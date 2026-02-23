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
        <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-emerald-500/30">
            {/* Ambient Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
            </div>

            <div className="relative max-w-6xl mx-auto p-6 lg:p-12">
                {/* Header Section */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                    <div>
                        <NavigationControls />
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg">
                                <Users className="w-6 h-6 text-emerald-500" />
                            </div>
                            <span className="text-emerald-500 font-bold tracking-wider text-sm">RECEPÇÃO EM TEMPO REAL</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
                            Fila de <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">Espera Ativa</span>
                        </h1>
                        <p className="text-slate-400 mt-2 text-lg">Monitoramento dinâmico de retiradas e tempo de resposta.</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Filtrar fila..."
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-500/50 outline-none w-64 transition-all"
                            />
                        </div>
                        <div className="bg-slate-900 border border-slate-800 px-6 py-3 rounded-2xl flex flex-col items-center justify-center min-w-[120px]">
                            <span className="text-3xl font-black text-emerald-500">{waiting.length}</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">ALUNOS TOTAIS</span>
                        </div>
                    </div>
                </header>

                {/* Empty State */}
                {filtered.length === 0 ? (
                    <div className="bg-slate-900/40 border border-slate-800/50 backdrop-blur-xl rounded-3xl p-20 text-center">
                        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Activity className="w-10 h-10 text-slate-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">Sem atividade pendente</h3>
                        <p className="text-slate-500 max-w-md mx-auto">A fila está vazia no momento. Novos chamados aparecerão aqui automaticamente.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {filtered.map((item, index) => (
                            <div
                                key={item.id}
                                className="group relative bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800 hover:border-emerald-500/30 backdrop-blur-xl rounded-2xl p-6 transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-6 overflow-hidden"
                            >
                                {/* Rank/Position Indicator */}
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500/50 to-blue-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="flex items-center gap-6">
                                    <div className="relative hidden md:block">
                                        <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-700 font-black text-xl text-slate-400 group-hover:border-emerald-500/50 group-hover:text-emerald-500 transition-all">
                                            {index + 1}
                                        </div>
                                        {item.wait_time_minutes > 10 && (
                                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-4 border-[#0f172a] animate-ping" />
                                        )}
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                                                {item.aluno?.nome_completo}
                                            </h3>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-widest border uppercase ${getStatusStyles(item.status)}`}>
                                                {item.status === 'LIBERADO' ? 'LIBERADO' :
                                                    item.status === 'SOLICITADO' ? 'SOLICITADO' :
                                                        item.status === 'NOTIFICADO' ? 'NOTIFICADO' :
                                                            item.status === 'CONFIRMADO' ? 'CONFIRMADO' :
                                                                item.status === 'AGUARDANDO' ? 'AGUARDANDO' : item.status}
                                            </span>
                                        </div>
                                        <p className="text-slate-400 text-sm flex items-center gap-2">
                                            <span className="font-bold text-slate-300">{item.aluno?.turma}</span>
                                            <span className="w-1 h-1 bg-slate-700 rounded-full" />
                                            <span>Mat: {item.aluno?.matricula}</span>
                                        </p>
                                        {item.mensagem_sala && (
                                            <div className="mt-2 text-xs bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1.5 rounded-lg flex items-center gap-2">
                                                <Bell className="w-3 h-3" />
                                                <span className="font-bold">Nota da Sala: {item.mensagem_sala}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-4 md:gap-12">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700">
                                            <User className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">RESPONSÁVEL</p>
                                            <p className="text-sm font-semibold text-slate-200">{item.responsavel?.nome_completo}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border transition-colors ${item.wait_time_minutes > 15 ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' :
                                            item.wait_time_minutes > 8 ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                                                'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                                            }`}>
                                            <Clock className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">TEMPO DE ESPERA</p>
                                            <p className={`text-sm font-black ${item.wait_time_minutes > 15 ? 'text-rose-400' :
                                                item.wait_time_minutes > 8 ? 'text-amber-400' :
                                                    'text-emerald-400'
                                                }`}>
                                                {item.wait_time_minutes} MINUTOS
                                            </p>
                                        </div>
                                    </div>

                                    <button className="p-3 bg-slate-800 hover:bg-emerald-500 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-all">
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Legend Area */}
                <footer className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center gap-4">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide italic">Tempo Ideal: Abaixo de 8 min</span>
                    </div>
                    <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-center gap-4">
                        <div className="w-2 h-2 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide italic">Atenção: 8 a 15 min</span>
                    </div>
                    <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl flex items-center gap-4">
                        <div className="w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_10px_rgba(244,63,94,0.5)] animate-pulse" />
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide italic">Crítico: Acima de 15 min</span>
                    </div>
                </footer>
            </div>
        </div>
    );
}
