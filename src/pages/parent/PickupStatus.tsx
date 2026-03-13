import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    CheckCircle, ShieldCheck, Bell, School,
    User, Info, Loader2, Navigation, Activity, Wifi, MapPin
} from 'lucide-react';
import GeoTracker from '../../components/parent/GeoTracker';
import { useToast } from '../../components/ui/Toast';

type StudentData = {
    id: string;
    nome_completo: string;
    foto_url: string | null;
    turma: string;
    escola_id: string;
};

type PickupData = {
    id: string;
    status: string;
    horario_solicitacao: string;
    mensagem_sala?: string;
    mensagem_recepcao?: string;
};

// ── Design tokens ─────────────────────────────────────────────────────────
const token = {
    bgDeep: '#070a13',
    bgGlass: 'rgba(17, 24, 43, 0.65)',
    bgBadge: 'rgba(17, 24, 43, 0.85)',
    cyan: '#47b8ff',
    gold: '#c79e61',
    bluePrimary: '#3174f1',
    blueHover: '#4e8eff',
    textMain: '#FFFFFF',
    textMuted: '#8491A2',
    borderMuted: 'rgba(255,255,255,0.05)',
    cyanBorder: 'rgba(71,184,255,0.55)',
    goldBorder: 'rgba(199,158,97,0.55)',
} as const;

const glassPanel: React.CSSProperties = {
    background: token.bgGlass,
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: 'inset 0 0 10px rgba(255,255,255,0.02), 0 4px 20px rgba(0,0,0,0.28)',
};

const badgeStyle: React.CSSProperties = {
    background: token.bgBadge,
    border: `1px solid ${token.borderMuted}`,
    borderRadius: '30px',
    padding: '8px 16px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.8px',
    color: token.textMuted,
};

// Gradient-bordered wrapper
function GlassCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
        <div className="relative w-full" style={{ borderRadius: 14, ...style }}>
            <div
                className="absolute"
                style={{
                    inset: -2, borderRadius: 14,
                    background: `linear-gradient(135deg, ${token.cyanBorder} 0%, ${token.goldBorder} 100%)`,
                    filter: 'blur(4px)', opacity: 0.5, zIndex: 0,
                }}
            />
            <div style={{ ...glassPanel, borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', position: 'relative', zIndex: 1 }}>
                {children}
            </div>
        </div>
    );
}

export default function ParentPickupStatus() {
    const { id: studentId } = useParams();
    const navigate = useNavigate();
    const toast = useToast();

    const [student, setStudent]             = useState<StudentData | null>(null);
    const [pickup, setPickup]               = useState<PickupData | null>(null);
    const [loading, setLoading]             = useState(true);
    const [requesting, setRequesting]       = useState(false);
    const [guardianName, setGuardianName]   = useState('Responsável');
    const [guardianId, setGuardianId]       = useState<string | undefined>(undefined);
    const [accessDenied, setAccessDenied]   = useState(false);

    const requestingRef  = useRef(false);
    // Null-debounce: require 2 consecutive null results before tearing down
    // GeoTracker. Prevents a transient DB miss (realtime event or 5s poll)
    // from unmounting GeoTracker and resetting the tracking button to ATIVAR.
    const nullCountRef   = useRef(0);

    // ── Session validation ────────────────────────────────────────────────
    useEffect(() => {
        const session = localStorage.getItem('sisra_parent_session');
        if (!session) { navigate('/parent/login'); return; }

        let parsed: { id?: string; nome?: string };
        try { parsed = JSON.parse(session); } catch { navigate('/parent/login'); return; }

        if (!parsed.id || !parsed.nome) { navigate('/parent/login'); return; }

        const firstName = parsed.nome.split(' ')[0];
        setGuardianName(`${firstName} (Responsável)`);
        setGuardianId(parsed.id);

        if (studentId) {
            loadInitialData(parsed.id);

            const channel = supabase
                .channel(`pickup_status_${studentId}`)
                .on('postgres_changes', {
                    event: '*', schema: 'public',
                    table: 'solicitacoes_retirada',
                    filter: `aluno_id=eq.${studentId}`,
                }, fetchPickupStatus)
                .subscribe();

            const interval = setInterval(fetchPickupStatus, 5000);
            return () => { supabase.removeChannel(channel); clearInterval(interval); };
        }
    }, [studentId]);

    const loadInitialData = async (gId: string) => {
        setLoading(true);
        try {
            const { data: link, error: linkErr } = await supabase
                .from('alunos_responsaveis')
                .select('aluno_id')
                .eq('responsavel_id', gId)
                .eq('aluno_id', studentId)
                .maybeSingle();

            if (linkErr || !link) { setAccessDenied(true); return; }

            const { data: studentData, error: studentErr } = await supabase
                .from('alunos')
                .select('id, nome_completo, foto_url, turma, escola_id')
                .eq('id', studentId)
                .single();

            if (studentErr || !studentData) throw studentErr;
            setStudent(studentData);
            await fetchPickupStatus();
        } catch {
            // fail silently
        } finally {
            setLoading(false);
        }
    };

    const fetchPickupStatus = async () => {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        try {
            const { data, error } = await supabase
                .from('solicitacoes_retirada')
                .select('id, status, mensagem_sala, mensagem_recepcao, horario_solicitacao')
                .eq('aluno_id', studentId)
                .is('horario_confirmacao', null)
                .neq('status', 'CANCELADO')
                .gte('horario_solicitacao', todayStart.toISOString())
                .order('horario_solicitacao', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!error) {
                if (data) {
                    nullCountRef.current = 0;
                    setPickup(data as PickupData);
                } else {
                    nullCountRef.current += 1;
                    // Only clear pickup (and unmount GeoTracker) after 2 consecutive
                    // null results — guards against a single transient query miss.
                    if (nullCountRef.current >= 2) setPickup(null);
                }
            }
        } catch { /* ignore */ }
    };

    const handleRequestPickup = async () => {
        if (!student || requestingRef.current) return;
        requestingRef.current = true;
        setRequesting(true);
        try {
            const session = localStorage.getItem('sisra_parent_session');
            const sessionData = session ? JSON.parse(session) : null;

            // Guard against duplicates: must mirror fetchPickupStatus filters exactly.
            // Only treat a request as "already active" if it is open (horario_confirmacao IS NULL)
            // and not cancelled — same conditions used to display the status screen.
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const { data: existing } = await supabase
                .from('solicitacoes_retirada')
                .select('id')
                .eq('aluno_id', student.id)
                .neq('status', 'CANCELADO')
                .is('horario_confirmacao', null)
                .gte('horario_solicitacao', todayStart.toISOString())
                .limit(1)
                .maybeSingle();

            if (existing) {
                // Already has an active request — just refresh the status view
                await fetchPickupStatus();
                return;
            }

            const { error } = await supabase
                .from('solicitacoes_retirada')
                .insert({
                    aluno_id: student.id,
                    status: 'SOLICITADO',
                    escola_id: student.escola_id,
                    responsavel_id: sessionData?.id ?? null,
                    tipo_solicitacao: 'ROTINA',
                });

            if (error) { toast.error('Erro ao solicitar', error.message); }
            else { await fetchPickupStatus(); }
        } catch {
            toast.error('Erro ao solicitar', 'Tente novamente.');
        } finally {
            requestingRef.current = false;
            setRequesting(false);
        }
    };

    // ── Common page shell ─────────────────────────────────────────────────
    const Shell = ({ children }: { children: React.ReactNode }) => (
        <div
            className="min-h-screen w-full relative overflow-hidden"
            style={{ backgroundColor: token.bgDeep, fontFamily: "'Inter', sans-serif" }}
        >
            <div className="fixed inset-0 pointer-events-none" style={{
                backgroundImage: `radial-gradient(circle at 10% 10%, #1a2540 0%, transparent 40%), radial-gradient(circle at 90% 90%, #0d121f 0%, transparent 40%)`,
                zIndex: 0,
            }} />
            <div className="fixed inset-0 pointer-events-none" style={{
                backgroundImage: `repeating-linear-gradient(rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 15px)`,
                backgroundSize: '15px 15px', zIndex: 0,
            }} />
            {children}
        </div>
    );

    // ── Access denied ─────────────────────────────────────────────────────
    if (accessDenied) {
        return (
            <Shell>
                <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
                    <GlassCard style={{ maxWidth: 360 }}>
                        <div style={{ padding: '40px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                            <div style={{ width: 64, height: 64, background: 'rgba(239,68,68,0.12)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(239,68,68,0.25)' }}>
                                <ShieldCheck style={{ width: 30, height: 30, color: '#f87171' }} />
                            </div>
                            <div>
                                <p style={{ color: token.textMain, fontSize: 18, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.3px' }}>Acesso não autorizado</p>
                                <p style={{ color: token.textMuted, fontSize: 13, marginTop: 8 }}>Você não tem permissão para visualizar este aluno.</p>
                            </div>
                            <button
                                onClick={() => navigate('/parent/login')}
                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 24px', color: token.textMuted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', cursor: 'pointer' }}
                            >
                                Voltar ao Login
                            </button>
                        </div>
                    </GlassCard>
                </div>
            </Shell>
        );
    }

    // ── Loading ───────────────────────────────────────────────────────────
    if (loading) {
        return (
            <Shell>
                <div className="relative z-10 min-h-screen flex items-center justify-center">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                        <Loader2 style={{ width: 36, height: 36, color: token.cyan }} className="animate-spin" />
                        <p style={{ color: token.textMuted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px' }}>CARREGANDO PROTOCOLO...</p>
                    </div>
                </div>
            </Shell>
        );
    }

    // ── Student not found ─────────────────────────────────────────────────
    if (!student) {
        return (
            <Shell>
                <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
                    <p style={{ color: token.textMuted, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px' }}>Aluno não encontrado.</p>
                </div>
            </Shell>
        );
    }

    // ── No active pickup — request screen ─────────────────────────────────
    if (!pickup) {
        return (
            <Shell>
                <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-5">
                    <GlassCard style={{ maxWidth: 400 }}>
                        <div style={{ padding: 'clamp(28px,6vw,44px) clamp(20px,5vw,36px)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, textAlign: 'center' }}>

                            {/* Badge */}
                            <div style={badgeStyle}>
                                <Activity style={{ width: 14, height: 14, color: token.cyan }} />
                                PROTOCOLO DISPONÍVEL
                            </div>

                            {/* Student avatar */}
                            <div style={{ position: 'relative', width: 96, height: 96 }}>
                                <div style={{ position: 'absolute', inset: -12, background: `rgba(71,184,255,0.12)`, borderRadius: '50%', filter: 'blur(18px)' }} />
                                <div style={{ position: 'relative', width: 96, height: 96, borderRadius: 20, overflow: 'hidden', border: `2px solid ${token.cyan}`, boxShadow: `0 0 20px rgba(71,184,255,0.2)` }}>
                                    {student.foto_url ? (
                                        <img src={student.foto_url} alt={student.nome_completo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', background: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <User style={{ width: 36, height: 36, color: '#4b5563' }} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <p style={{ fontSize: 11, fontWeight: 700, color: token.cyan, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 6 }}>
                                    IDENTIFICADO
                                </p>
                                <h2 style={{ fontSize: 'clamp(22px,5vw,28px)', fontWeight: 700, color: token.textMain, textTransform: 'uppercase', letterSpacing: '-0.5px', marginBottom: 10 }}>
                                    {student.nome_completo.split(' ')[0]}
                                </h2>
                                <div style={{ ...badgeStyle, justifyContent: 'center', borderRadius: 30, padding: '6px 14px' }}>
                                    <Activity style={{ width: 12, height: 12, color: '#34d399' }} />
                                    <span style={{ color: token.textMuted }}>Turma: {student.turma}</span>
                                </div>
                            </div>

                            <p style={{ color: token.textMuted, fontSize: 13, lineHeight: 1.7 }}>
                                Toque no botão abaixo para notificar que você está a caminho do colégio.
                            </p>

                            {/* Request button */}
                            <button
                                onClick={handleRequestPickup}
                                disabled={requesting}
                                className="w-full flex items-center justify-center transition-all"
                                style={{
                                    borderRadius: 30,
                                    background: `linear-gradient(135deg, ${token.bluePrimary} 0%, ${token.blueHover} 100%)`,
                                    border: 'none', padding: '18px 24px',
                                    fontSize: 14, fontWeight: 700,
                                    color: token.textMain, textTransform: 'uppercase',
                                    letterSpacing: '1.2px', gap: 12,
                                    cursor: requesting ? 'not-allowed' : 'pointer',
                                    opacity: requesting ? 0.6 : 1,
                                    boxShadow: '0 4px 18px rgba(49,116,241,0.32)',
                                }}
                            >
                                {requesting
                                    ? <><Loader2 style={{ width: 20, height: 20 }} className="animate-spin" /> ENVIANDO...</>
                                    : <><Navigation style={{ width: 20, height: 20 }} /> SOLICITAR RETIRADA</>
                                }
                            </button>

                            <button
                                onClick={() => window.history.back()}
                                style={{ background: 'none', border: 'none', color: token.textMuted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', cursor: 'pointer' }}
                            >
                                Cancelar
                            </button>
                        </div>
                    </GlassCard>

                    {/* Footer */}
                    <div style={{ marginTop: 32, fontSize: 10, fontWeight: 700, color: 'rgba(132,145,162,0.4)', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center' }}>
                        SISRA // Sistema de Retirada Segura
                    </div>
                </div>
            </Shell>
        );
    }

    // ── Active pickup — live tracker ──────────────────────────────────────
    const getStatusStep = (s: string) => {
        switch (s) {
            case 'SOLICITADO': case 'AGUARDANDO': return 1;
            case 'LIBERADO':   return 2;
            case 'CONFIRMADO': return 3;
            case 'FINALIZADO': return 4;
            default:           return 1;
        }
    };

    const currentStep = getStatusStep(pickup.status);

    const timelineSteps = [
        { label: 'Solicitação Recebida', sub: new Date(pickup.horario_solicitacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), icon: CheckCircle, step: 1, activeColor: '#34d399' },
        { label: 'Liberado — A Caminho', sub: 'Aluno encaminhado para a saída', icon: Activity, step: 2, activeColor: token.cyan },
        { label: 'Na Recepção', sub: currentStep >= 3 ? 'Aguardando na Recepção' : 'Aguardando Liberação', icon: MapPin, step: 3, activeColor: '#34d399' },
    ];

    return (
        <Shell>
            {/* Sticky Header */}
            <header
                className="sticky top-0 z-50"
                style={{ background: 'rgba(7,10,19,0.88)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
            >
                <div style={{ maxWidth: 520, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ position: 'relative' }}>
                            <Activity style={{ width: 20, height: 20, color: token.cyan }} className="animate-pulse" />
                            <div style={{ position: 'absolute', inset: -4, background: `rgba(71,184,255,0.18)`, borderRadius: '50%', filter: 'blur(6px)' }} />
                        </div>
                        <span style={{ fontWeight: 700, fontSize: 16, color: token.textMain, textTransform: 'uppercase', letterSpacing: '-0.3px' }}>
                            Telemetria Live
                        </span>
                    </div>
                    <div style={{ ...badgeStyle, padding: '6px 14px', gap: 8, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <Wifi style={{ width: 12, height: 12, color: '#34d399' }} className="animate-pulse" />
                        <span style={{ color: '#34d399', fontSize: 10 }}>SINAL ATIVO</span>
                    </div>
                </div>
            </header>

            <main style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px 48px', display: 'flex', flexDirection: 'column', gap: 20, position: 'relative', zIndex: 10 }}>

                {/* School label */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ background: 'rgba(49,116,241,0.15)', padding: 12, borderRadius: 12, border: '1px solid rgba(49,116,241,0.25)' }}>
                            <School style={{ color: token.cyan, width: 22, height: 22 }} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: 18, fontWeight: 700, color: token.textMain, textTransform: 'uppercase', letterSpacing: '-0.3px' }}>La Salle, Cheguei!</h1>
                            <p style={{ fontSize: 10, fontWeight: 700, color: token.textMuted, textTransform: 'uppercase', letterSpacing: '1.5px', marginTop: 2 }}>Acompanhamento em Tempo Real</p>
                        </div>
                    </div>
                    <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 10 }}>
                        <Bell style={{ width: 22, height: 22, color: token.textMuted }} />
                    </button>
                </div>

                {/* Main Status Card */}
                <GlassCard>
                    <div style={{ padding: 'clamp(20px,5vw,32px)' }}>
                        {/* Student info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                <div style={{ position: 'absolute', inset: -6, background: `rgba(71,184,255,0.15)`, borderRadius: 24, filter: 'blur(10px)' }} />
                                {student.foto_url ? (
                                    <img src={student.foto_url} alt="Estudante" style={{ width: 72, height: 72, borderRadius: 16, objectFit: 'cover', border: '2px solid rgba(255,255,255,0.15)', position: 'relative', zIndex: 1 }} />
                                ) : (
                                    <div style={{ width: 72, height: 72, borderRadius: 16, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.08)', position: 'relative', zIndex: 1 }}>
                                        <User style={{ width: 28, height: 28, color: '#374151' }} />
                                    </div>
                                )}
                                <div style={{ position: 'absolute', bottom: -6, right: -6, background: '#10b981', borderRadius: 8, padding: 5, border: '2px solid #070a13', zIndex: 2 }}>
                                    <CheckCircle style={{ width: 14, height: 14, color: '#fff' }} />
                                </div>
                            </div>
                            <div>
                                <h2 style={{ fontSize: 'clamp(18px,5vw,22px)', fontWeight: 700, color: token.textMain, textTransform: 'uppercase', letterSpacing: '-0.3px' }}>
                                    {student.nome_completo.split(' ')[0]}
                                </h2>
                                <p style={{ fontSize: 10, fontWeight: 700, color: token.textMuted, textTransform: 'uppercase', letterSpacing: '1px', marginTop: 3 }}>{student.turma}</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                                    <div style={{ width: 8, height: 8, background: token.cyan, borderRadius: '50%' }} className="animate-ping" />
                                    <span style={{ fontSize: 11, fontWeight: 700, color: token.cyan, textTransform: 'uppercase', letterSpacing: '1px' }}>STATUS: {pickup.status}</span>
                                </div>
                            </div>
                        </div>

                        {/* Alert — sala message */}
                        {pickup.mensagem_sala && (
                            <div style={{ marginBottom: 24, padding: '14px 18px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                <div style={{ background: 'rgba(245,158,11,0.15)', borderRadius: 8, padding: 8, flexShrink: 0 }}>
                                    <Bell style={{ width: 16, height: 16, color: '#f59e0b' }} />
                                </div>
                                <div>
                                    <p style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 5, opacity: 0.8 }}>Mensagem da Sala</p>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: '#fde68a', fontStyle: 'italic' }}>"{pickup.mensagem_sala}"</p>
                                </div>
                            </div>
                        )}

                        {/* Timeline */}
                        <div style={{ position: 'relative', paddingLeft: 12 }}>
                            {/* Vertical line */}
                            <div style={{ position: 'absolute', left: 22, top: 12, bottom: 12, width: 2, background: 'rgba(255,255,255,0.05)' }} />

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                                {timelineSteps.map(({ label, sub, icon: Icon, step, activeColor }) => {
                                    const active = currentStep >= step;
                                    return (
                                        <div key={step} style={{ display: 'flex', alignItems: 'flex-start', gap: 20, position: 'relative' }}>
                                            <div
                                                style={{
                                                    width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    background: active ? activeColor : '#0f172a',
                                                    border: `2px solid ${active ? activeColor : 'rgba(255,255,255,0.08)'}`,
                                                    transform: active ? 'rotate(45deg)' : 'none',
                                                    boxShadow: active ? `0 0 12px ${activeColor}44` : 'none',
                                                    transition: 'all 0.5s ease',
                                                    zIndex: 1,
                                                }}
                                            >
                                                <Icon style={{ width: 14, height: 14, color: active ? '#000' : '#374151', transform: active ? 'rotate(-45deg)' : 'none', transition: 'all 0.5s ease' }} />
                                            </div>
                                            <div>
                                                <p style={{ fontSize: 12, fontWeight: 700, color: active ? token.textMain : '#374151', textTransform: 'uppercase', letterSpacing: '0.8px', fontStyle: 'italic' }}>{label}</p>
                                                <p style={{ fontSize: 10, fontWeight: 600, color: active ? activeColor : '#374151', marginTop: 3, fontFamily: 'monospace', letterSpacing: '0.5px' }}>{sub}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </GlassCard>

                {/* GeoTracker */}
                <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: -1, borderRadius: 14, background: `linear-gradient(135deg, ${token.cyanBorder} 0%, ${token.goldBorder} 100%)`, filter: 'blur(3px)', opacity: 0.35 }} />
                    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
                        <GeoTracker pickupId={pickup.id} escolaId={student.escola_id} guardianId={guardianId} />
                    </div>
                </div>

                {/* Manual arrival confirmation */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <button
                        onClick={async () => {
                            const todayStart = new Date();
                            todayStart.setHours(0, 0, 0, 0);

                            const filter = guardianId
                                ? supabase
                                    .from('solicitacoes_retirada')
                                    .update({ status_geofence: 'CHEGOU', distancia_estimada_metros: 0 })
                                    .eq('responsavel_id', guardianId)
                                    .in('status', ['SOLICITADO', 'AGUARDANDO', 'LIBERADO'])
                                    .gte('horario_solicitacao', todayStart.toISOString())
                                : supabase
                                    .from('solicitacoes_retirada')
                                    .update({ status_geofence: 'CHEGOU', distancia_estimada_metros: 0 })
                                    .eq('id', pickup.id);

                            const { error } = await filter;
                            if (!error) {
                                toast.success('Chegada confirmada!', 'A escola foi notificada da sua chegada.');
                                fetchPickupStatus();
                            }
                        }}
                        className="w-full flex items-center justify-center transition-all"
                        style={{
                            borderRadius: 30,
                            background: 'linear-gradient(135deg, #059669 0%, #34d399 100%)',
                            border: 'none', padding: '18px 24px',
                            fontSize: 13, fontWeight: 700,
                            color: '#022c22', textTransform: 'uppercase',
                            letterSpacing: '1.5px', gap: 12, cursor: 'pointer',
                            boxShadow: '0 4px 18px rgba(52,211,153,0.25)',
                        }}
                    >
                        <CheckCircle style={{ width: 20, height: 20 }} />
                        Confirmar Chegada Manualmente
                    </button>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(132,145,162,0.45)', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center', lineHeight: 1.7 }}>
                        Use esta opção caso o GPS esteja indisponível ou você já esteja no local.
                    </p>
                </div>

                {/* Security verification */}
                <GlassCard>
                    <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ background: 'rgba(52,211,153,0.1)', borderRadius: 8, padding: 8, border: '1px solid rgba(52,211,153,0.2)' }}>
                                <ShieldCheck style={{ width: 18, height: 18, color: '#34d399' }} />
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, color: token.textMuted, textTransform: 'uppercase', letterSpacing: '1.2px' }}>Verificação de Segurança</span>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 10, padding: '16px 18px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
                                    <User style={{ width: 22, height: 22, color: '#374151' }} />
                                </div>
                                <div>
                                    <p style={{ fontSize: 10, fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 3, opacity: 0.8 }}>Responsável Autorizado</p>
                                    <p style={{ fontSize: 14, fontWeight: 700, color: token.textMain, textTransform: 'uppercase', letterSpacing: '-0.2px' }}>{guardianName}</p>
                                </div>
                            </div>
                            <CheckCircle style={{ width: 22, height: 22, color: '#34d399', flexShrink: 0 }} />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, opacity: 0.5 }}>
                            <Info style={{ width: 14, height: 14, color: token.cyan, flexShrink: 0, marginTop: 1 }} />
                            <p style={{ fontSize: 10, fontWeight: 600, color: token.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px', lineHeight: 1.7, fontStyle: 'italic' }}>
                                Apresente seu QR Code na recepção para concluir a retirada com segurança.
                            </p>
                        </div>
                    </div>
                </GlassCard>

                {/* Footer */}
                <footer style={{ textAlign: 'center', paddingTop: 16, paddingBottom: 32, opacity: 0.3 }}>
                    <div style={{ height: 1, background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent)', marginBottom: 16 }} />
                    <p style={{ fontSize: 10, fontWeight: 700, color: token.textMuted, textTransform: 'uppercase', letterSpacing: '2px' }}>
                        SISRA // Sistema de Retirada Segura
                    </p>
                </footer>
            </main>
        </Shell>
    );
}
