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
    liberado_sala_por_nome?: string | null;
    latitude?: number;
    longitude?: number;
    distancia_estimada_metros?: number;
    status_geofence?: 'LONGE' | 'PERTO' | 'CHEGOU';
};

export default function WithdrawalQueue() {
    const { user, escolaId } = useAuth();
    const toast = useToast();
    const [pendingPickups, setPendingPickups] = useState<PickupRequest[]>([]);
    const [operatorName, setOperatorName] = useState<string>('');

    useEffect(() => {
        if (!user?.id) return;
        supabase.from('usuarios').select('nome').eq('id', user.id).maybeSingle()
            .then(({ data }) => { setOperatorName(data?.nome || user.email || 'Recepção'); });
    }, [user?.id]);

    const fetchPending = async () => {
        if (!escolaId) return;
        const q = supabase
            .from('solicitacoes_retirada')
            .select(`
                id,
                status,
                horario_solicitacao,
                mensagem_recepcao,
                mensagem_sala,
                liberado_sala_por_nome,
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
            .eq('escola_id', escolaId)
            .in('status', ['SOLICITADO', 'NOTIFICADO', 'CONFIRMADO', 'AGUARDANDO', 'LIBERADO'])
            .is('horario_confirmacao', null)
            .order('horario_solicitacao', { ascending: true });
        const { data } = await q;

        if (data) {
            setPendingPickups(data.map((item: any) => ({
                id: item.id,
                status: item.status,
                horario_solicitacao: item.horario_solicitacao,
                aluno: item.aluno,
                responsavel: item.responsavel,
                mensagem_recepcao: item.mensagem_recepcao,
                mensagem_sala: item.mensagem_sala,
                liberado_sala_por_nome: item.liberado_sala_por_nome,
                distancia_estimada_metros: item.distancia_estimada_metros,
                status_geofence: item.status_geofence
            })));
        }
    };

    const markAsAtReception = async (pickupId: string) => {
        try {
            const pickup = pendingPickups.find(p => p.id === pickupId);
            const { error } = await supabase
                .from('solicitacoes_retirada')
                .update({
                    status: 'CONFIRMADO'
                })
                .eq('id', pickupId);

            if (error) throw error;

            logAudit(
                'CONFIRMACAO_ENTREGA',
                'solicitacoes_retirada',
                pickupId,
                {
                    status_anterior: 'LIBERADO',
                    acao: 'CHEGOU_NA_PORTARIA',
                    aluno_nome: pickup?.aluno?.nome_completo,
                    responsavel_nome: pickup?.responsavel?.nome_completo,
                    liberado_sala_por: pickup?.liberado_sala_por_nome || undefined,
                    liberado_recepcao_por: operatorName || undefined,
                },
                user?.id,
                escolaId || undefined
            );

            addLog(`Aluno ${pickupId} chegou na recepção.`);
        } catch (error: any) {
            console.error('Error marking as at reception:', error);
            toast.error('Erro ao registrar chegada', error.message);
        }
    };

    const finalizePickup = async (pickupId: string) => {
        try {
            const pickup = pendingPickups.find(p => p.id === pickupId);
            const { error } = await supabase
                .from('solicitacoes_retirada')
                .update({
                    horario_confirmacao: new Date().toISOString(),
                    status: 'CONCLUIDO',
                    recepcionista_id: user?.id
                })
                .eq('id', pickupId);

            if (error) throw error;

            logAudit(
                'CONFIRMACAO_ENTREGA',
                'solicitacoes_retirada',
                pickupId,
                {
                    status_anterior: 'CONFIRMADO',
                    acao: 'ENTREGA_CONCLUIDA',
                    aluno_nome: pickup?.aluno?.nome_completo,
                    responsavel_nome: pickup?.responsavel?.nome_completo,
                    liberado_sala_por: pickup?.liberado_sala_por_nome || undefined,
                    liberado_recepcao_por: operatorName || undefined,
                },
                user?.id,
                escolaId || undefined
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
                })
                .eq('id', pickupId);

            if (error) throw error;

            logAudit(
                'ALTERACAO_CONFIGURACAO',
                'solicitacoes_retirada',
                pickupId,
                { motivo: 'ALUNO_AUSENTE', acao: 'RETORNADO_PARA_FILA' },
                user?.id,
                escolaId || undefined
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

        const interval = setInterval(fetchPending, 5000);

        const channel = supabase
            .channel(`reception_queue_${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'solicitacoes_retirada',
                    ...(escolaId ? { filter: `escola_id=eq.${escolaId}` } : {}),
                },
                () => { fetchPending(); }
            )
            .subscribe();

        return () => {
            clearInterval(interval);
            supabase.removeChannel(channel);
        };
    }, [user?.id, escolaId]);

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
                {pendingPickups.map((pickup, idx) => {
                    const isAtDoor = pickup.status_geofence === 'CHEGOU';
                    const isNear = pickup.status_geofence === 'PERTO';
                    const posicao = idx + 1;
                    const chegouHora = new Date(pickup.horario_solicitacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    const minutosNaFila = Math.floor((Date.now() - new Date(pickup.horario_solicitacao).getTime()) / 60000);

                    return (
                        <div key={pickup.id} className="group relative p-3 lg:pr-4 bg-[#020617]/40 rounded-[1.5rem] border border-white/5 hover:border-emerald-500/40 hover:bg-[#020617]/60 transition-all duration-300 flex flex-col lg:flex-row lg:items-center gap-4 shadow-lg">
                            {/* Scanning effect on hover */}
                            <div className="absolute inset-x-0 h-[1px] bg-emerald-500/20 blur-[1px] top-0 opacity-0 group-hover:opacity-100 animate-scan pointer-events-none"></div>

                            {/* Posição e Tempo - lado esquerdo (Compacto) */}
                            <div className="flex items-center gap-3 shrink-0">
                                <div className="w-8 h-8 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center text-[11px] font-black text-white shadow-inner">
                                    {posicao}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{chegouHora}</span>
                                    {minutosNaFila > 0 && (
                                        <span className={`text-[9px] font-black uppercase tracking-wider ${minutosNaFila > 10 ? 'text-amber-400' : 'text-slate-600'}`}>
                                            {minutosNaFila}m
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Foto e Info Aluno */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="relative shrink-0">
                                    <div className="w-10 h-10 bg-[#020617] rounded-xl overflow-hidden border-2 border-white/10 group-hover:border-emerald-500/50 transition-all duration-300">
                                        {pickup.aluno.foto_url ? (
                                            <img src={pickup.aluno.foto_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-700">
                                                <UserIcon className="w-5 h-5" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex-1 min-w-0 overflow-hidden flex flex-col justify-center">
                                    <div className="flex items-center gap-2">
                                        <p className="font-black text-white leading-snug uppercase italic tracking-tighter text-[13px] truncate group-hover:text-emerald-400 transition-colors">
                                            {pickup.aluno.nome_completo}
                                        </p>
                                        <div className="shrink-0 scale-90 origin-left">
                                            <StatusBadge status={pickup.status} />
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                                        <div className="flex items-center gap-1.5">
                                            <p className="text-[9px] font-black text-emerald-500/80 uppercase tracking-widest truncate">{pickup.aluno.turma.split(' - ')[0]}</p>
                                            <div className="w-1 h-1 bg-white/10 rounded-full shrink-0"></div>
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">SALA {pickup.aluno.sala}</p>
                                        </div>
                                        
                                        {pickup.distancia_estimada_metros && (
                                            <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg border backdrop-blur-md transition-all duration-500 ${isAtDoor ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse' :
                                                isNear ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-white/5 border-white/10 text-slate-500'
                                                }`}>
                                                <MapPin className={`w-2.5 h-2.5 shrink-0 ${isAtDoor ? 'animate-bounce' : ''}`} />
                                                <span className="text-[8px] font-black uppercase tracking-[0.2em]">
                                                    {isAtDoor ? 'RECEPÇÃO' : isNear ? 'CHEGANDO' : 'A CAMINHO'}
                                                    {' '}({pickup.distancia_estimada_metros}m)
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Mensagem e Ações */}
                            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 shrink-0">
                                {pickup.mensagem_sala && (
                                    <div className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 max-w-[200px] truncate" title={pickup.mensagem_sala}>
                                        <MessageSquare className="w-3.5 h-3.5 text-rose-500 shrink-0 animate-pulse" />
                                        <p className="text-[9px] font-black text-rose-400 uppercase italic truncate">
                                            {pickup.mensagem_sala}
                                        </p>
                                    </div>
                                )}

                                <div className="flex gap-2 shrink-0 justify-end">
                                    {pickup.status === 'LIBERADO' ? (
                                        <>
                                            <button
                                                onClick={() => markAsAtReception(pickup.id)}
                                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-[9px] uppercase tracking-[0.2em] transition-all duration-300 shadow-md flex items-center gap-2"
                                            >
                                                <Clock className="w-3.5 h-3.5" /> CONFIRMAR
                                            </button>
                                            <button
                                                onClick={() => resetMissingStudent(pickup.id)}
                                                className="px-3 py-2 bg-white/5 border border-white/10 text-rose-500/70 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] transition-all duration-300 flex items-center gap-2"
                                                title="Aluno Ausente"
                                            >
                                                <AlertCircle className="w-3.5 h-3.5" />
                                            </button>
                                        </>
                                    ) : pickup.status === 'CONFIRMADO' ? (
                                        <button
                                            onClick={() => finalizePickup(pickup.id)}
                                            className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#020617] rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 shadow-lg hover:scale-105 active:scale-95 flex items-center gap-2"
                                        >
                                            <Check className="w-4 h-4" /> ENTREGAR
                                        </button>
                                    ) : (
                                        <div className="flex items-center justify-center gap-2 px-3 py-2 opacity-50">
                                            <div className="w-1 h-1 bg-emerald-500 rounded-full animate-ping" />
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Aguardando</span>
                                        </div>
                                    )}
                                </div>
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
