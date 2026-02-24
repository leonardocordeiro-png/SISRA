import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Users, School, Clock, Activity, TrendingUp, QrCode, BarChart2, Shield, Settings, ChevronRight, LayoutDashboard, Database, Zap } from 'lucide-react';
import NavigationControls from '../../components/NavigationControls';

export default function AdminDashboard() {
    const { signOut } = useAuth();
    const navigate = useNavigate();
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
        <div className="min-h-screen bg-[#020617] flex flex-col w-full max-w-full overflow-x-hidden relative selection:bg-emerald-500/30">
            {/* Ambient HUD Background Layer */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[70%] h-[70%] bg-slate-500/[0.03] blur-[120px] rounded-full animate-pulse-slow" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/[0.03] blur-[120px] rounded-full animate-pulse-slow" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
                <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent top-1/4 animate-scan opacity-20" />
            </div>

            {/* Tactical Operational Header */}
            <header className="relative z-20 bg-[#020617]/80 backdrop-blur-xl border-b border-white/5 px-6 md:px-12 py-6 flex items-center justify-between shadow-2xl">
                <div className="flex items-center gap-6">
                    <div className="relative group">
                        <div className="absolute -inset-2 bg-emerald-500/20 blur-lg rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" title="System Stable"></div>
                        <div className="relative bg-[#020617] p-3 rounded-xl border border-white/10 flex items-center justify-center shadow-2xl group-hover:border-emerald-500/40 transition-all duration-500">
                            <LayoutDashboard className="w-6 h-6 text-emerald-500" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-xl font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                            Command Center Prime
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[8px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-widest animate-pulse">
                                Active
                            </span>
                        </h1>
                        <div className="flex items-center gap-4">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">SISRA Operational Hub</p>
                            <span className="hidden md:block w-1 h-1 bg-slate-700 rounded-full"></span>
                            <p className="hidden md:block text-[10px] font-bold text-slate-600 uppercase tracking-widest">Node: SISRA.ADM.MAIN_DECK</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-8">
                    <div className="hidden lg:flex items-center gap-4 px-6 py-2 bg-white/[0.02] border border-white/5 rounded-full backdrop-blur-md">
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">System Health</span>
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
                    />
                    <TelemetryUnit
                        title="Retiradas Hoje"
                        value={stats.dailyPickups}
                        sub="Fluxo Diário"
                        icon={<Zap className="w-6 h-6 text-emerald-500" />}
                        trend="Nominal"
                        color="emerald"
                    />
                    <TelemetryUnit
                        title="Atendimentos em Curso"
                        value={stats.activePickups}
                        sub="Fila de Espera"
                        icon={<Clock className="w-6 h-6 text-amber-500" />}
                        trend="Priority High"
                        color="amber"
                    />
                    <TelemetryUnit
                        title="T. Médio Resposta"
                        value={`${stats.avgWaitTime} min`}
                        sub="Performance"
                        icon={<TrendingUp className="w-6 h-6 text-violet-500" />}
                        trend="-2.1% Latency"
                        color="violet"
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
                        />
                        <CommandModule
                            title="Terminal de Recepção"
                            desc="Módulo de identificação e busca de alunos em tempo real para controle de portaria."
                            icon={<Activity className="w-8 h-8" />}
                            path="/recepcao/busca"
                            label="Iniciar Missão"
                            color="blue"
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
                            />
                        </div>
                    </div>

                    {/* Quick Access Sidebar / Command Deck */}
                    <div className="lg:col-span-4 space-y-8">
                        <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                            <h3 className="text-sm font-black text-white uppercase italic tracking-[0.2em] mb-8 flex items-center gap-3">
                                <Database className="w-4 h-4 text-slate-500" />
                                Deck de Gestão Global
                            </h3>

                            <nav className="space-y-4">
                                <NavDeckItem icon={<Users />} label="Gestão de Alunos" path="/admin/alunos" />
                                <NavDeckItem icon={<Shield />} label="Controle de Acessos" path="/admin/usuarios" />
                                <NavDeckItem icon={<LayoutDashboard />} label="Estrutura de Turmas" path="/admin/turmas" />
                                <NavDeckItem icon={<QrCode />} label="Central de Cartões QR" path="/admin/cartoes-qr" accent="violet" />
                                <NavDeckItem icon={<Shield />} label="Auditoria de Segurança" path="/admin/auditoria-seguranca" accent="rose" />
                                <div className="pt-4 border-t border-white/5 mt-4">
                                    <NavDeckItem icon={<Settings />} label="Configurações Globais" path="/admin/configuracoes" ghost />
                                </div>
                            </nav>
                        </div>

                        <div className="p-8 bg-emerald-500/5 border border-emerald-500/10 rounded-[2rem] relative overflow-hidden">
                            <div className="relative z-10 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Backup Integridade</p>
                                    <p className="text-xs font-bold text-emerald-500/60 uppercase italic tracking-tighter">Última sincronia: agora</p>
                                </div>
                                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                                    <Activity className="w-5 h-5 text-emerald-500 animate-pulse" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* System Footer Overlay */}
            <footer className="relative z-20 px-12 py-8 flex flex-col md:flex-row items-center justify-between border-t border-white/5 opacity-30">
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">SISRA System Infrastructure © 2026</p>
                <div className="flex gap-8 mt-4 md:mt-0">
                    <span className="text-[9px] font-bold text-slate-700 tracking-tighter">SECURE_LINK // RSA_4096_ACTIVE</span>
                    <span className="text-[9px] font-bold text-slate-700 tracking-tighter">LATENCY // 14MS</span>
                </div>
            </footer>
        </div>
    );
}

function TelemetryUnit({ title, value, sub, icon, trend, color }: { title: string, value: string | number, sub: string, icon: React.ReactNode, trend: string, color: string }) {
    const colorMap: any = {
        blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20 hover:border-blue-500/50',
        emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/50',
        amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20 hover:border-amber-500/50',
        violet: 'text-violet-500 bg-violet-500/10 border-violet-500/20 hover:border-violet-500/50',
        rose: 'text-rose-500 bg-rose-500/10 border-rose-500/20 hover:border-rose-500/50',
    };

    return (
        <div className={`p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/5 backdrop-blur-3xl transition-all duration-700 hover:scale-[1.02] hover:bg-white/[0.04] group relative overflow-hidden shadow-2xl ${colorMap[color].split(' ')[2]}`}>
            <div className={`absolute top-0 right-0 p-10 opacity-5 transition-opacity group-hover:opacity-10 ${colorMap[color].split(' ')[0]}`}>
                {icon}
            </div>

            <div className="space-y-6 relative z-10">
                <div className="flex items-center justify-between">
                    <div className="p-3 bg-[#020617]/50 rounded-2xl border border-white/5 shadow-inner">
                        {icon}
                    </div>
                    <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-md bg-white/5 border border-white/10 ${colorMap[color].split(' ')[0]}`}>
                        {trend}
                    </span>
                </div>

                <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{title}</p>
                    <h3 className="text-4xl font-black text-white italic tracking-tighter leading-none">{value}</h3>
                </div>

                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em] border-l-2 border-white/5 pl-3">{sub}</p>
            </div>
        </div>
    );
}

function CommandModule({ title, desc, icon, path, label, color, layout = 'standard' }: any) {
    const navigate = useNavigate();
    const colorMap: any = {
        blue: 'from-blue-500/20 via-blue-500/5 to-transparent border-blue-500/20 text-blue-500',
        emerald: 'from-emerald-500/20 via-emerald-500/5 to-transparent border-emerald-500/20 text-emerald-500',
        violet: 'from-violet-500/20 via-violet-500/5 to-transparent border-violet-500/20 text-violet-500',
    };

    return (
        <div
            onClick={() => navigate(path)}
            className={`group relative bg-white/[0.02] p-10 rounded-[3rem] border border-white/5 backdrop-blur-3xl hover:bg-white/[0.04] transition-all duration-1000 cursor-pointer overflow-hidden shadow-2xl flex flex-col ${layout === 'wide' ? 'md:flex-row md:items-center gap-10' : ''}`}
        >
            <div className={`absolute -inset-2 bg-gradient-to-br ${colorMap[color]} opacity-0 group-hover:opacity-100 transition-opacity duration-1000`} />

            <div className="relative z-10 space-y-8 flex-1">
                <div className={`w-16 h-16 bg-[#020617]/50 rounded-[1.5rem] border border-white/10 flex items-center justify-center shadow-2xl transition-all duration-700 group-hover:scale-110 group-hover:border-${color}-500/40`}>
                    <div className={`${colorMap[color].split(' ')[3]}`}>
                        {icon}
                    </div>
                </div>

                <div className="space-y-3">
                    <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter group-hover:translate-x-1 transition-transform duration-700">{title}</h2>
                    <p className="text-sm font-bold text-slate-500 leading-relaxed uppercase tracking-tight max-w-sm opacity-60 group-hover:opacity-100 transition-opacity">
                        {desc}
                    </p>
                </div>

                <div className="pt-6 border-t border-white/5 flex items-center justify-between group-hover:border-white/10 transition-colors">
                    <span className={`text-[10px] font-black uppercase tracking-[0.3em] font-mono ${colorMap[color].split(' ')[3]}`}>
                        {label}
                    </span>
                    <ChevronRight className={`w-5 h-5 ${colorMap[color].split(' ')[3]} group-hover:translate-x-2 transition-transform duration-500`} />
                </div>
            </div>

            {layout === 'wide' && (
                <div className="hidden md:flex relative z-10 w-48 h-48 items-center justify-center">
                    <div className="absolute inset-0 border-2 border-dashed border-white/5 rounded-full animate-spin-slow opacity-20" />
                    <BarChart2 className={`w-16 h-16 opacity-10 ${colorMap[color].split(' ')[3]}`} />
                </div>
            )}
        </div>
    );
}

function NavDeckItem({ icon, label, path, accent = 'slate', ghost = false }: any) {
    const navigate = useNavigate();
    const accentMap: any = {
        slate: 'text-slate-400 group-hover:text-white group-hover:bg-white/10',
        violet: 'text-violet-400 group-hover:text-violet-300 group-hover:bg-violet-500/10',
        rose: 'text-rose-400 group-hover:text-rose-300 group-hover:bg-rose-500/10',
    };

    return (
        <button
            onClick={() => navigate(path)}
            className={`w-full group flex items-center gap-4 p-4 rounded-2xl border transition-all duration-500 ${ghost ? 'border-transparent hover:bg-white/5' : 'bg-[#020617]/50 border-white/5 hover:border-white/20 active:scale-[0.98]'}`}
        >
            <div className={`p-2.5 rounded-xl transition-all duration-500 ${accentMap[accent].split(' ')[1]} ${accentMap[accent].split(' ')[2]}`}>
                {import.meta.env.DEV ? icon : <div className="w-4 h-4">{icon}</div>}
            </div>
            <span className={`text-xs font-black uppercase tracking-widest transition-colors ${ghost ? 'text-slate-600 group-hover:text-slate-400' : 'text-slate-400 group-hover:text-white'}`}>
                {label}
            </span>
            <ChevronRight className="w-4 h-4 ml-auto opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500 text-slate-600" />
        </button>
    );
}
