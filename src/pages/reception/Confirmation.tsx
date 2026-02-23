import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle, User, ShieldCheck, Clock, FileText, Camera, Check, AlertTriangle, AlertCircle } from 'lucide-react';
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
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <NavigationControls />
                    <div>
                        <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">Confirmação de Entrega</h1>
                        <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Verificação de Segurança</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-xl">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <span className="text-xs font-black text-amber-700 uppercase tracking-widest">Protocolo de Verificação Ativo</span>
                </div>
            </header>

            <main className="flex-1 max-w-7xl mx-auto w-full p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Aluno Panel */}
                    <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 ring-1 ring-slate-900/5">
                            <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-10">
                                    <User className="w-32 h-32 text-white" />
                                </div>
                                <div className="relative z-10">
                                    <div className="w-48 h-48 bg-slate-800 rounded-3xl mx-auto mb-6 overflow-hidden border-4 border-white/10 shadow-2xl rotate-3">
                                        {request.aluno.foto_url ? (
                                            <img src={request.aluno.foto_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <User className="w-full h-full p-12 text-slate-700" />
                                        )}
                                    </div>
                                    <h2 className="text-4xl font-black text-white italic tracking-tighter mb-1 uppercase">{request.aluno.nome_completo}</h2>
                                    <div className="flex items-center justify-center gap-3">
                                        <span className="px-4 py-1.5 bg-emerald-500 text-slate-900 rounded-full font-black text-xs uppercase tracking-widest">
                                            {request.aluno.turma}
                                        </span>
                                        <span className="px-4 py-1.5 bg-white/10 text-white rounded-full font-black text-xs uppercase tracking-widest">
                                            ID: #{request.aluno.id.slice(0, 8)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="p-8 bg-white border-t border-slate-50">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Status da Sala</p>
                                        <p className="text-xl font-black text-emerald-600 uppercase italic">Liberado</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Hora Solicitação</p>
                                        <p className="text-xl font-black text-slate-700 italic">{new Date(request.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-blue-500/20 flex items-start gap-6">
                            <div className="bg-white/20 p-4 rounded-2xl">
                                <AlertCircle className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tighter mb-2 italic">Histórico de Hoje</h3>
                                <p className="text-blue-100 font-medium text-lg leading-tight">
                                    Já foi retirado e devolvido para a escola às 11:30 para consulta médica.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Responsável & Verificação Panel */}
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 delay-150">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden">
                            <div className="p-8 border-b border-slate-50">
                                <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest flex items-center gap-3 mb-8">
                                    <ShieldCheck className="w-6 h-6 text-emerald-500" /> Identificação do Responsável
                                </h3>

                                {request.responsavel ? (
                                    <div className="flex items-center gap-8 p-6 bg-slate-50 rounded-[2rem] border border-slate-100 group">
                                        <div className="w-24 h-24 bg-slate-200 rounded-3xl overflow-hidden border-2 border-white shadow-lg group-hover:scale-105 transition-transform">
                                            {request.responsavel.foto_url ? (
                                                <img src={request.responsavel.foto_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <User className="w-12 h-12 m-6 text-slate-400" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic leading-none mb-2">{request.responsavel.nome_completo}</p>
                                            <p className="text-sm font-bold text-emerald-600 uppercase tracking-widest mb-3">Responsável Autorizado</p>
                                            <button className="flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase tracking-widest hover:text-blue-700 transition-colors">
                                                <FileText className="w-4 h-4" /> Ver Documento Digitalizado
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-8 bg-red-50 border-2 border-red-100 rounded-[2rem] flex items-center gap-6">
                                        <AlertTriangle className="w-12 h-12 text-red-500" />
                                        <div>
                                            <p className="text-red-900 font-black uppercase tracking-widest text-sm mb-1">Atenção Crítica</p>
                                            <p className="text-red-700 font-bold">Nenhum responsável pré-atribuído. Verifique o QR Code ou documento físico!</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-8 bg-slate-50/50 space-y-6">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    CHECKLIST DE VERIFICAÇÃO DE IDENTIDADE
                                </h3>

                                <div className="space-y-4">
                                    {[
                                        { id: 'doc', label: 'Conferiu documento físico com foto', icon: FileText },
                                        { id: 'face', label: 'Validou identidade visual do portador', icon: Camera },
                                        { id: 'auth', label: 'Verificou autorização de saída ativa', icon: ShieldCheck }
                                    ].map(item => (
                                        <label key={item.id} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200 hover:border-emerald-500/50 cursor-pointer transition-all group">
                                            <div className="relative">
                                                <input type="checkbox" className="peer hidden" />
                                                <div className="w-8 h-8 rounded-lg border-2 border-slate-200 peer-checked:bg-emerald-500 peer-checked:border-emerald-500 flex items-center justify-center transition-all">
                                                    <Check className="w-5 h-5 text-white opacity-0 peer-checked:opacity-100" />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <item.icon className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                                                <span className="text-sm font-black text-slate-700 uppercase tracking-tighter">{item.label}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>

                                <div className="pt-4">
                                    <label className="flex items-start gap-4 p-6 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-3xl cursor-pointer hover:bg-emerald-500/20 transition-all">
                                        <input
                                            type="checkbox"
                                            className="w-6 h-6 mt-0.5 text-emerald-600 rounded-lg focus:ring-emerald-500 border-emerald-500/30"
                                            checked={confirmedIdentity}
                                            onChange={(e) => setConfirmedIdentity(e.target.checked)}
                                        />
                                        <span className="text-sm font-bold text-emerald-900 leading-tight">
                                            Declaro sob responsabilidade que todos os protocolos de segurança foram seguidos e a identidade do responsável foi confirmada.
                                        </span>
                                    </label>
                                </div>
                            </div>

                            <div className="p-8 bg-white border-t border-slate-50">
                                <button
                                    onClick={handleConfirmPickup}
                                    disabled={!confirmedIdentity}
                                    className="w-full py-6 bg-slate-900 hover:bg-emerald-500 text-white hover:text-slate-900 rounded-[2rem] font-black text-xl uppercase tracking-widest shadow-2xl transition-all flex items-center justify-center gap-4 active:scale-95 disabled:opacity-20 disabled:grayscale disabled:cursor-not-allowed group"
                                >
                                    <CheckCircle className="w-8 h-8 group-hover:scale-110 transition-transform" />
                                    Finalizar e Entregar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
