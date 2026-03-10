import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Clock, User as UserIcon, MessageSquare, AlertCircle, Check, MapPin, Activity } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { logAudit } from '../../lib/audit';

import type { Student } from '../../types';

type PickupRequest = {
    id: string;
    aluno: Student;
    responsavel: {
        nome_completo: string;
        foto_url: string | null;
    } | null;
    status: string;
    horario_solicitacao: string;
    tempo_espera_segundos?: number;
    mensagem_sala?: string;
    mensagem_recepcao?: string;
    latitude?: number;
    longitude?: number;
    distancia_estimada_metros?: number;
    status_geofence?: 'LONGE' | 'PERTO' | 'CHEGOU';
};

export default function WithdrawalQueue() {
    const { user } = useAuth();
    const toast = useToast();
    const [pendingPickups, setPendingPickups] = useState<PickupRequest[]>([]);

    const fetchPending = async () => {
        const { data } = await supabase
            .from('solicitacoes_retirada')
            .select(`
                id,
                status,
                horario_solicitacao,
                mensagem_recepcao,
                mensagem_sala,
                aluno:alunos (
                    id,
                    nome_completo,
                    turma,
                    sala,
                    foto_url
                ),
                responsavel:responsaveis (
                    nome_completo,
                    foto_url
                ),
                latitude,
                longitude,
                distancia_estimada_metros,
                status_geofence
            `)
            .in('status', ['SOLICITADO', 'NOTIFICADO', 'CONFIRMADO', 'AGUARDANDO', 'LIBERADO'])
            .is('horario_confirmacao', null)
            .order('horario_solicitacao', { ascending: true });

        if (data) {
            setPendingPickups(data.map((item: any) => ({
                id: item.id,
                status: item.status,
                horario_solicitacao: item.horario_solicitacao,
                aluno: item.aluno,
                responsavel: item.responsavel,
                mensagem_recepcao: item.mensagem_recepcao,
                mensagem_sala: item.mensagem_sala,
                distancia_estimada_metros: item.distancia_estimada_metros,
                status_geofence: item.status_geofence
            })));
        }
    };

    const markAsAtReception = async (pickupId: string) => {
        try {
            const { error } = await supabase
                .from('solicitacoes_retirada')
                .update({
                    status: 'CONFIRMADO'
                })
                .eq('id', pickupId);

            if (error) throw error;

            // Audit Log: Confirmação de Chegada na Recepção
            logAudit(
                'CONFIRMACAO_ENTREGA',
                'solicitacoes_retirada',
                pickupId,
                { status_anterior: 'LIBERADO_SALA', acao: 'CHEGOU_NA_PORTARIA' },
                user?.id
            );

            addLog(`Aluno ${pickupId} chegou na recepção.`);
        } catch (error: any) {
            console.error('Error marking as at reception:', error);
            toast.error('Erro ao registrar chegada', error.message);
        }
    };

    const finalizePickup = async (pickupId: string) => {
        try {
            const { error } = await supabase
                .from('solicitacoes_retirada')
                .update({
                    horario_confirmacao: new Date().toISOString(),
                    status: 'LIBERADO',
                    recepcionista_id: user?.id
                })
                .eq('id', pickupId);

            if (error) throw error;

            // Audit Log: Entrega Finalizada
            logAudit(
                'CONFIRMACAO_ENTREGA',
                'solicitacoes_retirada',
                pickupId,
                { status: 'LIBERADO', acao: 'ENTREGA_CONCLUIDA' },
                user?.id
            );

            // Optimistic update
            setPendingPickups(prev => prev.filter(p => p.id !== pickupId));
        } catch (error: any) {
            console.error('Error finalizing pickup:', error);
            toast.error('Erro ao finalizar saída', error.message);
        }
    };

    const resetMissingStudent = async (pickupId: string) => {
        try {
            const { error } = await supabase
                .from('solicitacoes_retirada')
                .update({
                    status: 'SOLICITADO',
                    horario_liberacao: null,
                    professor_id: null
                })
                .eq('id', pickupId);

            if (error) throw error;

            // Audit Log: Aluno Ausente / Reset
            logAudit(
                'ALTERACAO_CONFIGURACAO',
                'solicitacoes_retirada',
                pickupId,
                { motivo: 'ALUNO_AUSENTE', acao: 'RETORNADO_PARA_FILA' },
                user?.id
            );

            // Optimistic update handled by subscription/polling
            addLog(`Solicitação ${pickupId} retornada para a fila de prioridade.`);
        } catch (error: any) {
            console.error('Error resetting missing student:', error);
            toast.error('Erro ao retornar aluno', error.message);
        }
    };

    // Helper for logs (since this is receptive, we can just console log or add local state if needed)
    const addLog = (msg: string) => console.log(`[Queue] ${msg}`);

    useEffect(() => {
        if (!user) return;

        fetchPending();

        // 1 second polling for high synchronization
        const interval = setInterval(fetchPending, 1000);

        const channel = supabase
            .channel(`reception_queue_${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'solicitacoes_retirada'
                },
                () => {
                    fetchPending();
                }
            )
            .subscribe();

        return () => {
            clearInterval(interval);
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    return (
        <div className="bg-white/[0.03] border border-white/10 rounded-[2rem] flex flex-col overflow-hidden backdrop-blur-3xl shadow-2xl relative">
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#020617]/40 backdrop-blur-2xl">
                <div className="flex flex-col">
                    <h3 className="font-black text-white uppercase tracking-widest text-sm flex items-center gap-2 italic">
                        <Clock className="w-5 h-5 text-emerald-500 animate-pulse" /> Fila de Retirada
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="w-1 h-1 bg-emerald-500 rounded-full animate-ping"></div>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sistema Ativo</span>
                    </div>
                </div>
                <div className="relative group">
                    <div className="absolute -inset-2 bg-emerald-500/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <span className="relative bg-emerald-500 text-[#020617] text-[10px] font-black px-3 py-1 rounded-lg shadow-lg shadow-emerald-500/20">{pendingPickups.length}</span>
                </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto p-4 space-y-4 custom-scrollbar bg-transparent relative z-10" style={{ maxHeight: 'calc(100vh - 20rem)' }}>
                {pendingPickups.map((pickup) => {
                    const isAtDoor = pickup.status_geofence === 'CHEGOU';
                    const isNear = pickup.status_geofence === 'PERTO';

                    return (
                        <div key={pickup.id} className="group relative p-4 bg-[#020617]/40 rounded-3xl border border-white/5 hover:border-emerald-500/40 hover:bg-[#020617]/60 transition-all duration-500 shadow-xl">
                            {/* Scanning effect on hover */}
                            <div className="absolute inset-x-0 h-[1px] bg-emerald-500/20 blur-[1px] top-0 opacity-0 group-hover:opacity-100 animate-scan pointer-events-none"></div>

                            <div className="flex items-start gap-3 mb-4">
                                {/* Photo */}
                                <div className="relative shrink-0">
                                    <div className="w-14 h-14 bg-[#020617] rounded-2xl overflow-hidden border-2 border-white/10 group-hover:border-emerald-500/50 transition-all duration-500 shadow-2xl">
                                        {pickup.aluno.foto_url ? (
                                            <img src={pickup.aluno.foto_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-700">
                                                <UserIcon className="w-7 h-7" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-[#020617] rounded-full animate-pulse shadow-lg"></div>
                                </div>

                                {/* Info + badge */}
                                <div className="flex-1 min-w-0 overflow-hidden">
                                    <p
                                        className="font-black text-white leading-snug uppercase italic tracking-tighter text-sm group-hover:text-emerald-400 transition-colors mb-1"
                                        style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                                    >{pickup.aluno.nome_completo}</p>
                                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <p className="text-[10px] font-black text-emerald-500/80 uppercase tracking-widest leading-none">{pickup.aluno.turma}</p>
                                            <div className="w-1 h-1 bg-white/10 rounded-full shrink-0"></div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">SALA {pickup.aluno.sala}</p>
                                        </div>
                                        <div className="shrink-0">
                                            <StatusBadge status={pickup.status} />
                                        </div>
                                    </div>

                                    {pickup.distancia_estimada_metros && (
                                        <div className={`mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xl border backdrop-blur-md transition-all duration-500 ${isAtDoor ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse' :
                                            isNear ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-white/5 border-white/10 text-slate-500'
                                            }`}>
                                            <MapPin className={`w-3 h-3 shrink-0 ${isAtDoor ? 'animate-bounce' : ''}`} />
                                            <span className="text-[9px] font-black uppercase tracking-[0.2em]">
                                                {isAtDoor ? 'NA RECEPÇÃO' : isNear ? 'CHEGANDO' : 'A CAMINHO'}
                                                {' '}({pickup.distancia_estimada_metros}m)
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {pickup.mensagem_sala && (
                                <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-500 backdrop-blur-md">
                                    <MessageSquare className="w-4 h-4 text-rose-500 shrink-0 mt-0.5 animate-pulse" />
                                    <p className="text-[10px] font-black text-rose-400 uppercase italic leading-tight tracking-tight">
                                        NOTA: "{pickup.mensagem_sala}"
                                    </p>
                                </div>
                            )}

                            <div className="space-y-2.5">
                                {pickup.status === 'LIBERADO' ? (
                                    <div className="flex flex-col gap-2.5 relative">
                                        <button
                                            onClick={() => markAsAtReception(pickup.id)}
                                            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] transition-all duration-500 shadow-lg shadow-blue-500/20 group/btn active:scale-95 flex items-center justify-center gap-3 relative overflow-hidden"
                                        >
                                            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500"></div>
                                            <Clock className="w-4 h-4 relative z-10" /> <span className="relative z-10">Confirmar Recepção</span>
                                        </button>
                                        <button
                                            onClick={() => resetMissingStudent(pickup.id)}
                                            className="w-full py-3 bg-white/5 border border-white/10 text-rose-500/70 hover:text-rose-500 hover:bg-rose-500/10 rounded-2xl font-black text-[9px] uppercase tracking-[0.2em] transition-all duration-500 flex items-center justify-center gap-2 group/btn_alt"
                                        >
                                            <AlertCircle className="w-3.5 h-3.5 group-hover/btn_alt:rotate-12 transition-transform" /> ALUNO AUSENTE
                                        </button>
                                    </div>
                                ) : pickup.status === 'CONFIRMADO' ? (
                                    <div className="flex flex-col gap-2.5">
                                        <button
                                            onClick={() => finalizePickup(pickup.id)}
                                            className="w-full py-5 bg-emerald-500 hover:bg-emerald-400 text-[#020617] rounded-2xl font-black text-xs uppercase tracking-[0.4em] transition-all duration-500 shadow-[0_10px_30px_rgba(16,185,129,0.3)] hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-4 relative overflow-hidden"
                                        >
                                            <div className="absolute inset-0 bg-white/20 translate-y-full hover:translate-y-0 transition-transform duration-500"></div>
                                            <Check className="w-5 h-5 relative z-10" /> <span className="relative z-10">ENTREGAR AGORA</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-2xl opacity-60">
                                        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                            <div className="bg-gradient-to-r from-emerald-500 to-blue-500 h-full w-1/3 animate-[shimmer_2s_infinite_linear]"></div>
                                        </div>
                                        <div className="flex items-center justify-center gap-3 text-slate-500">
                                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
                                            <span className="text-[10px] font-black uppercase tracking-[0.3em] italic">Procedimento em Curso</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {pendingPickups.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-10 relative overflow-hidden h-full">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-white/5 blur-3xl rounded-full"></div>
                        <div className="relative space-y-6">
                            <div className="w-20 h-20 bg-[#020617] border-2 border-white/10 rounded-3xl flex items-center justify-center mx-auto shadow-2xl group transition-all duration-700">
                                <Activity className="w-10 h-10 text-slate-700 group-hover:text-emerald-500 transition-all duration-700" />
                                <div className="absolute inset-x-0 h-2 bg-emerald-500/5 blur-lg animate-scan"></div>
                            </div>
                            <div className="space-y-2">
                                <p className="font-black uppercase tracking-[0.3em] text-[10px] text-slate-500">Fila Vazia</p>
                                <p className="text-xs font-bold text-slate-600 leading-relaxed uppercase italic">Zero ativos na fila.</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Summary */}
            <div className="p-6 bg-[#020617]/80 border-t border-white/10 backdrop-blur-3xl relative z-10">
                <div className="flex justify-between items-center">
                    <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase text-emerald-500 tracking-[0.3em] leading-none">Status do Sistema</p>
                        <p className="text-xl font-black italic text-white tracking-widest uppercase">Seguro</p>
                    </div>
                    <div className="text-right space-y-1">
                        <p className="text-[9px] font-black uppercase text-blue-500 tracking-[0.3em] leading-none">Total Ativo</p>
                        <p className="text-xl font-black italic text-white tracking-widest">{pendingPickups.length}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles = {
        SOLICITADO: 'bg-amber-500/10 text-amber-500 border-amber-500/30 font-black',
        NOTIFICADO: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
        CONFIRMADO: 'bg-blue-600 text-white font-black animate-pulse shadow-lg shadow-blue-600/20',
        LIBERADO: 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/20',
        AGUARDANDO: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        FINALIZADO: 'bg-slate-800 text-white',
        CANCELADO: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    };

    const labels = {
        SOLICITADO: 'PENDENTE',
        NOTIFICADO: 'RECEBIDO',
        CONFIRMADO: 'PORTARIA',
        LIBERADO: 'LIBERADO',
        AGUARDANDO: 'ESPERA',
        FINALIZADO: 'ENTREGUE',
        CANCELADO: 'CANCELADO'
    };

    return (
        <span className={`text-[9px] uppercase px-3 py-1 rounded-full font-black tracking-widest border transition-all duration-500 ${styles[status as keyof typeof styles] || styles.SOLICITADO}`}>
            {labels[status as keyof typeof styles] || status}
        </span>
    );
}
