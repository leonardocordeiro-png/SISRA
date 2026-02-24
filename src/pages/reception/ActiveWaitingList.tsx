import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Clock, User, Users, ChevronRight, Activity, Search, Bell } from 'lucide-react';
import NavigationControls from '../../components/NavigationControls';

type WaitingStudent = {
    id: string;
    aluno: { nome_completo: string; turma: string; matricula: string };
    responsavel: { nome_completo: string };
    status: string;
    created_at: string;
    wait_time_minutes: number;
    mensagem_sala?: string;
    mensagem_recepcao?: string;
};

export default function ActiveWaitingList() {
    const { user } = useAuth();
    const [waiting, setWaiting] = useState<WaitingStudent[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');

    useEffect(() => {
        if (!user) return;

        fetchWaitingList();

        const channel = supabase
            .channel(`waiting_list_updates_${user.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'solicitacoes_retirada'
            }, (payload) => {
                console.log('Realtime update at Reception:', payload);
                fetchWaitingList();
            })
            .subscribe((status) => {
                console.log('Realtime status at Reception:', status);
            });

        const timer = setInterval(() => {
            setWaiting(prev => prev.map(item => ({
                ...item,
                wait_time_minutes: Math.round(
                    (new Date().getTime() - new Date(item.created_at).getTime()) / 60000
                )
            })));
        }, 30000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(timer);
        };
    }, [user?.id]);

    const fetchWaitingList = async () => {
        try {
            const { data, error } = await supabase
                .from('solicitacoes_retirada')
                .select(`
                    *,
                    aluno:alunos(nome_completo, turma, matricula),
                    responsavel:responsaveis(nome_completo)
                `)
                .in('status', ['SOLICITADO', 'NOTIFICADO', 'CONFIRMADO', 'AGUARDANDO', 'LIBERADO'])
                .order('created_at', { ascending: true });

            if (error) throw error;

            const withWaitTime = data?.map(item => ({
                ...item,
                wait_time_minutes: Math.round(
                    (new Date().getTime() - new Date(item.created_at).getTime()) / 60000
                )
            })) || [];

            setWaiting(withWaitTime);
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'SOLICITADO': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'NOTIFICADO': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
            case 'CONFIRMADO': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'AGUARDANDO': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            case 'LIBERADO': return 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-500/20';
            default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
        }
    };

    const filtered = waiting.filter(w =>
        w.aluno?.nome_completo.toLowerCase().includes(filter.toLowerCase()) ||
        w.responsavel?.nome_completo.toLowerCase().includes(filter.toLowerCase())
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Activity className="w-12 h-12 text-emerald-500 animate-pulse" />
                    <p className="text-slate-400 font-medium animate-pulse">Sincronizando fila...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-emerald-500/30 overflow-x-hidden relative">
            {/* Ultra-Premium Ambient Background */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/5 blur-[120px] rounded-full animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 blur-[120px] rounded-full animate-pulse-slow" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] pointer-events-none" />

                {/* HUD Grid Overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto p-6 lg:p-12 min-h-screen flex flex-col">
                {/* Header Section */}
                <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-10 mb-16 relative">
                    <div className="space-y-6">
                        <NavigationControls />
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                                    <Users className="w-6 h-6 text-emerald-500" />
                                </div>
                                <div className="space-y-0.5">
                                    <span className="text-emerald-500 font-black tracking-[0.3em] text-[10px] uppercase block">Operations Center</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                                        <span className="text-white/40 font-bold text-[10px] tracking-widest uppercase italic">Live Sequence Active</span>
                                    </div>
                                </div>
                            </div>
                            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase italic leading-[0.85]">
                                Fila de <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">Espera Ativa</span>
                            </h1>
                            <p className="text-slate-500 max-w-lg font-medium text-sm md:text-base leading-relaxed">Monitoramento tático de retiradas, tempo de resposta e integridade da fila em tempo real.</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch lg:items-center gap-6 w-full lg:w-auto">
                        <div className="relative group min-w-[300px]">
                            <div className="absolute inset-0 bg-emerald-500/5 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Filtrar por aluno ou responsável..."
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="w-full pl-12 pr-6 py-4 bg-white/[0.03] border border-white/10 rounded-2xl focus:border-emerald-500/50 outline-none transition-all text-white font-bold placeholder:text-slate-600 backdrop-blur-3xl shadow-2xl"
                            />
                        </div>

                        <div className="bg-[#020617]/80 border border-white/10 px-8 py-5 rounded-3xl flex flex-row lg:flex-col items-center justify-center min-w-[160px] gap-4 lg:gap-1 backdrop-blur-3xl shadow-2xl group/stat">
                            <div className="relative">
                                <span className="text-4xl lg:text-5xl font-black text-emerald-500 italic tracking-tighter leading-none group-hover/stat:scale-110 transition-transform block">{waiting.length}</span>
                                <div className="absolute -inset-4 bg-emerald-500/10 blur-2xl rounded-full opacity-0 group-hover/stat:opacity-100 transition-opacity"></div>
                            </div>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap text-center">Current <br className="hidden lg:block" /> Manifest</span>
                        </div>
                    </div>
                </header>

                {/* Empty State */}
                {filtered.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-20 text-center relative overflow-hidden bg-white/[0.02] border border-white/5 rounded-[3rem] backdrop-blur-sm">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/[0.03] blur-[100px] rounded-full animate-pulse-slow"></div>
                        <div className="relative space-y-8">
                            <div className="w-32 h-32 bg-[#020617] border-2 border-white/10 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl group transition-all duration-700 hover:border-emerald-500/30">
                                <Activity className="w-12 h-12 text-slate-700 group-hover:text-emerald-500 group-hover:scale-110 transition-all duration-700" />
                                <div className="absolute inset-x-0 h-4 bg-emerald-500/10 blur-xl animate-scan"></div>
                            </div>
                            <div className="space-y-3">
                                <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase">Fila Nominal</h3>
                                <p className="text-slate-500 max-w-sm mx-auto text-sm font-bold uppercase tracking-widest leading-relaxed">Nenhuma atividade pendente detectada no setor de transporte. O sistema permanece em espera.</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 flex-1">
                        {filtered.map((item, index) => {
                            const isCritical = item.wait_time_minutes > 15;
                            const isWarning = item.wait_time_minutes > 8;

                            return (
                                <div
                                    key={item.id}
                                    className="group relative bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 hover:border-emerald-500/30 backdrop-blur-3xl rounded-[1.5rem] p-6 lg:p-8 transition-all duration-500 flex flex-col lg:flex-row lg:items-center justify-between gap-8 overflow-hidden shadow-2xl"
                                >
                                    {/* Scanline Effect on item hover */}
                                    <div className="absolute inset-x-0 h-1 bg-emerald-500/10 blur-sm top-0 opacity-0 group-hover:opacity-100 animate-scan pointer-events-none"></div>

                                    <div className="flex items-center gap-8 relative z-10">
                                        <div className="relative hidden md:block shrink-0">
                                            <div className="w-20 h-20 bg-[#020617] rounded-3xl flex items-center justify-center border-2 border-white/10 font-black text-2xl text-slate-600 group-hover:border-emerald-500/40 group-hover:text-emerald-500 transition-all duration-500 shadow-2xl italic tracking-tighter">
                                                {String(index + 1).padStart(2, '0')}
                                            </div>
                                            {isCritical && (
                                                <div className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 rounded-lg border-4 border-[#020617] flex items-center justify-center animate-bounce shadow-lg shadow-rose-500/30">
                                                    <span className="text-[10px] font-black text-white">!</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-3 min-w-0">
                                            <div className="flex flex-wrap items-center gap-4">
                                                <h3 className="text-2xl md:text-3xl font-black text-white uppercase italic tracking-tighter group-hover:text-emerald-400 transition-colors leading-none truncate">
                                                    {item.aluno?.nome_completo}
                                                </h3>
                                                <span className={`px-3 py-1 rounded-full text-[9px] font-black tracking-[0.2em] border uppercase backdrop-blur-md transition-all duration-500 ${getStatusStyles(item.status)}`}>
                                                    {item.status}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-4 text-slate-500 font-bold text-xs uppercase tracking-widest">
                                                <span className="text-emerald-500/80">{item.aluno?.turma}</span>
                                                <div className="w-1 h-1 bg-white/10 rounded-full" />
                                                <span>ID: {item.aluno?.matricula}</span>
                                            </div>

                                            {item.mensagem_sala && (
                                                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-2.5 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-left-4 duration-500">
                                                    <Bell className="w-4 h-4 mt-0.5 shrink-0 animate-pulse" />
                                                    <p className="text-[11px] font-black uppercase tracking-tight italic leading-snug">Nota do Setor: "{item.mensagem_sala}"</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-6 lg:gap-16 relative z-10">
                                        <div className="flex items-center gap-5">
                                            <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 group-hover:border-blue-500/30 transition-all duration-500 shadow-2xl">
                                                <User className="w-6 h-6 text-slate-500 group-hover:text-blue-400 transition-colors" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Authorized Guardian</p>
                                                <p className="text-base font-black text-white italic tracking-tight">{item.responsavel?.nome_completo}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-5 min-w-[180px]">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-500 shadow-2xl ${isCritical ? 'bg-rose-500/10 border-rose-500/30 text-rose-500' :
                                                isWarning ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' :
                                                    'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                                                }`}>
                                                <Clock className={`w-6 h-6 ${isCritical ? 'animate-pulse' : ''}`} />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Deployment Timer</p>
                                                <p className={`text-xl font-black italic tracking-tighter ${isCritical ? 'text-rose-400' :
                                                    isWarning ? 'text-amber-400' :
                                                        'text-emerald-400'
                                                    }`}>
                                                    {item.wait_time_minutes}M <span className="text-[10px] opacity-60">ELAPSED</span>
                                                </p>
                                            </div>
                                        </div>

                                        <button className="h-14 w-14 bg-white/5 hover:bg-emerald-500 text-slate-500 hover:text-slate-950 rounded-2xl border border-white/10 transition-all duration-500 flex items-center justify-center group/arrow shadow-2xl">
                                            <ChevronRight className="w-6 h-6 group-hover/arrow:translate-x-1 transition-transform" />
                                        </button>
                                    </div>

                                    {/* Indicator Beam for Critical State */}
                                    {isCritical && (
                                        <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-rose-600 shadow-[0_0_20px_rgba(225,29,72,0.8)] animate-pulse"></div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Legend Area */}
                <footer className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 pb-12">
                    <div className="p-6 bg-emerald-500/[0.02] border border-emerald-500/10 rounded-3xl flex items-center gap-5 backdrop-blur-md group hover:bg-emerald-500/[0.05] transition-all">
                        <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.8)] group-hover:scale-125 transition-transform" />
                        <div className="space-y-0.5">
                            <span className="text-[10px] font-black text-emerald-500/60 uppercase tracking-widest">Optimal Range</span>
                            <p className="text-xs font-bold text-slate-400 uppercase italic">Response under 08 MIN</p>
                        </div>
                    </div>
                    <div className="p-6 bg-amber-500/[0.02] border border-amber-500/10 rounded-3xl flex items-center gap-5 backdrop-blur-md group hover:bg-amber-500/[0.05] transition-all">
                        <div className="w-3 h-3 bg-amber-500 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.8)] group-hover:scale-125 transition-transform" />
                        <div className="space-y-0.5">
                            <span className="text-[10px] font-black text-amber-500/60 uppercase tracking-widest">Warning Threshold</span>
                            <p className="text-xs font-bold text-slate-400 uppercase italic">Response 08 - 15 MIN</p>
                        </div>
                    </div>
                    <div className="p-6 bg-rose-500/[0.02] border border-rose-500/10 rounded-3xl flex items-center gap-5 backdrop-blur-md group hover:bg-rose-500/[0.05] transition-all">
                        <div className="w-3 h-3 bg-rose-500 rounded-full shadow-[0_0_15px_rgba(244,63,94,0.8)] animate-pulse group-hover:scale-125 transition-transform" />
                        <div className="space-y-0.5">
                            <span className="text-[10px] font-black text-rose-500/60 uppercase tracking-widest">Critical Alert</span>
                            <p className="text-xs font-bold text-slate-400 uppercase italic">Response over 15 MIN</p>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
}
