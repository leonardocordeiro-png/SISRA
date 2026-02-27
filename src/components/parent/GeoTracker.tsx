import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Navigation, MapPin, Wifi, WifiOff, Loader2 } from 'lucide-react';

// Geofence thresholds (meters)
const RADIUS_CHEGOU = 150;  // Within 150m → "CHEGOU" (was 50m, too tight for urban GPS)
const RADIUS_PERTO = 600;  // Within 600m → "PERTO"

// Debounce interval: write to Supabase at most once every 5 seconds
const DEBOUNCE_MS = 5000;

// Haversine formula – returns distance in meters between two lat/lng points
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth radius in meters
    const toRad = (deg: number) => deg * (Math.PI / 180);
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function classifyDistance(meters: number): 'CHEGOU' | 'PERTO' | 'LONGE' {
    if (meters < RADIUS_CHEGOU) return 'CHEGOU';
    if (meters < RADIUS_PERTO) return 'PERTO';
    return 'LONGE';
}

interface SchoolCoords {
    latitude: number;
    longitude: number;
    nome: string;
}

export default function GeoTracker({ pickupId, escolaId, guardianId }: { pickupId: string; escolaId?: string; guardianId?: string }) {
    const [tracking, setTracking] = useState(false);
    const [distance, setDistance] = useState<number | null>(null);
    const [geofence, setGeofence] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [school, setSchool] = useState<SchoolCoords | null>(null);
    const [loadingSchool, setLoadingSchool] = useState(false);

    // Debounce ref: holds the timestamp of the last Supabase write
    const lastWriteRef = useRef<number>(0);

    // ──────────────────────────────────────────────
    // Load school coordinates from the `escolas` table
    // ──────────────────────────────────────────────
    useEffect(() => {
        async function fetchSchool() {
            setLoadingSchool(true);
            try {
                let query = supabase
                    .from('escolas')
                    .select('nome, latitude, longitude');

                if (escolaId) {
                    query = query.eq('id', escolaId);
                }

                const { data, error: dbErr } = await query.limit(1).single();

                if (dbErr || !data) {
                    // Fallback: use hardcoded La Salle Sobradinho coordinates
                    setSchool({
                        latitude: -15.650972,
                        longitude: -47.782111,
                        nome: 'La Salle Sobradinho'
                    });
                    return;
                }

                if (data.latitude && data.longitude) {
                    setSchool({
                        latitude: data.latitude,
                        longitude: data.longitude,
                        nome: data.nome ?? 'Colégio'
                    });
                } else {
                    // Columns exist but are null – use hardcoded fallback
                    setSchool({
                        latitude: -15.650972,
                        longitude: -47.782111,
                        nome: data.nome ?? 'La Salle Sobradinho'
                    });
                }
            } catch {
                setSchool({
                    latitude: -15.650972,
                    longitude: -47.782111,
                    nome: 'La Salle Sobradinho'
                });
            } finally {
                setLoadingSchool(false);
            }
        }

        fetchSchool();
    }, [escolaId]);

    // ──────────────────────────────────────────────
    // Debounced writer to Supabase
    // ──────────────────────────────────────────────
    const writeToSupabase = useCallback(async (
        dist: number, lat: number, lng: number, status: string
    ) => {
        const now = Date.now();
        if (now - lastWriteRef.current < DEBOUNCE_MS) return;
        lastWriteRef.current = now;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (guardianId) {
            // Update basic telemetry for all active requests
            await supabase
                .from('solicitacoes_retirada')
                .update({
                    latitude: lat,
                    longitude: lng,
                    distancia_estimada_metros: Math.round(dist)
                })
                .eq('responsavel_id', guardianId)
                .in('status', ['SOLICITADO', 'AGUARDANDO', 'LIBERADO'])
                .gte('horario_solicitacao', today.toISOString());

            // Update status_geofence only if it's not already 'CHEGOU'
            // or if the new status IS 'CHEGOU' (upgrade)
            if (status === 'CHEGOU') {
                await supabase
                    .from('solicitacoes_retirada')
                    .update({ status_geofence: 'CHEGOU' })
                    .eq('responsavel_id', guardianId)
                    .in('status', ['SOLICITADO', 'AGUARDANDO', 'LIBERADO'])
                    .gte('horario_solicitacao', today.toISOString());
            } else {
                await supabase
                    .from('solicitacoes_retirada')
                    .update({ status_geofence: status })
                    .eq('responsavel_id', guardianId)
                    .in('status', ['SOLICITADO', 'AGUARDANDO', 'LIBERADO'])
                    .neq('status_geofence', 'CHEGOU')
                    .gte('horario_solicitacao', today.toISOString());
            }
        } else {
            // Fallback to single request update if guardianId is missing
            // 1. Fetch current status to avoid overwriting "CHEGOU"
            const { data: currentReq } = await supabase
                .from('solicitacoes_retirada')
                .select('status_geofence')
                .eq('id', pickupId)
                .single();

            const finalStatus = currentReq?.status_geofence === 'CHEGOU' ? 'CHEGOU' : status;

            await supabase
                .from('solicitacoes_retirada')
                .update({
                    latitude: lat,
                    longitude: lng,
                    distancia_estimada_metros: Math.round(dist),
                    status_geofence: finalStatus
                })
                .eq('id', pickupId);
        }
    }, [pickupId, guardianId]);

    // ──────────────────────────────────────────────
    // GPS watchPosition
    // ──────────────────────────────────────────────
    useEffect(() => {
        if (!tracking || !school) return;

        if (!navigator.geolocation) {
            setError('GPS não disponível neste dispositivo.');
            return;
        }

        setError(null);

        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                const dist = haversineMeters(latitude, longitude, school.latitude, school.longitude);
                const status = classifyDistance(dist);

                setDistance(Math.round(dist));
                setGeofence(status);
                writeToSupabase(dist, latitude, longitude, status);
            },
            (err) => {
                setError(`Erro de GPS: ${err.message}`);
            },
            {
                enableHighAccuracy: true,   // Use GPS de alta precisão
                timeout: 15000,
                maximumAge: 3000            // Aceitar posição de até 3s atrás
            }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, [tracking, school, writeToSupabase]);

    // ──────────────────────────────────────────────
    // Geofence label helpers
    // ──────────────────────────────────────────────
    const geofenceLabel = () => {
        if (!geofence) return null;
        const cfg = {
            CHEGOU: { text: 'Na Área do Colégio', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
            PERTO: { text: 'Próximo ao Colégio', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
            LONGE: { text: 'Em Trânsito', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
        }[geofence] ?? { text: geofence, color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' };
        return cfg;
    };

    const label = geofenceLabel();

    // ──────────────────────────────────────────────
    // UI
    // ──────────────────────────────────────────────
    return (
        <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${tracking ? 'bg-emerald-500/20 text-emerald-400 animate-pulse' : 'bg-white/5 text-slate-500'
                        }`}>
                        <Navigation className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-xs font-black text-white uppercase tracking-widest italic">Modo "Estou Chegando"</p>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                            {loadingSchool ? 'Carregando...' : school ? school.nome : 'GPS Geofencing'}
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => setTracking(t => !t)}
                    disabled={loadingSchool}
                    className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 ${tracking
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30'
                        : 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400'
                        }`}
                >
                    {loadingSchool ? <Loader2 className="w-3 h-3 animate-spin" /> : tracking ? 'Parar' : 'Ativar'}
                </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
                {/* Distance display */}
                {tracking && (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <MapPin className="w-4 h-4 text-blue-400" />
                            <span className="text-sm font-black text-white italic">
                                {distance !== null ? `${distance.toLocaleString('pt-BR')} m` : 'Calculando...'}
                            </span>
                        </div>
                        {label && (
                            <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${label.bg} ${label.color}`}>
                                {label.text}
                            </span>
                        )}
                    </div>
                )}

                {/* Status row */}
                <div className="flex items-center gap-2">
                    {tracking
                        ? <Wifi className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                        : <WifiOff className="w-3.5 h-3.5 text-slate-600" />
                    }
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                        {tracking
                            ? distance !== null
                                ? `Atualizando a cada ${DEBOUNCE_MS / 1000}s • Alta precisão GPS`
                                : 'Aguardando sinal de GPS...'
                            : 'Ative para notificar automaticamente sua chegada'}
                    </p>
                </div>

                {/* Error display */}
                {error && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                        <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">{error}</p>
                    </div>
                )}

                {/* Geofence guide */}
                {!tracking && (
                    <div className="grid grid-cols-3 gap-2 pt-1">
                        {[
                            { label: 'Na escola', range: `< ${RADIUS_CHEGOU}m`, color: 'text-emerald-400' },
                            { label: 'Próximo', range: `< ${RADIUS_PERTO}m`, color: 'text-amber-400' },
                            { label: 'Em trânsito', range: `> ${RADIUS_PERTO}m`, color: 'text-blue-400' },
                        ].map(z => (
                            <div key={z.label} className="bg-white/[0.02] rounded-xl p-2.5 text-center border border-white/5">
                                <p className={`text-[8px] font-black uppercase tracking-widest ${z.color}`}>{z.label}</p>
                                <p className="text-[8px] text-slate-500 font-bold mt-0.5">{z.range}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
