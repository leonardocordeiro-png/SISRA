import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    LogOut, Users, School, Activity, TrendingUp, QrCode,
    BarChart2, Shield, Settings, ChevronRight, LayoutDashboard,
    ArrowUpRight, Lock, FileText, UserCheck, LayoutGrid
} from 'lucide-react';
import NavigationControls from '../../components/NavigationControls';
import { logAudit } from '../../lib/audit';

// ── Brand tokens (identical to sala/dashboard) ────────────────────────────────
const B = {
    navy:       '#104699',
    navyDark:   '#0a2f6b',
    navyDeep:   '#071830',
    gold:       '#fbd12d',
    goldDark:   '#e8be1a',
    red:        '#E40123',
    gray:       '#A7A7A2',
    grayLight:  '#c8c8c4',
    white:      '#FFFFFF',
    card:       '#0d2a54',
    cardBorder: 'rgba(251,209,45,0.10)',
    onGold:     '#071830',
    textSub:    'rgba(167,167,162,0.9)',
};

// ─── Animated counter hook ────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200) {
    const [value, setValue] = useState(0);
    const startTime = useRef<number | null>(null);
    const rafRef = useRef<number>(0);

    useEffect(() => {
        if (target === 0) return;
        startTime.current = null;
        const animate = (ts: number) => {
            if (!startTime.current) startTime.current = ts;
            const progress = Math.min((ts - startTime.current) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(eased * target));
            if (progress < 1) rafRef.current = requestAnimationFrame(animate);
        };
        rafRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(rafRef.current);
    }, [target, duration]);

    return value;
}

// ─── Live Clock ───────────────────────────────────────────────────────────────

function LiveClock() {
    const [time, setTime] = useState(new Date());
    useEffect(() => {
        const t = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
            background: 'rgba(0,0,0,0.2)', border: `1px solid ${B.gold}18`,
            borderRadius: 8, padding: '5px 12px',
        }}>
            <span style={{ fontFamily: 'Epilogue, sans-serif', fontSize: 20, fontWeight: 900, color: B.gold, lineHeight: 1, letterSpacing: '-0.02em' }}>
                {time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                <span style={{ fontSize: 13, color: `${B.gold}80`, marginLeft: 3 }}>
                    :{String(time.getSeconds()).padStart(2, '0')}
                </span>
            </span>
            <span style={{ fontSize: 8.5, fontWeight: 600, color: B.gray, letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 1 }}>
                {time.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
            </span>
        </div>
    );
}

// ─── Stat Block ───────────────────────────────────────────────────────────────

function StatBlock({ label, value, unit = '', highlight = false, delay = 0 }: {
    label: string; value: number; unit?: string; highlight?: boolean; delay?: number;
}) {
    const animated = useCountUp(value, 1000 + delay);
    return (
        <div style={{
            padding: '22px 22px',
            borderBottom: `1px solid ${B.cardBorder}`,
            position: 'relative', overflow: 'hidden',
            transition: 'background 0.2s',
            cursor: 'default',
        }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
            {/* Left gold accent */}
            {highlight && (
                <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: '60%', background: B.gold, borderRadius: '0 2px 2px 0' }} />
            )}

            <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: `${B.gold}65`, marginBottom: 8 }}>
                {label}
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{
                    fontFamily: 'Epilogue, sans-serif',
                    fontSize: 44, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em',
                    color: highlight ? B.gold : B.white,
                }}>
                    {animated.toLocaleString('pt-BR')}
                </span>
                {unit && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: B.gray, letterSpacing: '0.18em', textTransform: 'uppercase' }}>{unit}</span>
                )}
            </div>
        </div>
    );
}

// ─── Command Card ─────────────────────────────────────────────────────────────

function CommandCard({ index, title, desc, icon: Icon, path, cta, accentGold = false }: {
    index: string; title: string; desc: string; icon: any; path: string; cta: string; accentGold?: boolean;
}) {
    const navigate = useNavigate();
    return (
        <button
            onClick={() => navigate(path)}
            style={{
                textAlign: 'left', width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                overflow: 'hidden', background: B.card,
                border: 'none', cursor: 'pointer',
                transition: 'all 0.25s',
                position: 'relative',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = B.navyDark; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = B.card; }}
        >
            {/* Top gold rule */}
            <div style={{ height: 2, background: accentGold ? `linear-gradient(90deg, ${B.gold}, transparent)` : `linear-gradient(90deg, ${B.navy}80, transparent)`, flexShrink: 0 }} />

            {/* Index — top right */}
            <div style={{
                position: 'absolute', top: 14, right: 14,
                fontFamily: 'Epilogue, sans-serif', fontSize: 11, fontWeight: 900,
                color: accentGold ? `${B.gold}45` : `${B.gray}30`,
                letterSpacing: '0.05em',
            }}>
                {index}
            </div>

            <div style={{ flex: 1, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Icon */}
                <div style={{
                    width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                    background: accentGold ? `${B.gold}18` : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${accentGold ? `${B.gold}38` : B.cardBorder}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: accentGold ? B.gold : B.gray,
                }}>
                    <Icon size={18} />
                </div>

                {/* Text */}
                <div style={{ flex: 1 }}>
                    <h3 style={{
                        fontFamily: 'Epilogue, sans-serif',
                        fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1,
                        color: B.white, marginBottom: 7,
                    }}>
                        {title}
                    </h3>
                    <p style={{ fontSize: 10.5, fontWeight: 500, color: B.textSub, lineHeight: 1.55 }}>
                        {desc}
                    </p>
                </div>
            </div>

            {/* CTA bar */}
            <div style={{
                padding: '11px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderTop: `1px solid ${B.cardBorder}`,
                background: 'rgba(0,0,0,0.18)',
            }}>
                <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: accentGold ? B.gold : B.gray }}>
                    {cta}
                </span>
                <ArrowUpRight size={13} style={{ color: accentGold ? B.gold : B.gray }} />
            </div>
        </button>
    );
}

// ─── Deck Item ────────────────────────────────────────────────────────────────

function DeckItem({ icon: Icon, label, path }: { icon: any; label: string; path: string; }) {
    const navigate = useNavigate();
    const [hovered, setHovered] = useState(false);
    return (
        <button
            onClick={() => navigate(path)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex', alignItems: 'center', gap: 11, padding: '13px 20px',
                textAlign: 'left', width: '100%', background: hovered ? 'rgba(255,255,255,0.03)' : 'transparent',
                border: 'none', borderBottom: `1px solid ${B.cardBorder}`,
                cursor: 'pointer', transition: 'background 0.18s',
            }}
        >
            <div style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                background: hovered ? `${B.gold}18` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${hovered ? `${B.gold}38` : B.cardBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: hovered ? B.gold : B.gray,
                transition: 'all 0.18s',
            }}>
                <Icon size={13} />
            </div>
            <span style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
                color: hovered ? B.white : B.grayLight,
                fontFamily: 'Instrument Sans, sans-serif',
                transition: 'color 0.18s', flex: 1,
            }}>
                {label}
            </span>
            <ChevronRight size={12} style={{
                color: hovered ? B.gold : 'transparent',
                transition: 'all 0.18s',
            }} />
        </button>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
    const { signOut } = useAuth();
    const navigate = useNavigate();
    const [mounted, setMounted] = useState(false);
    const [stats, setStats] = useState({
        totalStudents: 0,
        activePickups: 0,
        dailyPickups: 0,
        avgWaitTime: 0
    });

    // Inject fonts (same as sala/dashboard)
    useEffect(() => {
        if (!document.getElementById('adm-brand-fonts')) {
            const link = document.createElement('link');
            link.id = 'adm-brand-fonts';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Epilogue:ital,wght@0,700;0,800;0,900;1,700;1,800&family=Instrument+Sans:wght@400;500;600;700&display=swap';
            document.head.appendChild(link);
        }
        const t = setTimeout(() => setMounted(true), 80);
        return () => clearTimeout(t);
    }, []);

    async function fetchStats() {
        try {
            const studentsCount = await supabase
                .from('alunos')
                .select('*', { count: 'exact', head: true });

            const activeRequests = await supabase
                .from('solicitacoes_retirada')
                .select('*', { count: 'exact', head: true })
                .neq('status', 'ENTREGUE')
                .neq('status', 'CANCELADO');

            const today = new Date().toISOString().split('T')[0];
            const finishedToday = await supabase
                .from('solicitacoes_retirada')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'ENTREGUE')
                .gte('horario_confirmacao', today);

            setStats({
                totalStudents: studentsCount.count || 0,
                activePickups: activeRequests.count || 0,
                dailyPickups: finishedToday.count || 0,
                avgWaitTime: 8
            });
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
        }
    }

    useEffect(() => {
        fetchStats();
        logAudit('SISTEMA_LOGIN', undefined, undefined, { modulo: 'ADMIN_DASHBOARD_V1' });
        const interval = setInterval(fetchStats, 60000);
        return () => clearInterval(interval);
    }, []);

    const handleLogout = async () => {
        logAudit('SISTEMA_LOGOUT', undefined, undefined, { modulo: 'ADMIN_DASHBOARD_V1' });
        await signOut();
        navigate('/admin/login');
    };

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
                                <LayoutDashboard size={17} style={{ color: B.onGold }} />
                            </div>
                            <div>
                                <p style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.26em', textTransform: 'uppercase', color: `${B.gold}80`, marginBottom: 1 }}>
                                    La Salle, Cheguei! · ADM
                                </p>
                                <h1 style={{ fontSize: 16, fontWeight: 800, color: B.white, letterSpacing: '-0.02em', lineHeight: 1, fontFamily: 'Epilogue, sans-serif' }}>
                                    Painel Administrativo
                                </h1>
                            </div>
                        </div>
                    </div>

                    {/* Center clock */}
                    <div className="hidden md:block">
                        <LiveClock />
                    </div>

                    {/* Right */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        {/* Live status pill */}
                        <div className="hidden lg:flex" style={{
                            alignItems: 'center', gap: 9,
                            background: 'rgba(0,0,0,0.25)', border: `1px solid ${B.gold}28`,
                            borderRadius: 8, padding: '6px 13px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 6px #22C55E' }} />
                                <p style={{ fontSize: 7.5, fontWeight: 600, color: '#22C55E', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Sistema Ativo</p>
                            </div>
                        </div>

                        {/* Logout */}
                        <button onClick={handleLogout} style={{
                            display: 'flex', alignItems: 'center', gap: 7,
                            padding: '8px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                            background: `${B.red}18`, color: '#ff7b8a',
                            outline: `1px solid ${B.red}35`, transition: 'all 0.18s',
                            fontSize: 11, fontWeight: 700, fontFamily: 'Instrument Sans, sans-serif',
                        }}
                            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = `${B.red}35`; el.style.color = '#fff'; }}
                            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = `${B.red}18`; el.style.color = '#ff7b8a'; }}
                        >
                            <LogOut size={13} />
                            <span className="hidden sm:inline">Sair</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* ══════════════ BODY ══════════════ */}
            <main
                className="adm-main-grid"
                style={{
                    flex: 1, display: 'grid', gridTemplateColumns: '280px 1fr', minHeight: 0,
                    opacity: mounted ? 1 : 0,
                    transform: mounted ? 'none' : 'translateY(8px)',
                    transition: 'opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s',
                }}
            >
                {/* ─── LEFT RAIL ──────────────────────────────────────────── */}
                <aside style={{
                    display: 'flex', flexDirection: 'column',
                    borderRight: `1px solid ${B.cardBorder}`,
                    background: `linear-gradient(180deg, ${B.navyDark} 0%, ${B.navyDeep} 100%)`,
                }}>
                    {/* Identity block */}
                    <div style={{
                        padding: '28px 22px 22px', position: 'relative', overflow: 'hidden',
                        borderBottom: `1px solid ${B.cardBorder}`,
                    }}>
                        {/* Gold line accent */}
                        <div style={{ height: 2, background: `linear-gradient(90deg, ${B.gold}, transparent)`, marginBottom: 20, borderRadius: 1 }} />

                        {/* Decorative background letter */}
                        <div style={{
                            position: 'absolute', bottom: -10, right: -8,
                            fontFamily: 'Epilogue, sans-serif', fontSize: 120, fontWeight: 900,
                            color: `${B.gold}06`, lineHeight: 1, pointerEvents: 'none', userSelect: 'none',
                        }}>A</div>

                        <div style={{ position: 'relative' }}>
                            <div style={{
                                width: 38, height: 38, borderRadius: 9, marginBottom: 16,
                                background: `${B.gold}18`, border: `1px solid ${B.gold}38`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <LayoutDashboard size={17} style={{ color: B.gold }} />
                            </div>
                            <h2 style={{
                                fontFamily: 'Epilogue, sans-serif',
                                fontSize: 32, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.08,
                                color: B.white, marginBottom: 6,
                            }}>
                                SISRA
                                <br />
                                <span style={{ color: B.gold }}>Admin</span>
                            </h2>
                            <p style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.26em', textTransform: 'uppercase', color: `${B.gold}55` }}>
                                Interface Administrativa · 2026
                            </p>
                        </div>
                    </div>

                    {/* Stat blocks */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <StatBlock label="Total de Alunos" value={stats.totalStudents} highlight delay={0} />
                        <StatBlock label="Retiradas Hoje" value={stats.dailyPickups} delay={100} />
                        <StatBlock label="Em Atendimento" value={stats.activePickups} delay={200} />
                        <StatBlock label="Tempo Médio Resp." value={stats.avgWaitTime} unit="min" delay={300} />
                    </div>

                    {/* Footer status strip */}
                    <div style={{
                        padding: '11px 22px', display: 'flex', alignItems: 'center', gap: 8,
                        borderTop: `1px solid ${B.cardBorder}`,
                    }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 8px #22C55E', flexShrink: 0 }} />
                        <span style={{ fontSize: 8.5, fontWeight: 600, color: B.textSub, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                            Uptime 98.4% · 14ms
                        </span>
                    </div>
                </aside>

                {/* ─── RIGHT CONTENT ─────────────────────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

                    {/* Section label */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px',
                        borderBottom: `1px solid ${B.cardBorder}`,
                        background: 'rgba(0,0,0,0.12)',
                    }}>
                        <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', color: `${B.gold}70` }}>
                            Módulos Operacionais
                        </span>
                        <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${B.gold}28, transparent)` }} />
                        <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: B.gold }}>
                            3 Ativos
                        </span>
                    </div>

                    {/* ── Command Cards Grid ───────────────────────────────── */}
                    <div
                        className="adm-cards-grid"
                        style={{
                            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', flexShrink: 0,
                            borderBottom: `1px solid ${B.cardBorder}`,
                        }}
                    >
                        <div style={{ borderRight: `1px solid ${B.cardBorder}` }}>
                            <CommandCard
                                index="01"
                                title="Sala de Aula"
                                desc="Gestão de professores e SCTs. Chamadas e alertas em tempo real."
                                icon={School}
                                path="/sala/dashboard"
                                cta="Acessar Portal"
                                accentGold
                            />
                        </div>
                        <div style={{ borderRight: `1px solid ${B.cardBorder}` }}>
                            <CommandCard
                                index="02"
                                title="Terminal Recepção"
                                desc="Identificação e busca de alunos para controle de portaria."
                                icon={Activity}
                                path="/recepcao/busca"
                                cta="Abrir Terminal"
                            />
                        </div>
                        <div>
                            <CommandCard
                                index="03"
                                title="Inteligência & Dados"
                                desc="Telemetria, auditoria de retiradas e exportação de logs completos."
                                icon={BarChart2}
                                path="/admin/exportar-dados"
                                cta="Ver Relatórios"
                            />
                        </div>
                    </div>

                    {/* ── Management Deck ──────────────────────────────────── */}
                    <div style={{ flex: 1 }}>
                        {/* Section label */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px',
                            borderBottom: `1px solid ${B.cardBorder}`,
                            background: 'rgba(0,0,0,0.12)',
                        }}>
                            <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', color: `${B.gold}70` }}>
                                Deck de Gestão Global
                            </span>
                            <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${B.gold}28, transparent)` }} />
                        </div>

                        {/* Nav items in 2-col grid */}
                        <div className="adm-deck-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `1px solid ${B.cardBorder}` }}>
                            <div style={{ borderRight: `1px solid ${B.cardBorder}` }}>
                                <DeckItem icon={Users}      label="Gestão de Alunos"       path="/admin/alunos" />
                                <DeckItem icon={Lock}       label="Controle de Acessos"     path="/admin/usuarios" />
                                <DeckItem icon={LayoutGrid} label="Estrutura de Turmas"     path="/admin/turmas" />
                            </div>
                            <div>
                                <DeckItem icon={QrCode}   label="Central de Cartões QR"    path="/admin/cartoes-qr" />
                                <DeckItem icon={Shield}   label="Auditoria de Segurança"   path="/admin/auditoria-seguranca" />
                                <DeckItem icon={Settings} label="Configurações Globais"    path="/admin/configuracoes" />
                            </div>
                        </div>

                        {/* Bottom quick links */}
                        <div className="adm-bottom-strip" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', height: 88 }}>
                            {[
                                { icon: FileText,   label: 'Histórico',    path: '/admin/historico-retiradas' },
                                { icon: UserCheck,  label: 'Funcionários', path: '/admin/funcionarios' },
                                { icon: TrendingUp, label: 'Relatórios',   path: '/admin/exportar-dados' },
                            ].map((item, i) => (
                                <button
                                    key={i}
                                    onClick={() => navigate(item.path)}
                                    style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7,
                                        background: 'transparent', border: 'none', cursor: 'pointer',
                                        borderRight: i < 2 ? `1px solid ${B.cardBorder}` : 'none',
                                        color: B.gray, transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.03)'; el.style.color = B.gold; }}
                                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = B.gray; }}
                                >
                                    <item.icon size={15} />
                                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: 'Instrument Sans, sans-serif' }}>
                                        {item.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </main>

            {/* ── Responsive styles ────────────────────────────────────────── */}
            <style>{`
                @media (max-width: 1024px) {
                    .adm-main-grid { grid-template-columns: 1fr !important; }
                    .adm-cards-grid { grid-template-columns: 1fr 1fr !important; }
                }
                @media (max-width: 640px) {
                    .adm-main-grid { grid-template-columns: 1fr !important; }
                    .adm-cards-grid { grid-template-columns: 1fr !important; }
                    .adm-deck-grid  { grid-template-columns: 1fr !important; }
                    .adm-bottom-strip { grid-template-columns: 1fr !important; height: auto !important; }
                    .adm-bottom-strip > button { padding: 16px 0 !important; border-right: none !important; border-bottom: 1px solid rgba(251,209,45,0.10) !important; }
                }
            `}</style>

            {/* ── Footer ───────────────────────────────────────────────────── */}
            <footer style={{
                padding: '10px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderTop: `1px solid ${B.cardBorder}`,
                background: B.navyDeep,
            }}>
                <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase', color: `${B.gold}30`, fontFamily: 'Instrument Sans, sans-serif' }}>
                    La Salle, Cheguei! — SISRA © 2026
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, opacity: 0.3 }}>
                    {['Seguro · RSA-4096', 'Latência · 14ms', 'Env · Produção'].map(tag => (
                        <span key={tag} style={{ fontSize: 7.5, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: B.gray, fontFamily: 'Instrument Sans, sans-serif' }}>
                            {tag}
                        </span>
                    ))}
                </div>
            </footer>
        </div>
    );
}
