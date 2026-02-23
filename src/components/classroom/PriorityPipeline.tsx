import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Clock, User as UserIcon, Check } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

interface PriorityPipelineProps {
    selectedClass: string;
    activeRequestId?: string;
    onSelectRequest: (request: any) => void;
    onQueueChange?: (requests: any[]) => void;
    userId: string;
    escolaId?: string;
}

export default function PriorityPipeline({
    selectedClass,
    activeRequestId,
    onSelectRequest,
    onQueueChange,
    userId,
    escolaId
}: PriorityPipelineProps) {
    const toast = useToast();
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchRequests = async () => {
        let query = supabase
            .from('solicitacoes_retirada')
            .select(`
                id,
                status,
                tipo_solicitacao,
                horario_solicitacao,
                aluno:alunos!inner (
                    id,
                    nome_completo,
                    turma,
                    sala,
                    foto_url,
                    observacoes
                ),
                mensagem_recepcao,
                status_geofence,
                distancia_estimada_metros
            `)
            .in('status', ['SOLICITADO', 'AGUARDANDO']);

        if (selectedClass !== 'TODAS') {
            if (selectedClass.startsWith('Sala ')) {
                query = query.eq('alunos.sala', selectedClass);
            } else {
                query = query.eq('alunos.turma', selectedClass);
            }
        }

        if (escolaId) {
            query = query.eq('escola_id', escolaId);
        }

        const { data, error } = await query.order('horario_solicitacao', { ascending: true });

        if (!error && data) {
            setRequests(data);
            if (onQueueChange) onQueueChange(data);
        }
        setLoading(false);
    };

    const handleLiberarTodos = async () => {
        if (requests.length === 0) return;

        const ids = requests.map(r => r.id);

        const { error } = await supabase
            .from('solicitacoes_retirada')
            .update({
                status: 'LIBERADO',
                professor_id: userId,
                horario_liberacao: new Date().toISOString()
            })
            .in('id', ids);

        if (!error) {
            fetchRequests();
        } else {
            toast.error('Erro ao liberar alunos', error.message);
        }
    };

    useEffect(() => {
        if (!userId) return;

        fetchRequests();

        // High-frequency polling (1 second) for ultra-fast sync
        const interval = setInterval(fetchRequests, 1000);

        // Also keep Realtime for immediate push notification response
        const channel = supabase
            .channel(`pipeline_room_${selectedClass}_${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'solicitacoes_retirada'
                },
                () => fetchRequests()
            )
            .subscribe();

        return () => {
            clearInterval(interval);
            supabase.removeChannel(channel);
        };
    }, [selectedClass, userId, escolaId]);

    return (
        <div className="w-96 border-r border-white/5 bg-white/[0.02] backdrop-blur-2xl flex flex-col z-20">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Fila de Prioridade</h3>
                    <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-tighter">Sequência de Retirada (FIFO)</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-[8px] font-black text-emerald-500/50 uppercase tracking-widest">Ao Vivo</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {loading && requests.length === 0 ? (
                    <div className="py-10 flex flex-col items-center justify-center opacity-20">
                        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mb-4"></div>
                    </div>
                ) : requests.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-30 grayscale">
                        <div className="w-12 h-12 mb-4 border-2 border-white/20 rounded-2xl flex items-center justify-center">
                            <Clock className="w-6 h-6 text-slate-500" />
                        </div>
                        <p className="text-sm font-black uppercase tracking-widest">Fila Vazia</p>
                        <p className="text-[10px] font-bold mt-2 leading-relaxed">Sistema em espera: Aguardando próxima solicitação...</p>
                    </div>
                ) : (
                    requests.map((req, idx) => (
                        <button
                            key={req.id}
                            onClick={() => onSelectRequest(req)}
                            className={`w-full group relative p-4 rounded-2xl border transition-all duration-300 flex items-center gap-4 text-left ${activeRequestId === req.id
                                ? 'bg-emerald-500 border-emerald-400 shadow-2xl shadow-emerald-500/20'
                                : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/[0.08]'}`}
                        >
                            <div className="relative shrink-0">
                                <div className={`w-12 h-12 rounded-xl overflow-hidden border-2 transition-colors ${activeRequestId === req.id ? 'border-white/40' : 'border-white/10 group-hover:border-white/20'}`}>
                                    {req.aluno.foto_url ? (
                                        <img src={req.aluno.foto_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-slate-800">
                                            <UserIcon className="w-6 h-6 text-slate-600" />
                                        </div>
                                    )}
                                </div>
                                {idx === 0 && (
                                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center border-2 border-[#0f172a] animate-bounce">
                                        <Clock className="w-3 h-3 text-slate-950 font-black" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className={`font-black uppercase italic tracking-tighter truncate leading-none mb-1 ${activeRequestId === req.id ? 'text-slate-950' : 'text-white'}`}>
                                    {req.aluno.nome_completo.split(' ')[0]} {req.aluno.nome_completo.split(' ')[1] || ''}
                                </p>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[9px] font-black uppercase tracking-widest ${activeRequestId === req.id ? 'text-slate-950/60' : 'text-emerald-400'}`}>
                                        {req.aluno.turma}
                                    </span>
                                    <span className={`w-1 h-1 rounded-full ${activeRequestId === req.id ? 'bg-slate-950/20' : 'bg-white/10'}`}></span>
                                    <span className={`text-[9px] font-bold ${activeRequestId === req.id ? 'text-slate-950/60' : 'text-slate-500'}`}>
                                        {req.aluno.sala}
                                    </span>
                                </div>
                            </div>
                            {activeRequestId === req.id && (
                                <div className="absolute top-1/2 -translate-y-1/2 right-4 flex items-center gap-3">
                                    {req.status_geofence === 'CHEGOU' && (
                                        <div className="bg-emerald-400/20 text-emerald-400 px-2 py-0.5 rounded text-[8px] font-black animate-pulse">NA PORTA</div>
                                    )}
                                    <div className="w-1.5 h-6 bg-slate-900/20 rounded-full animate-pulse"></div>
                                </div>
                            )}
                            {activeRequestId !== req.id && req.status_geofence === 'CHEGOU' && (
                                <div className="absolute top-4 right-4 animate-bounce">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                                </div>
                            )}
                        </button>
                    ))
                )}
            </div>

            {requests.length > 1 && (
                <div className="p-4 bg-emerald-500/10 border-t border-white/5">
                    <button
                        onClick={handleLiberarTodos}
                        className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-emerald-500/10 active:scale-95 flex items-center justify-center gap-3"
                    >
                        <Check className="w-5 h-5" /> Liberar Todos em Lote
                    </button>
                </div>
            )}

            <div className="p-4 bg-slate-900/40 border-t border-white/5 flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Carga Atual</span>
                    <span className="text-sm font-black italic">{requests.length} Aluno(s)</span>
                </div>
            </div>
        </div>
    );
}
