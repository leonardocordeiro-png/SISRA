import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Clock, User as UserIcon, MessageSquare, AlertCircle, Check, MapPin } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

import type { Student } from '../../types';

type PickupRequest = {
    id: string;
    aluno: Student;
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
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 backdrop-blur-md">
                <h3 className="font-black text-slate-800 uppercase tracking-widest text-lg flex items-center gap-3">
                    <Clock className="w-6 h-6 text-emerald-500" /> FILA DE RETIRADA
                </h3>
                <span className="bg-emerald-500 text-slate-900 text-xs font-black px-3 py-1 rounded-full shadow-lg shadow-emerald-500/20">{pendingPickups.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/30">
                {pendingPickups.map((pickup) => (
                    <div key={pickup.id} className="group p-5 bg-white rounded-2xl border border-slate-200 hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex gap-4">
                                <div className="relative">
                                    <div className="w-14 h-14 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 group-hover:border-emerald-500/30 transition-colors">
                                        {pickup.aluno.foto_url ? <img src={pickup.aluno.foto_url} alt="" className="w-full h-full object-cover" /> : <UserIcon className="w-6 h-6 m-4 text-slate-300" />}
                                    </div>

                                    {pickup.distancia_estimada_metros && (
                                        <div className={`mt-2 mb-2 p-2 rounded-lg flex items-center gap-2 ${pickup.status_geofence === 'CHEGOU' ? 'bg-red-100 text-red-700 animate-pulse' :
                                            pickup.status_geofence === 'PERTO' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                            <MapPin className="w-4 h-4" />
                                            <span className="text-xs font-bold uppercase tracking-wider">
                                                {pickup.status_geofence === 'CHEGOU' ? 'NA PORTA' :
                                                    pickup.status_geofence === 'PERTO' ? 'CHEGANDO' : 'A CAMINHO'}
                                                {' '}({pickup.distancia_estimada_metros}m)
                                            </span>
                                        </div>
                                    )}
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full animate-pulse"></div>
                                </div>
                                <div>
                                    <p className="font-black text-slate-900 leading-tight group-hover:text-emerald-600 transition-colors uppercase italic tracking-tighter text-sm">{pickup.aluno.nome_completo}</p>
                                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">{pickup.aluno.turma}</p>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">{pickup.aluno.sala}</p>

                                    {pickup.distancia_estimada_metros && (
                                        <div className={`mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ${pickup.status_geofence === 'CHEGOU' ? 'bg-red-100 text-red-700 animate-pulse' :
                                            pickup.status_geofence === 'PERTO' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                            <MapPin className="w-3 h-3" />
                                            <span className="text-[9px] font-bold uppercase tracking-wider">
                                                {pickup.status_geofence === 'CHEGOU' ? 'NA PORTA' :
                                                    pickup.status_geofence === 'PERTO' ? 'CHEGANDO' : 'A CAMINHO'}
                                                {' '}({pickup.distancia_estimada_metros}m)
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <StatusBadge status={pickup.status} />
                        </div>

                        {pickup.mensagem_sala && (
                            <div className="mt-2 mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
                                <MessageSquare className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                <p className="text-[10px] font-bold text-rose-700 italic leading-tight">
                                    Nota da Sala: "{pickup.mensagem_sala}"
                                </p>
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            {pickup.status === 'LIBERADO' ? (
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => markAsAtReception(pickup.id)}
                                        className="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2 group-hover:scale-[1.01] active:scale-95"
                                    >
                                        <Clock className="w-4 h-4" /> CONFIRMAR CHEGADA
                                    </button>
                                    <button
                                        onClick={() => resetMissingStudent(pickup.id)}
                                        className="w-full py-2 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl font-bold text-[9px] uppercase tracking-widest hover:bg-rose-100 transition-all flex items-center justify-center gap-2"
                                    >
                                        <AlertCircle className="w-3.5 h-3.5" /> Aluno não chegou
                                    </button>
                                </div>
                            ) : pickup.status === 'CONFIRMADO' ? (
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => finalizePickup(pickup.id)}
                                        className="w-full py-3 bg-emerald-500 text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 group-hover:scale-[1.01] active:scale-95 animate-pulse"
                                    >
                                        <Check className="w-4 h-4" /> ENTREGAR AO PAI
                                    </button>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col gap-2 opacity-60">
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-amber-500 h-full w-1/4 animate-pulse"></div>
                                    </div>
                                    <div className="flex items-center justify-center gap-2 text-slate-400">
                                        <Clock className="w-3 h-3 text-amber-500" />
                                        <span className="text-[9px] font-black uppercase tracking-widest">Aguardando Sala</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {pendingPickups.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-300 space-y-4 text-center px-8">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                            <AlertCircle className="w-8 h-8 text-slate-200" />
                        </div>
                        <div>
                            <p className="font-black uppercase tracking-widest text-sm text-slate-400">FILA VAZIA</p>
                            <p className="text-xs font-bold leading-relaxed mt-1">Nenhum aluno na fila de espera no momento.</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-6 bg-slate-900 text-white border-t border-white/5">
                <div className="flex justify-between items-center text-xs">
                    <div>
                        <p className="text-[9px] font-black uppercase text-emerald-500 tracking-widest leading-none mb-1">Status da Fila</p>
                        <p className="text-xl font-black italic">ATUALIZADO</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] font-black uppercase text-emerald-500 tracking-widest leading-none mb-1">Total Ativos</p>
                        <p className="text-xl font-black italic">{pendingPickups.length}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles = {
        SOLICITADO: 'bg-amber-100 text-amber-700 font-black',
        NOTIFICADO: 'bg-blue-100 text-blue-600',
        CONFIRMADO: 'bg-blue-600 text-white font-black animate-pulse',
        LIBERADO: 'bg-emerald-500 text-slate-900 font-black',
        AGUARDANDO: 'bg-amber-50 text-amber-600',
        FINALIZADO: 'bg-slate-800 text-white',
        CANCELADO: 'bg-red-100 text-red-600',
    };

    const labels = {
        SOLICITADO: 'PENDENTE',
        NOTIFICADO: 'Recebido',
        CONFIRMADO: 'NA PORTARIA',
        LIBERADO: 'LIBERADO',
        AGUARDANDO: 'Em Espera',
        FINALIZADO: 'ENTREGUE',
        CANCELADO: 'Cancelado'
    };

    return (
        <span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-bold ${styles[status as keyof typeof styles] || styles.SOLICITADO}`}>
            {labels[status as keyof typeof styles] || status}
        </span>
    );
}
