import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    LogOut, Users, School, Activity, TrendingUp, QrCode,
    BarChart2, Shield, Settings, ChevronRight,
    FileText, UserCheck, LayoutGrid, ArrowLeft, Home, CalendarClock,
    X, Clock, User as UserIcon, AlertTriangle, Loader2,
} from 'lucide-react';
import { logAudit } from '../../lib/audit';

// ── Design tokens ─────────────────────────────────────────────────────────────
const D = {
    bgDark:      '#070a13',
    bgDash:      '#111422',
    glassBg:     'rgba(17,20,34,0.6)',
    glassBorder: '1px solid rgba(50,160,240,0.3)',
    glassBox:    '0 0 15px rgba(50,160,240,0.2)',
    glowBorder:  'rgba(50,160,240,0.3)',
    dimBorder:   'rgba(255,255,255,0.05)',
    gold:        '#f4d06f',
    textMain:    '#f8fafc',
    textMuted:   '#64748b',
    green:       '#34d399',
    red:         '#E40123',
};

const glassPanel: React.CSSProperties = {
    background:      D.glassBg,
    backdropFilter:  'blur(20px)',
    border:          D.glassBorder,
    borderRadius:    16,
    boxShadow:       D.glassBox,
};

// ── Animated counter ──────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1200) {
    const [value, setValue] = useState(0);
    const startTime = useRef<number | null>(null);
    const rafRef    = useRef<number>(0);

    useEffect(() => {
        if (target === 0) { setValue(0); return; }
        startTime.current = null;
        const animate = (ts: number) => {
            if (!startTime.current) startTime.current = ts;
            const progress = Math.min((ts - startTime.current) / duration, 1);
            const eased    = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(eased * target));
            if (progress < 1) rafRef.current = requestAnimationFrame(animate);
        };
        rafRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(rafRef.current);
    }, [target, duration]);

    return value;
}

// ── Live Clock ────────────────────────────────────────────────────────────────
function LiveClock() {
    const [time, setTime] = useState(new Date());
    useEffect(() => {
        const t = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);
    return (
        <span style={{ fontSize: '2rem', fontWeight: 300, color: D.gold, fontVariantNumeric: 'tabular-nums' }}>
            {time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
    );
}

// ── Stat Group ────────────────────────────────────────────────────────────────
function StatGroup({ label, value, unit = '', delay = 0, onClick, clickable = false }: {
    label: string; value: number; unit?: string; delay?: number;
    onClick?: () => void; clickable?: boolean;
}) {
    const animated = useCountUp(value, 1000 + delay);
    const [hov, setHov] = useState(false);
    return (
        <div
            onClick={onClick}
            onMouseEnter={() => clickable && setHov(true)}
            onMouseLeave={() => clickable && setHov(false)}
            style={{
                borderBottom: `1px solid ${D.dimBorder}`, paddingBottom: '1rem',
                cursor: clickable ? 'pointer' : 'default',
                borderRadius: clickable ? 8 : 0,
                padding: clickable ? '0.5rem 0.6rem 1rem' : undefined,
                background: clickable && hov ? 'rgba(244,208,111,0.05)' : 'transparent',
                transition: 'background 0.18s',
                marginInline: clickable ? '-0.6rem' : undefined,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: clickable && hov ? D.gold : D.textMuted, margin: 0, transition: 'color 0.18s' }}>
                    {label}
                </p>
                {clickable && (
                    <span style={{ fontSize: '0.62rem', color: hov ? D.gold : D.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', transition: 'color 0.18s' }}>
                        Ver detalhes →
                    </span>
                )}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: '2.8rem', fontWeight: 700, color: D.gold, lineHeight: 1.1 }}>
                    {animated.toLocaleString('pt-BR')}
                </span>
                {unit && (
                    <span style={{ fontSize: '1rem', fontWeight: 500, color: D.textMuted, marginLeft: 4 }}>
                        {unit}
                    </span>
                )}
            </div>
        </div>
    );
}

// ── Module Card ───────────────────────────────────────────────────────────────
function ModuleCard({ index, title, desc, icon: Icon, path, cta }: {
    index: string; title: string; desc: string; icon: any;
    path: string; cta: string;
}) {
    const navigate = useNavigate();
    const [hov, setHov] = useState(false);
    return (
        <div
            onClick={() => navigate(path)}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                ...glassPanel,
                padding: '1.5rem',
                display: 'flex', flexDirection: 'column', gap: '1rem',
                position: 'relative', overflow: 'hidden',
                cursor: 'pointer',
                transition: 'box-shadow 0.2s, background 0.2s',
                background: hov ? 'rgba(50,160,240,0.06)' : D.glassBg,
                boxShadow: hov ? `0 0 25px rgba(50,160,240,0.35)` : D.glassBox,
            }}
        >
            <span style={{ position: 'absolute', top: '1rem', right: '1.2rem', fontSize: '0.85rem', fontWeight: 600, color: D.textMuted }}>
                {index}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Icon size={28} style={{ color: D.gold }} />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: D.textMain }}>{title}</h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: D.textMuted, flexGrow: 1, lineHeight: 1.55 }}>{desc}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                    fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em',
                    fontWeight: 600, color: hov ? D.textMain : D.gold,
                    transition: 'color 0.2s',
                }}>
                    {cta}
                </span>
                <ChevronRight size={14} style={{ color: hov ? D.textMain : D.gold, transition: 'color 0.2s' }} />
            </div>
        </div>
    );
}

// ── Deck Item ─────────────────────────────────────────────────────────────────
function DeckItem({ icon: Icon, label, path }: { icon: any; label: string; path: string }) {
    const navigate = useNavigate();
    const [hov, setHov] = useState(false);
    return (
        <li
            onClick={() => navigate(path)}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                padding: '1rem 1.2rem',
                display: 'flex', alignItems: 'center', gap: '1rem',
                cursor: 'pointer', borderRadius: 8,
                background: hov ? 'rgba(50,160,240,0.06)' : 'transparent',
                transition: 'background 0.18s',
                listStyle: 'none',
            }}
        >
            <Icon size={16} style={{ color: hov ? D.gold : D.textMuted, transition: 'color 0.18s', flexShrink: 0 }} />
            <span style={{ fontSize: '0.9rem', color: hov ? D.textMain : D.textMain, transition: 'color 0.18s' }}>{label}</span>
        </li>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
    const { signOut } = useAuth();
    const navigate    = useNavigate();
    const [mounted, setMounted] = useState(false);
    const [stats, setStats] = useState({
        totalStudents: 0,
        activePickups: 0,
        dailyPickups:  0,
        avgWaitTime:   0,
    });
    const [latencyMs, setLatencyMs] = useState<number | null>(null);

    // ── Open Requests Modal ────────────────────────────────────────────────────
    type OpenRequest = {
        id: string;
        status: string;
        tipo_solicitacao: string;
        horario_solicitacao: string;
        aluno: { nome_completo: string; turma: string; sala: string } | null;
        responsavel: { nome_completo: string } | null;
    };
    const [showModal, setShowModal]         = useState(false);
    const [openRequests, setOpenRequests]   = useState<OpenRequest[]>([]);
    const [loadingModal, setLoadingModal]   = useState(false);

    const STATUS_LABEL: Record<string, { label: string; color: string }> = {
        SOLICITADO:  { label: 'Aguardando sala',      color: '#94a3b8' },
        NOTIFICADO:  { label: 'Sala notificada',      color: D.gold   },
        AGUARDANDO:  { label: 'Aguardando liberação', color: D.gold   },
        LIBERADO:    { label: 'A caminho',            color: '#60a5fa' },
        CONFIRMADO:  { label: 'Na recepção',          color: D.green  },
    };

    function elapsed(iso: string) {
        const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
        if (diff < 60) return `${diff}s atrás`;
        if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
        return `${Math.floor(diff / 3600)}h atrás`;
    }

    async function fetchOpenRequests() {
        setLoadingModal(true);
        const { data } = await supabase
            .from('solicitacoes_retirada')
            .select(`
                id, status, tipo_solicitacao, horario_solicitacao,
                aluno:alunos(nome_completo, turma, sala),
                responsavel:responsaveis(nome_completo)
            `)
            .not('status', 'in', '("CONCLUIDO","CANCELADO")')
            .order('horario_solicitacao', { ascending: true });
        setOpenRequests((data ?? []) as unknown as OpenRequest[]);
        setLoadingModal(false);
    }

    function openModal() {
        setShowModal(true);
        fetchOpenRequests();
    }

    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 80);
        return () => clearTimeout(t);
    }, []);

    async function fetchStats() {
        try {
            const today = new Date().toISOString().split('T')[0];

            // Measure Supabase round-trip latency
            const t0 = Date.now();

            const [studentsRes, activeRes, finishedRes, timesRes] = await Promise.all([
                // Total students — no escola_id filter to avoid silent mismatch
                supabase.from('alunos').select('*', { count: 'exact', head: true }),

                // Active pickups — all currently open (regardless of date), status fixed to CONCLUIDO
                supabase.from('solicitacoes_retirada')
                    .select('*', { count: 'exact', head: true })
                    .not('status', 'in', '("CONCLUIDO","CANCELADO")'),

                // Concluded pickups today — status fixed from 'ENTREGUE' → 'CONCLUIDO'
                supabase.from('solicitacoes_retirada')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'CONCLUIDO')
                    .gte('horario_confirmacao', `${today}T00:00:00`),

                // Timestamps of concluded pickups today — for real avg wait time calculation
                supabase.from('solicitacoes_retirada')
                    .select('horario_solicitacao, horario_confirmacao')
                    .eq('status', 'CONCLUIDO')
                    .gte('horario_confirmacao', `${today}T00:00:00`)
                    .not('horario_confirmacao', 'is', null),
            ]);

            setLatencyMs(Date.now() - t0);

            // Calculate real average wait time in minutes
            const times = (timesRes.data ?? []) as { horario_solicitacao: string; horario_confirmacao: string }[];
            let avgWaitTime = 0;
            if (times.length > 0) {
                const totalMs = times.reduce((sum, r) => {
                    return sum + (new Date(r.horario_confirmacao).getTime() - new Date(r.horario_solicitacao).getTime());
                }, 0);
                avgWaitTime = Math.round(totalMs / times.length / 60000);
            }

            setStats({
                totalStudents: studentsRes.count ?? 0,
                activePickups: activeRes.count   ?? 0,
                dailyPickups:  finishedRes.count ?? 0,
                avgWaitTime,
            });
        } catch (err) {
            console.error('fetchStats:', err);
        }
    }

    useEffect(() => {
        fetchStats();
        logAudit('SISTEMA_LOGIN', undefined, undefined, { modulo: 'ADMIN_DASHBOARD_V2' });
        const interval = setInterval(fetchStats, 60000);
        return () => clearInterval(interval);
    }, []);

    const handleLogout = async () => {
        logAudit('SISTEMA_LOGOUT', undefined, undefined, { modulo: 'ADMIN_DASHBOARD_V2' });
        await signOut();
        navigate('/admin/login');
    };

    return (
        <div style={{
            height: '100vh', display: 'flex', overflow: 'hidden',
            background: D.bgDark,
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            color: D.textMain,
            opacity: mounted ? 1 : 0, transition: 'opacity 0.4s',
        }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
                @keyframes adm-pulse { 0%{box-shadow:0 0 0 0 rgba(52,211,153,0.7)} 70%{box-shadow:0 0 0 6px rgba(52,211,153,0)} 100%{box-shadow:0 0 0 0 rgba(52,211,153,0)} }
                @keyframes adm-spin  { to { transform: rotate(360deg); } }
                .adm-sidebar-hidden { display: none !important; }
                @media (max-width: 1024px) {
                    .adm-sidebar { display: none !important; }
                    .adm-hdr { grid-template-columns: 1fr auto !important; }
                    .adm-modules { grid-template-columns: 1fr 1fr !important; }
                }
                @media (max-width: 640px) {
                    .adm-hdr { grid-template-columns: 1fr !important; }
                    .adm-modules { grid-template-columns: 1fr !important; }
                    .adm-deck { grid-template-columns: 1fr !important; }
                    .adm-btmnav { grid-template-columns: 1fr !important; height: auto !important; }
                }
            `}</style>

            {/* ── Sidebar ── */}
            <aside className="adm-sidebar" style={{
                width: 280, flexShrink: 0,
                background: D.bgDash,
                display: 'flex', flexDirection: 'column',
                padding: '2rem 1.5rem',
                position: 'relative',
            }}>
                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <School size={32} style={{ color: D.gold }} />
                    <div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, lineHeight: 1.1, color: D.textMain }}>
                            SISRA <span style={{ color: D.gold }}>Admin</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: D.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>
                            Interface Administrativa · 2026
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flexGrow: 1 }}>
                    <StatGroup label="Total de Alunos"     value={stats.totalStudents} delay={0}   />
                    <StatGroup label="Retiradas Hoje"      value={stats.dailyPickups}  delay={100} />
                    <StatGroup label="Em Aberto" value={stats.activePickups} delay={200} clickable onClick={openModal} />
                    <StatGroup label="Tempo Médio Resp."   value={stats.avgWaitTime}   delay={300} unit="Min" />
                </div>

                {/* Status bar */}
                <div style={{
                    position: 'absolute', bottom: '1.5rem', left: '1.5rem', right: '1.5rem',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    fontSize: '0.75rem', color: D.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em',
                }}>
                    <div style={{
                        width: 8, height: 8, borderRadius: '50%', background: D.green,
                        animation: 'adm-pulse 1.5s infinite',
                    }} />
                    <span>Supabase · {latencyMs !== null ? `${latencyMs}ms` : '—'}</span>
                </div>
            </aside>

            {/* ── Main ── */}
            <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

                {/* ── Header ── */}
                <header className="adm-hdr" style={{
                    padding: '1rem 2rem',
                    display: 'grid',
                    gridTemplateColumns: '2fr auto auto',
                    alignItems: 'center',
                    gap: '1.5rem',
                    borderBottom: `1px solid ${D.dimBorder}`,
                    flexShrink: 0,
                }}>
                    {/* Nav buttons */}
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <button
                            onClick={() => navigate(-1)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '0.6rem 1.2rem',
                                background: 'rgba(255,255,255,0.03)',
                                border: `1px solid rgba(255,255,255,0.1)`,
                                color: D.textMuted, borderRadius: 8,
                                fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(50,160,240,0.1)'; el.style.color = D.textMain; el.style.borderColor = D.glowBorder; }}
                            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.03)'; el.style.color = D.textMuted; el.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                        >
                            <ArrowLeft size={16} /> Voltar
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '0.6rem 1.2rem',
                                background: 'rgba(255,255,255,0.03)',
                                border: `1px solid rgba(244,208,111,0.3)`,
                                color: D.textMuted, borderRadius: 8,
                                fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(244,208,111,0.08)'; el.style.color = D.gold; el.style.borderColor = `${D.gold}70`; }}
                            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.03)'; el.style.color = D.textMuted; el.style.borderColor = 'rgba(244,208,111,0.3)'; }}
                        >
                            <Home size={16} /> Início
                        </button>
                    </div>

                    {/* Title */}
                    <div style={{ textAlign: 'right', borderLeft: `1px solid ${D.dimBorder}`, paddingLeft: '1.5rem' }}>
                        <div style={{ fontSize: '0.8rem', color: D.gold, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500 }}>
                            La Salle, Cheguei! · ADM
                        </div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: D.textMain }}>
                            Painel Administrativo
                        </h1>
                    </div>

                    {/* Clock + live + logout */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <LiveClock />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: D.green }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: D.green, animation: 'adm-pulse 1.5s infinite' }} />
                            Sistema Ativo
                        </div>
                        <button
                            onClick={handleLogout}
                            title="Sair"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: D.textMuted, display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f43f5e'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = D.textMuted; }}
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </header>

                {/* ── Dashboard sections ── */}
                <section style={{ padding: '1rem 2rem 2rem', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Módulos Operacionais */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h2 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: D.textMuted, fontWeight: 500 }}>
                                Módulos Operacionais
                            </h2>
                            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: D.textMuted, fontWeight: 500 }}>
                                3 Ativos
                            </span>
                        </div>
                        <div className="adm-modules" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                            <ModuleCard index="01" title="Sala de Aula"
                                desc="Gestão de professores e SCTs. Chamadas e alertas em tempo real."
                                icon={School} path="/sala/dashboard" cta="Acessar Portal" />
                            <ModuleCard index="02" title="Terminal Recepção"
                                desc="Identificação e busca de alunos para controle de portaria."
                                icon={Activity} path="/recepcao/busca" cta="Abrir Terminal" />
                            <ModuleCard index="03" title="Inteligência & Dados"
                                desc="Telemetria, auditoria de retiradas e exportação de logs completos."
                                icon={BarChart2} path="/admin/exportar-dados" cta="Ver Relatórios" />
                        </div>
                    </div>

                    {/* Deck de Gestão Global */}
                    <div>
                        <h2 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: D.textMuted, fontWeight: 500, marginBottom: '0.75rem' }}>
                            Deck de Gestão Global
                        </h2>
                        <ul className="adm-deck" style={{
                            ...glassPanel,
                            display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
                            padding: '0.5rem', margin: 0,
                        }}>
                            <DeckItem icon={Users}       label="Gestão de Alunos"       path="/admin/alunos" />
                            <DeckItem icon={QrCode}      label="Central de Cartões QR"  path="/admin/cartoes-qr" />
                            <DeckItem icon={Shield}      label="Controle de Acessos"    path="/admin/usuarios" />
                            <DeckItem icon={Shield}      label="Auditoria de Segurança" path="/admin/auditoria-seguranca" />
                            <DeckItem icon={LayoutGrid}      label="Estrutura de Turmas"    path="/admin/turmas" />
                            <DeckItem icon={Settings}        label="Configurações Globais"  path="/admin/configuracoes" />
                            <DeckItem icon={CalendarClock}   label="Manutenção de Horários" path="/admin/manutencao/horarios" />
                        </ul>
                    </div>
                </section>

                {/* ── Bottom Nav ── */}
                <nav className="adm-btmnav" style={{
                    marginTop: 'auto',
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                    borderTop: `1px solid ${D.dimBorder}`,
                    background: D.bgDash,
                    flexShrink: 0,
                }}>
                    {[
                        { icon: FileText,   label: 'Histórico',    path: '/admin/historico-retiradas' },
                        { icon: UserCheck,  label: 'Funcionários', path: '/admin/funcionarios' },
                        { icon: TrendingUp, label: 'Relatórios',   path: '/admin/exportar-dados' },
                    ].map((item, i) => {
                        const [hov, setHov] = useState(false);
                        return (
                            <button
                                key={i}
                                onClick={() => navigate(item.path)}
                                onMouseEnter={() => setHov(true)}
                                onMouseLeave={() => setHov(false)}
                                style={{
                                    background: hov ? 'rgba(255,255,255,0.03)' : 'none',
                                    border: 'none',
                                    color: hov ? D.textMain : D.textMuted,
                                    padding: '1rem',
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                                    borderRadius: 8, transition: 'all 0.2s',
                                    borderBottom: hov ? `2px solid ${D.gold}` : '2px solid transparent',
                                    fontSize: '0.8rem', fontWeight: 500, letterSpacing: '0.1em',
                                    textTransform: 'uppercase',
                                }}
                            >
                                <item.icon size={16} style={{ color: hov ? D.gold : D.textMuted, transition: 'color 0.2s' }} />
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </nav>
            </main>

            {/* ── Modal: Solicitações Em Aberto ── */}
            {showModal && (
                <>
                    {/* Backdrop */}
                    <div
                        onClick={() => setShowModal(false)}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 200 }}
                    />

                    {/* Panel */}
                    <div style={{
                        position: 'fixed', top: '50%', left: '50%', zIndex: 201,
                        transform: 'translate(-50%, -50%)',
                        width: 'min(720px, 95vw)', maxHeight: '80vh',
                        display: 'flex', flexDirection: 'column',
                        background: D.bgDash,
                        border: `1px solid rgba(244,208,111,0.25)`,
                        borderRadius: 20,
                        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                        overflow: 'hidden',
                    }}>
                        {/* Header */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '1.2rem 1.5rem',
                            borderBottom: `1px solid ${D.dimBorder}`,
                            background: 'rgba(244,208,111,0.04)',
                            flexShrink: 0,
                        }}>
                            <div>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: D.textMain, margin: 0 }}>
                                    Solicitações Em Aberto
                                </h2>
                                <p style={{ fontSize: '0.75rem', color: D.textMuted, margin: '4px 0 0', lineHeight: 1.5 }}>
                                    Retiradas ainda não concluídas ou canceladas — podem ser de dias anteriores.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: D.textMuted, padding: 4 }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div style={{ overflowY: 'auto', flex: 1, padding: '1rem 1.5rem' }}>
                            {loadingModal ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: 12, color: D.textMuted }}>
                                    <Loader2 size={20} style={{ animation: 'adm-spin 1s linear infinite' }} />
                                    <span style={{ fontSize: '0.9rem' }}>Carregando solicitações...</span>
                                </div>
                            ) : openRequests.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: D.textMuted }}>
                                    <Activity size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                                    <p style={{ fontSize: '0.9rem' }}>Nenhuma solicitação em aberto no momento.</p>
                                </div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: `1px solid ${D.dimBorder}` }}>
                                            {['Aluno', 'Turma / Sala', 'Responsável', 'Status', 'Tempo'].map(h => (
                                                <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: D.textMuted, fontWeight: 600 }}>
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {openRequests.map((req, i) => {
                                            const st = STATUS_LABEL[req.status] ?? { label: req.status, color: D.textMuted };
                                            const isEmergency = req.tipo_solicitacao === 'EMERGENCIA';
                                            return (
                                                <tr key={req.id} style={{ borderBottom: `1px solid ${D.dimBorder}`, background: isEmergency ? 'rgba(228,1,35,0.07)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                                                    <td style={{ padding: '0.65rem 0.75rem', color: D.textMain, fontWeight: 600 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            {isEmergency && <AlertTriangle size={12} style={{ color: D.red, flexShrink: 0 }} />}
                                                            {req.aluno?.nome_completo ?? '—'}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '0.65rem 0.75rem', color: D.textMuted }}>
                                                        {req.aluno ? `${req.aluno.turma} · ${req.aluno.sala}` : '—'}
                                                    </td>
                                                    <td style={{ padding: '0.65rem 0.75rem', color: D.textMuted }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                            <UserIcon size={11} style={{ flexShrink: 0 }} />
                                                            {req.responsavel?.nome_completo ?? '—'}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '0.65rem 0.75rem' }}>
                                                        <span style={{
                                                            fontSize: '0.7rem', fontWeight: 700, color: st.color,
                                                            background: `${st.color}18`,
                                                            padding: '2px 8px', borderRadius: 20,
                                                            textTransform: 'uppercase', letterSpacing: '0.06em',
                                                            whiteSpace: 'nowrap',
                                                        }}>
                                                            {st.label}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '0.65rem 0.75rem', color: D.textMuted, whiteSpace: 'nowrap' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                            <Clock size={11} />
                                                            {elapsed(req.horario_solicitacao)}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '0.9rem 1.5rem', borderTop: `1px solid ${D.dimBorder}`, flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: D.textMuted }}>
                                {openRequests.length} solicitação{openRequests.length !== 1 ? 'ões' : ''} em aberto
                            </span>
                            <button
                                onClick={fetchOpenRequests}
                                style={{ background: 'none', border: `1px solid ${D.dimBorder}`, color: D.textMuted, padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                                <Activity size={13} /> Atualizar
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
