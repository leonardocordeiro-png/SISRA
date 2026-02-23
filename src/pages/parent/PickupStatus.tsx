import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    CheckCircle,
    Clock,
    ArrowRight,
    Phone,
    ShieldCheck,
    Bell,
    School,
    User,
    Info,
    Loader2
} from 'lucide-react';
import GeoTracker from '../../components/parent/GeoTracker';
import { useToast } from '../../components/ui/Toast';

type StudentData = {
    id: string;
    nome_completo: string;
    foto_url: string | null;
    turma: string;
    escola_id: string;
};

type PickupData = {
    id: string;
    status: string;
    horario_solicitacao: string;
    mensagem_sala?: string;
    mensagem_recepcao?: string;
};

export default function ParentPickupStatus() {
    const { id: studentId } = useParams();
    const navigate = useNavigate();
    const toast = useToast();

    const [student, setStudent] = useState<StudentData | null>(null);
    const [pickup, setPickup] = useState<PickupData | null>(null);
    const [loading, setLoading] = useState(true);
    const [guardianName, setGuardianName] = useState('Responsável');

    useEffect(() => {
        const session = localStorage.getItem('sisra_parent_session');
        if (!session) {
            navigate('/parent/login');
            return;
        }

        const data = JSON.parse(session);
        const firstName = data.nome.split(' ')[0];
        setGuardianName(`${firstName} (Responsável)`);

        if (studentId) {
            loadInitialData();

            // 1. Realtime Subscription
            const channel = supabase
                .channel(`pickup_status_${studentId}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'solicitacoes_retirada',
                        filter: `aluno_id=eq.${studentId}`
                    },
                    () => {
                        fetchPickupStatus();
                    }
                )
                .subscribe();

            // 2. 1-second Polling (User Request)
            const interval = setInterval(() => {
                fetchPickupStatus();
            }, 1000);

            return () => {
                supabase.removeChannel(channel);
                clearInterval(interval);
            };
        }
    }, [studentId]);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Student
            const { data: studentData, error: studentError } = await supabase
                .from('alunos')
                .select('id, nome_completo, foto_url, turma, escola_id')
                .eq('id', studentId)
                .single();

            if (studentError) throw studentError;
            setStudent(studentData);

            // 2. Fetch Pickup
            await fetchPickupStatus();

        } catch (err) {
            console.error("Error loading data:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchPickupStatus = async () => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const { data, error } = await supabase
                .from('solicitacoes_retirada')
                .select(`
                    id,
                    status,
                    mensagem_sala,
                    mensagem_recepcao,
                    horario_solicitacao,
                    aluno:alunos (
                        nome_completo,
                        foto_url,
                        turma
                    )
                `)
                .eq('aluno_id', studentId)
                .is('horario_confirmacao', null)
                .neq('status', 'CANCELADO')
                .gte('horario_solicitacao', today.toISOString())
                .order('horario_solicitacao', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) console.error("Error fetching pickup", error);
            if (data) {
                // Force type cast as Supabase inference might be generic
                setPickup(data as unknown as PickupData);
            } else {
                setPickup(null);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleRequestPickup = async () => {
        if (!student) return;

        try {
            setLoading(true);

            // Get parent session info
            const parentSessionStr = localStorage.getItem('sisra_parent_session');
            const parentSession = parentSessionStr ? JSON.parse(parentSessionStr) : null;

            const { error } = await supabase
                .from('solicitacoes_retirada')
                .insert({
                    aluno_id: student.id,
                    status: 'SOLICITADO',
                    escola_id: student.escola_id,
                    responsavel_id: parentSession?.id,
                    tipo_solicitacao: 'ROTINA' // Must be 'ROTINA' or 'EMERGENCIA'
                });

            if (error) {
                toast.error('Erro ao solicitar', error.message);
                setLoading(false);
            } else {
                await fetchPickupStatus();
                setLoading(false);
            }
        } catch (err) {
            toast.error('Erro ao solicitar', 'Tente novamente.');
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!student) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <p className="text-slate-500">Aluno não encontrado.</p>
            </div>
        );
    }

    if (!pickup) {
        return (
            <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center text-center">
                <div className="bg-white p-8 rounded-3xl shadow-xl space-y-6 max-w-sm w-full">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto overflow-hidden border-4 border-white shadow-sm">
                        {student.foto_url ? (
                            <img src={student.foto_url} alt={student.nome_completo} className="w-full h-full object-cover" />
                        ) : (
                            <User className="w-10 h-10 text-slate-300" />
                        )}
                    </div>
                    <div className="mt-4">
                        <h2 className="text-xl font-bold text-slate-800">{student.nome_completo.split(' ')[0]}</h2>
                        <p className="text-sm text-slate-500 font-medium">Turma {student.turma}</p>
                    </div>

                    <div className="py-4">
                        <p className="text-slate-500 text-sm">Toque abaixo para avisar que você está a caminho.</p>
                    </div>

                    <button
                        onClick={handleRequestPickup}
                        className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold uppercase tracking-wider shadow-lg shadow-emerald-500/20 active:scale-95 transition-transform"
                    >
                        Solicitar Retirada
                    </button>

                    <button onClick={() => window.history.back()} className="text-slate-400 font-bold text-sm hover:text-slate-600 mt-4">Voltar</button>
                </div>
            </div>
        );
    }

    const getStatusStep = (s: string) => {
        switch (s) {
            case 'SOLICITADO': return 1;
            case 'AGUARDANDO': return 1;
            case 'LIBERADO': return 2;
            case 'CONFIRMADO': return 3;
            case 'FINALIZADO': return 4;
            default: return 1;
        }
    };

    const currentStep = getStatusStep(pickup.status);

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800 antialiased">
            {/* Header Sticky */}
            <div className="bg-blue-600 text-white sticky top-0 z-50 shadow-lg">
                <div className="max-w-md mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ArrowRight className="w-5 h-5 animate-pulse" />
                        <span className="font-bold text-lg">Status do Aluno</span>
                    </div>
                    <div className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider animate-pulse">
                        Ao Vivo
                    </div>
                </div>
            </div>

            <main className="max-w-md mx-auto px-4 py-6 space-y-6">
                {/* School Branding */}
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600 p-2 rounded-xl shadow-md shadow-blue-600/20">
                            <School className="text-white w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 leading-tight">La Salle, Cheguei!</h1>
                            <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">Colégio La Salle</p>
                        </div>
                    </div>
                    <button className="text-slate-400 hover:text-blue-600 transition-colors p-2 hover:bg-slate-100 rounded-full">
                        <Bell className="w-6 h-6" />
                    </button>
                </div>

                {/* Main Status Card */}
                <section className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-8">
                        <div className="flex items-center gap-5 mb-8">
                            <div className="relative">
                                {student.foto_url ? (
                                    <img
                                        src={student.foto_url}
                                        alt="Estudante"
                                        className="h-20 w-20 rounded-2xl object-cover border-4 border-slate-50 shadow-sm"
                                    />
                                ) : (
                                    <div className="h-20 w-20 rounded-2xl bg-slate-100 flex items-center justify-center border-4 border-slate-50 shadow-sm">
                                        <User className="w-8 h-8 text-slate-300" />
                                    </div>
                                )}
                                <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-1 rounded-full border-2 border-white shadow-sm">
                                    <CheckCircle className="w-4 h-4" />
                                </div>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900">{student.nome_completo.split(' ')[0]}</h2>
                                <p className="text-xs text-slate-400 uppercase font-bold">{student.turma}</p>
                                <div className="flex items-center gap-2 text-slate-500 mt-1">
                                    <Clock className="w-4 h-4" />
                                    <span className="text-sm font-medium">Situação: <span className="text-blue-600 font-bold">{pickup.status}</span></span>
                                </div>
                            </div>
                        </div>

                        {/* Dispatcher Quick Notes Notification */}
                        {pickup.mensagem_sala && (
                            <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 animate-bounce-subtle">
                                <div className="bg-amber-100 p-2 rounded-xl">
                                    <Bell className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Aviso do Colégio</p>
                                    <p className="text-sm font-bold text-amber-900 leading-tight">"{pickup.mensagem_sala}"</p>
                                </div>
                            </div>
                        )}

                        {/* Timeline */}
                        <div className="space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                            {/* Step 1 */}
                            <div className="flex items-start gap-4 relative">
                                <div className={`z-10 h-6 w-6 rounded-full flex items-center justify-center ring-4 ring-white shadow-sm ${currentStep >= 1 ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                                    <CheckCircle className="text-white w-4 h-4" />
                                </div>
                                <div className="flex-1">
                                    <p className={`text-sm font-bold leading-none ${currentStep >= 1 ? 'text-slate-900' : 'text-slate-400'}`}>Solicitação Recebida</p>
                                    <p className="text-xs text-slate-400 mt-1">{new Date(pickup.horario_solicitacao).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                            </div>

                            {/* Step 2 */}
                            <div className="flex items-start gap-4 relative">
                                <div className={`z-10 h-6 w-6 rounded-full flex items-center justify-center ring-4 ring-white shadow-sm transition-colors duration-500 ${currentStep >= 2 ? 'bg-blue-600' : 'bg-slate-200'}`}>
                                    <div className={`h-2 w-2 bg-white rounded-full ${currentStep === 2 ? 'animate-ping' : ''}`}></div>
                                </div>
                                <div className="flex-1">
                                    <p className={`text-sm font-bold leading-none ${currentStep >= 2 ? 'text-blue-600' : 'text-slate-400'}`}>Liberado da Sala</p>
                                    <p className="text-xs text-slate-500 mt-1 font-medium">O aluno está a caminho da recepção</p>
                                </div>
                            </div>

                            {/* Step 3 */}
                            <div className="flex items-start gap-4 relative">
                                <div className={`z-10 h-6 w-6 rounded-full flex items-center justify-center ring-4 ring-white shadow-sm transition-colors duration-500 ${currentStep >= 3 ? 'bg-emerald-500' : 'bg-slate-100'}`}>
                                    <div className={`h-2 w-2 rounded-full ${currentStep >= 3 ? 'bg-white' : 'bg-slate-300'}`}></div>
                                </div>
                                <div className="flex-1">
                                    <p className={`text-sm font-bold leading-none ${currentStep >= 3 ? 'text-slate-900' : 'text-slate-300'}`}>Pronto na Recepção</p>
                                    <p className={`text-xs mt-1 italic uppercase tracking-tighter ${currentStep >= 3 ? 'text-emerald-600 font-bold' : 'text-slate-300'}`}>
                                        {currentStep >= 3 ? 'Já está aguardando você!' : 'Aguardando sua chegada'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Button Action */}
                        <div className="mt-10">
                            <button className="w-full bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl border border-slate-200 transition-all flex items-center justify-center gap-3 active:scale-[0.98] shadow-sm">
                                <Phone className="w-5 h-5" />
                                Falar com a Portaria
                            </button>
                        </div>
                    </div>
                </section>

                {/* Geofencing Tracker */}
                <GeoTracker pickupId={pickup.id} />

                {/* Manual Arrival Button (User Request) */}
                <div className="px-2">
                    <button
                        onClick={async () => {
                            const { error } = await supabase
                                .from('solicitacoes_retirada')
                                .update({
                                    status_geofence: 'CHEGOU',
                                    distancia_estimada_metros: 0
                                })
                                .eq('id', pickup.id);

                            if (!error) {
                                fetchPickupStatus();
                                toast.success('Aviso enviado!', 'O professor já recebeu a notificação de que você chegou.');
                            }
                        }}
                        className="w-full py-4 bg-white hover:bg-slate-50 text-blue-600 rounded-2xl border-2 border-blue-100 hover:border-blue-200 font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-sm shadow-blue-500/5 group"
                    >
                        <div className="bg-blue-50 p-1.5 rounded-lg group-hover:bg-blue-100 transition-colors">
                            <CheckCircle className="w-4 h-4" />
                        </div>
                        Já estou na recepção (Manual)
                    </button>
                    <p className="text-[10px] text-slate-400 text-center mt-3 px-4 leading-tight">
                        Use este botão caso esteja na portaria mas seu GPS esteja desligado ou com erro.
                    </p>
                </div>

                {/* Safety Card */}
                <section className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <ShieldCheck className="text-emerald-500 w-6 h-6 border-2 border-emerald-500/10 rounded-lg p-0.5" />
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Segurança e Verificação</h3>
                    </div>
                    <div className="flex items-center justify-between bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100/50">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm">
                                <User className="w-full h-full bg-slate-200 text-slate-400 p-2" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-tighter">Responsável Autorizado</p>
                                <p className="text-sm font-bold text-slate-900">{guardianName}</p>
                            </div>
                        </div>
                        <div className="text-emerald-500">
                            <CheckCircle className="w-6 h-6 fill-emerald-500 text-white" />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-400 px-1 leading-tight">
                        <Info className="w-4 h-4 shrink-0" />
                        <p>Por favor, tenha seu RG ou QR Code em mãos para verificar na portaria.</p>
                    </div>
                </section>

                {/* Footer Info */}
                <div className="text-center pt-4 pb-12">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">La Salle, Cheguei! Student Pickup • v2.4.1</p>
                    <div className="flex justify-center gap-6 mt-3">
                        <button className="text-xs text-blue-600 font-bold uppercase tracking-wider hover:underline">Suporte</button>
                        <span className="text-slate-200">|</span>
                        <button className="text-xs text-blue-600 font-bold uppercase tracking-wider hover:underline">Privacidade</button>
                    </div>
                </div>
            </main>
        </div>
    );
}
