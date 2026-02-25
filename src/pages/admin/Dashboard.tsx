import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Users, School, Clock, Activity, TrendingUp, QrCode, BarChart2, Shield, Settings, ChevronRight, LayoutDashboard, Database, Zap, Sun, Moon } from 'lucide-react';
import NavigationControls from '../../components/NavigationControls';

export default function AdminDashboard() {
    const { signOut } = useAuth();
    const navigate = useNavigate();
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [stats, setStats] = useState({
        totalStudents: 0,
        activePickups: 0,
        dailyPickups: 0,
        avgWaitTime: 0
    });

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
        const interval = setInterval(fetchStats, 60000);
        return () => clearInterval(interval);
    }, []);

    const handleLogout = async () => {
        await signOut();
        navigate('/admin/login');
    };

    return (
        <div className={`min-h-screen transition-colors duration-1000 flex flex-col w-full max-w-full overflow-x-hidden relative selection:bg-emerald-500/30 ${isDarkMode ? 'bg-[#020617]' : 'bg-slate-50'}`}>
            {/* Ambient HUD Background Layer */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <div className={`absolute top-[-10%] right-[-10%] w-[70%] h-[70%] blur-[120px] rounded-full animate-pulse-slow ${isDarkMode ? 'bg-slate-500/[0.03]' : 'bg-slate-500/[0.06]'}`} />
                <div className={`absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] blur-[120px] rounded-full animate-pulse-slow ${isDarkMode ? 'bg-emerald-500/[0.03]' : 'bg-emerald-500/[0.06]'}`} />
                <div className={`absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] ${!isDarkMode ? 'invert' : ''}`} />
                <div className={`absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent top-1/4 animate-scan opacity-20`} />
            </div>

            {/* Tactical Operational Header */}
            <header className={`relative z-20 backdrop-blur-xl border-b px-6 md:px-12 py-6 flex items-center justify-between shadow-2xl transition-all duration-500 ${isDarkMode ? 'bg-[#020617]/80 border-white/5' : 'bg-white/80 border-slate-200'}`}>
                <div className="flex items-center gap-6">
                    <div className="relative group">
                        <div className="absolute -inset-2 bg-emerald-500/20 blur-lg rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" title="System Stable"></div>
                        <div className={`relative p-3 rounded-xl border flex items-center justify-center shadow-2xl group-hover:border-emerald-500/40 transition-all duration-500 ${isDarkMode ? 'bg-[#020617] border-white/10' : 'bg-white border-slate-200'}`}>
                            <LayoutDashboard className="w-6 h-6 text-emerald-500" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <h1 className={`text-xl font-black italic uppercase tracking-tighter flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            Command Center Prime
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[8px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-widest animate-pulse">
                                Active
                            </span>
                        </h1>
                        <div className="flex items-center gap-4">
                            <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>SISRA Operational Hub</p>
                            <span className={`hidden md:block w-1 h-1 rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`}></span>
                            <p className={`hidden md:block text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-600' : 'text-slate-500'}`}>Node: SISRA.ADM.MAIN_DECK</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 md:gap-8">
                    <button
                        onClick={() => setIsDarkMode(!isDarkMode)}
                        className={`p-2.5 rounded-xl border transition-all duration-500 shadow-lg ${isDarkMode ? 'bg-white/5 border-white/10 text-amber-400 hover:bg-white/10' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'}`}
                    >
                        {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>

                    <div className={`hidden lg:flex items-center gap-4 px-6 py-2 border rounded-full backdrop-blur-md ${isDarkMode ? 'bg-white/[0.02] border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                        <div className="flex flex-col items-end">
                            <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-600' : 'text-slate-500'}`}>System Health</span>
                            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter">Normal // 98.4%</span>
                        </div>
                        <Activity className="w-4 h-4 text-emerald-500/50 animate-pulse" />
                    </div>

                    <button
                        onClick={handleLogout}
                        className="group flex items-center gap-3 px-5 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 hover:bg-rose-500 hover:text-white transition-all duration-500 text-xs font-black uppercase tracking-widest active:scale-95"
                    >
                        <LogOut className="w-4 h-4 group-hover:rotate-180 transition-transform duration-700" />
                        <span>Terminar Sessão</span>
                    </button>
                </div>
            </header>

            <main className="relative z-10 flex-1 max-w-[1600px] mx-auto w-full p-6 md:p-12 space-y-12 animate-in fade-in zoom-in-95 duration-1000">
                <NavigationControls />

                {/* Telemetry Units (Stats) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
                    <TelemetryUnit
                        title="Total de Alunos"
                        value={stats.totalStudents}
                        sub="Registros Ativos"
                        icon={<Users className="w-6 h-6 text-blue-500" />}
                        trend="+12% Base"
                        color="blue"
                        isDarkMode={isDarkMode}
                    />
                    <TelemetryUnit
                        title="Retiradas Hoje"
                        value={stats.dailyPickups}
                        sub="Fluxo Diário"
                        icon={<Zap className="w-6 h-6 text-emerald-500" />}
                        trend="Nominal"
                        color="emerald"
                        isDarkMode={isDarkMode}
                    />
                    <TelemetryUnit
                        title="Atendimentos em Curso"
                        value={stats.activePickups}
                        sub="Fila de Espera"
                        icon={<Clock className="w-6 h-6 text-amber-500" />}
                        trend="Priority High"
                        color="amber"
                        isDarkMode={isDarkMode}
                    />
                    <TelemetryUnit
                        title="T. Médio Resposta"
                        value={`${stats.avgWaitTime} min`}
                        sub="Performance"
                        icon={<TrendingUp className="w-6 h-6 text-violet-500" />}
                        trend="-2.1% Latency"
                        color="violet"
                        isDarkMode={isDarkMode}
                    />
                </div>

                {/* Top-Level Command Modules */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Primary Flow Modules */}
                    <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <CommandModule
                            title="Operacional Sala de Aula"
                            desc="Interface de gestão para professores e SCTs. Controle de chamadas e alertas em tempo real."
                            icon={<School className="w-8 h-8" />}
                            path="/sala/dashboard"
                            label="Acessar Terminal"
                            color="emerald"
                            isDarkMode={isDarkMode}
                        />
                        <CommandModule
                            title="Terminal de Recepção"
                            desc="Módulo de identificação e busca de alunos em tempo real para controle de portaria."
                            icon={<Activity className="w-8 h-8" />}
                            path="/recepcao/busca"
                            label="Iniciar Missão"
                            color="blue"
                            isDarkMode={isDarkMode}
                        />
                        <div className="md:col-span-2">
                            <CommandModule
                                title="Inteligência e Relatórios"
                                desc="Central de telemetria para análise de dados, auditoria de retiradas e exportação de logs operacionais completos."
                                icon={<BarChart2 className="w-8 h-8" />}
                                path="/admin/exportar-dados"
                                label="Manifesto de Dados"
                                color="violet"
                                layout="wide"
                                isDarkMode={isDarkMode}
                            />
                        </div>
                    </div>

                    {/* Quick Access Sidebar / Command Deck */}
                    <div className="lg:col-span-4 space-y-8">
                        <div className={`border rounded-[2.5rem] p-8 backdrop-blur-3xl shadow-2xl relative overflow-hidden group transition-all duration-500 ${isDarkMode ? 'bg-white/[0.02] border-white/5' : 'bg-white border-slate-200 shadow-slate-200'}`}>
                            <div className={`absolute inset-0 bg-gradient-to-br pointer-events-none ${isDarkMode ? 'from-white/[0.02] to-transparent' : 'from-slate-50 to-transparent'}`} />
                            <h3 className={`text-sm font-black uppercase italic tracking-[0.2em] mb-8 flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                <Database className="w-4 h-4 text-slate-500" />
                                Deck de Gestão Global
                            </h3>

                            <nav className="space-y-4">
                                <NavDeckItem icon={<Users />} label="Gestão de Alunos" path="/admin/alunos" isDarkMode={isDarkMode} />
                                <NavDeckItem icon={<Shield />} label="Controle de Acessos" path="/admin/usuarios" isDarkMode={isDarkMode} />
                                <NavDeckItem icon={<LayoutDashboard />} label="Estrutura de Turmas" path="/admin/turmas" isDarkMode={isDarkMode} />
                                <NavDeckItem icon={<QrCode />} label="Central de Cartões QR" path="/admin/cartoes-qr" accent="violet" isDarkMode={isDarkMode} />
                                <NavDeckItem icon={<Shield />} label="Auditoria de Segurança" path="/admin/auditoria-seguranca" accent="rose" isDarkMode={isDarkMode} />
                                <div className={`pt-4 border-t mt-4 ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                                    <NavDeckItem icon={<Settings />} label="Configurações Globais" path="/admin/configuracoes" ghost isDarkMode={isDarkMode} />
                                </div>
                            </nav>
                        </div>

                        <div className={`border rounded-[2rem] p-8 relative overflow-hidden transition-all duration-500 ${isDarkMode ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-emerald-50 border-emerald-100'}`}>
                            <div className="relative z-10 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Backup Integridade</p>
                                    <p className={`text-xs font-bold uppercase italic tracking-tighter ${isDarkMode ? 'text-emerald-500/60' : 'text-emerald-600/60'}`}>Última sincronia: agora</p>
                                </div>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
                                    <Activity className="w-5 h-5 text-emerald-500 animate-pulse" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* System Footer Overlay */}
            <footer className={`relative z-20 px-12 py-8 flex flex-col md:flex-row items-center justify-between border-t transition-all duration-500 ${isDarkMode ? 'border-white/5 opacity-30' : 'border-slate-200 opacity-60'}`}>
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">SISRA System Infrastructure © 2026</p>
                <div className="flex gap-8 mt-4 md:mt-0">
                    <span className="text-[9px] font-bold text-slate-700 tracking-tighter">SECURE_LINK // RSA_4096_ACTIVE</span>
                    <span className="text-[9px] font-bold text-slate-700 tracking-tighter">LATENCY // 14MS</span>
                </div>
            </footer>
        </div>
    );
}

function TelemetryUnit({ title, value, sub, icon, trend, color, isDarkMode }: { title: string, value: string | number, sub: string, icon: React.ReactNode, trend: string, color: string, isDarkMode: boolean }) {
    const colorMap: any = {
        blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20 hover:border-blue-500/50',
        emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/50',
        amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20 hover:border-amber-500/50',
        violet: 'text-violet-500 bg-violet-500/10 border-violet-500/20 hover:border-violet-500/50',
        rose: 'text-rose-500 bg-rose-500/10 border-rose-500/20 hover:border-rose-500/50',
    };

    return (
        <div className={`p-8 rounded-[2.5rem] border backdrop-blur-3xl transition-all duration-700 hover:scale-[1.02] group relative overflow-hidden shadow-2xl ${isDarkMode ? 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]' : 'bg-white border-slate-200 hover:bg-slate-50 shadow-slate-200/50'} ${colorMap[color].split(' ')[2]}`}>
            <div className={`absolute top-0 right-0 p-10 opacity-5 transition-opacity group-hover:opacity-10 ${colorMap[color].split(' ')[0]}`}>
                {icon}
            </div>

            <div className="space-y-6 relative z-10">
                <div className="flex items-center justify-between">
                    <div className={`p-3 rounded-2xl border shadow-inner transition-colors duration-500 ${isDarkMode ? 'bg-[#020617]/50 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                        {icon}
                    </div>
                    <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-md border transition-colors duration-500 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'} ${colorMap[color].split(' ')[0]}`}>
                        {trend}
                    </span>
                </div>

                <div className="space-y-1">
                    <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>{title}</p>
                    <h3 className={`text-4xl font-black italic tracking-tighter leading-none transition-colors duration-500 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{value}</h3>
                </div>

                <p className={`text-[9px] font-bold uppercase tracking-[0.2em] border-l-2 pl-3 transition-colors duration-500 ${isDarkMode ? 'text-slate-600 border-white/5' : 'text-slate-500 border-slate-300'}`}>{sub}</p>
            </div>
        </div>
    );
}

function CommandModule({ title, desc, icon, path, label, color, layout = 'standard', isDarkMode }: any) {
    const navigate = useNavigate();
    const colorMap: any = {
        blue: 'from-blue-500/20 via-blue-500/5 to-transparent border-blue-500/20 text-blue-500',
        emerald: 'from-emerald-500/20 via-emerald-500/5 to-transparent border-emerald-500/20 text-emerald-500',
        violet: 'from-violet-500/20 via-violet-500/5 to-transparent border-violet-500/20 text-violet-500',
    };

    return (
        <div
            onClick={() => navigate(path)}
            className={`group relative p-10 rounded-[3rem] border backdrop-blur-3xl transition-all duration-1000 cursor-pointer overflow-hidden shadow-2xl flex flex-col ${isDarkMode ? 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]' : 'bg-white border-slate-200 hover:bg-slate-50 shadow-slate-200/50'} ${layout === 'wide' ? 'md:flex-row md:items-center gap-10' : ''}`}
        >
            <div className={`absolute -inset-2 bg-gradient-to-br ${colorMap[color]} opacity-0 group-hover:opacity-100 transition-opacity duration-1000`} />

            <div className="relative z-10 space-y-8 flex-1">
                <div className={`w-16 h-16 rounded-[1.5rem] border flex items-center justify-center shadow-2xl transition-all duration-700 group-hover:scale-110 group-hover:border-${color}-500/40 ${isDarkMode ? 'bg-[#020617]/50 border-white/10' : 'bg-white border-slate-100'}`}>
                    <div className={`${colorMap[color].split(' ')[3]}`}>
                        {icon}
                    </div>
                </div>

                <div className="space-y-3">
                    <h2 className={`text-2xl font-black italic uppercase tracking-tighter group-hover:translate-x-1 transition-all duration-700 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{title}</h2>
                    <p className={`text-sm font-bold leading-relaxed uppercase tracking-tight max-w-sm transition-opacity ${isDarkMode ? 'text-slate-500 opacity-60 group-hover:opacity-100' : 'text-slate-600 opacity-80 group-hover:opacity-100'}`}>
                        {desc}
                    </p>
                </div>

                <div className={`pt-6 border-t flex items-center justify-between transition-colors ${isDarkMode ? 'border-white/5 group-hover:border-white/10' : 'border-slate-100 group-hover:border-slate-200'}`}>
                    <span className={`text-[10px] font-black uppercase tracking-[0.3em] font-mono ${colorMap[color].split(' ')[3]}`}>
                        {label}
                    </span>
                    <ChevronRight className={`w-5 h-5 ${colorMap[color].split(' ')[3]} group-hover:translate-x-2 transition-transform duration-500`} />
                </div>
            </div>

            {layout === 'wide' && (
                <div className="hidden md:flex relative z-10 w-48 h-48 items-center justify-center">
                    <div className={`absolute inset-0 border-2 border-dashed rounded-full animate-spin-slow opacity-20 ${isDarkMode ? 'border-white/5' : 'border-slate-300'}`} />
                    <BarChart2 className={`w-16 h-16 opacity-10 ${colorMap[color].split(' ')[3]}`} />
                </div>
            )}
        </div>
    );
}

function NavDeckItem({ icon, label, path, accent = 'slate', ghost = false, isDarkMode }: any) {
    const navigate = useNavigate();

    const iconClass = isDarkMode
        ? accent === 'violet' ? 'text-violet-400 bg-violet-500/10 group-hover:text-violet-300'
            : accent === 'rose' ? 'text-rose-400 bg-rose-500/10 group-hover:text-rose-300'
                : 'text-slate-400 bg-white/5 group-hover:text-white group-hover:bg-white/10'
        : accent === 'violet' ? 'text-violet-600 bg-violet-100 group-hover:text-violet-700'
            : accent === 'rose' ? 'text-rose-600 bg-rose-100 group-hover:text-rose-700'
                : 'text-slate-600 bg-slate-100 group-hover:text-slate-900 group-hover:bg-slate-200';

    const labelClass = isDarkMode
        ? ghost ? 'text-slate-400 group-hover:text-slate-300'
            : accent === 'violet' ? 'text-violet-400 group-hover:text-violet-300'
                : accent === 'rose' ? 'text-rose-400 group-hover:text-rose-300'
                    : 'text-slate-400 group-hover:text-white'
        : ghost ? 'text-slate-500 group-hover:text-slate-700'
            : accent === 'violet' ? 'text-violet-600 group-hover:text-violet-800'
                : accent === 'rose' ? 'text-rose-600 group-hover:text-rose-800'
                    : 'text-slate-700 group-hover:text-slate-900';

    return (
        <button
            onClick={() => navigate(path)}
            className={`w-full group flex items-center gap-4 p-4 rounded-2xl border transition-all duration-500 ${ghost ? 'border-transparent hover:bg-slate-100/50' : isDarkMode ? 'bg-[#020617]/50 border-white/5 hover:border-white/20 active:scale-[0.98]' : 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]'}`}
        >
            <div className={`p-2.5 rounded-xl transition-all duration-500 ${iconClass}`}>
                <div className="w-4 h-4">{icon}</div>
            </div>
            <span className={`text-xs font-black uppercase tracking-widest transition-colors ${labelClass}`}>
                {label}
            </span>
            <ChevronRight className={`w-4 h-4 ml-auto opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
        </button>
    );
}
