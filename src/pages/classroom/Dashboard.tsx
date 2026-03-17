import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
    Bell, Clock, LogOut, Check, X, User as UserIcon,
    Volume2, VolumeX, Send, AlertTriangle, MessageSquare,
    ChevronRight, School, Loader2, ArrowLeft, Home, MapPin,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
    mensagem_sala: string | null;
    status_geofence: string | null;
    distancia_estimada_metros: number | null;
};

// ── Design tokens ─────────────────────────────────────────────────────────────
const D = {
    bgDark1:     '#0A0F1F',
    bgDark2:     '#121A2B',
    glassBg:     'rgba(255,255,255,0.03)',
    borderLight: 'rgba(255,255,255,0.08)',
    gold:        '#F1C40F',
    goldDark:    '#D4AC0D',
    blue:        '#3498DB',
    blueSecondary: '#2980B9',
    green:       '#38D9A9',
    textMain:    '#FFFFFF',
    textMuted:   '#8C98A6',
    textMutedDark: '#6A7788',
    red:         '#E40123',
    glowBlue:    'rgba(52,152,219,0.5)',
    glowGold:    'rgba(241,196,15,0.5)',
    glowGreen:   'rgba(56,217,169,0.5)',
};

const QUICK_NOTES = ['A caminho', 'Lanchando', 'No banheiro', 'Em atendimento'];

// ── Radar Empty State ─────────────────────────────────────────────────────────
function RadarIdle() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 32, textAlign: 'center' }}>
            {/* Radar */}
            <div style={{ position: 'relative', width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle, rgba(22,28,44,0.2), rgba(10,15,31,0.8))', display: 'grid', placeItems: 'center' }}>
                {/* Spinning arcs */}
                {[320, 270, 220].map((size, i) => (
                    <div key={i} className="cls-radar-spin" style={{
                        position: 'absolute', width: size, height: size,
                        borderRadius: '50%',
                        border: `1px solid ${D.borderLight}`,
                        borderTop: `1px solid ${i === 0 ? D.blue : i === 1 ? D.gold : D.green}`,
                        animationDuration: `${6 + i * 2}s`,
                        animationDirection: i % 2 === 0 ? 'normal' : 'reverse',
                    }} />
                ))}
                {/* Central circle */}
                <div style={{
                    width: 150, height: 150, borderRadius: '50%',
                    background: D.blueSecondary,
                    display: 'grid', placeItems: 'center',
                    position: 'relative', zIndex: 2,
                    border: `1px solid rgba(255,255,255,0.06)`,
                    boxShadow: `0 0 40px ${D.glowBlue}, inset 0 0 20px rgba(0,0,0,0.2)`,
                }}>
                    <Bell size={52} style={{ color: D.gold, filter: `drop-shadow(0 0 18px ${D.glowGold})`, animation: 'cls-bell-glow 2s ease-in-out infinite' }} />
                </div>
            </div>

            {/* Text */}
            <div>
                <h3 style={{ fontSize: 22, fontWeight: 600, color: D.textMain, marginBottom: 10 }}>
                    Aguardando Solicitações
                </h3>
                <p style={{ fontSize: 14, fontWeight: 500, color: D.textMuted, maxWidth: 320, lineHeight: 1.65, margin: '0 auto' }}>
                    Monitoramento ativo. Novas solicitações de retirada aparecerão aqui automaticamente.
                </p>
            </div>

            {/* Status pills */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px', background: 'rgba(255,255,255,0.01)', border: `1px solid rgba(56,217,169,0.2)`, borderRadius: 8, backdropFilter: 'blur(5px)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: D.green, boxShadow: `0 0 8px ${D.glowGreen}`, animation: 'cls-dot-pulse 1.5s infinite' }} />
                    <span style={{ color: D.green, fontWeight: 600, fontSize: 14 }}>VARREDURA ATIVA</span>
                </div>
                <div style={{ padding: '8px 20px', background: 'rgba(255,255,255,0.01)', border: `1px solid rgba(255,255,255,0.03)`, borderRadius: 8, backdropFilter: 'blur(2px)' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: D.textMutedDark, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        LA SALLE, CHEGUEI! — SISTEMA ESCOLAR
                    </span>
                </div>
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ClassroomDashboard() {
    const { user, signOut, role } = useAuth();
    const navigate  = useNavigate();
    const toast     = useToast();

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

    useEffect(() => {
        if (!document.getElementById('cls-montserrat')) {
            const link = document.createElement('link');
            link.id = 'cls-montserrat';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap';
            document.head.appendChild(link);
        }
        setTimeout(() => setMounted(true), 80);
    }, []);

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

    const prevTotalRef = useRef(requests.length);
    useEffect(() => {
        if (requests.length > prevTotalRef.current && soundEnabled) playNotificationSound();
        prevTotalRef.current = requests.length;
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
            if ((action === 'RECUSAR' || action === 'AGUARDAR') && activeRequest?.id === requestId)
                setActiveRequest(null);
        }
    };

    const sendQuickNote = async (requestId: string, note: string) => {
        setSendingNote(true);
        const { error } = await supabase.from('solicitacoes_retirada')
            .update({ mensagem_sala: note }).eq('id', requestId);
        if (!error) { setCustomNote(''); }
        else { toast.error('Erro ao enviar nota', error.message); }
        setSendingNote(false);
    };

    const handleLogout = async () => { await signOut(); navigate('/sala/login'); };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div style={{
            height: '100vh', overflow: 'hidden',
            display: 'grid',
            gridTemplateAreas: '"header header" "sidebar main"',
            gridTemplateColumns: '400px 1fr',
            gridTemplateRows: 'auto 1fr',
            background: `radial-gradient(circle at 75% 10%, ${D.bgDark2}, ${D.bgDark1} 70%)`,
            fontFamily: "'Montserrat', system-ui, sans-serif",
            color: D.textMain,
            opacity: mounted ? 1 : 0, transition: 'opacity 0.4s',
        }}>

            {/* ── CSS Animations & Responsive ── */}
            <style>{`
                @keyframes cls-radar-spin  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes cls-bell-glow   { 0%,100% { filter: drop-shadow(0 0 15px rgba(241,196,15,0.5)); } 50% { filter: drop-shadow(0 0 30px rgba(241,196,15,0.8)); } }
                @keyframes cls-dot-pulse   { 0%,100% { box-shadow: 0 0 0 0 rgba(56,217,169,0.7); } 70% { box-shadow: 0 0 0 6px rgba(56,217,169,0); } }
                @keyframes cls-spin        { to { transform: rotate(360deg); } }
                @keyframes cls-glow-btn    { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
                .cls-radar-spin { animation: cls-radar-spin linear infinite; }
                @media (max-width: 1024px) {
                    .cls-grid { grid-template-areas: "header" "sidebar" "main" !important; grid-template-columns: 1fr !important; grid-template-rows: auto auto 1fr !important; height: auto !important; overflow: auto !important; }
                    .cls-controls-grid { grid-template-columns: 1fr !important; }
                }
                @media (max-width: 640px) {
                    .cls-hdr { flex-wrap: wrap !important; gap: 10px !important; }
                    .cls-hdr-center { order: -1; width: 100%; justify-content: center; }
                    .cls-hero-card { flex-direction: column !important; }
                    .cls-photo-col { width: 100% !important; border-right: none !important; border-bottom: 1px solid ${D.borderLight} !important; flex-direction: row !important; padding: 16px !important; }
                    .cls-action-btns { display: grid !important; grid-template-columns: 1fr 1fr 1fr !important; }
                    .cls-class-filter { display: none !important; }
                }
            `}</style>

            {/* ════════════ HEADER ════════════ */}
            <header className="cls-hdr" style={{
                gridArea: 'header',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '15px 30px',
                backdropFilter: 'blur(10px)',
                background: D.glassBg,
                borderBottom: `1px solid ${D.borderLight}`,
                zIndex: 100, gap: 16,
            }}>
                {/* Left: nav buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                        onClick={() => navigate(-1)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(52,152,219,0.4)`,
                            color: D.blue, padding: '10px 20px', borderRadius: 8,
                            fontWeight: 600, fontSize: 14, cursor: 'pointer',
                            transition: 'all 0.2s', backdropFilter: 'blur(5px)',
                            boxShadow: `0 0 10px rgba(52,152,219,0.15)`,
                            fontFamily: 'Montserrat, sans-serif',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(52,152,219,0.1)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                    >
                        <ArrowLeft size={15} /> VOLTAR
                    </button>
                    <button
                        onClick={() => navigate('/')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(241,196,15,0.4)`,
                            color: D.gold, padding: '10px 20px', borderRadius: 8,
                            fontWeight: 600, fontSize: 14, cursor: 'pointer',
                            transition: 'all 0.2s', backdropFilter: 'blur(5px)',
                            boxShadow: `0 0 10px rgba(241,196,15,0.15)`,
                            fontFamily: 'Montserrat, sans-serif',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(241,196,15,0.1)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                    >
                        <Home size={15} /> INÍCIO
                    </button>
                </div>

                {/* Center: logo + title */}
                <div className="cls-hdr-center" style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                    <div style={{
                        width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                        background: D.gold, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: `0 0 12px ${D.glowGold}`,
                    }}>
                        <School size={17} style={{ color: '#0A0F1F' }} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 600, lineHeight: 1.1 }}>LA SALLE, CHEGUEI! — SCT</h1>
                        <p style={{ margin: 0, fontSize: 12, color: D.textMuted }}>Portal da Sala</p>
                    </div>
                </div>

                {/* Right: controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {/* Class filter (admin/coord only) */}
                    {(role === 'ADMIN' || role === 'COORDENADOR') && (
                        <div className="cls-class-filter" style={{
                            display: 'flex', alignItems: 'center',
                            background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(5px)',
                            border: `1px solid rgba(52,152,219,0.3)`, borderRadius: 8,
                            boxShadow: `0 0 10px rgba(52,152,219,0.1)`,
                        }}>
                            <button onClick={() => setSelectedClass('TODAS')} style={{
                                background: selectedClass === 'TODAS' ? 'rgba(255,255,255,0.05)' : 'none',
                                border: 'none', color: selectedClass === 'TODAS' ? D.gold : D.textMuted,
                                padding: '9px 14px', fontSize: 13, fontWeight: selectedClass === 'TODAS' ? 700 : 400,
                                cursor: 'pointer', borderRadius: 8, fontFamily: 'Montserrat, sans-serif',
                                transition: 'all 0.2s',
                            }}>TODAS</button>
                            <div style={{ position: 'relative', paddingRight: 20 }}>
                                <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} style={{
                                    appearance: 'none', background: 'transparent', border: 'none', outline: 'none',
                                    color: D.textMuted, fontSize: 13, fontWeight: 400,
                                    padding: '9px 8px', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif',
                                }}>
                                    <option value="TODAS" style={{ color: '#000', background: '#fff' }}>FILTRAR</option>
                                    {allClasses.map(c => <option key={c} value={c} style={{ color: '#000', background: '#fff' }}>{c}</option>)}
                                </select>
                                <ChevronRight size={10} style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%) rotate(90deg)', color: D.textMutedDark, pointerEvents: 'none' }} />
                            </div>
                        </div>
                    )}

                    {/* Queue counter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: D.gold, fontWeight: 700, fontSize: 14 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: D.green, boxShadow: `0 0 8px ${D.glowGreen}`, animation: 'cls-dot-pulse 1.5s infinite' }} />
                        <span style={{ fontSize: 20, fontWeight: 700 }}>{requests.length}</span>
                        <span style={{ fontSize: 12, fontWeight: 500 }}>FILA</span>
                        <span style={{ fontSize: 11, color: D.textMuted }}>AO VIVO</span>
                    </div>

                    {/* Sound toggle */}
                    <button onClick={() => setSoundEnabled(!soundEnabled)} style={{
                        width: 36, height: 36, borderRadius: 8, border: `1px solid ${soundEnabled ? `rgba(241,196,15,0.3)` : D.borderLight}`,
                        background: soundEnabled ? 'rgba(241,196,15,0.07)' : 'rgba(255,255,255,0.02)',
                        color: soundEnabled ? D.gold : D.textMutedDark,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s',
                    }}>
                        {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                    </button>

                    {/* Logout */}
                    <button onClick={handleLogout} style={{
                        width: 36, height: 36, borderRadius: 8,
                        border: `1px solid rgba(228,1,35,0.3)`,
                        background: 'rgba(228,1,35,0.07)', color: '#ff7b8a',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s',
                    }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(228,1,35,0.2)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(228,1,35,0.07)'; (e.currentTarget as HTMLElement).style.color = '#ff7b8a'; }}
                    >
                        <LogOut size={15} />
                    </button>
                </div>
            </header>

            {/* ════════════ SIDEBAR (PriorityPipeline) ════════════ */}
            <aside style={{
                gridArea: 'sidebar',
                display: 'flex', flexDirection: 'column',
                backdropFilter: 'blur(10px)',
                background: D.glassBg,
                borderRight: `1px solid ${D.borderLight}`,
                overflow: 'hidden',
            }}>
                <PriorityPipeline
                    userId={user?.id || ''}
                    selectedClass={selectedClass}
                    activeRequestId={activeRequest?.id}
                    onSelectRequest={req => setActiveRequest(req as any)}
                    onQueueChange={reqs => setRequests(reqs as any)}
                    escolaId={escolaId}
                />
            </aside>

            {/* ════════════ MAIN ════════════ */}
            <main style={{
                gridArea: 'main',
                overflowY: 'auto',
                padding: '28px',
                opacity: mounted ? 1 : 0,
                transition: 'opacity 0.4s ease 0.1s',
            }}>
                {activeRequest ? (

                    /* ──── ACTIVE REQUEST ──── */
                    <div style={{ maxWidth: 860 }}>

                        {/* Hero student card */}
                        <div style={{
                            background: D.glassBg, backdropFilter: 'blur(10px)',
                            borderRadius: 16, overflow: 'hidden', marginBottom: 14,
                            border: `1px solid ${D.borderLight}`,
                        }}>
                            {/* Gold top rule */}
                            <div style={{ height: 3, background: `linear-gradient(90deg, ${D.gold}, ${D.blue}80, transparent)` }} />

                            {/* Emergency banner */}
                            {activeRequest.tipo_solicitacao === 'EMERGENCIA' && (
                                <div style={{ background: D.red, padding: '8px 22px', display: 'flex', alignItems: 'center', gap: 9 }}>
                                    <AlertTriangle size={14} style={{ color: '#fff' }} />
                                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#fff' }}>
                                        Prioridade Crítica — Atendimento Imediato
                                    </span>
                                </div>
                            )}

                            <div className="cls-hero-card" style={{ display: 'flex', flexWrap: 'wrap' }}>
                                {/* Photo column */}
                                <div className="cls-photo-col" style={{
                                    width: 200, flexShrink: 0,
                                    background: 'rgba(10,15,31,0.6)',
                                    padding: '26px 18px',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
                                    borderRight: `1px solid ${D.borderLight}`,
                                }}>
                                    <div style={{ position: 'relative' }}>
                                        <div style={{
                                            width: 136, height: 136, borderRadius: 14, overflow: 'hidden',
                                            border: `3px solid ${D.gold}`,
                                            boxShadow: `0 0 0 6px ${D.gold}14, 0 10px 36px rgba(10,15,31,0.8)`,
                                            background: D.bgDark2,
                                        }}>
                                            {activeRequest.aluno.foto_url ? (
                                                <img src={activeRequest.aluno.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(52,152,219,0.1)' }}>
                                                    <UserIcon size={52} style={{ color: `${D.gold}45` }} />
                                                </div>
                                            )}
                                        </div>
                                        {/* Corner accents */}
                                        <div style={{ position: 'absolute', top: -2, left: -2, width: 16, height: 16, borderTop: `3px solid ${D.gold}`, borderLeft: `3px solid ${D.gold}`, borderRadius: '4px 0 0 0' }} />
                                        <div style={{ position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderTop: `3px solid ${D.gold}`, borderRight: `3px solid ${D.gold}`, borderRadius: '0 4px 0 0' }} />
                                        <div style={{ position: 'absolute', bottom: -2, left: -2, width: 16, height: 16, borderBottom: `3px solid ${D.gold}`, borderLeft: `3px solid ${D.gold}`, borderRadius: '0 0 0 4px' }} />
                                        <div style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderBottom: `3px solid ${D.gold}`, borderRight: `3px solid ${D.gold}`, borderRadius: '0 0 4px 0' }} />
                                    </div>

                                    {/* Guardian */}
                                    <div style={{ width: '100%' }}>
                                        <p style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.24em', textTransform: 'uppercase', color: `${D.gold}70`, marginBottom: 7, textAlign: 'center' }}>
                                            Quem Retira
                                        </p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 9px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${D.borderLight}`, borderRadius: 9 }}>
                                            <div style={{ width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', background: D.bgDark2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1.5px solid ${D.gold}28` }}>
                                                {activeRequest.responsavel?.foto_url
                                                    ? <img src={activeRequest.responsavel.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    : <UserIcon size={12} style={{ color: `${D.gold}55` }} />}
                                            </div>
                                            <p style={{ fontSize: 10.5, fontWeight: 600, color: D.textMain, lineHeight: 1.25, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                                                {activeRequest.responsavel?.nome_completo || 'Não atribuído'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Info column */}
                                <div style={{ flex: 1, padding: '26px 24px 22px', minWidth: 0 }}>
                                    {/* Badges */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 13 }}>
                                        <span style={{ padding: '3px 10px', background: `${D.blue}16`, border: `1px solid ${D.blue}38`, borderRadius: 4, fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: D.blue }}>
                                            SCT Ativo
                                        </span>
                                        {activeRequest.aluno.observacoes && (
                                            <span style={{ padding: '3px 10px', background: `${D.red}14`, border: `1px solid ${D.red}38`, borderRadius: 4, fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#ff7b8a', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <AlertTriangle size={8} /> Alerta Médico
                                            </span>
                                        )}
                                    </div>

                                    {/* Name */}
                                    <h2 style={{ fontSize: 'clamp(22px, 3vw, 36px)', fontWeight: 700, color: D.textMain, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 18 }}>
                                        {activeRequest.aluno.nome_completo.split(' ').slice(0, 2).join(' ')}
                                        {activeRequest.aluno.nome_completo.split(' ').length > 2 && (
                                            <><br /><span style={{ color: D.gold }}>{activeRequest.aluno.nome_completo.split(' ').slice(2).join(' ')}</span></>
                                        )}
                                    </h2>

                                    {/* Metadata chips */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
                                        {/* Room */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${D.borderLight}`, borderRadius: 10 }}>
                                            <div style={{ width: 30, height: 30, borderRadius: 7, background: `${D.blue}15`, border: `1px solid ${D.blue}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <School size={13} style={{ color: D.gold }} />
                                            </div>
                                            <div>
                                                <p style={{ fontSize: 12, fontWeight: 700, color: D.textMain, lineHeight: 1, marginBottom: 2 }}>{activeRequest.aluno.sala}</p>
                                                <p style={{ fontSize: 9.5, fontWeight: 500, color: D.textMuted, letterSpacing: '0.06em' }}>{activeRequest.aluno.turma}</p>
                                            </div>
                                        </div>

                                        {/* Time */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${D.borderLight}`, borderRadius: 10 }}>
                                            <div style={{ width: 30, height: 30, borderRadius: 7, background: `${D.blue}15`, border: `1px solid ${D.blue}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Clock size={13} style={{ color: D.gold }} />
                                            </div>
                                            <div>
                                                <p style={{ fontSize: 12, fontWeight: 700, color: D.textMain, lineHeight: 1, marginBottom: 2 }}>
                                                    {activeRequest.horario_solicitacao ? new Date(activeRequest.horario_solicitacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                                </p>
                                                <p style={{ fontSize: 9.5, fontWeight: 500, color: D.textMuted, letterSpacing: '0.06em' }}>solicitado às</p>
                                            </div>
                                        </div>

                                        {/* Geofence */}
                                        {activeRequest.status_geofence === 'CHEGOU' ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: `${D.green}10`, border: `1px solid ${D.green}30`, borderRadius: 10 }}>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: D.green, boxShadow: `0 0 0 3px ${D.green}30`, flexShrink: 0 }} />
                                                <span style={{ fontSize: 12, fontWeight: 600, color: D.green }}>Na recepção</span>
                                            </div>
                                        ) : activeRequest.status_geofence === 'PERTO' ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10 }}>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 0 3px rgba(245,158,11,0.25)', flexShrink: 0 }} className="animate-pulse" />
                                                <span style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b' }}>Responsável próximo</span>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 10 }}>
                                                <MapPin size={12} style={{ color: '#fbbf24' }} />
                                                <span style={{ fontSize: 12, fontWeight: 600, color: '#fbbf24' }}>Em deslocamento</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Reception message */}
                            {activeRequest.mensagem_recepcao && (
                                <div style={{ margin: '0 18px 18px', padding: '12px 16px', background: `${D.blue}18`, border: `1px solid ${D.blue}35`, borderLeft: `3px solid ${D.gold}`, borderRadius: 10, display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                                    <MessageSquare size={13} style={{ color: D.gold, flexShrink: 0, marginTop: 1 }} />
                                    <div>
                                        <p style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: D.gold, marginBottom: 4 }}>Nota da Recepção</p>
                                        <p style={{ fontSize: 13, fontWeight: 500, color: '#C8D8F4', lineHeight: 1.5 }}>{activeRequest.mensagem_recepcao}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Controls grid: notes + action buttons */}
                        <div className="cls-controls-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 188px', gap: 12, alignItems: 'start' }}>
                            {/* Note panel */}
                            <div style={{ background: D.glassBg, backdropFilter: 'blur(10px)', borderRadius: 16, padding: '18px 20px', border: `1px solid ${D.borderLight}` }}>
                                <p style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: D.gold, marginBottom: 2 }}>Mensagem para Recepção</p>
                                <p style={{ fontSize: 11, color: D.textMuted, marginBottom: 13 }}>Informe o status atual do aluno</p>

                                {/* Active message indicator */}
                                {activeRequest.mensagem_sala && (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        marginBottom: 10, padding: '8px 12px',
                                        background: `${D.gold}10`, border: `1px solid ${D.gold}35`,
                                        borderLeft: `3px solid ${D.gold}`, borderRadius: 9,
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <MessageSquare size={11} style={{ color: D.gold, flexShrink: 0 }} />
                                            <div>
                                                <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: `${D.gold}90`, marginBottom: 2 }}>Sinalizado</p>
                                                <p style={{ fontSize: 12, fontWeight: 600, color: D.gold }}>{activeRequest.mensagem_sala}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => sendQuickNote(activeRequest.id, '')}
                                            disabled={sendingNote}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: D.textMutedDark, padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}
                                            title="Limpar mensagem"
                                        >
                                            <X size={13} />
                                        </button>
                                    </div>
                                )}

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 13 }}>
                                    {QUICK_NOTES.map(note => {
                                        const isActive = activeRequest.mensagem_sala === note;
                                        return (
                                            <button key={note} onClick={() => sendQuickNote(activeRequest.id, isActive ? '' : note)} disabled={sendingNote}
                                                style={{
                                                    padding: '6px 13px',
                                                    background: isActive ? `${D.gold}18` : 'rgba(255,255,255,0.03)',
                                                    border: `1px solid ${isActive ? `${D.gold}60` : D.borderLight}`,
                                                    borderRadius: 18, fontSize: 11.5, fontWeight: isActive ? 700 : 600,
                                                    color: isActive ? D.gold : D.textMuted,
                                                    cursor: 'pointer', transition: 'all 0.17s', fontFamily: 'Montserrat, sans-serif',
                                                    boxShadow: isActive ? `0 0 10px ${D.gold}20` : 'none',
                                                }}
                                                onMouseEnter={e => { if (!isActive) { const el = e.currentTarget as HTMLElement; el.style.background = `${D.gold}12`; el.style.borderColor = `${D.gold}40`; el.style.color = D.gold; } }}
                                                onMouseLeave={e => { if (!isActive) { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.03)'; el.style.borderColor = D.borderLight; el.style.color = D.textMuted; } }}
                                            >{note}</button>
                                        );
                                    })}
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        value={customNote} onChange={e => setCustomNote(e.target.value)}
                                        onKeyPress={e => e.key === 'Enter' && customNote && sendQuickNote(activeRequest.id, customNote)}
                                        placeholder="Mensagem personalizada…"
                                        style={{ width: '100%', padding: '11px 50px 11px 15px', background: 'rgba(255,255,255,0.03)', border: `1.5px solid ${D.borderLight}`, borderRadius: 11, fontSize: 13, fontWeight: 500, color: D.textMain, outline: 'none', transition: 'border-color 0.18s', fontFamily: 'Montserrat, sans-serif', boxSizing: 'border-box' }}
                                        onFocus={e => (e.target as HTMLInputElement).style.borderColor = `${D.blue}60`}
                                        onBlur={e => (e.target as HTMLInputElement).style.borderColor = D.borderLight}
                                    />
                                    <button onClick={() => customNote && sendQuickNote(activeRequest.id, customNote)} disabled={sendingNote || !customNote}
                                        style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: 7, border: 'none', cursor: customNote ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', background: customNote ? D.gold : 'rgba(255,255,255,0.05)', color: customNote ? '#0A0F1F' : 'rgba(255,255,255,0.18)', transition: 'all 0.18s' }}>
                                        {sendingNote ? <Loader2 size={13} style={{ animation: 'cls-spin 0.8s linear infinite' }} /> : <Send size={13} />}
                                    </button>
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className="cls-action-btns" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                                {/* LIBERAR */}
                                <button onClick={() => handleResponse(activeRequest.id, 'LIBERAR')}
                                    style={{ width: '100%', padding: '17px 10px', background: `linear-gradient(135deg, ${D.gold} 0%, ${D.goldDark} 100%)`, border: 'none', borderRadius: 14, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, boxShadow: `0 6px 24px ${D.glowGold}`, transition: 'all 0.2s' }}
                                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = `0 10px 32px ${D.glowGold}`; }}
                                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(0)'; el.style.boxShadow = `0 6px 24px ${D.glowGold}`; }}
                                >
                                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Check size={19} style={{ color: '#0A0F1F' }} />
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.6)', marginBottom: 1 }}>Finalizar &amp;</p>
                                        <p style={{ fontSize: 13, fontWeight: 700, color: '#0A0F1F', letterSpacing: '-0.01em' }}>Liberar Aluno</p>
                                    </div>
                                </button>

                                {/* AGUARDAR */}
                                <button onClick={() => {
                                    if (confirmPending === 'AGUARDAR') { handleResponse(activeRequest.id, 'AGUARDAR'); setConfirmPending(null); }
                                    else { setConfirmPending('AGUARDAR'); setTimeout(() => setConfirmPending(p => p === 'AGUARDAR' ? null : p), 3000); }
                                }} style={{ width: '100%', padding: '11px', background: confirmPending === 'AGUARDAR' ? `${D.gold}12` : 'rgba(255,255,255,0.03)', border: `1.5px solid ${confirmPending === 'AGUARDAR' ? `${D.gold}48` : D.borderLight}`, borderRadius: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9, transition: 'all 0.18s' }}>
                                    <div style={{ width: 30, height: 30, borderRadius: 7, background: confirmPending === 'AGUARDAR' ? `${D.gold}18` : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Clock size={13} style={{ color: confirmPending === 'AGUARDAR' ? D.gold : D.textMuted }} />
                                    </div>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: confirmPending === 'AGUARDAR' ? D.gold : D.textMuted, fontFamily: 'Montserrat, sans-serif' }}>
                                        {confirmPending === 'AGUARDAR' ? 'Confirmar?' : 'Aguardar'}
                                    </span>
                                </button>

                                {/* RECUSAR */}
                                <button onClick={() => {
                                    if (confirmPending === 'RECUSAR') { handleResponse(activeRequest.id, 'RECUSAR'); setConfirmPending(null); }
                                    else { setConfirmPending('RECUSAR'); setTimeout(() => setConfirmPending(p => p === 'RECUSAR' ? null : p), 3000); }
                                }} style={{ width: '100%', padding: '11px', background: confirmPending === 'RECUSAR' ? `${D.red}12` : 'rgba(255,255,255,0.03)', border: `1.5px solid ${confirmPending === 'RECUSAR' ? `${D.red}48` : D.borderLight}`, borderRadius: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9, transition: 'all 0.18s' }}>
                                    <div style={{ width: 30, height: 30, borderRadius: 7, background: confirmPending === 'RECUSAR' ? `${D.red}18` : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <X size={13} style={{ color: confirmPending === 'RECUSAR' ? '#ff7b8a' : D.textMuted }} />
                                    </div>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: confirmPending === 'RECUSAR' ? '#ff7b8a' : D.textMuted, fontFamily: 'Montserrat, sans-serif' }}>
                                        {confirmPending === 'RECUSAR' ? 'Confirmar?' : 'Rejeitar'}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>

                ) : (
                    /* ──── RADAR EMPTY STATE ──── */
                    <RadarIdle />
                )}
            </main>
        </div>
    );
}
