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
    Loader2,
    Navigation,
    Activity,
    Wifi,
    MapPin,
    AlertTriangle
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
            const { data: studentData, error: studentError } = await supabase
                .from('alunos')
                .select('id, nome_completo, foto_url, turma, escola_id')
                .eq('id', studentId)
                .single();

            if (studentError) throw studentError;
            setStudent(studentData);

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

            const parentSessionStr = localStorage.getItem('sisra_parent_session');
            const parentSession = parentSessionStr ? JSON.parse(parentSessionStr) : null;

            const { error } = await supabase
                .from('solicitacoes_retirada')
                .insert({
                    aluno_id: student.id,
                    status: 'SOLICITADO',
                    escola_id: student.escola_id,
                    responsavel_id: parentSession?.id,
                    tipo_solicitacao: 'ROTINA'
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
            <div className="min-h-screen bg-[#020617] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!student) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#020617]">
                <p className="text-slate-500 font-black uppercase tracking-widest italic">Sinal Perdido: Aluno não encontrado.</p>
            </div>
        );
    }

    if (!pickup) {
        return (
            <div className="min-h-screen bg-[#020617] p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
                {/* HUD Background Decorations */}
                <div className="absolute top-[-10%] right-[-10%] w-[70%] h-[70%] bg-blue-500/[0.03] blur-[120px] rounded-full animate-pulse-slow pointer-events-none" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

                <div className="bg-white/[0.03] border border-white/10 backdrop-blur-3xl p-10 rounded-[3rem] space-y-8 max-w-sm w-full relative z-10 shadow-2xl">
                    <div className="relative inline-block">
                        <div className="w-24 h-24 bg-slate-900 rounded-[2rem] flex items-center justify-center mx-auto overflow-hidden border-4 border-white/5 shadow-2xl relative z-10">
                            {student.foto_url ? (
                                <img src={student.foto_url} alt={student.nome_completo} className="w-full h-full object-cover" />
                            ) : (
                                <User className="w-10 h-10 text-slate-700" />
                            )}
                        </div>
                        <div className="absolute -inset-4 bg-blue-500/20 blur-2xl rounded-full animate-pulse z-0" />
                    </div>

                    <div className="space-y-2">
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Protocolo Disponível</p>
                        <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">{student.nome_completo.split(' ')[0]}</h2>
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                            <Activity className="w-3 h-3 text-emerald-500 animate-pulse" />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Unidade: {student.turma}</span>
                        </div>
                    </div>

                    <p className="text-slate-400 text-sm leading-relaxed">
                        Toque no comando abaixo para notificar que você está a caminho do colégio.
                    </p>

                    <button
                        id="solicit-pickup-button"
                        onClick={handleRequestPickup}
                        className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black italic uppercase tracking-[0.2em] shadow-2xl shadow-blue-500/20 active:scale-95 transition-all relative group overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                        <span className="relative z-10 flex items-center justify-center gap-3">
                            <Navigation className="w-5 h-5 fill-white/20" />
                            Solicitar Retirada
                        </span>
                    </button>

                    <button
                        onClick={() => window.history.back()}
                        className="text-slate-600 font-black text-[10px] uppercase tracking-widest hover:text-white transition-colors"
                    >
                        Cancelar Missão
                    </button>
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
        <div className="min-h-screen bg-[#020617] font-sans text-slate-200 antialiased selection:bg-blue-500/30 overflow-x-hidden relative">
            {/* Ambient HUD Layer */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-blue-500/[0.04] blur-[120px] rounded-full animate-pulse-slow" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:60px_60px] opacity-30" />
            </div>

            {/* Header Sticky */}
            <header className="bg-[#020617]/80 backdrop-blur-3xl border-b border-white/5 sticky top-0 z-50">
                <div className="max-w-md mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Activity className="w-5 h-5 text-blue-500 animate-pulse" />
                            <div className="absolute -inset-1 bg-blue-500/20 blur-md rounded-full pointer-events-none" />
                        </div>
                        <span className="font-black italic text-lg uppercase tracking-tighter text-white">Telemetria Live</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                        <Wifi className="w-3 h-3 text-emerald-500 animate-pulse" />
                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Sinal Linkado</span>
                    </div>
                </div>
            </header>

            <main className="max-w-md mx-auto px-4 py-8 space-y-8 relative z-10">
                {/* School Status */}
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-600/20 p-3 rounded-2xl border border-blue-500/30 shadow-2xl shadow-blue-500/10">
                            <School className="text-blue-400 w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-white italic uppercase tracking-tighter leading-tight">La Salle, Cheguei!</h1>
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Centro de Operações Escolares</p>
                        </div>
                    </div>
                    <button className="text-slate-600 hover:text-blue-400 transition-all p-3 hover:bg-white/5 rounded-2xl border border-transparent hover:border-white/5">
                        <Bell className="w-6 h-6" />
                    </button>
                </div>

                {/* Main Status HUD Card */}
                <section className="bg-white/[0.02] border border-white/10 rounded-[2.5rem] backdrop-blur-3xl overflow-hidden shadow-2xl relative group">
                    <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent top-0 animate-scan opacity-30" />

                    <div className="p-8">
                        <div className="flex items-center gap-6 mb-10">
                            <div className="relative">
                                <div className="absolute -inset-2 bg-blue-500/20 blur-xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
                                {student.foto_url ? (
                                    <img
                                        src={student.foto_url}
                                        alt="Estudante"
                                        className="h-20 w-20 rounded-[2rem] object-cover border-2 border-white/20 shadow-2xl relative z-10"
                                    />
                                ) : (
                                    <div className="h-20 w-20 rounded-[2rem] bg-slate-900 flex items-center justify-center border-2 border-white/10 shadow-2xl relative z-10">
                                        <User className="w-8 h-8 text-slate-700" />
                                    </div>
                                )}
                                <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-1.5 rounded-xl border-2 border-[#020617] shadow-xl z-20">
                                    <CheckCircle className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter tracking-[0.1em]">{student.nome_completo.split(' ')[0]}</h2>
                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{student.turma}</p>
                                <div className="flex items-center gap-3 pt-2">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                                    <span className="text-xs font-black uppercase tracking-widest text-blue-400">Status: {pickup.status}</span>
                                </div>
                            </div>
                        </div>

                        {/* Tactical Alerts */}
                        {pickup.mensagem_sala && (
                            <div className="mb-10 p-5 bg-amber-500/10 border border-amber-500/20 rounded-3xl flex items-start gap-4 animate-in zoom-in-95">
                                <div className="bg-amber-500/20 p-2.5 rounded-xl">
                                    <Bell className="w-5 h-5 text-amber-500" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1.5 opacity-80">Mensagem do Centro de Comando</p>
                                    <p className="text-sm font-bold text-amber-200 leading-tight italic">"{pickup.mensagem_sala}"</p>
                                </div>
                            </div>
                        )}

                        {/* Timeline HUD View */}
                        <div className="space-y-10 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-white/[0.05] ml-1">
                            {/* Step 1 */}
                            <div className="flex items-start gap-6 relative">
                                <div className={`z-10 h-6 w-6 rounded-lg flex items-center justify-center border-2 shadow-xl transition-all duration-700 ${currentStep >= 1 ? 'bg-emerald-500 border-emerald-400 rotate-45' : 'bg-slate-900 border-white/10'}`}>
                                    <CheckCircle className={`text-white w-4 h-4 transition-all duration-700 ${currentStep >= 1 ? '-rotate-45' : ''}`} />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <p className={`text-xs font-black uppercase tracking-widest italic ${currentStep >= 1 ? 'text-white' : 'text-slate-700'}`}>Protocolo Recebido</p>
                                    <p className="text-[10px] text-slate-500 font-mono">{new Date(pickup.horario_solicitacao).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                                </div>
                            </div>

                            {/* Step 2 */}
                            <div className="flex items-start gap-6 relative">
                                <div className={`z-10 h-6 w-6 rounded-lg flex items-center justify-center border-2 transition-all duration-700 ${currentStep >= 2 ? 'bg-blue-600 border-blue-400 rotate-45 animate-pulse' : 'bg-slate-900 border-white/10'}`}>
                                    <Activity className={`text-white w-3 h-3 transition-all duration-700 ${currentStep >= 2 ? '-rotate-45' : ''}`} />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <p className={`text-xs font-black uppercase tracking-widest italic ${currentStep >= 2 ? 'text-blue-400' : 'text-slate-700'}`}>Liberado para Desembarque</p>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-tighter">O aluno iniciou o deslocamento tático</p>
                                </div>
                            </div>

                            {/* Step 3 */}
                            <div className="flex items-start gap-6 relative">
                                <div className={`z-10 h-6 w-6 rounded-lg flex items-center justify-center border-2 transition-all duration-700 ${currentStep >= 3 ? 'bg-emerald-500 border-emerald-400 rotate-45' : 'bg-slate-900 border-white/10'}`}>
                                    <MapPin className={`text-white w-4 h-4 transition-all duration-700 ${currentStep >= 3 ? '-rotate-45' : ''}`} />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <p className={`text-xs font-black uppercase tracking-widest italic ${currentStep >= 3 ? 'text-emerald-400' : 'text-slate-700'}`}>Ponto de Coleta</p>
                                    <p className={`text-[10px] font-black uppercase tracking-widest ${currentStep >= 3 ? 'text-emerald-500' : 'text-slate-700'}`}>
                                        {currentStep >= 3 ? 'Posicionado na Recepção' : 'Aguardando Aproximação'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* HUD Action Button */}
                        <div className="mt-12">
                            <button className="w-full bg-white/5 hover:bg-white/10 text-slate-300 font-black text-[10px] italic uppercase tracking-[0.3em] py-5 rounded-[1.5rem] border border-white/5 transition-all flex items-center justify-center gap-4 active:scale-[0.98]">
                                <Phone className="w-4 h-4 text-blue-500 animate-pulse" />
                                Estabelecer Contato (Portaria)
                            </button>
                        </div>
                    </div>
                </section>

                {/* Geofencing Tracker - Mission Control Style */}
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 blur opacity-50 group-hover:opacity-100 transition duration-1000"></div>
                    <div className="relative">
                        <GeoTracker pickupId={pickup.id} />
                    </div>
                </div>

                <div className="px-2 space-y-4">
                    <button
                        id="manual-checkpoint-button"
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
                                toast.success('Checkpoint confirmado!', 'O Centro de Comando foi notificado da sua chegada.');
                            }
                        }}
                        className="w-full py-5 bg-white/[0.03] hover:bg-white/[0.06] text-white rounded-3xl border border-white/10 italic hover:border-blue-500/50 font-black text-[10px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-4 shadow-2xl active:scale-95 group"
                    >
                        <div className="bg-blue-500/10 p-2 rounded-xl group-hover:bg-blue-500/20 transition-all">
                            <CheckCircle className="w-4 h-4 text-blue-500" />
                        </div>
                        Ativar Checkpoint de Chegada
                    </button>
                    <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest text-center px-8 leading-relaxed opacity-50">
                        Utilize este protocolo caso o sinal de geolocalização (GPS) esteja instável no local.
                    </p>
                </div>

                {/* Security Data Display */}
                <section className="bg-white/[0.01] border border-white/5 rounded-[2rem] p-6 space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                            <ShieldCheck className="text-emerald-500 w-5 h-5" />
                        </div>
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verificação de Segurança</h3>
                    </div>

                    <div className="flex items-center justify-between bg-white/[0.03] p-5 rounded-2xl border border-white/5 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex items-center gap-5 relative z-10">
                            <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl">
                                <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                                    <User className="w-6 h-6 text-slate-700" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-tighter italic opacity-80">Guardião Autorizado</p>
                                <p className="text-sm font-black text-white uppercase italic tracking-tight">{guardianName}</p>
                            </div>
                        </div>
                        <CheckCircle className="w-6 h-6 text-emerald-500 relative z-10" />
                    </div>

                    <div className="flex items-start gap-4 px-2 opacity-50 lg:opacity-30">
                        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter leading-relaxed italic">
                            Apresente sua ID-Card Digital ou QR Token na barreira física de segurança para completar o protocolo.
                        </p>
                    </div>
                </section>

                {/* Terminal Footer */}
                <footer className="text-center pt-8 pb-20 space-y-4 opacity-30">
                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent w-full" />
                    <p className="text-[9px] text-slate-600 font-bold uppercase tracking-[0.4em]">SISRA // MISSAO_CRITICAL_V2.4.1</p>
                    <div className="flex justify-center gap-8 capitalize font-black italic text-[10px]">
                        <button className="text-slate-500 hover:text-blue-500 transition-colors">SUPORTE</button>
                        <button className="text-slate-500 hover:text-blue-500 transition-colors">PRIVACIDADE</button>
                    </div>
                </footer>
            </main>
        </div>
    );
}
