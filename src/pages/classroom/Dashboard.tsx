import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
    Bell, Clock, LogOut, Check, X, User as UserIcon,
    Volume2, VolumeX, Send, AlertTriangle, MessageSquare,
    ChevronRight, School, Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import NavigationControls from '../../components/NavigationControls';
import PriorityPipeline from '../../components/classroom/PriorityPipeline';
import { useToast } from '../../components/ui/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────
type PickupRequest = {
    id: string;
    status: string;
    tipo_solicitacao: string;
    horario_solicitacao: string;
    aluno: {
        id: string;
        nome_completo: string;
        turma: string;
        sala: string;
        foto_url: string | null;
        observacoes: string | null;
    };
    responsavel?: {
        nome_completo: string;
        foto_url: string | null;
    } | null;
    mensagem_recepcao: string | null;
    status_geofence: string | null;
    distancia_estimada_metros: number | null;
};

// ─── Design tokens ────────────────────────────────────────────────────────────
const D = {
    indigoDark:  '#1E1B4B',
    indigo:      '#312E81',
    indigoMid:   '#4338CA',
    teal:        '#0D9488',
    tealLight:   '#F0FDFA',
    tealBorder:  '#99F6E4',
    amber:       '#D97706',
    amberLight:  '#FFFBEB',
    amberBorder: '#FCD34D',
    rose:        '#BE123C',
    roseLight:   '#FFF1F2',
    roseBorder:  '#FDA4AF',
    ink:         '#0F172A',
    inkMid:      '#475569',
    inkMuted:    '#94A3B8',
    border:      '#E2E8F0',
    surface:     '#F8FAFC',
    white:       '#FFFFFF',
    page:        '#F1F5F9',
};

// ─── Quick note presets ───────────────────────────────────────────────────────
const QUICK_NOTES = ['A caminho', 'Lanchando', 'No banheiro', 'Em atendimento'];

// ─────────────────────────────────────────────────────────────────────────────
export default function ClassroomDashboard() {
    const { user, signOut, role } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();

    const [requests, setRequests]             = useState<PickupRequest[]>([]);
    const [activeRequest, setActiveRequest]   = useState<PickupRequest | null>(null);
    const [soundEnabled, setSoundEnabled]     = useState(true);
    const [allClasses, setAllClasses]         = useState<string[]>([]);
    const [selectedClass, setSelectedClass]   = useState<string | 'TODAS'>('TODAS');
    const [customNote, setCustomNote]         = useState('');
    const [sendingNote, setSendingNote]       = useState(false);
    const [confirmPending, setConfirmPending] = useState<'AGUARDAR' | 'RECUSAR' | null>(null);
    const [escolaId, setEscolaId]             = useState<string | undefined>();
    const [mounted, setMounted]               = useState(false);

    // ── Font injection ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!document.getElementById('cls-dash-fonts')) {
            const link = document.createElement('link');
            link.id = 'cls-dash-fonts';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Nunito:wght@400;500;600;700;800;900&display=swap';
            document.head.appendChild(link);
        }
        setTimeout(() => setMounted(true), 80);
    }, []);

    // ── Fetch user class assignment ───────────────────────────────────────────
    useEffect(() => {
        if (user) {
            supabase
                .from('usuarios')
                .select('turma_atribuida, sala_atribuida, escola_id')
                .eq('id', user.id)
                .single()
                .then(({ data }) => {
                    if (data?.escola_id) setEscolaId(data.escola_id);
                    if (data?.sala_atribuida) {
                        setSelectedClass(data.sala_atribuida === 'TODAS' ? 'TODAS' : data.sala_atribuida);
                    } else if (data?.turma_atribuida) {
                        setSelectedClass(data.turma_atribuida);
                    } else if (role === 'ADMIN' || role === 'COORDENADOR') {
                        setSelectedClass('TODAS');
                    }
                });

            if (role === 'ADMIN' || role === 'COORDENADOR') {
                supabase
                    .from('alunos')
                    .select('turma, sala')
                    .then(({ data }) => {
                        if (data) {
                            const uniqueItems = Array.from(new Set([
                                ...data.map(a => a.sala).filter(Boolean)
                            ]))
                                .filter(item => item.startsWith('Sala '))
                                .sort();
                            setAllClasses(uniqueItems);
                        }
                    });
            }
        }
    }, [user, role]);

    // ── Sound notification ────────────────────────────────────────────────────
    const playNotificationSound = () => {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.volume = 0.5;
        audio.play().catch(e => console.log('Audio play failed - ensure user interacted with page', e));
    };

    const prevTotalRequestsRef = useRef(requests.length);
    useEffect(() => {
        if (requests.length > prevTotalRequestsRef.current && soundEnabled) {
            playNotificationSound();
        }
        prevTotalRequestsRef.current = requests.length;
    }, [requests.length, soundEnabled]);

    // ── Active request auto-select & sync ─────────────────────────────────────
    const handleSelectRequest = (req: PickupRequest) => setActiveRequest(req);

    useEffect(() => {
        if (requests.length > 0) {
            if (!activeRequest) {
                setTimeout(() => setActiveRequest(requests[0]), 0);
            } else {
                const refreshed = requests.find(r => r.id === activeRequest.id);
                if (refreshed) {
                    if (JSON.stringify(refreshed) !== JSON.stringify(activeRequest)) {
                        setTimeout(() => setActiveRequest(refreshed), 0);
                    }
                } else {
                    setTimeout(() => setActiveRequest(requests[0]), 0);
                }
            }
        } else {
            if (activeRequest) setTimeout(() => setActiveRequest(null), 0);
        }
    }, [requests]);

    // ── Actions ───────────────────────────────────────────────────────────────
    const handleResponse = async (requestId: string, action: 'LIBERAR' | 'AGUARDAR' | 'RECUSAR') => {
        const statusMap = { LIBERAR: 'LIBERADO', AGUARDAR: 'AGUARDANDO', RECUSAR: 'CANCELADO' };
        const msgMap    = { LIBERAR: 'Aluno liberado com sucesso!', AGUARDAR: 'Solicitação colocada em espera.', RECUSAR: 'Solicitação rejeitada e removida.' };

        const { error } = await supabase
            .from('solicitacoes_retirada')
            .update({
                status: statusMap[action],
                professor_id: user?.id,
                horario_liberacao: action === 'LIBERAR' ? new Date().toISOString() : null,
            })
            .eq('id', requestId);

        if (error) {
            toast.error('Erro ao atualizar status', error.message);
        } else {
            toast.success('Sucesso', msgMap[action]);
            if (action === 'RECUSAR' || action === 'AGUARDAR') {
                if (activeRequest?.id === requestId) setActiveRequest(null);
            }
        }
    };

    const sendQuickNote = async (requestId: string, note: string) => {
        setSendingNote(true);
        const { error } = await supabase
            .from('solicitacoes_retirada')
            .update({ mensagem_sala: note })
            .eq('id', requestId);
        if (!error) {
            setCustomNote('');
        } else {
            toast.error('Erro ao enviar nota', error.message);
        }
        setSendingNote(false);
    };

    const handleLogout = async () => {
        await signOut();
        navigate('/sala/login');
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div style={{
            minHeight: '100vh',
            background: D.page,
            fontFamily: "'Sora', 'Nunito', system-ui, sans-serif",
            display: 'flex', flexDirection: 'column',
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.35s ease',
        }}>

            {/* ════════════════════════════════════════════════════
                HEADER — Deep Indigo
            ════════════════════════════════════════════════════ */}
            <header style={{
                background: `linear-gradient(135deg, ${D.indigoDark} 0%, ${D.indigo} 100%)`,
                position: 'sticky', top: 0, zIndex: 60,
                boxShadow: '0 4px 24px rgba(30,27,75,0.35)',
            }}>
                <div style={{
                    maxWidth: '100%', padding: '0 24px',
                    height: 68,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 16,
                }}>
                    {/* Left cluster */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
                        <NavigationControls />

                        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.12)' }} />

                        {/* Title */}
                        <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                <div style={{
                                    width: 8, height: 8, borderRadius: '50%',
                                    background: '#34D399',
                                    boxShadow: '0 0 8px #34D399',
                                }} />
                                <span style={{
                                    fontFamily: 'Nunito, sans-serif',
                                    fontSize: 9, fontWeight: 800,
                                    letterSpacing: '0.28em', textTransform: 'uppercase',
                                    color: 'rgba(255,255,255,0.45)',
                                }}>Terminal da Sala</span>
                            </div>
                            <h1 style={{
                                fontSize: 18, fontWeight: 700,
                                color: '#FFFFFF', lineHeight: 1,
                                letterSpacing: '-0.02em',
                                whiteSpace: 'nowrap',
                            }}>
                                Portal do Professor
                            </h1>
                        </div>

                        {/* Class filter — admin/coordinator only */}
                        {(role === 'ADMIN' || role === 'COORDENADOR') && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                background: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: 10,
                                padding: '4px 6px',
                                marginLeft: 8,
                            }}>
                                <button
                                    onClick={() => setSelectedClass('TODAS')}
                                    style={{
                                        padding: '6px 14px',
                                        borderRadius: 7,
                                        fontSize: 10, fontWeight: 800,
                                        letterSpacing: '0.18em', textTransform: 'uppercase',
                                        border: 'none', cursor: 'pointer',
                                        transition: 'all 0.18s',
                                        background: selectedClass === 'TODAS' ? 'rgba(255,255,255,0.95)' : 'transparent',
                                        color: selectedClass === 'TODAS' ? D.indigoDark : 'rgba(255,255,255,0.5)',
                                    }}
                                >
                                    Todas
                                </button>
                                <div style={{ position: 'relative' }}>
                                    <select
                                        value={selectedClass}
                                        onChange={(e) => setSelectedClass(e.target.value)}
                                        style={{
                                            appearance: 'none',
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'rgba(255,255,255,0.7)',
                                            fontSize: 10, fontWeight: 700,
                                            letterSpacing: '0.12em', textTransform: 'uppercase',
                                            padding: '6px 28px 6px 10px',
                                            cursor: 'pointer',
                                            outline: 'none',
                                            fontFamily: 'Sora, sans-serif',
                                        }}
                                    >
                                        <option value="TODAS" style={{ color: '#1E1B4B', background: '#fff' }}>Filtrar por Sala</option>
                                        {allClasses.map(c => (
                                            <option key={c} value={c} style={{ color: '#1E1B4B', background: '#fff' }}>{c}</option>
                                        ))}
                                    </select>
                                    <ChevronRight size={12} style={{
                                        position: 'absolute', right: 8, top: '50%',
                                        transform: 'translateY(-50%) rotate(90deg)',
                                        color: 'rgba(255,255,255,0.4)',
                                        pointerEvents: 'none',
                                    }} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right cluster */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                        {/* Queue count pill */}
                        <div className="hidden sm:flex" style={{ alignItems: 'center', gap: 10 }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                background: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: 10, padding: '6px 14px',
                            }}>
                                <span style={{
                                    fontFamily: 'Nunito, sans-serif',
                                    fontSize: 22, fontWeight: 900, color: '#FFFFFF',
                                    lineHeight: 1,
                                }}>{requests.length}</span>
                                <div>
                                    <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', lineHeight: 1, marginBottom: 2 }}>na fila</p>
                                    <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#34D399', lineHeight: 1 }}>ao vivo</p>
                                </div>
                            </div>
                        </div>

                        {/* Sound toggle */}
                        <button
                            onClick={() => setSoundEnabled(!soundEnabled)}
                            style={{
                                width: 40, height: 40, borderRadius: 10,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: soundEnabled ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.06)',
                                border: `1px solid ${soundEnabled ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.1)'}`,
                                color: soundEnabled ? '#34D399' : 'rgba(255,255,255,0.3)',
                                cursor: 'pointer',
                                transition: 'all 0.18s',
                            }}
                        >
                            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                        </button>

                        {/* Logout */}
                        <button
                            onClick={handleLogout}
                            style={{
                                width: 40, height: 40, borderRadius: 10,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(239,68,68,0.12)',
                                border: '1px solid rgba(239,68,68,0.25)',
                                color: '#FCA5A5',
                                cursor: 'pointer',
                                transition: 'all 0.18s',
                            }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.25)';
                                (e.currentTarget as HTMLElement).style.color = '#FFF';
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.12)';
                                (e.currentTarget as HTMLElement).style.color = '#FCA5A5';
                            }}
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </header>

            {/* ════════════════════════════════════════════════════
                MAIN BODY
            ════════════════════════════════════════════════════ */}
            <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                {/* Left: Priority Pipeline sidebar */}
                <PriorityPipeline
                    userId={user?.id || ''}
                    selectedClass={selectedClass}
                    activeRequestId={activeRequest?.id}
                    onSelectRequest={handleSelectRequest}
                    onQueueChange={(reqs) => setRequests(reqs)}
                    escolaId={escolaId}
                />

                {/* Right: Detail area */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '28px 28px 40px',
                }}>
                    {activeRequest ? (
                        /* ── ACTIVE REQUEST VIEW ─────────────────────── */
                        <div style={{
                            maxWidth: 900,
                            opacity: mounted ? 1 : 0,
                            transition: 'opacity 0.4s ease',
                        }}>

                            {/* ── Student Profile Card ───────────────── */}
                            <div style={{
                                background: D.white,
                                borderRadius: 20,
                                boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 8px 32px rgba(15,23,42,0.08)',
                                overflow: 'hidden',
                                marginBottom: 20,
                            }}>
                                {/* Emergency banner */}
                                {activeRequest.tipo_solicitacao === 'EMERGENCIA' && (
                                    <div style={{
                                        background: D.rose,
                                        padding: '10px 24px',
                                        display: 'flex', alignItems: 'center', gap: 10,
                                    }}>
                                        <AlertTriangle size={16} style={{ color: '#fff' }} />
                                        <span style={{
                                            fontFamily: 'Nunito, sans-serif',
                                            fontSize: 11, fontWeight: 900,
                                            letterSpacing: '0.2em', textTransform: 'uppercase',
                                            color: '#fff',
                                        }}>Prioridade Crítica — Emergência</span>
                                    </div>
                                )}

                                {/* Card body */}
                                <div style={{ padding: '28px 32px', display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>

                                    {/* Photo */}
                                    <div style={{ position: 'relative', flexShrink: 0 }}>
                                        <div style={{
                                            width: 120, height: 120, borderRadius: '50%',
                                            border: `4px solid ${D.teal}`,
                                            overflow: 'hidden',
                                            background: D.surface,
                                            boxShadow: `0 0 0 8px ${D.tealLight}, 0 8px 32px rgba(13,148,136,0.2)`,
                                        }}>
                                            {activeRequest.aluno.foto_url ? (
                                                <img
                                                    src={activeRequest.aluno.foto_url}
                                                    alt=""
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                />
                                            ) : (
                                                <div style={{
                                                    width: '100%', height: '100%',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    background: `linear-gradient(135deg, ${D.tealLight}, #E0F2FE)`,
                                                }}>
                                                    <UserIcon size={48} style={{ color: D.teal }} />
                                                </div>
                                            )}
                                        </div>
                                        {/* Active pulse ring */}
                                        <div style={{
                                            position: 'absolute', inset: -8,
                                            borderRadius: '50%',
                                            border: `2px solid ${D.teal}`,
                                            opacity: 0.3,
                                            animation: 'pulse 2s ease-in-out infinite',
                                        }} />
                                    </div>

                                    {/* Student info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        {/* Badges */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                                            <span style={{
                                                padding: '4px 12px',
                                                background: D.tealLight,
                                                border: `1px solid ${D.tealBorder}`,
                                                borderRadius: 6,
                                                fontSize: 10, fontWeight: 800,
                                                letterSpacing: '0.18em', textTransform: 'uppercase',
                                                color: D.teal,
                                                fontFamily: 'Nunito, sans-serif',
                                            }}>SCT Ativo</span>

                                            {activeRequest.aluno.observacoes && (
                                                <span style={{
                                                    padding: '4px 12px',
                                                    background: D.roseLight,
                                                    border: `1px solid ${D.roseBorder}`,
                                                    borderRadius: 6,
                                                    fontSize: 10, fontWeight: 800,
                                                    letterSpacing: '0.18em', textTransform: 'uppercase',
                                                    color: D.rose,
                                                    fontFamily: 'Nunito, sans-serif',
                                                    display: 'flex', alignItems: 'center', gap: 5,
                                                }}>
                                                    <AlertTriangle size={10} /> Alerta Médico
                                                </span>
                                            )}
                                        </div>

                                        {/* Name */}
                                        <h2 style={{
                                            fontSize: 'clamp(26px, 3.5vw, 40px)',
                                            fontWeight: 800,
                                            color: D.ink,
                                            lineHeight: 1.1,
                                            letterSpacing: '-0.03em',
                                            marginBottom: 16,
                                        }}>
                                            {activeRequest.aluno.nome_completo}
                                        </h2>

                                        {/* Info chips row */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                                            {/* Room */}
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: 8,
                                                padding: '8px 14px',
                                                background: D.surface,
                                                border: `1px solid ${D.border}`,
                                                borderRadius: 10,
                                            }}>
                                                <School size={14} style={{ color: D.indigoMid }} />
                                                <div>
                                                    <p style={{ fontSize: 11, fontWeight: 700, color: D.ink, lineHeight: 1 }}>
                                                        {activeRequest.aluno.sala}
                                                    </p>
                                                    <p style={{
                                                        fontSize: 9, fontWeight: 600, color: D.inkMuted,
                                                        letterSpacing: '0.12em', textTransform: 'uppercase',
                                                    }}>{activeRequest.aluno.turma}</p>
                                                </div>
                                            </div>

                                            {/* Guardian */}
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: 8,
                                                padding: '8px 14px',
                                                background: D.surface,
                                                border: `1px solid ${D.border}`,
                                                borderRadius: 10,
                                            }}>
                                                <div style={{
                                                    width: 28, height: 28, borderRadius: '50%',
                                                    overflow: 'hidden', background: D.border,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    flexShrink: 0,
                                                }}>
                                                    {activeRequest.responsavel?.foto_url ? (
                                                        <img src={activeRequest.responsavel.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <UserIcon size={14} style={{ color: D.inkMuted }} />
                                                    )}
                                                </div>
                                                <div>
                                                    <p style={{ fontSize: 11, fontWeight: 700, color: D.ink, lineHeight: 1 }}>
                                                        {activeRequest.responsavel?.nome_completo || 'Não atribuído'}
                                                    </p>
                                                    <p style={{
                                                        fontSize: 9, fontWeight: 600, color: D.inkMuted,
                                                        letterSpacing: '0.12em', textTransform: 'uppercase',
                                                    }}>responsável</p>
                                                </div>
                                            </div>

                                            {/* Geofence status */}
                                            {activeRequest.status_geofence === 'CHEGOU' ? (
                                                <div style={{
                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                    padding: '8px 14px',
                                                    background: D.tealLight,
                                                    border: `1px solid ${D.tealBorder}`,
                                                    borderRadius: 10,
                                                }}>
                                                    <div style={{
                                                        width: 8, height: 8, borderRadius: '50%',
                                                        background: D.teal,
                                                        boxShadow: `0 0 0 3px ${D.tealBorder}`,
                                                        animation: 'pulse 1.5s ease-in-out infinite',
                                                    }} />
                                                    <span style={{ fontSize: 11, fontWeight: 700, color: D.teal }}>
                                                        Na recepção
                                                    </span>
                                                </div>
                                            ) : (
                                                <div style={{
                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                    padding: '8px 14px',
                                                    background: D.surface,
                                                    border: `1px solid ${D.border}`,
                                                    borderRadius: 10,
                                                }}>
                                                    <Clock size={13} style={{ color: D.inkMuted }} />
                                                    <span style={{ fontSize: 11, fontWeight: 600, color: D.inkMuted }}>
                                                        Em deslocamento
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Reception message */}
                                {activeRequest.mensagem_recepcao && (
                                    <div style={{
                                        margin: '0 32px 24px',
                                        padding: '16px 20px',
                                        background: '#EFF6FF',
                                        border: '1px solid #BFDBFE',
                                        borderLeft: '4px solid #3B82F6',
                                        borderRadius: 12,
                                        display: 'flex', gap: 12, alignItems: 'flex-start',
                                    }}>
                                        <MessageSquare size={16} style={{ color: '#3B82F6', flexShrink: 0, marginTop: 2 }} />
                                        <div>
                                            <p style={{
                                                fontSize: 10, fontWeight: 800,
                                                letterSpacing: '0.2em', textTransform: 'uppercase',
                                                color: '#2563EB', marginBottom: 4,
                                                fontFamily: 'Nunito, sans-serif',
                                            }}>Nota da Recepção</p>
                                            <p style={{ fontSize: 14, fontWeight: 500, color: '#1E3A8A', lineHeight: 1.5 }}>
                                                {activeRequest.mensagem_recepcao}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ── Controls Row ───────────────────────── */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'start' }}
                                className="grid-cols-1 lg:grid-cols-[1fr_auto]"
                            >
                                {/* Note panel */}
                                <div style={{
                                    background: D.white,
                                    borderRadius: 20,
                                    boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
                                    padding: '24px',
                                }}>
                                    <div style={{ marginBottom: 16 }}>
                                        <p style={{
                                            fontSize: 10, fontWeight: 800,
                                            letterSpacing: '0.22em', textTransform: 'uppercase',
                                            color: D.indigoMid, marginBottom: 2,
                                            fontFamily: 'Nunito, sans-serif',
                                        }}>Mensagem para Recepção</p>
                                        <p style={{ fontSize: 12, color: D.inkMuted }}>
                                            Status atual do aluno
                                        </p>
                                    </div>

                                    {/* Quick note pills */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                                        {QUICK_NOTES.map(note => (
                                            <button
                                                key={note}
                                                onClick={() => sendQuickNote(activeRequest.id, note)}
                                                disabled={sendingNote}
                                                style={{
                                                    padding: '8px 16px',
                                                    background: D.surface,
                                                    border: `1px solid ${D.border}`,
                                                    borderRadius: 20,
                                                    fontSize: 12, fontWeight: 600,
                                                    color: D.inkMid,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.18s',
                                                    fontFamily: 'Sora, sans-serif',
                                                }}
                                                onMouseEnter={e => {
                                                    const el = e.currentTarget as HTMLElement;
                                                    el.style.background = D.tealLight;
                                                    el.style.borderColor = D.tealBorder;
                                                    el.style.color = D.teal;
                                                }}
                                                onMouseLeave={e => {
                                                    const el = e.currentTarget as HTMLElement;
                                                    el.style.background = D.surface;
                                                    el.style.borderColor = D.border;
                                                    el.style.color = D.inkMid;
                                                }}
                                            >
                                                {note}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Custom note input */}
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            value={customNote}
                                            onChange={(e) => setCustomNote(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && customNote && sendQuickNote(activeRequest.id, customNote)}
                                            placeholder="Enviar mensagem personalizada…"
                                            style={{
                                                width: '100%',
                                                padding: '14px 60px 14px 18px',
                                                background: D.surface,
                                                border: `1.5px solid ${D.border}`,
                                                borderRadius: 14,
                                                fontSize: 14, fontWeight: 500,
                                                color: D.ink,
                                                outline: 'none',
                                                transition: 'border-color 0.18s',
                                                fontFamily: 'Sora, sans-serif',
                                                boxSizing: 'border-box',
                                            }}
                                            onFocus={e => { (e.target as HTMLInputElement).style.borderColor = D.teal; }}
                                            onBlur={e => { (e.target as HTMLInputElement).style.borderColor = D.border; }}
                                        />
                                        <button
                                            onClick={() => customNote && sendQuickNote(activeRequest.id, customNote)}
                                            disabled={sendingNote || !customNote}
                                            style={{
                                                position: 'absolute', right: 8, top: '50%',
                                                transform: 'translateY(-50%)',
                                                width: 38, height: 38, borderRadius: 10,
                                                background: customNote ? D.teal : D.border,
                                                border: 'none',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: '#fff',
                                                cursor: customNote ? 'pointer' : 'not-allowed',
                                                transition: 'background 0.18s',
                                            }}
                                        >
                                            {sendingNote
                                                ? <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
                                                : <Send size={15} />
                                            }
                                        </button>
                                    </div>
                                </div>

                                {/* Action buttons */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 200 }}>
                                    {/* LIBERAR — primary */}
                                    <button
                                        onClick={() => handleResponse(activeRequest.id, 'LIBERAR')}
                                        style={{
                                            width: '100%', padding: '20px 16px',
                                            background: D.teal,
                                            border: 'none', borderRadius: 16,
                                            cursor: 'pointer',
                                            display: 'flex', flexDirection: 'column',
                                            alignItems: 'center', gap: 8,
                                            boxShadow: `0 8px 24px ${D.teal}40`,
                                            transition: 'all 0.18s',
                                        }}
                                        onMouseEnter={e => {
                                            const el = e.currentTarget as HTMLElement;
                                            el.style.background = '#0F766E';
                                            el.style.transform = 'translateY(-2px)';
                                            el.style.boxShadow = `0 12px 32px ${D.teal}50`;
                                        }}
                                        onMouseLeave={e => {
                                            const el = e.currentTarget as HTMLElement;
                                            el.style.background = D.teal;
                                            el.style.transform = 'translateY(0)';
                                            el.style.boxShadow = `0 8px 24px ${D.teal}40`;
                                        }}
                                    >
                                        <div style={{
                                            width: 44, height: 44, borderRadius: '50%',
                                            background: 'rgba(255,255,255,0.2)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <Check size={22} style={{ color: '#fff' }} />
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <p style={{
                                                fontSize: 9, fontWeight: 800,
                                                letterSpacing: '0.2em', textTransform: 'uppercase',
                                                color: 'rgba(255,255,255,0.7)',
                                                fontFamily: 'Nunito, sans-serif',
                                                marginBottom: 2,
                                            }}>Finalizar &amp;</p>
                                            <p style={{
                                                fontSize: 14, fontWeight: 800,
                                                color: '#fff', letterSpacing: '-0.01em',
                                            }}>Liberar Aluno</p>
                                        </div>
                                    </button>

                                    {/* AGUARDAR */}
                                    <button
                                        onClick={() => {
                                            if (confirmPending === 'AGUARDAR') {
                                                handleResponse(activeRequest.id, 'AGUARDAR');
                                                setConfirmPending(null);
                                            } else {
                                                setConfirmPending('AGUARDAR');
                                                setTimeout(() => setConfirmPending(prev => prev === 'AGUARDAR' ? null : prev), 3000);
                                            }
                                        }}
                                        style={{
                                            width: '100%', padding: '14px 16px',
                                            background: confirmPending === 'AGUARDAR' ? D.amberLight : D.surface,
                                            border: `1.5px solid ${confirmPending === 'AGUARDAR' ? D.amberBorder : D.border}`,
                                            borderRadius: 14,
                                            cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            transition: 'all 0.18s',
                                        }}
                                    >
                                        <div style={{
                                            width: 34, height: 34, borderRadius: 10,
                                            background: confirmPending === 'AGUARDAR' ? `${D.amber}20` : D.border,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0,
                                        }}>
                                            <Clock size={16} style={{ color: confirmPending === 'AGUARDAR' ? D.amber : D.inkMuted }} />
                                        </div>
                                        <span style={{
                                            fontSize: 13, fontWeight: 700,
                                            color: confirmPending === 'AGUARDAR' ? D.amber : D.inkMid,
                                        }}>
                                            {confirmPending === 'AGUARDAR' ? 'Confirmar?' : 'Aguardar'}
                                        </span>
                                    </button>

                                    {/* RECUSAR */}
                                    <button
                                        onClick={() => {
                                            if (confirmPending === 'RECUSAR') {
                                                handleResponse(activeRequest.id, 'RECUSAR');
                                                setConfirmPending(null);
                                            } else {
                                                setConfirmPending('RECUSAR');
                                                setTimeout(() => setConfirmPending(prev => prev === 'RECUSAR' ? null : prev), 3000);
                                            }
                                        }}
                                        style={{
                                            width: '100%', padding: '14px 16px',
                                            background: confirmPending === 'RECUSAR' ? D.roseLight : D.surface,
                                            border: `1.5px solid ${confirmPending === 'RECUSAR' ? D.roseBorder : D.border}`,
                                            borderRadius: 14,
                                            cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            transition: 'all 0.18s',
                                        }}
                                    >
                                        <div style={{
                                            width: 34, height: 34, borderRadius: 10,
                                            background: confirmPending === 'RECUSAR' ? `${D.rose}20` : D.border,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0,
                                        }}>
                                            <X size={16} style={{ color: confirmPending === 'RECUSAR' ? D.rose : D.inkMuted }} />
                                        </div>
                                        <span style={{
                                            fontSize: 13, fontWeight: 700,
                                            color: confirmPending === 'RECUSAR' ? D.rose : D.inkMid,
                                        }}>
                                            {confirmPending === 'RECUSAR' ? 'Confirmar?' : 'Rejeitar'}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* ── EMPTY STATE ───────────────────────────── */
                        <div style={{
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            height: '100%', minHeight: 480,
                            textAlign: 'center', gap: 24,
                            opacity: mounted ? 1 : 0,
                            transition: 'opacity 0.5s ease 0.1s',
                        }}>
                            {/* Bell icon with rings */}
                            <div style={{ position: 'relative', marginBottom: 8 }}>
                                <div style={{
                                    position: 'absolute', inset: -20,
                                    borderRadius: '50%',
                                    border: `1.5px solid ${D.teal}20`,
                                    animation: 'ping 3s ease-in-out infinite',
                                }} />
                                <div style={{
                                    position: 'absolute', inset: -10,
                                    borderRadius: '50%',
                                    border: `1.5px solid ${D.teal}30`,
                                    animation: 'ping 3s ease-in-out infinite 0.5s',
                                }} />
                                <div style={{
                                    width: 96, height: 96, borderRadius: '50%',
                                    background: D.tealLight,
                                    border: `2px solid ${D.tealBorder}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    position: 'relative',
                                }}>
                                    <Bell size={40} style={{ color: D.teal }} />
                                </div>
                            </div>

                            <div>
                                <h2 style={{
                                    fontSize: 28, fontWeight: 800,
                                    color: D.ink, letterSpacing: '-0.03em',
                                    marginBottom: 8,
                                }}>
                                    Aguardando Solicitações
                                </h2>
                                <p style={{
                                    fontSize: 14, color: D.inkMuted,
                                    maxWidth: 320, lineHeight: 1.6,
                                    fontFamily: 'Nunito, sans-serif',
                                }}>
                                    Monitoramento ativo. Novas solicitações de retirada aparecerão aqui automaticamente.
                                </p>
                            </div>

                            {/* Status chip */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '8px 18px',
                                background: D.tealLight,
                                border: `1px solid ${D.tealBorder}`,
                                borderRadius: 20,
                            }}>
                                <div style={{
                                    width: 7, height: 7, borderRadius: '50%',
                                    background: D.teal,
                                    animation: 'pulse 1.5s ease-in-out infinite',
                                }} />
                                <span style={{
                                    fontSize: 11, fontWeight: 700,
                                    color: D.teal,
                                    fontFamily: 'Nunito, sans-serif',
                                    letterSpacing: '0.1em', textTransform: 'uppercase',
                                }}>
                                    Varredura Ativa
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Global keyframes */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.6; transform: scale(0.95); }
                }
                @keyframes ping {
                    0% { transform: scale(1); opacity: 0.4; }
                    80%, 100% { transform: scale(1.8); opacity: 0; }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
