import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import {
    LogOut, Users, TrendingUp, Clock, UserPlus,
    AlertCircle, Activity, FileText, QrCode, Search, ShieldCheck,
    UserCheck, LayoutGrid, Settings, ArrowUpRight
} from 'lucide-react';
import NavigationControls from '../../components/NavigationControls';
import { logAudit } from '../../lib/audit';

// ─── Types ────────────────────────────────────────────────────────────────────
type DashboardStats = {
    total_students: number;
    total_staff: number;
    total_pickups_today: number;
    pending_pickups: number;
    avg_pickup_time: string;
    active_alerts: number;
};

type RecentActivity = {
    id: string;
    type: string;
    description: string;
    timestamp: string;
};

// ─── Navigation manifest ──────────────────────────────────────────────────────
const MODULES = [
    { to: '/admin/alunos',              Icon: Users,       label: 'Gerenciar Alunos',        accent: '#C24B2A' },
    { to: '/admin/historico-retiradas', Icon: FileText,    label: 'Histórico de Retiradas',  accent: '#1E6359' },
    { to: '/admin/auditoria-seguranca', Icon: ShieldCheck, label: 'Auditoria de Segurança',  accent: '#6B3D8F' },
    { to: '/admin/exportar-dados',      Icon: Search,      label: 'Relatórios e Manutenção', accent: '#C8892A' },
    { to: '/admin/usuarios',            Icon: UserCheck,   label: 'Usuários e Permissões',   accent: '#1F3057' },
    { to: '/admin/turmas',              Icon: LayoutGrid,  label: 'Gestão de Turmas',        accent: '#1E6359' },
    { to: '/admin/cartoes-qr',          Icon: QrCode,      label: 'Gerar Cartões QR',        accent: '#C24B2A' },
    { to: '/admin/configuracoes',       Icon: Settings,    label: 'Configurações Gerais',    accent: '#7A6F65' },
] as const;

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
    page:    '#F7F3EC',
    white:   '#FFFFFF',
    ink:     '#1A1612',
    inkMid:  '#5C504A',
    inkFaint: '#9A8C84',
    rule:    '#E8E0D6',
    rust:    '#C24B2A',
    teal:    '#1E6359',
    gold:    '#C8892A',
    navy:    '#1F3057',
    panel:   '#1A1612',
};

// ─── Stat card data builder ───────────────────────────────────────────────────
function buildStats(s: DashboardStats) {
    return [
        { label: 'Total de Alunos',  value: String(s.total_students),      sub: 'matrículas ativas',   Icon: Users,      accent: T.rust },
        { label: 'Funcionários',     value: String(s.total_staff),          sub: 'usuários ativos',     Icon: UserPlus,   accent: T.navy },
        { label: 'Retiradas Hoje',   value: String(s.total_pickups_today),  sub: 'movimentos no dia',   Icon: TrendingUp, accent: T.teal },
        { label: 'Tempo Médio',      value: s.avg_pickup_time,              sub: 'por atendimento',     Icon: Clock,      accent: T.gold },
    ];
}

// ─────────────────────────────────────────────────────────────────────────────
export default function EnhancedAdminDashboard() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();

    const [stats, setStats] = useState<DashboardStats>({
        total_students: 0, total_staff: 0, total_pickups_today: 0,
        pending_pickups: 0, avg_pickup_time: '—', active_alerts: 0,
    });
    const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [visible, setVisible] = useState(false);

    // ── Font injection + auth guard + data fetch ──────────────────────────────
    useEffect(() => {
        if (!document.getElementById('cc-editorial-fonts')) {
            const link = document.createElement('link');
            link.id = 'cc-editorial-fonts';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=DM+Mono:wght@400;500&display=swap';
            document.head.appendChild(link);
        }
        if (!user) { navigate('/admin/login'); return; }
        fetchDashboardData();
        logAudit('SISTEMA_LOGIN', undefined, undefined, { modulo: 'ADMIN_DASHBOARD_V2' });
        const t = setTimeout(() => setVisible(true), 80);
        return () => clearTimeout(t);
    }, [user]);

    const fetchDashboardData = async () => {
        try {
            const [studentsRes, staffRes, pickupsRes, pendingRes] = await Promise.all([
                supabase.from('alunos').select('id', { count: 'exact', head: true }),
                supabase.from('usuarios').select('id', { count: 'exact', head: true }),
                supabase.from('solicitacoes_retirada').select('id', { count: 'exact', head: true })
                    .gte('created_at', new Date().toISOString().split('T')[0]),
                supabase.from('solicitacoes_retirada').select('id', { count: 'exact', head: true })
                    .in('status', ['SOLICITADO', 'NOTIFICADO']),
            ]);
            setStats({
                total_students: studentsRes.count || 0,
                total_staff: staffRes.count || 0,
                total_pickups_today: pickupsRes.count || 0,
                pending_pickups: pendingRes.count || 0,
                avg_pickup_time: '12 min',
                active_alerts: 0,
            });
            const { data: logs } = await supabase
                .from('logs_auditoria').select('*')
                .order('timestamp', { ascending: false }).limit(5);
            setRecentActivity(
                logs?.map(log => ({
                    id: log.id,
                    type: log.tipo_evento,
                    description: log.descricao,
                    timestamp: log.timestamp,
                })) || []
            );
        } catch (err) {
            console.error('Error fetching dashboard data:', err);
        } finally {
            setLoading(false);
        }
    };

    // ── Loading state ─────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: T.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        border: `2px solid ${T.rust}`, borderTopColor: 'transparent',
                        animation: 'spin 0.8s linear infinite', margin: '0 auto 14px',
                    }} />
                    <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: T.inkFaint }}>
                        Carregando
                    </p>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    const dateline = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const datelineFormatted = dateline.charAt(0).toUpperCase() + dateline.slice(1);
    const statItems = buildStats(stats);

    return (
        <div style={{
            minHeight: '100vh',
            background: T.page,
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.45s ease',
        }}>
            {/* ════════════════════════════════════════════════════
                HEADER
            ════════════════════════════════════════════════════ */}
            <header style={{
                background: T.white,
                borderBottom: `1px solid ${T.rule}`,
                position: 'sticky', top: 0, zIndex: 30,
            }}>
                {/* Thin rust top stripe */}
                <div style={{ height: 3, background: T.rust }} />

                <div style={{
                    maxWidth: 1320, margin: '0 auto', padding: '0 32px',
                    height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    {/* Left: nav + branding */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <NavigationControls />
                        <div style={{ width: 1, height: 26, background: T.rule }} />
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 1 }}>
                                <span style={{
                                    fontFamily: 'DM Mono, monospace', fontSize: 8,
                                    letterSpacing: '0.3em', textTransform: 'uppercase',
                                    color: T.rust, fontWeight: 500,
                                }}>Control Center</span>
                                <span style={{ width: 3, height: 3, borderRadius: '50%', background: T.rule, display: 'inline-block' }} />
                                <span style={{
                                    fontFamily: 'DM Mono, monospace', fontSize: 8,
                                    letterSpacing: '0.18em', textTransform: 'uppercase', color: T.inkFaint,
                                }}>La Salle, Cheguei!</span>
                            </div>
                            <h1 style={{ fontSize: 19, fontWeight: 700, color: T.ink, lineHeight: 1, letterSpacing: '-0.01em' }}>
                                Dashboard Administrativo
                            </h1>
                        </div>
                    </div>

                    {/* Right: email + logout */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <span className="hidden md:block" style={{
                            fontFamily: 'DM Mono, monospace', fontSize: 11, color: T.inkFaint,
                        }}>{user?.email}</span>
                        <button
                            onClick={async () => {
                                logAudit('SISTEMA_LOGOUT', undefined, undefined, { modulo: 'ADMIN_DASHBOARD_V2' });
                                await signOut();
                            }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 7,
                                padding: '7px 14px',
                                background: 'transparent',
                                border: `1px solid ${T.rule}`,
                                borderRadius: 5,
                                color: T.inkMid,
                                fontSize: 13,
                                cursor: 'pointer',
                                fontFamily: 'DM Mono, monospace',
                                transition: 'border-color 0.2s, color 0.2s',
                            }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.borderColor = T.rust;
                                (e.currentTarget as HTMLElement).style.color = T.rust;
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.borderColor = T.rule;
                                (e.currentTarget as HTMLElement).style.color = T.inkMid;
                            }}
                        >
                            <LogOut size={13} />
                            <span className="hidden sm:inline">Sair</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* ════════════════════════════════════════════════════
                MAIN
            ════════════════════════════════════════════════════ */}
            <main style={{ maxWidth: 1320, margin: '0 auto', padding: '48px 32px 64px' }}>

                {/* ── DATELINE ──────────────────────────────────────── */}
                <div style={{
                    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                    marginBottom: 48, paddingBottom: 24, borderBottom: `1px solid ${T.rule}`,
                }}>
                    <div style={{
                        opacity: visible ? 1 : 0,
                        transform: visible ? 'translateY(0)' : 'translateY(8px)',
                        transition: 'opacity 0.55s ease, transform 0.55s ease',
                    }}>
                        <p style={{
                            fontFamily: 'DM Mono, monospace', fontSize: 9,
                            letterSpacing: '0.32em', textTransform: 'uppercase',
                            color: T.rust, marginBottom: 8, fontWeight: 500,
                        }}>
                            Visão Geral do Sistema
                        </p>
                        <h2 style={{
                            fontSize: 'clamp(28px, 3.8vw, 48px)',
                            fontWeight: 700,
                            color: T.ink,
                            lineHeight: 1.05,
                            fontStyle: 'italic',
                            letterSpacing: '-0.02em',
                        }}>
                            {datelineFormatted}
                        </h2>
                    </div>

                    <div className="hidden md:flex" style={{ alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <div style={{
                            width: 7, height: 7, borderRadius: '50%',
                            background: '#3DB87A',
                            boxShadow: '0 0 0 3px #3DB87A22',
                        }} />
                        <span style={{
                            fontFamily: 'DM Mono, monospace', fontSize: 10,
                            color: '#3DB87A', letterSpacing: '0.12em', textTransform: 'uppercase',
                        }}>Operacional</span>
                    </div>
                </div>

                {/* ── STAT CARDS ────────────────────────────────────── */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 20,
                    marginBottom: 48,
                }}>
                    {statItems.map((s, i) => (
                        <div
                            key={s.label}
                            style={{
                                background: T.white,
                                borderRadius: 10,
                                padding: '28px 24px 22px',
                                borderTop: `3px solid ${s.accent}`,
                                boxShadow: '0 1px 3px rgba(26,22,18,0.05), 0 4px 20px rgba(26,22,18,0.04)',
                                opacity: visible ? 1 : 0,
                                transform: visible ? 'translateY(0)' : 'translateY(14px)',
                                transition: `opacity 0.5s ease ${i * 0.07}s, transform 0.5s ease ${i * 0.07}s`,
                            }}
                        >
                            {/* Icon + sub-label row */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                                <div style={{
                                    width: 34, height: 34, borderRadius: 7,
                                    background: `${s.accent}14`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <s.Icon size={16} style={{ color: s.accent }} />
                                </div>
                                <span style={{
                                    fontFamily: 'DM Mono, monospace', fontSize: 9,
                                    letterSpacing: '0.14em', textTransform: 'uppercase',
                                    color: T.inkFaint,
                                }}>{s.sub}</span>
                            </div>

                            {/* Big number */}
                            <div style={{
                                fontFamily: 'DM Mono, monospace',
                                fontSize: 'clamp(38px, 4.5vw, 52px)',
                                fontWeight: 500,
                                color: T.ink,
                                lineHeight: 1,
                                marginBottom: 8,
                                letterSpacing: '-0.02em',
                            }}>
                                {s.value}
                            </div>

                            {/* Label */}
                            <div style={{
                                fontSize: 14, fontWeight: 600, color: T.inkMid,
                                letterSpacing: '0.005em',
                            }}>
                                {s.label}
                            </div>

                            {/* Accent bar */}
                            <div style={{
                                marginTop: 14, height: 2, borderRadius: 2,
                                background: `linear-gradient(90deg, ${s.accent}50, transparent)`,
                            }} />
                        </div>
                    ))}
                </div>

                {/* ── BODY: ACTIVITY + MODULES ──────────────────────── */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 320px',
                    gap: 24,
                    alignItems: 'start',
                }}
                    className="grid-cols-1 lg:grid-cols-[1fr_320px]"
                >
                    {/* ── Recent Activity: Timeline ────────────────── */}
                    <div style={{
                        background: T.white,
                        borderRadius: 10,
                        padding: '32px 36px',
                        boxShadow: '0 1px 3px rgba(26,22,18,0.05)',
                        opacity: visible ? 1 : 0,
                        transition: 'opacity 0.5s ease 0.28s',
                    }}>
                        {/* Section header */}
                        <div style={{
                            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                            paddingBottom: 20, marginBottom: 28,
                            borderBottom: `1px solid ${T.rule}`,
                        }}>
                            <div>
                                <p style={{
                                    fontFamily: 'DM Mono, monospace', fontSize: 9,
                                    letterSpacing: '0.3em', textTransform: 'uppercase',
                                    color: T.rust, marginBottom: 4, fontWeight: 500,
                                }}>Registro de Eventos</p>
                                <h3 style={{
                                    fontSize: 22, fontWeight: 700, color: T.ink,
                                    fontStyle: 'italic', letterSpacing: '-0.01em',
                                }}>Atividade Recente</h3>
                            </div>
                            <Activity size={16} style={{ color: T.rule, marginTop: 6 }} />
                        </div>

                        {/* Timeline */}
                        {recentActivity.length > 0 ? (
                            <div style={{ paddingLeft: 22, position: 'relative' }}>
                                {/* Vertical rule */}
                                <div style={{
                                    position: 'absolute', left: 7, top: 6, bottom: 6,
                                    width: 1, background: T.rule,
                                }} />

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                    {recentActivity.map((act, i) => (
                                        <div key={act.id} style={{
                                            position: 'relative',
                                            opacity: visible ? 1 : 0,
                                            transition: `opacity 0.4s ease ${0.38 + i * 0.07}s`,
                                        }}>
                                            {/* Timeline dot */}
                                            <div style={{
                                                position: 'absolute',
                                                left: -22 + 4,
                                                top: 6,
                                                width: 8, height: 8,
                                                borderRadius: '50%',
                                                background: i === 0 ? T.rust : T.rule,
                                                border: `2px solid ${i === 0 ? T.rust : T.rule}`,
                                                boxShadow: i === 0 ? `0 0 0 3px ${T.rust}20` : 'none',
                                            }} />

                                            <div style={{ paddingLeft: 16 }}>
                                                <p style={{
                                                    fontSize: 15,
                                                    fontWeight: i === 0 ? 600 : 400,
                                                    color: i === 0 ? T.ink : T.inkMid,
                                                    marginBottom: 6,
                                                    lineHeight: 1.45,
                                                }}>
                                                    {act.description || act.type || 'Evento registrado no sistema'}
                                                </p>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{
                                                        fontFamily: 'DM Mono, monospace',
                                                        fontSize: 11, color: T.inkFaint,
                                                    }}>
                                                        {act.timestamp
                                                            ? new Date(act.timestamp).toLocaleString('pt-BR')
                                                            : '—'}
                                                    </span>
                                                    {act.type && (
                                                        <>
                                                            <span style={{
                                                                width: 3, height: 3, borderRadius: '50%',
                                                                background: T.rule, display: 'inline-block',
                                                            }} />
                                                            <span style={{
                                                                fontFamily: 'DM Mono, monospace',
                                                                fontSize: 9, color: T.rust,
                                                                letterSpacing: '0.14em',
                                                                textTransform: 'uppercase',
                                                            }}>{act.type}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '48px 0' }}>
                                <Activity size={36} style={{ color: T.rule, margin: '0 auto 12px' }} />
                                <p style={{ fontSize: 14, color: T.inkFaint, fontStyle: 'italic' }}>
                                    Nenhuma atividade recente registrada.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* ── Quick Actions: Ink panel ──────────────────── */}
                    <div style={{
                        background: T.panel,
                        borderRadius: 10,
                        padding: '28px 22px',
                        boxShadow: '0 4px 24px rgba(26,22,18,0.14)',
                        opacity: visible ? 1 : 0,
                        transition: 'opacity 0.5s ease 0.34s',
                    }}>
                        {/* Panel header */}
                        <div style={{ paddingBottom: 18, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                            <p style={{
                                fontFamily: 'DM Mono, monospace', fontSize: 9,
                                letterSpacing: '0.3em', textTransform: 'uppercase',
                                color: T.rust, marginBottom: 4, fontWeight: 500,
                            }}>Módulos</p>
                            <h3 style={{
                                fontSize: 20, fontWeight: 700, color: '#F5F0E8',
                                fontStyle: 'italic', letterSpacing: '-0.01em',
                            }}>Ações Rápidas</h3>
                        </div>

                        {/* Module links */}
                        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {MODULES.map((m, i) => (
                                <Link
                                    key={m.to}
                                    to={m.to}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 11,
                                        padding: '9px 10px',
                                        borderRadius: 7,
                                        textDecoration: 'none',
                                        color: '#9A8878',
                                        fontSize: 14,
                                        fontWeight: 400,
                                        border: '1px solid transparent',
                                        transition: 'all 0.17s ease',
                                        opacity: visible ? 1 : 0,
                                        transform: visible ? 'translateX(0)' : 'translateX(-8px)',
                                        transitionDelay: `${0.28 + i * 0.035}s`,
                                    }}
                                    onMouseEnter={e => {
                                        const el = e.currentTarget as HTMLElement;
                                        el.style.background = `${m.accent}16`;
                                        el.style.borderColor = `${m.accent}30`;
                                        el.style.color = '#F5F0E8';
                                    }}
                                    onMouseLeave={e => {
                                        const el = e.currentTarget as HTMLElement;
                                        el.style.background = 'transparent';
                                        el.style.borderColor = 'transparent';
                                        el.style.color = '#9A8878';
                                    }}
                                >
                                    {/* Icon chip */}
                                    <div style={{
                                        width: 28, height: 28, borderRadius: 6,
                                        background: `${m.accent}22`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <m.Icon size={13} style={{ color: m.accent }} />
                                    </div>

                                    <span style={{ flex: 1, fontSize: 13 }}>{m.label}</span>

                                    <ArrowUpRight size={11} style={{ color: '#3A3028', flexShrink: 0 }} />
                                </Link>
                            ))}
                        </nav>

                        {/* Footer note */}
                        <div style={{
                            marginTop: 18, paddingTop: 14,
                            borderTop: '1px solid rgba(255,255,255,0.07)',
                            textAlign: 'center',
                        }}>
                            <p style={{
                                fontFamily: 'DM Mono, monospace', fontSize: 9,
                                letterSpacing: '0.14em', color: '#3A3028',
                                textTransform: 'uppercase',
                            }}>
                                La Salle, Cheguei! — Sistema Escolar
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── PENDING PICKUPS ALERT ─────────────────────────── */}
                {stats.pending_pickups > 0 && (
                    <div style={{
                        marginTop: 32,
                        background: '#FEF8F5',
                        border: `1px solid ${T.rust}30`,
                        borderLeft: `4px solid ${T.rust}`,
                        borderRadius: 10,
                        padding: '20px 24px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 18,
                        flexWrap: 'wrap',
                        opacity: visible ? 1 : 0,
                        transition: 'opacity 0.5s ease 0.5s',
                    }}>
                        <div style={{
                            width: 38, height: 38, borderRadius: 8,
                            background: T.rust,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            <AlertCircle size={18} style={{ color: '#fff' }} />
                        </div>

                        <div style={{ flex: 1, minWidth: 180 }}>
                            <p style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 3 }}>
                                Ação Requerida
                            </p>
                            <p style={{ fontSize: 13, color: T.inkMid, lineHeight: 1.5 }}>
                                Existem{' '}
                                <strong style={{ color: T.rust }}>{stats.pending_pickups}</strong>{' '}
                                retirada(s) pendente(s) aguardando processamento na recepção.
                            </p>
                        </div>

                        <Link
                            to="/recepcao/busca"
                            style={{
                                padding: '9px 22px',
                                background: T.rust,
                                color: '#fff',
                                borderRadius: 7,
                                fontSize: 11,
                                fontWeight: 700,
                                textDecoration: 'none',
                                letterSpacing: '0.1em',
                                textTransform: 'uppercase',
                                fontFamily: 'DM Mono, monospace',
                                transition: 'background 0.18s',
                                flexShrink: 0,
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#A33D22'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.rust; }}
                        >
                            Ver Agora
                        </Link>
                    </div>
                )}
            </main>
        </div>
    );
}
