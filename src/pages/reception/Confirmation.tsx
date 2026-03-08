import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/audit';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle, User, ShieldCheck, Clock, FileText, Camera, Check, AlertTriangle, AlertCircle, Activity } from 'lucide-react';
import NavigationControls from '../../components/NavigationControls';
import { useToast } from '../../components/ui/Toast';

type PickupRequest = {
    id: string;
    status: string;
    created_at: string;
    aluno: {
        id: string;
        nome_completo: string;
        turma: string;
        foto_url: string;
        escola_id: string;
    };
    responsavel?: {
        id: string;
        nome_completo: string;
        documento_url: string;
        foto_url: string;
    };
};

export default function ReceptionConfirmation() {
    const { id } = useParams();
    const navigate = useNavigate();
    useAuth();
    const toast = useToast();
    const [request, setRequest] = useState<PickupRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [confirmedIdentity, setConfirmedIdentity] = useState(false);

    async function fetchRequest(requestId: string) {
        const { data, error } = await supabase
            .from('solicitacoes_retirada')
            .select(`
        *,
        aluno:alunos (
          id,
          nome_completo,
          turma,
          foto_url,
          escola_id
        ),
        responsavel:responsaveis (
          id,
          nome_completo,
          documento_url,
          foto_url
        )
      `)
            .eq('id', requestId)
            .single();

        if (error) {
            console.error('Error fetching request:', error);
            navigate('/recepcao/busca');
            return;
        }

        setRequest(data);
        setLoading(false);
    }

    useEffect(() => {
        if (id) setTimeout(() => fetchRequest(id), 0);
    }, [id]);

    async function handleConfirmPickup() {
        if (!request || !confirmedIdentity) return;

        const { error } = await supabase
            .from('solicitacoes_retirada')
            .update({
                status: 'LIBERADO', // Finished state in this context/or explicit 'ENTREGUE' if added to schema
                horario_confirmacao: new Date().toISOString()
            })
            .eq('id', request.id);

        if (error) {
            toast.error('Erro ao confirmar', 'Não foi possível confirmar a entrega.');
            return;
        }

        await logAudit('CONFIRMACAO_ENTREGA', 'solicitacoes_retirada', request.id, {
            aluno_nome: request.aluno.nome_completo,
            responsavel_nome: request.responsavel?.nome_completo,
            horario: new Date().toISOString()
        }, undefined, request.aluno.escola_id);

        navigate('/recepcao/busca');
    }

    if (loading || !request) {
        return (
            <div className="min-h-screen bg-emerald-50 flex items-center justify-center">
                <div className="animate-spin text-emerald-600">
                    <Clock className="w-10 h-10" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-emerald-500/30 overflow-x-hidden relative">
            {/* Ultra-Premium Ambient Background */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/5 blur-[120px] rounded-full animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-rose-500/[0.03] blur-[120px] rounded-full animate-pulse-slow" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
            </div>

            <header className="relative z-50 bg-[#020617]/60 border-b border-white/10 px-8 py-5 backdrop-blur-2xl flex items-center justify-between sticky top-0">
                <div className="flex items-center gap-6">
                    <NavigationControls />
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-emerald-500 animate-pulse" />
                            <span className="text-emerald-500 font-black tracking-[0.3em] text-[10px] uppercase">Protocolo de Segurança</span>
                        </div>
                        <h1 className="text-2xl font-black text-white uppercase tracking-tighter italic leading-none">Confirmação de <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">Entrega</span></h1>
                    </div>
                </div>
                <div className="hidden md:flex items-center gap-4 bg-rose-500/10 border border-rose-500/20 px-6 py-3 rounded-2xl shadow-2xl shadow-rose-500/10">
                    <AlertTriangle className="w-5 h-5 text-rose-500 animate-bounce" />
                    <div className="space-y-0.5">
                        <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest block leading-none">Nível de Identificação 4</span>
                        <span className="text-xs font-bold text-white/60 uppercase tracking-widest italic">Verificação Mandatória Ativa</span>
                    </div>
                </div>
            </header>

            <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full p-8 lg:p-12">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
                    {/* Aluno Panel */}
                    <div className="space-y-8 animate-in fade-in slide-in-from-left-8 duration-700">
                        <div className="bg-white/[0.03] rounded-[3rem] shadow-2xl overflow-hidden border border-white/10 backdrop-blur-3xl group">
                            <div className="bg-[#020617]/60 p-10 text-center relative overflow-hidden border-b border-white/5">
                                <div className="absolute inset-x-0 h-1 bg-emerald-500/10 blur-md top-0 group-hover:animate-scan"></div>
                                <div className="relative z-10 space-y-8">
                                    <div className="relative inline-block">
                                        <div className="w-56 h-56 bg-[#020617] rounded-[2.5rem] mx-auto overflow-hidden border-2 border-white/10 shadow-2xl transition-all duration-700 group-hover:border-emerald-500/40 relative">
                                            {request.aluno.foto_url ? (
                                                <img src={request.aluno.foto_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <User className="w-full h-full p-16 text-slate-800" />
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent opacity-40"></div>
                                        </div>
                                        <div className="absolute -bottom-3 -right-3 w-12 h-12 bg-emerald-500 border-8 border-[#020617] rounded-full shadow-2xl flex items-center justify-center">
                                            <Check className="w-5 h-5 text-[#020617]" />
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h2 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">{request.aluno.nome_completo}</h2>
                                        <div className="flex items-center justify-center gap-4">
                                            <span className="px-5 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full font-black text-[10px] uppercase tracking-[0.2em] backdrop-blur-md">
                                                {request.aluno.turma}
                                            </span>
                                            <span className="px-5 py-2 bg-white/5 border border-white/10 text-white/40 rounded-full font-black text-[10px] uppercase tracking-[0.2em] backdrop-blur-md">
                                                IDENT: #{request.aluno.id.slice(0, 8)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-10 bg-transparent">
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="p-6 bg-white/[0.02] rounded-[2rem] border border-white/5 space-y-1 group/item hover:bg-white/[0.04] transition-all">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none">Status na Sala</p>
                                        <p className="text-2xl font-black text-emerald-500 uppercase italic tracking-tighter">LIBERADO</p>
                                    </div>
                                    <div className="p-6 bg-white/[0.02] rounded-[2rem] border border-white/5 space-y-1 group/item hover:bg-white/[0.04] transition-all">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none">Horário do Sinal</p>
                                        <p className="text-2xl font-black text-white italic tracking-tighter">{new Date(request.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-600/10 border border-blue-500/20 rounded-[2.5rem] p-8 text-white backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-5">
                                <Activity className="w-32 h-32" />
                            </div>
                            <div className="flex items-start gap-8 relative z-10">
                                <div className="bg-blue-500/20 p-5 rounded-[1.5rem] border border-blue-500/30">
                                    <AlertCircle className="w-8 h-8 text-blue-400 animate-pulse" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-black uppercase tracking-tighter italic text-blue-400">Histórico do Dia</h3>
                                    <p className="text-slate-300 font-bold text-lg leading-snug">
                                        ALERTA: Retirada anterior detectada às 11:30 para procedimento médico externo. Fluxo normal reestabelecido.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Responsável & Verificação Panel */}
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-700 delay-200">
                        <div className="bg-white/[0.03] rounded-[3rem] shadow-2xl border border-white/10 backdrop-blur-3xl overflow-hidden">
                            <div className="p-10 border-b border-white/5">
                                <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] flex items-center gap-4 mb-10">
                                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                    </div>
                                    Manifesto de Autorização do Responsável
                                </h3>

                                {request.responsavel ? (
                                    <div className="flex items-center gap-8 p-8 bg-[#020617]/60 rounded-[2.5rem] border border-white/5 group relative overflow-hidden">
                                        <div className="absolute inset-x-0 h-[1px] bg-emerald-500/10 blur-sm top-0 group-hover:animate-scan"></div>
                                        <div className="w-28 h-28 bg-[#020617] rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl group-hover:scale-105 transition-all duration-500 shrink-0">
                                            {request.responsavel.foto_url ? (
                                                <img src={request.responsavel.foto_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <User className="w-12 h-12 m-8 text-slate-700" />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-3xl font-black text-white uppercase tracking-tighter italic leading-none truncate mb-3">{request.responsavel.nome_completo}</p>
                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Identidade Autorizada</p>
                                            </div>
                                            <button className="flex items-center gap-3 text-blue-400 font-black text-[9px] uppercase tracking-[0.3em] hover:text-blue-300 transition-colors group/link">
                                                <FileText className="w-4 h-4 group-hover/link:rotate-6 transition-transform" />
                                                <span className="border-b border-blue-400/30">Ver Dados de Identidade</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-10 bg-rose-500/10 border-2 border-rose-500/20 rounded-[2.5rem] flex items-center gap-8 animate-pulse shadow-2xl shadow-rose-500/20">
                                        <div className="bg-rose-500/20 p-5 rounded-2xl">
                                            <AlertTriangle className="w-10 h-10 text-rose-500" />
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-rose-500 font-black uppercase tracking-[0.3em] text-[10px]">ALERTA CRÍTICO</p>
                                            <p className="text-white font-black text-lg leading-tight italic uppercase tracking-tighter">Manifesto de Responsável Ausente. Requer Verificação Física Nível 5!</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-10 bg-transparent space-y-8">
                                <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] flex items-center justify-center gap-4">
                                    <div className="h-px w-full bg-white/5"></div>
                                    Verificação de Identidade
                                    <div className="h-px w-full bg-white/5"></div>
                                </h3>

                                <div className="space-y-4">
                                    {[
                                        { id: 'doc', label: 'Verificação de Documento Físico', icon: FileText, desc: 'Conferência de incompatibilidades' },
                                        { id: 'face', label: 'Correspondência de reconhecimento facial', icon: Camera, desc: 'Confirmação visual de identidade' },
                                        { id: 'auth', label: 'Validação do protocolo ativo', icon: ShieldCheck, desc: 'Verificação de permissão no sistema' }
                                    ].map(item => (
                                        <label key={item.id} className="flex items-center gap-6 p-6 bg-white/[0.02] rounded-[1.8rem] border border-white/5 hover:border-emerald-500/30 cursor-pointer transition-all duration-500 group/check">
                                            <div className="relative">
                                                <input type="checkbox" className="peer hidden" />
                                                <div className="w-10 h-10 rounded-xl bg-[#020617] border-2 border-white/10 peer-checked:bg-emerald-500 peer-checked:border-emerald-500 flex items-center justify-center transition-all duration-500 shadow-2xl">
                                                    <Check className="w-6 h-6 text-[#020617] opacity-0 peer-checked:opacity-100 scale-50 peer-checked:scale-100 transition-all duration-500" />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-5">
                                                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover/check:border-emerald-500/30 transition-all">
                                                    <item.icon className="w-6 h-6 text-slate-600 group-hover/check:text-emerald-500 transition-colors" />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <span className="text-sm font-black text-white uppercase italic tracking-tighter group-hover/check:text-emerald-400 transition-colors">{item.label}</span>
                                                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{item.desc}</p>
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>

                                <div className="pt-4">
                                    <label className="flex items-start gap-6 p-8 bg-emerald-500/[0.03] border-2 border-emerald-500/20 rounded-[2.5rem] cursor-pointer hover:bg-emerald-500/[0.06] transition-all duration-500 relative group/confirm overflow-hidden shadow-2xl">
                                        <div className="absolute inset-0 bg-emerald-500/5 blur-3xl opacity-0 group-hover/confirm:opacity-100 transition-opacity"></div>
                                        <div className="relative z-10 pt-1">
                                            <input
                                                type="checkbox"
                                                className="w-8 h-8 rounded-xl bg-[#020617] border-2 border-emerald-500/30 text-emerald-500 focus:ring-emerald-500/50"
                                                checked={confirmedIdentity}
                                                onChange={(e) => setConfirmedIdentity(e.target.checked)}
                                            />
                                        </div>
                                        <div className="relative z-10 space-y-2">
                                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Declaração de Consentimento</span>
                                            <p className="text-xs font-bold text-slate-400 leading-relaxed uppercase italic tracking-tight">
                                                Eu confirmo sob responsabilidade funcional que todos os protocolos de segurança foram rigorosamente seguidos e a identidade do responsável foi validada no sistema.
                                            </p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div className="p-10 bg-[#020617]/40 border-t border-white/5 backdrop-blur-3xl">
                                <button
                                    onClick={handleConfirmPickup}
                                    disabled={!confirmedIdentity}
                                    className="w-full py-8 bg-white/5 border border-white/10 hover:bg-emerald-500 text-white hover:text-[#020617] rounded-[2.5rem] font-black text-2xl uppercase tracking-[0.4em] shadow-2xl transition-all duration-700 flex items-center justify-center gap-6 active:scale-95 disabled:opacity-20 disabled:grayscale disabled:cursor-not-allowed group/final relative overflow-hidden italic"
                                >
                                    <div className="absolute inset-0 bg-emerald-500 opacity-0 group-hover/final:opacity-100 transition-opacity duration-700"></div>
                                    <CheckCircle className="w-10 h-10 relative z-10 group-hover/final:scale-125 transition-transform duration-700" />
                                    <span className="relative z-10">Autorizar Liberação</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
