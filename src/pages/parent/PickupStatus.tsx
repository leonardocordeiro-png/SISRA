import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    CheckCircle, ShieldCheck, Bell, School,
    User, Info, Loader2, Navigation, Activity, Wifi, MapPin
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

    const [student, setStudent]             = useState<StudentData | null>(null);
    const [pickup, setPickup]               = useState<PickupData | null>(null);
    const [loading, setLoading]             = useState(true);
    const [requesting, setRequesting]       = useState(false);
    const [guardianName, setGuardianName]   = useState('Responsável');
    const [guardianId, setGuardianId]       = useState<string | undefined>(undefined);
    const [accessDenied, setAccessDenied]   = useState(false);

    const requestingRef = useRef(false); // guard against double-submit

    // ── Session validation ────────────────────────────────────────────────────
    useEffect(() => {
        const session = localStorage.getItem('sisra_parent_session');
        if (!session) {
            navigate('/parent/login');
            return;
        }

        let parsed: { id?: string; nome?: string };
        try {
            parsed = JSON.parse(session);
        } catch {
            navigate('/parent/login');
            return;
        }

        if (!parsed.id || !parsed.nome) {
            navigate('/parent/login');
            return;
        }

        const firstName = parsed.nome.split(' ')[0];
        setGuardianName(`${firstName} (Responsável)`);
        setGuardianId(parsed.id);

        if (studentId) {
            loadInitialData(parsed.id);

            const channel = supabase
                .channel(`pickup_status_${studentId}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'solicitacoes_retirada',
                    filter: `aluno_id=eq.${studentId}`,
                }, fetchPickupStatus)
                .subscribe();

            // Poll every 5 s — realtime handles instant updates;
            // polling is just a safety net.
            const interval = setInterval(fetchPickupStatus, 5000);

            return () => {
                supabase.removeChannel(channel);
                clearInterval(interval);
            };
        }
    }, [studentId]);

    // ── Load student + verify ownership ──────────────────────────────────────
    const loadInitialData = async (gId: string) => {
        setLoading(true);
        try {
            // 1. Verify that this guardian is actually linked to this student
            const { data: link, error: linkErr } = await supabase
                .from('alunos_responsaveis')
                .select('aluno_id')
                .eq('responsavel_id', gId)
                .eq('aluno_id', studentId)
                .maybeSingle();

            if (linkErr || !link) {
                setAccessDenied(true);
                return;
            }

            // 2. Load student data (only after ownership confirmed)
            const { data: studentData, error: studentErr } = await supabase
                .from('alunos')
                .select('id, nome_completo, foto_url, turma, escola_id')
                .eq('id', studentId)
                .single();

            if (studentErr || !studentData) throw studentErr;
            setStudent(studentData);

            await fetchPickupStatus();
        } catch {
            // fail silently — student will show as not found
        } finally {
            setLoading(false);
        }
    };

    // ── Fetch active pickup ───────────────────────────────────────────────────
    const fetchPickupStatus = async () => {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        try {
            const { data, error } = await supabase
                .from('solicitacoes_retirada')
                .select('id, status, mensagem_sala, mensagem_recepcao, horario_solicitacao')
                .eq('aluno_id', studentId)
                .is('horario_confirmacao', null)
                .neq('status', 'CANCELADO')
                .gte('horario_solicitacao', todayStart.toISOString())
                .order('horario_solicitacao', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!error) setPickup(data as PickupData | null);
        } catch { /* ignore */ }
    };

    // ── Request pickup ────────────────────────────────────────────────────────
    const handleRequestPickup = async () => {
        if (!student || requestingRef.current) return;
        requestingRef.current = true;
        setRequesting(true);

        try {
            const session = localStorage.getItem('sisra_parent_session');
            const sessionData = session ? JSON.parse(session) : null;

            const { error } = await supabase
                .from('solicitacoes_retirada')
                .insert({
                    aluno_id: student.id,
                    status: 'SOLICITADO',
                    escola_id: student.escola_id,
                    responsavel_id: sessionData?.id ?? null,
                    tipo_solicitacao: 'ROTINA',
                });

            if (error) {
                toast.error('Erro ao solicitar', error.message);
            } else {
                await fetchPickupStatus();
            }
        } catch {
            toast.error('Erro ao solicitar', 'Tente novamente.');
        } finally {
            requestingRef.current = false;
            setRequesting(false);
        }
    };

    // ── Access denied ─────────────────────────────────────────────────────────
    if (accessDenied) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <ShieldCheck className="w-12 h-12 text-rose-500 mx-auto" />
                    <p className="text-white font-black text-lg uppercase italic tracking-tighter">Acesso não autorizado</p>
                    <p className="text-slate-500 text-sm">Você não tem permissão para visualizar este aluno.</p>
                    <button
                        onClick={() => navigate('/parent/login')}
                        className="mt-4 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-slate-400 font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
                    >
                        Voltar
                    </button>
                </div>
            </div>
        );
    }

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
                <p className="text-slate-500 font-black uppercase tracking-widest italic">Aluno não encontrado.</p>
            </div>
        );
    }

    if (!pickup) {
        return (
            <div className="min-h-screen bg-[#020617] p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
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
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Turma: {student.turma}</span>
                        </div>
                    </div>

                    <p className="text-slate-400 text-sm leading-relaxed">
                        Toque no botão abaixo para notificar que você está a caminho do colégio.
                    </p>

                    <button
                        onClick={handleRequestPickup}
                        disabled={requesting}
                        className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black italic uppercase tracking-[0.2em] shadow-2xl shadow-blue-500/20 active:scale-95 transition-all relative group overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                        <span className="relative z-10 flex items-center justify-center gap-3">
                            {requesting
                                ? <Loader2 className="w-5 h-5 animate-spin" />
                                : <Navigation className="w-5 h-5 fill-white/20" />
                            }
                            {requesting ? 'Enviando...' : 'Solicitar Retirada'}
                        </span>
                    </button>

                    <button
                        onClick={() => window.history.back()}
                        className="text-slate-600 font-black text-[10px] uppercase tracking-widest hover:text-white transition-colors"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        );
    }

    const getStatusStep = (s: string) => {
        switch (s) {
            case 'SOLICITADO': case 'AGUARDANDO': return 1;
            case 'LIBERADO':   return 2;
            case 'CONFIRMADO': return 3;
            case 'FINALIZADO': return 4;
            default:           return 1;
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

            {/* Header */}
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
                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Sinal Ativo</span>
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
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Acompanhamento em Tempo Real</p>
                        </div>
                    </div>
                    <button className="text-slate-600 hover:text-blue-400 transition-all p-3 hover:bg-white/5 rounded-2xl border border-transparent hover:border-white/5">
                        <Bell className="w-6 h-6" />
                    </button>
                </div>

                {/* Main Status Card */}
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
                                <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">{student.nome_completo.split(' ')[0]}</h2>
                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{student.turma}</p>
                                <div className="flex items-center gap-3 pt-2">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                                    <span className="text-xs font-black uppercase tracking-widest text-blue-400">Status: {pickup.status}</span>
                                </div>
                            </div>
                        </div>

                        {/* Alerts */}
                        {pickup.mensagem_sala && (
                            <div className="mb-10 p-5 bg-amber-500/10 border border-amber-500/20 rounded-3xl flex items-start gap-4 animate-in zoom-in-95">
                                <div className="bg-amber-500/20 p-2.5 rounded-xl">
                                    <Bell className="w-5 h-5 text-amber-500" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1.5 opacity-80">Mensagem da Sala</p>
                                    <p className="text-sm font-bold text-amber-200 leading-tight italic">"{pickup.mensagem_sala}"</p>
                                </div>
                            </div>
                        )}

                        {/* Timeline */}
                        <div className="space-y-10 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-white/[0.05] ml-1">
                            <div className="flex items-start gap-6 relative">
                                <div className={`z-10 h-6 w-6 rounded-lg flex items-center justify-center border-2 shadow-xl transition-all duration-700 ${currentStep >= 1 ? 'bg-emerald-500 border-emerald-400 rotate-45' : 'bg-slate-900 border-white/10'}`}>
                                    <CheckCircle className={`text-white w-4 h-4 transition-all duration-700 ${currentStep >= 1 ? '-rotate-45' : ''}`} />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <p className={`text-xs font-black uppercase tracking-widest italic ${currentStep >= 1 ? 'text-white' : 'text-slate-700'}`}>Solicitação Recebida</p>
                                    <p className="text-[10px] text-slate-500 font-mono">{new Date(pickup.horario_solicitacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-6 relative">
                                <div className={`z-10 h-6 w-6 rounded-lg flex items-center justify-center border-2 transition-all duration-700 ${currentStep >= 2 ? 'bg-blue-600 border-blue-400 rotate-45 animate-pulse' : 'bg-slate-900 border-white/10'}`}>
                                    <Activity className={`text-white w-3 h-3 transition-all duration-700 ${currentStep >= 2 ? '-rotate-45' : ''}`} />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <p className={`text-xs font-black uppercase tracking-widest italic ${currentStep >= 2 ? 'text-blue-400' : 'text-slate-700'}`}>Liberado — A Caminho</p>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-tighter">Aluno encaminhado para a saída</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-6 relative">
                                <div className={`z-10 h-6 w-6 rounded-lg flex items-center justify-center border-2 transition-all duration-700 ${currentStep >= 3 ? 'bg-emerald-500 border-emerald-400 rotate-45' : 'bg-slate-900 border-white/10'}`}>
                                    <MapPin className={`text-white w-4 h-4 transition-all duration-700 ${currentStep >= 3 ? '-rotate-45' : ''}`} />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <p className={`text-xs font-black uppercase tracking-widest italic ${currentStep >= 3 ? 'text-emerald-400' : 'text-slate-700'}`}>Na Recepção</p>
                                    <p className={`text-[10px] font-black uppercase tracking-widest ${currentStep >= 3 ? 'text-emerald-500' : 'text-slate-700'}`}>
                                        {currentStep >= 3 ? 'Aguardando na Recepção' : 'Aguardando Liberação'}
                                    </p>
                                </div>
                            </div>
                        </div>

                    </div>
                </section>

                {/* GeoTracker */}
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 blur opacity-50 group-hover:opacity-100 transition duration-1000" />
                    <div className="relative">
                        <GeoTracker pickupId={pickup.id} escolaId={student.escola_id} guardianId={guardianId} />
                    </div>
                </div>

                {/* Manual checkpoint */}
                <div className="px-2 space-y-4">
                    <button
                        onClick={async () => {
                            // Update ALL active pickups for this guardian today —
                            // not just pickup.id, so multi-student requests are all
                            // marked as CHEGOU at the same time.
                            const todayStart = new Date();
                            todayStart.setHours(0, 0, 0, 0);

                            const filter = guardianId
                                ? supabase
                                    .from('solicitacoes_retirada')
                                    .update({ status_geofence: 'CHEGOU', distancia_estimada_metros: 0 })
                                    .eq('responsavel_id', guardianId)
                                    .in('status', ['SOLICITADO', 'AGUARDANDO', 'LIBERADO'])
                                    .gte('horario_solicitacao', todayStart.toISOString())
                                : supabase
                                    .from('solicitacoes_retirada')
                                    .update({ status_geofence: 'CHEGOU', distancia_estimada_metros: 0 })
                                    .eq('id', pickup.id);

                            const { error } = await filter;
                            if (!error) {
                                toast.success('Chegada confirmada!', 'A escola foi notificada da sua chegada.');
                                fetchPickupStatus();
                            }
                        }}
                        className="w-full py-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-3xl font-black text-[10px] italic uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-4 shadow-2xl shadow-emerald-500/20 active:scale-95 group"
                    >
                        <CheckCircle className="w-5 h-5" />
                        Confirmar Chegada Manualmente
                    </button>
                    <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest text-center px-8 leading-relaxed opacity-50">
                        Use esta opção caso o GPS esteja indisponível ou você já esteja no local.
                    </p>
                </div>

                {/* Security info */}
                <section className="bg-white/[0.01] border border-white/5 rounded-[2rem] p-6 space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                            <ShieldCheck className="text-emerald-500 w-5 h-5" />
                        </div>
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verificação de Segurança</h3>
                    </div>

                    <div className="flex items-center justify-between bg-white/[0.03] p-5 rounded-2xl border border-white/5 relative overflow-hidden group">
                        <div className="flex items-center gap-5 relative z-10">
                            <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl bg-slate-900 flex items-center justify-center">
                                <User className="w-6 h-6 text-slate-700" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-tighter italic opacity-80">Responsável Autorizado</p>
                                <p className="text-sm font-black text-white uppercase italic tracking-tight">{guardianName}</p>
                            </div>
                        </div>
                        <CheckCircle className="w-6 h-6 text-emerald-500 relative z-10" />
                    </div>

                    <div className="flex items-start gap-4 px-2 opacity-50">
                        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter leading-relaxed italic">
                            Apresente seu QR Code na recepção para concluir a retirada com segurança.
                        </p>
                    </div>
                </section>

                {/* Footer */}
                <footer className="text-center pt-8 pb-20 space-y-4 opacity-30">
                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent w-full" />
                    <p className="text-[9px] text-slate-600 font-bold uppercase tracking-[0.4em]">SISRA // Sistema de Retirada Segura</p>
                </footer>
            </main>
        </div>
    );
}
