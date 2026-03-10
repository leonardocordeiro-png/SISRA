import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Navigation, MapPin, Wifi, WifiOff, Loader2, AlertTriangle, ShieldOff, SatelliteDish } from 'lucide-react';

// ── Geofence thresholds (meters) ──────────────────────────────────────────────
const RADIUS_CHEGOU = 150;
const RADIUS_PERTO  = 600;

// Supabase write debounce: at most once per 5 seconds
const DEBOUNCE_MS = 5000;

// ── Haversine distance ─────────────────────────────────────────────────────────
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function classifyDistance(meters: number): 'CHEGOU' | 'PERTO' | 'LONGE' {
    if (meters < RADIUS_CHEGOU) return 'CHEGOU';
    if (meters < RADIUS_PERTO)  return 'PERTO';
    return 'LONGE';
}

// ── Error diagnosis ────────────────────────────────────────────────────────────
type GeoErrorInfo = { title: string; message: string; hint: string };

function diagnoseGeoError(err: GeolocationPositionError): GeoErrorInfo {
    // Code 1 = PERMISSION_DENIED — can be user denial OR Permissions-Policy header
    if (err.code === err.PERMISSION_DENIED) {
        if (err.message.toLowerCase().includes('permissions policy') ||
            err.message.toLowerCase().includes('permission policy')) {
            return {
                title: 'GPS bloqueado pelo servidor',
                message: 'A localização foi desativada por uma configuração do servidor. Contate o suporte da escola.',
                hint: 'Use o botão "Confirmar Chegada" abaixo como alternativa.',
            };
        }
        return {
            title: 'Permissão de localização negada',
            message: 'Você recusou o acesso à localização. Para ativar: Configurações do navegador → Privacidade → Localização → Permitir para este site.',
            hint: 'Ou use o botão "Confirmar Chegada" manualmente.',
        };
    }
    if (err.code === err.POSITION_UNAVAILABLE) {
        return {
            title: 'Sinal de GPS indisponível',
            message: 'Não foi possível obter sua posição. Verifique se o GPS/Localização está ativo no dispositivo.',
            hint: 'Tente em área aberta ou use o botão "Confirmar Chegada".',
        };
    }
    if (err.code === err.TIMEOUT) {
        return {
            title: 'GPS sem resposta',
            message: 'O sinal de localização demorou muito para responder. Verifique sua conexão e as permissões de localização.',
            hint: 'Tente novamente ou use o botão "Confirmar Chegada".',
        };
    }
    return {
        title: 'Erro de localização',
        message: err.message,
        hint: 'Use o botão "Confirmar Chegada" como alternativa.',
    };
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface SchoolCoords {
    latitude: number;
    longitude: number;
    nome: string;
}

interface Props {
    pickupId: string;
    escolaId?: string;
    guardianId?: string;
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function GeoTracker({ pickupId, escolaId, guardianId }: Props) {
    const [tracking, setTracking]       = useState(false);
    const [distance, setDistance]       = useState<number | null>(null);
    const [geofence, setGeofence]       = useState<string | null>(null);
    const [geoError, setGeoError]       = useState<GeoErrorInfo | null>(null);
    const [school, setSchool]           = useState<SchoolCoords | null>(null);
    const [loadingSchool, setLoadingSchool] = useState(false);

    const lastWriteRef = useRef<number>(0);
    const watchIdRef   = useRef<number | null>(null);

    // ── Load school coords ────────────────────────────────────────────────────
    useEffect(() => {
        async function fetchSchool() {
            setLoadingSchool(true);
            try {
                let query = supabase.from('escolas').select('nome, latitude, longitude');
                if (escolaId) query = query.eq('id', escolaId);
                const { data, error } = await query.limit(1).single();

                const fallback: SchoolCoords = {
                    latitude: -15.650972,
                    longitude: -47.782111,
                    nome: 'La Salle Sobradinho',
                };

                if (error || !data || !data.latitude || !data.longitude) {
                    setSchool({ ...fallback, nome: data?.nome ?? fallback.nome });
                } else {
                    setSchool({ latitude: data.latitude, longitude: data.longitude, nome: data.nome ?? 'Colégio' });
                }
            } catch {
                setSchool({ latitude: -15.650972, longitude: -47.782111, nome: 'La Salle Sobradinho' });
            } finally {
                setLoadingSchool(false);
            }
        }
        fetchSchool();
    }, [escolaId]);

    // ── Debounced Supabase writer ─────────────────────────────────────────────
    const writeToSupabase = useCallback(async (
        dist: number, lat: number, lng: number, status: string
    ) => {
        const now = Date.now();
        if (now - lastWriteRef.current < DEBOUNCE_MS) return;
        lastWriteRef.current = now;

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const baseUpdate = {
            latitude: lat,
            longitude: lng,
            distancia_estimada_metros: Math.round(dist),
        };

        if (guardianId) {
            // Update telemetry for all active requests of this guardian today
            await supabase
                .from('solicitacoes_retirada')
                .update(baseUpdate)
                .eq('responsavel_id', guardianId)
                .in('status', ['SOLICITADO', 'AGUARDANDO', 'LIBERADO'])
                .gte('horario_solicitacao', todayStart.toISOString());

            // Only upgrade geofence status, never downgrade from CHEGOU
            if (status === 'CHEGOU') {
                await supabase
                    .from('solicitacoes_retirada')
                    .update({ status_geofence: 'CHEGOU' })
                    .eq('responsavel_id', guardianId)
                    .in('status', ['SOLICITADO', 'AGUARDANDO', 'LIBERADO'])
                    .gte('horario_solicitacao', todayStart.toISOString());
            } else {
                await supabase
                    .from('solicitacoes_retirada')
                    .update({ status_geofence: status })
                    .eq('responsavel_id', guardianId)
                    .in('status', ['SOLICITADO', 'AGUARDANDO', 'LIBERADO'])
                    .neq('status_geofence', 'CHEGOU')
                    .gte('horario_solicitacao', todayStart.toISOString());
            }
        } else {
            // Fallback: update the specific request, but never downgrade CHEGOU
            const { data: current } = await supabase
                .from('solicitacoes_retirada')
                .select('status_geofence')
                .eq('id', pickupId)
                .single();

            const finalStatus = current?.status_geofence === 'CHEGOU' ? 'CHEGOU' : status;

            await supabase
                .from('solicitacoes_retirada')
                .update({ ...baseUpdate, status_geofence: finalStatus })
                .eq('id', pickupId);
        }
    }, [pickupId, guardianId]);

    // ── Start / stop tracking ─────────────────────────────────────────────────
    const startTracking = useCallback(async () => {
        if (!school) return;

        setGeoError(null);

        // Never pre-check navigator.permissions here — doing so would prevent
        // the browser from showing its native permission dialog when state='prompt'.
        // Always call watchPosition directly; diagnose errors in the error callback.

        if (!navigator.geolocation) {
            setGeoError({
                title: 'GPS não disponível',
                message: 'Este dispositivo ou navegador não suporta geolocalização.',
                hint: 'Use o botão "Confirmar Chegada" manualmente.',
            });
            return;
        }

        const options: PositionOptions = {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 3000,
        };

        const onSuccess = (pos: GeolocationPosition) => {
            const { latitude, longitude } = pos.coords;
            const dist = haversineMeters(latitude, longitude, school.latitude, school.longitude);
            const status = classifyDistance(dist);
            setDistance(Math.round(dist));
            setGeofence(status);
            setGeoError(null);
            writeToSupabase(dist, latitude, longitude, status);
        };

        const onError = async (err: GeolocationPositionError) => {
            // Post-check permission state to refine the message shown to the user.
            // We do this AFTER the error, not before, so watchPosition always runs
            // and the browser can show its native permission dialog when needed.
            let info = diagnoseGeoError(err);
            if (err.code === err.PERMISSION_DENIED && navigator.permissions) {
                try {
                    const perm = await navigator.permissions.query({ name: 'geolocation' });
                    if (perm.state === 'denied') {
                        info = {
                            title: 'Permissão bloqueada no navegador',
                            message: 'O acesso à localização está bloqueado para este site. Para reativar: toque no ícone de cadeado/info na barra de endereço → Permissões → Localização → Permitir. Depois recarregue a página.',
                            hint: 'Ou use o botão "Confirmar Chegada" manualmente.',
                        };
                    }
                } catch { /* Permissions API indisponível — usar mensagem padrão */ }
            }
            setGeoError(info);
            setTracking(false);
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
        };

        watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, options);
        setTracking(true);
    }, [school, writeToSupabase]);

    const stopTracking = useCallback(() => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        setTracking(false);
        setDistance(null);
        setGeofence(null);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, []);

    // ── Geofence label ────────────────────────────────────────────────────────
    const GEOFENCE_CFG = {
        CHEGOU: { text: 'Na Área do Colégio', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
        PERTO:  { text: 'Próximo ao Colégio', color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
        LONGE:  { text: 'Em Trânsito',        color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20' },
    } as const;

    const label = geofence ? GEOFENCE_CFG[geofence as keyof typeof GEOFENCE_CFG] : null;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${tracking ? 'bg-emerald-500/20 text-emerald-400 animate-pulse' : 'bg-white/5 text-slate-500'}`}>
                        <Navigation className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-xs font-black text-white uppercase tracking-widest italic">Modo "Estou Chegando"</p>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                            {loadingSchool ? 'Carregando...' : school?.nome ?? 'GPS Geofencing'}
                        </p>
                    </div>
                </div>

                <button
                    onClick={tracking ? stopTracking : startTracking}
                    disabled={loadingSchool}
                    className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 ${
                        tracking
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30'
                            : 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400'
                    }`}
                >
                    {loadingSchool
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : tracking ? 'Parar' : 'Ativar'
                    }
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
                                {distance !== null
                                    ? distance >= 1000
                                        ? `${(distance / 1000).toFixed(1)} km`
                                        : `${distance.toLocaleString('pt-BR')} m`
                                    : 'Calculando...'
                                }
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
                                ? `Atualizando a cada ${DEBOUNCE_MS / 1000}s · Alta precisão`
                                : 'Aguardando sinal de GPS...'
                            : 'Ative para notificar sua chegada automaticamente'
                        }
                    </p>
                </div>

                {/* Error display */}
                {geoError && (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-2">
                        <div className="flex items-center gap-2">
                            {geoError.title.includes('bloqueado') || geoError.title.includes('servidor')
                                ? <ShieldOff className="w-4 h-4 text-rose-400 shrink-0" />
                                : geoError.title.includes('indisponível') || geoError.title.includes('sem sinal')
                                    ? <SatelliteDish className="w-4 h-4 text-rose-400 shrink-0" />
                                    : <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                            }
                            <p className="text-[11px] font-black text-rose-400 uppercase tracking-widest">{geoError.title}</p>
                        </div>
                        <p className="text-[11px] text-rose-300/80 leading-relaxed">{geoError.message}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{geoError.hint}</p>
                    </div>
                )}

                {/* Geofence guide (when idle) */}
                {!tracking && !geoError && (
                    <div className="grid grid-cols-3 gap-2 pt-1">
                        {[
                            { label: 'Na escola',  range: `< ${RADIUS_CHEGOU}m`,  color: 'text-emerald-400' },
                            { label: 'Próximo',    range: `< ${RADIUS_PERTO}m`,   color: 'text-amber-400' },
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
