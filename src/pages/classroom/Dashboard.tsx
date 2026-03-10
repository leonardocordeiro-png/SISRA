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
    responsavel?: { nome_completo: string; foto_url: string | null } | null;
    mensagem_recepcao: string | null;
    status_geofence: string | null;
    distancia_estimada_metros: number | null;
};

// ── Brand tokens ──────────────────────────────────────────────────────────────
const B = {
    navy:      '#104699',
    navyDark:  '#0a2f6b',
    navyDeep:  '#071830',
    gold:      '#fbd12d',
    goldDark:  '#e8be1a',
    red:       '#E40123',
    gray:      '#A7A7A2',
    grayLight: '#c8c8c4',
    white:     '#FFFFFF',
    card:      '#0d2a54',
    cardBorder:'rgba(251,209,45,0.10)',
    onGold:    '#071830',
    textSub:   'rgba(167,167,162,0.9)',
};

const QUICK_NOTES = ['A caminho', 'Lanchando', 'No banheiro', 'Em atendimento'];

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

    // Font injection
    useEffect(() => {
        if (!document.getElementById('cls-brand-fonts')) {
            const link = document.createElement('link');
            link.id = 'cls-brand-fonts';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Epilogue:ital,wght@0,700;0,800;0,900;1,700;1,800&family=Instrument+Sans:wght@400;500;600;700&display=swap';
            document.head.appendChild(link);
        }
        setTimeout(() => setMounted(true), 80);
    }, []);

    // Fetch user class assignment
    useEffect(() => {
        if (user) {
            supabase.from('usuarios').select('turma_atribuida, sala_atribuida, escola_id')
                .eq('id', user.id).single()
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
                supabase.from('alunos').select('turma, sala').then(({ data }) => {
                    if (data) {
                        setAllClasses(
                            Array.from(new Set(data.map(a => a.sala).filter(Boolean)))
                                .filter(i => i.startsWith('Sala ')).sort()
                        );
                    }
                });
            }
        }
    }, [user, role]);

    const playNotificationSound = () => {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.volume = 0.5;
        audio.play().catch(e => console.log('Audio play failed', e));
    };

    const handleSelectRequest = (req: PickupRequest) => setActiveRequest(req);

    const prevTotalRequestsRef = useRef(requests.length);
    useEffect(() => {
        if (requests.length > prevTotalRequestsRef.current && soundEnabled) playNotificationSound();
        prevTotalRequestsRef.current = requests.length;
    }, [requests.length, soundEnabled]);

    useEffect(() => {
        if (requests.length > 0) {
            if (!activeRequest) {
                setTimeout(() => setActiveRequest(requests[0]), 0);
            } else {
                const refreshed = requests.find(r => r.id === activeRequest.id);
                if (refreshed) {
                    if (JSON.stringify(refreshed) !== JSON.stringify(activeRequest))
                        setTimeout(() => setActiveRequest(refreshed), 0);
                } else {
                    setTimeout(() => setActiveRequest(requests[0]), 0);
                }
            }
        } else {
            if (activeRequest) setTimeout(() => setActiveRequest(null), 0);
        }
    }, [requests]);

    const handleResponse = async (requestId: string, action: 'LIBERAR' | 'AGUARDAR' | 'RECUSAR') => {
        const statusMap = { LIBERAR: 'LIBERADO', AGUARDAR: 'AGUARDANDO', RECUSAR: 'CANCELADO' };
        const msgMap    = { LIBERAR: 'Aluno liberado com sucesso!', AGUARDAR: 'Solicitação colocada em espera.', RECUSAR: 'Solicitação rejeitada e removida.' };
        const { error } = await supabase.from('solicitacoes_retirada')
            .update({ status: statusMap[action], professor_id: user?.id, horario_liberacao: action === 'LIBERAR' ? new Date().toISOString() : null })
            .eq('id', requestId);
        if (error) { toast.error('Erro ao atualizar status', error.message); }
        else {
            toast.success('Sucesso', msgMap[action]);
            if ((action === 'RECUSAR' || action === 'AGUARDAR') && activeRequest?.id === requestId) setActiveRequest(null);
        }
    };

    const sendQuickNote = async (requestId: string, note: string) => {
        setSendingNote(true);
        const { error } = await supabase.from('solicitacoes_retirada').update({ mensagem_sala: note }).eq('id', requestId);
        if (!error) { setCustomNote(''); } else { toast.error('Erro ao enviar nota', error.message); }
        setSendingNote(false);
    };

    const handleLogout = async () => { await signOut(); navigate('/sala/login'); };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div style={{
            minHeight: '100vh', display: 'flex', flexDirection: 'column',
            background: B.navyDeep,
            fontFamily: "'Instrument Sans', system-ui, sans-serif",
            opacity: mounted ? 1 : 0, transition: 'opacity 0.4s ease',
        }}>

            {/* ══════════════ HEADER ══════════════ */}
            <header style={{
                background: B.navy,
                borderBottom: `3px solid ${B.gold}`,
                position: 'sticky', top: 0, zIndex: 60,
                boxShadow: `0 4px 24px rgba(7,24,48,0.7)`,
            }}>
                {/* Top gold stripe */}
                <div style={{ height: 3, background: `linear-gradient(90deg, ${B.gold} 0%, ${B.goldDark} 50%, ${B.gold} 100%)` }} />

                <div style={{ padding: '0 20px', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>

                    {/* Left */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
                        <NavigationControls />
                        <div style={{ width: 1, height: 26, background: 'rgba(255,255,255,0.15)' }} />

                        {/* Gold school badge + title */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                                width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                                background: B.gold, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: `0 2px 10px ${B.gold}45`,
                            }}>
                                <School size={17} style={{ color: B.onGold }} />
                            </div>
                            <div>
                                <p style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.26em', textTransform: 'uppercase', color: `${B.gold}80`, marginBottom: 1 }}>
                                    La Salle, Cheguei! · SCT
                                </p>
                                <h1 style={{ fontSize: 16, fontWeight: 800, color: B.white, letterSpacing: '-0.02em', lineHeight: 1, fontFamily: 'Epilogue, sans-serif' }}>
                                    Portal da Sala
                                </h1>
                            </div>
                        </div>

                        {/* Class filter */}
                        {(role === 'ADMIN' || role === 'COORDENADOR') && (
                            <div className="cls-class-filter" style={{
                                display: 'flex', alignItems: 'center', gap: 5, marginLeft: 8,
                                background: 'rgba(0,0,0,0.2)', border: `1px solid ${B.gold}22`,
                                borderRadius: 8, padding: '3px 5px',
                            }}>
                                <button onClick={() => setSelectedClass('TODAS')} style={{
                                    padding: '5px 12px', borderRadius: 5, border: 'none', cursor: 'pointer',
                                    fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
                                    transition: 'all 0.18s', fontFamily: 'Instrument Sans, sans-serif',
                                    background: selectedClass === 'TODAS' ? B.gold : 'transparent',
                                    color: selectedClass === 'TODAS' ? B.onGold : 'rgba(255,255,255,0.4)',
                                }}>Todas</button>
                                <div style={{ position: 'relative' }}>
                                    <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} style={{
                                        appearance: 'none', background: 'transparent', border: 'none', outline: 'none',
                                        color: 'rgba(255,255,255,0.55)', fontSize: 9, fontWeight: 600,
                                        letterSpacing: '0.12em', textTransform: 'uppercase',
                                        padding: '5px 20px 5px 8px', cursor: 'pointer',
                                        fontFamily: 'Instrument Sans, sans-serif',
                                    }}>
                                        <option value="TODAS" style={{ color: B.onGold, background: '#fff' }}>Filtrar</option>
                                        {allClasses.map(c => <option key={c} value={c} style={{ color: B.onGold, background: '#fff' }}>{c}</option>)}
                                    </select>
                                    <ChevronRight size={10} style={{ position: 'absolute', right: 3, top: '50%', transform: 'translateY(-50%) rotate(90deg)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        {/* Queue count */}
                        <div className="hidden sm:flex" style={{
                            alignItems: 'center', gap: 9,
                            background: 'rgba(0,0,0,0.25)', border: `1px solid ${B.gold}28`,
                            borderRadius: 8, padding: '6px 13px',
                        }}>
                            <span style={{ fontFamily: 'Epilogue, sans-serif', fontSize: 26, fontWeight: 900, color: B.gold, lineHeight: 1, letterSpacing: '-0.02em' }}>
                                {requests.length}
                            </span>
                            <div>
                                <p style={{ fontSize: 7.5, fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 2 }}>fila</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 6px #22C55E' }} />
                                    <p style={{ fontSize: 7.5, fontWeight: 600, color: '#22C55E', letterSpacing: '0.14em', textTransform: 'uppercase' }}>ao vivo</p>
                                </div>
                            </div>
                        </div>

                        {/* Sound */}
                        <button onClick={() => setSoundEnabled(!soundEnabled)} style={{
                            width: 36, height: 36, borderRadius: 7, border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: soundEnabled ? `${B.gold}22` : 'rgba(255,255,255,0.05)',
                            color: soundEnabled ? B.gold : 'rgba(255,255,255,0.22)',
                            transition: 'all 0.18s',
                            outline: `1px solid ${soundEnabled ? `${B.gold}38` : 'rgba(255,255,255,0.07)'}`,
                        }}>
                            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                        </button>

                        {/* Logout */}
                        <button onClick={handleLogout} style={{
                            width: 36, height: 36, borderRadius: 7, border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: `${B.red}18`, color: '#ff7b8a',
                            outline: `1px solid ${B.red}35`, transition: 'all 0.18s',
                        }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${B.red}35`; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${B.red}18`; (e.currentTarget as HTMLElement).style.color = '#ff7b8a'; }}
                        >
                            <LogOut size={14} />
                        </button>
                    </div>
                </div>
            </header>

            {/* ══════════════ BODY ══════════════ */}
            <main className="cls-main-body" style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

                <PriorityPipeline
                    userId={user?.id || ''}
                    selectedClass={selectedClass}
                    activeRequestId={activeRequest?.id}
                    onSelectRequest={handleSelectRequest}
                    onQueueChange={reqs => setRequests(reqs)}
                    escolaId={escolaId}
                />

                {/* Detail scroll area */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '22px 22px 48px', minWidth: 0 }}>

                    {activeRequest ? (
                        /* ════ ACTIVE REQUEST ════ */
                        <div style={{ maxWidth: 860, opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(10px)', transition: 'opacity 0.4s ease, transform 0.4s ease' }}>

                            {/* ── Hero student card ── */}
                            <div style={{
                                background: B.card, borderRadius: 18, overflow: 'hidden', marginBottom: 14,
                                border: `1px solid ${B.cardBorder}`,
                                boxShadow: `0 8px 40px rgba(7,24,48,0.6), 0 0 0 1px rgba(251,209,45,0.05)`,
                            }}>
                                {/* Gold top rule */}
                                <div style={{ height: 3, background: `linear-gradient(90deg, ${B.gold}, ${B.navy}80, transparent)` }} />

                                {/* Emergency */}
                                {activeRequest.tipo_solicitacao === 'EMERGENCIA' && (
                                    <div style={{ background: B.red, padding: '8px 22px', display: 'flex', alignItems: 'center', gap: 9 }}>
                                        <AlertTriangle size={14} style={{ color: '#fff' }} />
                                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#fff' }}>
                                            Prioridade Crítica — Atendimento Imediato
                                        </span>
                                    </div>
                                )}

                                <div className="cls-hero-card" style={{ display: 'flex', flexWrap: 'wrap' }}>
                                    {/* Photo column */}
                                    <div className="cls-photo-col" style={{
                                        width: 190, flexShrink: 0,
                                        background: `linear-gradient(160deg, ${B.navyDark} 0%, ${B.navyDeep} 100%)`,
                                        padding: '26px 18px',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
                                        borderRight: `1px solid ${B.cardBorder}`,
                                    }}>
                                        {/* Student photo with gold frame */}
                                        <div style={{ position: 'relative' }}>
                                            <div style={{
                                                width: 136, height: 136, borderRadius: 14, overflow: 'hidden',
                                                border: `3px solid ${B.gold}`,
                                                boxShadow: `0 0 0 6px ${B.gold}14, 0 10px 36px rgba(7,24,48,0.8)`,
                                                background: B.navy,
                                            }}>
                                                {activeRequest.aluno.foto_url ? (
                                                    <img src={activeRequest.aluno.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${B.navy}90, ${B.navyDark})` }}>
                                                        <UserIcon size={52} style={{ color: `${B.gold}45` }} />
                                                    </div>
                                                )}
                                            </div>
                                            {/* Gold corner accents */}
                                            <div style={{ position: 'absolute', top: -2, left: -2, width: 16, height: 16, borderTop: `3px solid ${B.gold}`, borderLeft: `3px solid ${B.gold}`, borderRadius: '4px 0 0 0' }} />
                                            <div style={{ position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderTop: `3px solid ${B.gold}`, borderRight: `3px solid ${B.gold}`, borderRadius: '0 4px 0 0' }} />
                                            <div style={{ position: 'absolute', bottom: -2, left: -2, width: 16, height: 16, borderBottom: `3px solid ${B.gold}`, borderLeft: `3px solid ${B.gold}`, borderRadius: '0 0 0 4px' }} />
                                            <div style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderBottom: `3px solid ${B.gold}`, borderRight: `3px solid ${B.gold}`, borderRadius: '0 0 4px 0' }} />
                                        </div>

                                        {/* Guardian */}
                                        <div style={{ width: '100%' }}>
                                            <p style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.24em', textTransform: 'uppercase', color: `${B.gold}65`, marginBottom: 7, textAlign: 'center' }}>
                                                Quem Retira
                                            </p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 9px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 9 }}>
                                                <div style={{ width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', background: B.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1.5px solid ${B.gold}28` }}>
                                                    {activeRequest.responsavel?.foto_url
                                                        ? <img src={activeRequest.responsavel.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        : <UserIcon size={12} style={{ color: `${B.gold}55` }} />}
                                                </div>
                                                <p style={{ fontSize: 10.5, fontWeight: 600, color: B.white, lineHeight: 1.25, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                                    {activeRequest.responsavel?.nome_completo || 'Não atribuído'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Info column */}
                                    <div style={{ flex: 1, padding: '26px 24px 22px', minWidth: 0 }}>
                                        {/* Badges */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 13 }}>
                                            <span style={{ padding: '3px 10px', background: `${B.gold}16`, border: `1px solid ${B.gold}38`, borderRadius: 4, fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: B.gold }}>
                                                SCT Ativo
                                            </span>
                                            {activeRequest.aluno.observacoes && (
                                                <span style={{ padding: '3px 10px', background: `${B.red}14`, border: `1px solid ${B.red}38`, borderRadius: 4, fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#ff7b8a', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <AlertTriangle size={8} /> Alerta Médico
                                                </span>
                                            )}
                                        </div>

                                        {/* Name */}
                                        <h2 style={{ fontFamily: 'Epilogue, sans-serif', fontSize: 'clamp(22px, 3vw, 38px)', fontWeight: 900, color: B.white, letterSpacing: '-0.03em', lineHeight: 1.08, marginBottom: 18 }}>
                                            {activeRequest.aluno.nome_completo.split(' ').slice(0, 2).join(' ')}
                                            {activeRequest.aluno.nome_completo.split(' ').length > 2 && (
                                                <><br /><span style={{ color: B.gold }}>{activeRequest.aluno.nome_completo.split(' ').slice(2).join(' ')}</span></>
                                            )}
                                        </h2>

                                        {/* Metadata chips */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
                                            {/* Room */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
                                                <div style={{ width: 30, height: 30, borderRadius: 7, background: `${B.navy}60`, border: `1px solid ${B.gold}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <School size={13} style={{ color: B.gold }} />
                                                </div>
                                                <div>
                                                    <p style={{ fontSize: 12, fontWeight: 700, color: B.white, lineHeight: 1, marginBottom: 2 }}>{activeRequest.aluno.sala}</p>
                                                    <p style={{ fontSize: 9.5, fontWeight: 500, color: B.gray, letterSpacing: '0.06em' }}>{activeRequest.aluno.turma}</p>
                                                </div>
                                            </div>

                                            {/* Time */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
                                                <div style={{ width: 30, height: 30, borderRadius: 7, background: `${B.navy}60`, border: `1px solid ${B.gold}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Clock size={13} style={{ color: B.gold }} />
                                                </div>
                                                <div>
                                                    <p style={{ fontSize: 12, fontWeight: 700, color: B.white, lineHeight: 1, marginBottom: 2 }}>
                                                        {activeRequest.horario_solicitacao ? new Date(activeRequest.horario_solicitacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                                    </p>
                                                    <p style={{ fontSize: 9.5, fontWeight: 500, color: B.gray, letterSpacing: '0.06em' }}>solicitado às</p>
                                                </div>
                                            </div>

                                            {/* Geofence */}
                                            {activeRequest.status_geofence === 'CHEGOU' ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.22)', borderRadius: 10 }}>
                                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 0 3px rgba(34,197,94,0.22)', flexShrink: 0 }} />
                                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#4ADE80' }}>Na recepção</span>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
                                                    <Clock size={12} style={{ color: B.gray }} />
                                                    <span style={{ fontSize: 12, fontWeight: 500, color: B.gray }}>Em deslocamento</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Reception message */}
                                {activeRequest.mensagem_recepcao && (
                                    <div style={{ margin: '0 18px 18px', padding: '12px 16px', background: 'rgba(16,70,153,0.28)', border: `1px solid ${B.navy}`, borderLeft: `3px solid ${B.gold}`, borderRadius: 10, display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                                        <MessageSquare size={13} style={{ color: B.gold, flexShrink: 0, marginTop: 1 }} />
                                        <div>
                                            <p style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: B.gold, marginBottom: 4 }}>Nota da Recepção</p>
                                            <p style={{ fontSize: 13, fontWeight: 500, color: '#C8D8F4', lineHeight: 1.5 }}>{activeRequest.mensagem_recepcao}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ── Controls: notes + actions ── */}
                            <div className="cls-controls-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 188px', gap: 12, alignItems: 'start' }}>

                                {/* Note panel */}
                                <div style={{ background: B.card, borderRadius: 16, padding: '18px 20px', border: `1px solid ${B.cardBorder}`, boxShadow: '0 4px 20px rgba(7,24,48,0.4)' }}>
                                    <p style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: B.gold, marginBottom: 2 }}>Mensagem para Recepção</p>
                                    <p style={{ fontSize: 11, color: B.gray, marginBottom: 13 }}>Informe o status atual do aluno</p>

                                    {/* Quick notes */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 13 }}>
                                        {QUICK_NOTES.map(note => (
                                            <button key={note} onClick={() => sendQuickNote(activeRequest.id, note)} disabled={sendingNote}
                                                style={{ padding: '6px 13px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 18, fontSize: 11.5, fontWeight: 600, color: B.grayLight, cursor: 'pointer', transition: 'all 0.17s', fontFamily: 'Instrument Sans, sans-serif' }}
                                                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = `${B.gold}16`; el.style.borderColor = `${B.gold}42`; el.style.color = B.gold; }}
                                                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.04)'; el.style.borderColor = 'rgba(255,255,255,0.09)'; el.style.color = B.grayLight; }}
                                            >{note}</button>
                                        ))}
                                    </div>

                                    {/* Custom note */}
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            value={customNote} onChange={e => setCustomNote(e.target.value)}
                                            onKeyPress={e => e.key === 'Enter' && customNote && sendQuickNote(activeRequest.id, customNote)}
                                            placeholder="Mensagem personalizada…"
                                            style={{ width: '100%', padding: '11px 50px 11px 15px', background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.09)', borderRadius: 11, fontSize: 13, fontWeight: 500, color: B.white, outline: 'none', transition: 'border-color 0.18s', fontFamily: 'Instrument Sans, sans-serif', boxSizing: 'border-box' }}
                                            onFocus={e => (e.target as HTMLInputElement).style.borderColor = `${B.gold}50`}
                                            onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.09)'}
                                        />
                                        <button onClick={() => customNote && sendQuickNote(activeRequest.id, customNote)} disabled={sendingNote || !customNote}
                                            style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: 7, border: 'none', cursor: customNote ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', background: customNote ? B.gold : 'rgba(255,255,255,0.06)', color: customNote ? B.onGold : 'rgba(255,255,255,0.18)', transition: 'all 0.18s' }}>
                                            {sendingNote ? <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Send size={13} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Action buttons */}
                                <div className="cls-action-btns" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                                    {/* LIBERAR — gold */}
                                    <button onClick={() => handleResponse(activeRequest.id, 'LIBERAR')}
                                        style={{ width: '100%', padding: '17px 10px', background: `linear-gradient(135deg, ${B.gold} 0%, ${B.goldDark} 100%)`, border: 'none', borderRadius: 14, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, boxShadow: `0 6px 24px ${B.gold}38`, transition: 'all 0.2s' }}
                                        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = `0 10px 32px ${B.gold}52`; }}
                                        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(0)'; el.style.boxShadow = `0 6px 24px ${B.gold}38`; }}
                                    >
                                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(7,24,48,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Check size={19} style={{ color: B.onGold }} />
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: `${B.onGold}75`, marginBottom: 1 }}>Finalizar &amp;</p>
                                            <p style={{ fontFamily: 'Epilogue, sans-serif', fontSize: 13, fontWeight: 800, color: B.onGold, letterSpacing: '-0.01em' }}>Liberar Aluno</p>
                                        </div>
                                    </button>

                                    {/* AGUARDAR */}
                                    <button onClick={() => {
                                        if (confirmPending === 'AGUARDAR') { handleResponse(activeRequest.id, 'AGUARDAR'); setConfirmPending(null); }
                                        else { setConfirmPending('AGUARDAR'); setTimeout(() => setConfirmPending(p => p === 'AGUARDAR' ? null : p), 3000); }
                                    }} style={{ width: '100%', padding: '11px', background: confirmPending === 'AGUARDAR' ? `${B.gold}14` : 'rgba(255,255,255,0.04)', border: `1.5px solid ${confirmPending === 'AGUARDAR' ? `${B.gold}48` : 'rgba(255,255,255,0.09)'}`, borderRadius: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9, transition: 'all 0.18s' }}>
                                        <div style={{ width: 30, height: 30, borderRadius: 7, background: confirmPending === 'AGUARDAR' ? `${B.gold}18` : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Clock size={13} style={{ color: confirmPending === 'AGUARDAR' ? B.gold : B.gray }} />
                                        </div>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: confirmPending === 'AGUARDAR' ? B.gold : B.grayLight, fontFamily: 'Instrument Sans, sans-serif' }}>
                                            {confirmPending === 'AGUARDAR' ? 'Confirmar?' : 'Aguardar'}
                                        </span>
                                    </button>

                                    {/* RECUSAR */}
                                    <button onClick={() => {
                                        if (confirmPending === 'RECUSAR') { handleResponse(activeRequest.id, 'RECUSAR'); setConfirmPending(null); }
                                        else { setConfirmPending('RECUSAR'); setTimeout(() => setConfirmPending(p => p === 'RECUSAR' ? null : p), 3000); }
                                    }} style={{ width: '100%', padding: '11px', background: confirmPending === 'RECUSAR' ? `${B.red}14` : 'rgba(255,255,255,0.04)', border: `1.5px solid ${confirmPending === 'RECUSAR' ? `${B.red}48` : 'rgba(255,255,255,0.09)'}`, borderRadius: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9, transition: 'all 0.18s' }}>
                                        <div style={{ width: 30, height: 30, borderRadius: 7, background: confirmPending === 'RECUSAR' ? `${B.red}18` : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <X size={13} style={{ color: confirmPending === 'RECUSAR' ? '#ff7b8a' : B.gray }} />
                                        </div>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: confirmPending === 'RECUSAR' ? '#ff7b8a' : B.grayLight, fontFamily: 'Instrument Sans, sans-serif' }}>
                                            {confirmPending === 'RECUSAR' ? 'Confirmar?' : 'Rejeitar'}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        </div>

                    ) : (
                        /* ════ EMPTY STATE ════ */
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 500, textAlign: 'center', gap: 26, opacity: mounted ? 1 : 0, transition: 'opacity 0.5s ease 0.1s' }}>

                            {/* Concentric rings */}
                            <div style={{ position: 'relative', width: 152, height: 152 }}>
                                <div style={{ position: 'absolute', inset: -28, borderRadius: '50%', border: `1px solid ${B.gold}10`, animation: 'ringPulse 3.5s ease-in-out infinite' }} />
                                <div style={{ position: 'absolute', inset: -14, borderRadius: '50%', border: `1px solid ${B.gold}18`, animation: 'ringPulse 3.5s ease-in-out infinite 0.4s' }} />
                                <div style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: `1.5px solid ${B.gold}28`, animation: 'ringPulse 3.5s ease-in-out infinite 0.8s' }} />
                                <div style={{ width: 152, height: 152, borderRadius: '50%', background: `radial-gradient(circle at 38% 35%, ${B.navy}, ${B.navyDark})`, border: `2.5px solid ${B.gold}38`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 48px ${B.gold}12, 0 12px 48px rgba(7,24,48,0.8)` }}>
                                    <Bell size={50} style={{ color: B.gold, filter: `drop-shadow(0 0 10px ${B.gold}60)`, animation: 'bellSway 3s ease-in-out infinite' }} />
                                </div>
                            </div>

                            <div>
                                <h2 style={{ fontFamily: 'Epilogue, sans-serif', fontSize: 24, fontWeight: 800, color: B.white, letterSpacing: '-0.03em', marginBottom: 8, lineHeight: 1.15 }}>
                                    Aguardando Solicitações
                                </h2>
                                <p style={{ fontSize: 13, color: B.gray, maxWidth: 290, lineHeight: 1.65, margin: '0 auto' }}>
                                    Monitoramento ativo. Novas solicitações de retirada aparecerão aqui automaticamente.
                                </p>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 20px', background: `${B.gold}12`, border: `1px solid ${B.gold}28`, borderRadius: 30 }}>
                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: B.gold, boxShadow: `0 0 8px ${B.gold}`, animation: 'glowPulse 1.5s ease-in-out infinite' }} />
                                <span style={{ fontSize: 10, fontWeight: 700, color: B.gold, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Varredura Ativa</span>
                            </div>

                            <div style={{ padding: '10px 22px', background: 'rgba(16,70,153,0.18)', border: `1px solid ${B.navy}55`, borderRadius: 10 }}>
                                <p style={{ fontSize: 9.5, fontWeight: 600, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                                    La Salle, Cheguei! — Sistema Escolar
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes glowPulse { 0%,100%{opacity:1;box-shadow:0 0 8px ${B.gold};} 50%{opacity:.6;box-shadow:0 0 18px ${B.gold};} }
                @keyframes bellSway { 0%,100%{transform:rotate(-7deg);} 50%{transform:rotate(7deg);} }
                @keyframes ringPulse { 0%{opacity:.25;transform:scale(1);} 50%{opacity:.6;transform:scale(1.04);} 100%{opacity:.25;transform:scale(1);} }

                /* ── Responsive: tablet (max 1024px) ── */
                @media (max-width: 1024px) {
                    .cls-main-body { flex-direction: column !important; overflow-y: auto !important; }
                }

                /* ── Responsive: mobile (max 640px) ── */
                @media (max-width: 640px) {
                    .cls-main-body { flex-direction: column !important; overflow-y: auto !important; }
                    .cls-hero-card { flex-direction: column !important; }
                    .cls-photo-col {
                        width: 100% !important;
                        border-right: none !important;
                        border-bottom: 1px solid rgba(251,209,45,0.1);
                        flex-direction: row !important;
                        align-items: center !important;
                        gap: 16px !important;
                        padding: 18px 18px !important;
                    }
                    .cls-controls-grid { grid-template-columns: 1fr !important; }
                    .cls-action-btns {
                        display: grid !important;
                        grid-template-columns: 1fr 1fr 1fr !important;
                        width: 100% !important;
                    }
                    .cls-class-filter { display: none !important; }
                }
            `}</style>
        </div>
    );
}
