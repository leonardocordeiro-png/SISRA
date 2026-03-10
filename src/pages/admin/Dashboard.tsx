import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    LogOut, Users, School, Activity, TrendingUp, QrCode,
    BarChart2, Shield, Settings, ChevronRight, LayoutDashboard,
    Sun, Moon, ArrowUpRight, Lock, FileText, UserCheck, LayoutGrid
} from 'lucide-react';
import NavigationControls from '../../components/NavigationControls';
import { logAudit } from '../../lib/audit';

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
        <span style={{ fontFamily: "'JetBrains Mono', monospace" }} className="text-[11px] text-[#4A4A5E] tracking-widest">
            {time.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).toUpperCase()}
            &nbsp;&nbsp;
            <span className="text-[#5AFFB4]">{time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </span>
    );
}

// ─── Stat Block ───────────────────────────────────────────────────────────────

function StatBlock({ label, value, unit = '', highlight = false, delay = 0 }: {
    label: string; value: number; unit?: string; highlight?: boolean; delay?: number;
}) {
    const animated = useCountUp(value, 1000 + delay);
    return (
        <div
            className="relative group cursor-default border-b border-[#1C1C26] last:border-b-0 py-7 px-8 hover:bg-[#0C0C12] transition-colors duration-300"
        >
            {/* Left accent bar */}
            <div
                className={`absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-0 group-hover:h-full transition-all duration-500 ${highlight ? 'bg-[#5AFFB4]' : 'bg-[#2A2A3A]'}`}
            />

            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#3D3D52] mb-3">
                {label}
            </p>
            <div className="flex items-baseline gap-2">
                <span
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    className={`text-5xl font-black leading-none tracking-tight tabular-nums ${highlight ? 'text-[#5AFFB4]' : 'text-white'}`}
                >
                    {animated.toLocaleString('pt-BR')}
                </span>
                {unit && (
                    <span className="text-[11px] text-[#3D3D52] font-bold uppercase tracking-widest">{unit}</span>
                )}
            </div>
        </div>
    );
}

// ─── Command Card ─────────────────────────────────────────────────────────────

function CommandCard({ index, title, desc, icon: Icon, path, cta, accent = '#5AFFB4', isDark }: {
    index: string; title: string; desc: string; icon: any; path: string; cta: string; accent?: string; isDark: boolean;
}) {
    const navigate = useNavigate();
    return (
        <button
            onClick={() => navigate(path)}
            className="group relative text-left w-full h-full flex flex-col overflow-hidden transition-all duration-500 active:scale-[0.98]"
            style={{
                background: isDark ? '#0C0C12' : '#F8F8FC',
                border: `1px solid ${isDark ? '#1C1C26' : '#E4E4EF'}`,
            }}
        >
            {/* Hover overlay */}
            <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at 20% 30%, ${accent}08 0%, transparent 70%)` }}
            />

            {/* Index number — top-right */}
            <div
                className="absolute top-6 right-6 text-[10px] font-black tracking-[0.2em] opacity-20 group-hover:opacity-60 transition-opacity duration-300"
                style={{ fontFamily: "'JetBrains Mono', monospace", color: accent }}
            >
                [{index}]
            </div>

            <div className="flex-1 p-8 flex flex-col gap-6">
                {/* Icon */}
                <div
                    className="w-12 h-12 flex items-center justify-center border transition-all duration-500 group-hover:scale-110"
                    style={{
                        borderColor: isDark ? '#2A2A3A' : '#DDDDED',
                        background: isDark ? '#111118' : '#EFEFF8',
                        color: accent
                    }}
                >
                    <Icon className="w-5 h-5" />
                </div>

                {/* Text */}
                <div className="space-y-2 flex-1">
                    <h3
                        className="text-xl font-black uppercase tracking-tight leading-none"
                        style={{
                            fontFamily: "'Bebas Neue', cursive",
                            fontSize: '1.6rem',
                            letterSpacing: '0.04em',
                            color: isDark ? '#FFFFFF' : '#0A0A14'
                        }}
                    >
                        {title}
                    </h3>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] leading-relaxed" style={{ color: isDark ? '#3D3D52' : '#8888A0' }}>
                        {desc}
                    </p>
                </div>
            </div>

            {/* CTA bar */}
            <div
                className="px-8 py-4 flex items-center justify-between border-t transition-all duration-300"
                style={{ borderColor: isDark ? '#1C1C26' : '#E4E4EF' }}
            >
                <span
                    className="text-[9px] font-black uppercase tracking-[0.3em] transition-colors duration-300 group-hover:opacity-100 opacity-60"
                    style={{ color: accent, fontFamily: "'JetBrains Mono', monospace" }}
                >
                    {cta}
                </span>
                <ArrowUpRight
                    className="w-4 h-4 transition-all duration-500 group-hover:translate-x-1 group-hover:-translate-y-1 opacity-30 group-hover:opacity-100"
                    style={{ color: accent }}
                />
            </div>
        </button>
    );
}

// ─── Deck Item ────────────────────────────────────────────────────────────────

function DeckItem({ icon: Icon, label, path, isDark }: { icon: any; label: string; path: string; isDark: boolean }) {
    const navigate = useNavigate();
    return (
        <button
            onClick={() => navigate(path)}
            className="group flex items-center gap-3 px-5 py-3.5 text-left w-full transition-all duration-300 active:scale-[0.98]"
            style={{
                borderBottom: `1px solid ${isDark ? '#1C1C26' : '#E4E4EF'}`,
            }}
        >
            <div
                className="w-7 h-7 flex items-center justify-center shrink-0 transition-all duration-300"
                style={{
                    background: isDark ? '#111118' : '#EEEEFC',
                    border: `1px solid ${isDark ? '#2A2A3A' : '#DDDDED'}`,
                    color: isDark ? '#4A4A5E' : '#6A6A88'
                }}
            >
                <Icon className="w-3.5 h-3.5 group-hover:text-[#5AFFB4] transition-colors duration-300" />
            </div>
            <span
                className="text-[10px] font-black uppercase tracking-[0.2em] transition-colors duration-300"
                style={{ color: isDark ? '#4A4A5E' : '#6A6A88' }}
            >
                <span className="group-hover:text-white dark:group-hover:text-white transition-colors duration-300">
                    {label}
                </span>
            </span>
            <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-300 text-[#5AFFB4]" />
        </button>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
    const { signOut } = useAuth();
    const navigate = useNavigate();
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [stats, setStats] = useState({
        totalStudents: 0,
        activePickups: 0,
        dailyPickups: 0,
        avgWaitTime: 0
    });

    // Inject fonts
    useEffect(() => {
        const existing = document.getElementById('dashboard-fonts');
        if (!existing) {
            const link = document.createElement('link');
            link.id = 'dashboard-fonts';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;700;800&display=swap';
            document.head.appendChild(link);
        }
        // Trigger mount animation
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

    const bg = isDarkMode ? '#070709' : '#F2F2F8';
    const surface = isDarkMode ? '#0C0C12' : '#FFFFFF';
    const border = isDarkMode ? '#1C1C26' : '#E4E4EF';
    const textPrimary = isDarkMode ? '#FFFFFF' : '#0A0A14';
    const textMuted = isDarkMode ? '#3D3D52' : '#8888A0';

    return (
        <div
            className="min-h-screen flex flex-col transition-colors duration-700"
            style={{ background: bg, color: textPrimary }}
        >
            {/* ─── Subtle background texture ─────────────────────────────── */}
            <div
                className="fixed inset-0 pointer-events-none z-0 opacity-[0.025]"
                style={{
                    backgroundImage: `
                        linear-gradient(to right, #5AFFB4 1px, transparent 1px),
                        linear-gradient(to bottom, #5AFFB4 1px, transparent 1px)
                    `,
                    backgroundSize: '80px 80px',
                    maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)'
                }}
            />

            {/* ─── Header ────────────────────────────────────────────────── */}
            <header
                className="relative z-20 flex items-center justify-between px-8 py-4 shrink-0"
                style={{
                    borderBottom: `1px solid ${border}`,
                    background: isDarkMode ? 'rgba(7,7,9,0.92)' : 'rgba(242,242,248,0.92)',
                    backdropFilter: 'blur(24px)',
                }}
            >
                {/* Left: Classification badge + title */}
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        {/* Classification stripe */}
                        <div className="flex flex-col gap-[3px]">
                            {['#5AFFB4', '#2A2A3A', '#2A2A3A'].map((c, i) => (
                                <div key={i} style={{ width: 20, height: 3, background: c }} />
                            ))}
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <span
                                    className="text-xl tracking-[0.05em] leading-none"
                                    style={{ fontFamily: "'Bebas Neue', cursive", color: textPrimary }}
                                >
                                    Command Center Prime
                                </span>
                                <span
                                    className="text-[8px] px-2 py-0.5 font-black tracking-[0.25em] border"
                                    style={{
                                        color: '#5AFFB4',
                                        borderColor: '#5AFFB420',
                                        background: '#5AFFB408',
                                        fontFamily: "'JetBrains Mono', monospace"
                                    }}
                                >
                                    ACTIVE
                                </span>
                            </div>
                            <p
                                className="text-[9px] font-black tracking-[0.3em] uppercase mt-0.5"
                                style={{ color: textMuted, fontFamily: "'JetBrains Mono', monospace" }}
                            >
                                NODE // SISRA.ADM.MAIN_DECK
                            </p>
                        </div>
                    </div>

                    <NavigationControls />
                </div>

                {/* Center: live clock */}
                <div className="hidden md:block">
                    <LiveClock />
                </div>

                {/* Right: controls */}
                <div className="flex items-center gap-3">
                    {/* System health pill */}
                    <div
                        className="hidden lg:flex items-center gap-2.5 px-4 py-2"
                        style={{ border: `1px solid ${border}`, background: isDarkMode ? '#0C0C12' : '#FFFFFF' }}
                    >
                        <div className="w-1.5 h-1.5 rounded-full bg-[#5AFFB4] animate-pulse" />
                        <span
                            className="text-[9px] font-black uppercase tracking-[0.25em] text-[#5AFFB4]"
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                            SYSTEM // NOMINAL
                        </span>
                    </div>

                    <button
                        onClick={() => setIsDarkMode(!isDarkMode)}
                        className="p-2 transition-all duration-300 hover:opacity-70"
                        style={{ border: `1px solid ${border}`, background: surface, color: textMuted }}
                    >
                        {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>

                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 hover:bg-[#FF4D4D] hover:border-[#FF4D4D] hover:text-white active:scale-95"
                        style={{
                            border: '1px solid #FF4D4D30',
                            background: '#FF4D4D08',
                            color: '#FF4D4D',
                            fontFamily: "'JetBrains Mono', monospace"
                        }}
                    >
                        <LogOut className="w-3.5 h-3.5" />
                        Encerrar
                    </button>
                </div>
            </header>

            {/* ─── Main Grid ─────────────────────────────────────────────── */}
            <main
                className="relative z-10 flex-1 grid"
                style={{
                    gridTemplateColumns: '320px 1fr',
                    opacity: mounted ? 1 : 0,
                    transform: mounted ? 'none' : 'translateY(8px)',
                    transition: 'opacity 0.6s ease, transform 0.6s ease',
                }}
            >
                {/* ─── LEFT RAIL: Identity + Stats ───────────────────────── */}
                <aside
                    className="flex flex-col"
                    style={{ borderRight: `1px solid ${border}` }}
                >
                    {/* System identity block */}
                    <div
                        className="px-8 py-10 relative overflow-hidden"
                        style={{ borderBottom: `1px solid ${border}` }}
                    >
                        {/* Large background letter */}
                        <div
                            className="absolute -bottom-6 -right-4 text-[140px] font-black leading-none select-none pointer-events-none opacity-[0.03]"
                            style={{ fontFamily: "'Bebas Neue', cursive", color: '#5AFFB4' }}
                        >
                            S
                        </div>

                        <div className="relative">
                            <div
                                className="w-10 h-10 flex items-center justify-center mb-6"
                                style={{
                                    border: `1px solid ${border}`,
                                    background: '#5AFFB408',
                                    color: '#5AFFB4'
                                }}
                            >
                                <LayoutDashboard className="w-5 h-5" />
                            </div>
                            <h2
                                className="text-4xl leading-none mb-2"
                                style={{ fontFamily: "'Bebas Neue', cursive", color: textPrimary, letterSpacing: '0.04em' }}
                            >
                                SISRA
                                <br />
                                <span style={{ color: '#5AFFB4' }}>OPS</span>
                            </h2>
                            <p
                                className="text-[9px] font-black tracking-[0.3em] uppercase"
                                style={{ color: textMuted, fontFamily: "'JetBrains Mono', monospace" }}
                            >
                                Admin Interface · 2026
                            </p>
                        </div>
                    </div>

                    {/* Stat blocks */}
                    <div className="flex-1 flex flex-col divide-y divide-[#1C1C26]">
                        <StatBlock label="Total de Alunos" value={stats.totalStudents} highlight delay={0} />
                        <StatBlock label="Retiradas Hoje" value={stats.dailyPickups} delay={100} />
                        <StatBlock label="Em Atendimento" value={stats.activePickups} delay={200} />
                        <StatBlock label="Tempo Médio Resp." value={stats.avgWaitTime} unit="min" delay={300} />
                    </div>

                    {/* Footer status strip */}
                    <div
                        className="px-8 py-4 flex items-center gap-3"
                        style={{ borderTop: `1px solid ${border}` }}
                    >
                        <Activity className="w-3 h-3 text-[#5AFFB4] animate-pulse shrink-0" />
                        <span
                            className="text-[8px] font-black uppercase tracking-[0.25em] text-[#3D3D52]"
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                            Uptime // 98.4% · Latência // 14ms
                        </span>
                    </div>
                </aside>

                {/* ─── RIGHT CONTENT ──────────────────────────────────────── */}
                <div className="flex flex-col overflow-y-auto">

                    {/* Section label */}
                    <div
                        className="flex items-center gap-4 px-8 py-4 shrink-0"
                        style={{ borderBottom: `1px solid ${border}` }}
                    >
                        <span
                            className="text-[9px] font-black uppercase tracking-[0.35em]"
                            style={{ color: textMuted, fontFamily: "'JetBrains Mono', monospace" }}
                        >
                            Módulos Operacionais
                        </span>
                        <div className="flex-1 h-px" style={{ background: border }} />
                        <span
                            className="text-[9px] font-black uppercase tracking-[0.35em] text-[#5AFFB4]"
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                            3 Ativos
                        </span>
                    </div>

                    {/* ─── Command Cards Grid ──────────────────────────────── */}
                    <div
                        className="grid shrink-0"
                        style={{
                            gridTemplateColumns: '1fr 1fr 1fr',
                            borderBottom: `1px solid ${border}`,
                        }}
                    >
                        <div style={{ borderRight: `1px solid ${border}` }}>
                            <CommandCard
                                index="01"
                                title="Sala de Aula"
                                desc="Gestão de professores e SCTs. Chamadas e alertas em tempo real."
                                icon={School}
                                path="/sala/dashboard"
                                cta="Acessar Terminal"
                                accent="#5AFFB4"
                                isDark={isDarkMode}
                            />
                        </div>
                        <div style={{ borderRight: `1px solid ${border}` }}>
                            <CommandCard
                                index="02"
                                title="Terminal Recepção"
                                desc="Identificação e busca de alunos para controle de portaria."
                                icon={Activity}
                                path="/recepcao/busca"
                                cta="Iniciar Missão"
                                accent="#4DC8FF"
                                isDark={isDarkMode}
                            />
                        </div>
                        <div>
                            <CommandCard
                                index="03"
                                title="Inteligência & Dados"
                                desc="Telemetria, auditoria de retiradas e exportação de logs completos."
                                icon={BarChart2}
                                path="/admin/exportar-dados"
                                cta="Manifesto de Dados"
                                accent="#C27AFF"
                                isDark={isDarkMode}
                            />
                        </div>
                    </div>

                    {/* ─── Management Deck ────────────────────────────────── */}
                    <div className="flex-1">
                        {/* Section label */}
                        <div
                            className="flex items-center gap-4 px-8 py-4"
                            style={{ borderBottom: `1px solid ${border}` }}
                        >
                            <span
                                className="text-[9px] font-black uppercase tracking-[0.35em]"
                                style={{ color: textMuted, fontFamily: "'JetBrains Mono', monospace" }}
                            >
                                Deck de Gestão Global
                            </span>
                            <div className="flex-1 h-px" style={{ background: border }} />
                        </div>

                        {/* Nav items in 2-column grid */}
                        <div className="grid grid-cols-2" style={{ borderBottom: `1px solid ${border}` }}>
                            <div style={{ borderRight: `1px solid ${border}` }}>
                                <DeckItem icon={Users} label="Gestão de Alunos" path="/admin/alunos" isDark={isDarkMode} />
                                <DeckItem icon={Lock} label="Controle de Acessos" path="/admin/usuarios" isDark={isDarkMode} />
                                <DeckItem icon={LayoutGrid} label="Estrutura de Turmas" path="/admin/turmas" isDark={isDarkMode} />
                            </div>
                            <div>
                                <DeckItem icon={QrCode} label="Central de Cartões QR" path="/admin/cartoes-qr" isDark={isDarkMode} />
                                <DeckItem icon={Shield} label="Auditoria de Segurança" path="/admin/auditoria-seguranca" isDark={isDarkMode} />
                                <DeckItem icon={Settings} label="Configurações Globais" path="/admin/configuracoes" isDark={isDarkMode} />
                            </div>
                        </div>

                        {/* Bottom: Additional quick links */}
                        <div className="grid grid-cols-3 h-24">
                            {[
                                { icon: FileText, label: 'Histórico', path: '/admin/historico-retiradas' },
                                { icon: UserCheck, label: 'Funcionários', path: '/admin/funcionarios' },
                                { icon: TrendingUp, label: 'Relatórios', path: '/admin/exportar-dados' },
                            ].map((item, i) => (
                                <button
                                    key={i}
                                    onClick={() => navigate(item.path)}
                                    className="group flex flex-col items-center justify-center gap-2 transition-all duration-300 active:scale-[0.97]"
                                    style={{
                                        borderRight: i < 2 ? `1px solid ${border}` : 'none',
                                        background: 'transparent',
                                        color: textMuted,
                                    }}
                                >
                                    <item.icon className="w-4 h-4 group-hover:text-[#5AFFB4] transition-colors duration-300" />
                                    <span
                                        className="text-[8px] font-black uppercase tracking-[0.25em] group-hover:text-white transition-colors duration-300"
                                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                                    >
                                        {item.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </main>

            {/* ─── Footer ────────────────────────────────────────────────── */}
            <footer
                className="relative z-20 px-8 py-3 flex items-center justify-between shrink-0"
                style={{
                    borderTop: `1px solid ${border}`,
                    background: isDarkMode ? 'rgba(7,7,9,0.95)' : 'rgba(242,242,248,0.95)',
                }}
            >
                <span
                    className="text-[8px] font-black uppercase tracking-[0.3em] opacity-30"
                    style={{ color: textPrimary, fontFamily: "'JetBrains Mono', monospace" }}
                >
                    SISRA System Infrastructure © 2026
                </span>
                <div className="flex items-center gap-6 opacity-30">
                    {['SECURE_LINK // RSA_4096', 'LATENCY // 14MS', 'ENV // PROD'].map(tag => (
                        <span
                            key={tag}
                            className="text-[7px] font-bold tracking-widest uppercase"
                            style={{ color: textMuted, fontFamily: "'JetBrains Mono', monospace" }}
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            </footer>
        </div>
    );
}
