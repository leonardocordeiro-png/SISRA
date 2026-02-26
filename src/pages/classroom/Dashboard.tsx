import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Bell, Clock, LogOut, Check, X, User as UserIcon, Volume2, VolumeX, Send, AlertTriangle, MessageSquare, ChevronRight, School, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import NavigationControls from '../../components/NavigationControls';
import PriorityPipeline from '../../components/classroom/PriorityPipeline';
import { useToast } from '../../components/ui/Toast';

type PickupRequest = {
    id: string;
    status: string;
    tipo_solicitacao: string;
    horario_solicitacao: string;
    aluno: {
        id: string;
        nome_completo: string;
        turma: string;
        sala: string;
        foto_url: string | null;
        observacoes: string | null;
    };
    mensagem_recepcao: string | null;
    status_geofence: string | null;
    distancia_estimada_metros: number | null;
};

export default function ClassroomDashboard() {
    const { user, signOut, role } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const [requests, setRequests] = useState<PickupRequest[]>([]);
    const [activeRequest, setActiveRequest] = useState<PickupRequest | null>(null);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [allClasses, setAllClasses] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState<string | 'TODAS'>('TODAS');
    const [customNote, setCustomNote] = useState('');
    const [sendingNote, setSendingNote] = useState(false);
    const [confirmPending, setConfirmPending] = useState<'AGUARDAR' | 'RECUSAR' | null>(null);
    const [escolaId, setEscolaId] = useState<string | undefined>();

    // Fetch teacher's assigned class or all classes if admin/coordinator
    useEffect(() => {
        if (user) {
            supabase
                .from('usuarios')
                .select('turma_atribuida, sala_atribuida, escola_id')
                .eq('id', user.id)
                .single()
                .then(({ data }) => {
                    if (data?.escola_id) {
                        setEscolaId(data.escola_id);
                    }

                    if (data?.sala_atribuida) {
                        setSelectedClass(data.sala_atribuida === 'TODAS' ? 'TODAS' : data.sala_atribuida);
                    } else if (data?.turma_atribuida) {
                        setSelectedClass(data.turma_atribuida);
                    } else if (role === 'ADMIN' || role === 'COORDENADOR') {
                        setSelectedClass('TODAS');
                    }
                });

            if (role === 'ADMIN' || role === 'COORDENADOR') {
                supabase
                    .from('alunos')
                    .select('turma, sala')
                    .then(({ data }) => {
                        if (data) {
                            const uniqueItems = Array.from(new Set([
                                ...data.map(a => a.sala).filter(Boolean)
                            ]))
                                .filter(item => item.startsWith('Sala '))
                                .sort();
                            setAllClasses(uniqueItems);
                        }
                    });
            }
        }
    }, [user, role]);

    const playNotificationSound = () => {
        // High quality notification sound
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.volume = 0.5;
        audio.play().catch(e => console.log('Audio play failed - ensure user interacted with page', e));
    };

    const handleSelectRequest = (req: PickupRequest) => {
        setActiveRequest(req);
    };

    const prevTotalRequestsRef = useRef(requests.length);

    // Sound notification logic when requests change
    useEffect(() => {
        if (requests.length > prevTotalRequestsRef.current) {
            if (soundEnabled) {
                playNotificationSound();
            }
        }
        prevTotalRequestsRef.current = requests.length;
    }, [requests.length, soundEnabled]);

    // Auto-select and details sync
    useEffect(() => {
        if (requests.length > 0) {
            if (!activeRequest) {
                const firstReq = requests[0];
                setTimeout(() => setActiveRequest(firstReq), 0);
            } else {
                const refreshed = requests.find(r => r.id === activeRequest.id);
                if (refreshed) {
                    // Update if details (like message) changed
                    if (JSON.stringify(refreshed) !== JSON.stringify(activeRequest)) {
                        setTimeout(() => setActiveRequest(refreshed), 0);
                    }
                } else {
                    // Previous active request is no longer in queue, pick the next first one
                    const nextReq = requests[0];
                    setTimeout(() => setActiveRequest(nextReq), 0);
                }
            }
        } else {
            if (activeRequest) {
                setTimeout(() => setActiveRequest(null), 0);
            }
        }
    }, [requests]);

    // Requests are handled by PriorityPipeline now

    const handleResponse = async (requestId: string, action: 'LIBERAR' | 'AGUARDAR' | 'RECUSAR') => {
        let newStatus = '';

        if (action === 'LIBERAR') newStatus = 'LIBERADO';
        if (action === 'AGUARDAR') newStatus = 'AGUARDANDO';
        if (action === 'RECUSAR') newStatus = 'CANCELADO';

        const { error } = await supabase
            .from('solicitacoes_retirada')
            .update({
                status: newStatus,
                professor_id: user?.id,
                horario_liberacao: action === 'LIBERAR' ? new Date().toISOString() : null
            })
            .eq('id', requestId);

        if (error) {
            toast.error('Erro ao atualizar status', error.message);
        }
    };

    const sendQuickNote = async (requestId: string, note: string) => {
        console.log('Sending note:', { requestId, note });
        setSendingNote(true);
        const { error } = await supabase
            .from('solicitacoes_retirada')
            .update({ mensagem_sala: note })
            .eq('id', requestId);

        if (!error) {
            console.log('Note sent successfully');
            setCustomNote('');
            // Toast or visual feedback would go here
        } else {
            console.error('Error sending note:', error);
            toast.error('Erro ao enviar nota', error.message);
        }
        setSendingNote(false);
    };

    const handleLogout = async () => {
        await signOut();
        navigate('/sala/login');
    };

    return (
        <div className="min-h-screen bg-[#020617] text-white flex flex-col font-sans selection:bg-emerald-500/30 overflow-hidden relative">
            {/* Ultra-Premium Ambient Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-emerald-500/10 blur-[180px] rounded-full animate-pulse-slow" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-600/10 blur-[200px] rounded-full animate-pulse-slow delay-1000" />

                {/* HUD Grid Overlay */}
                <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
            </div>

            <header className="px-6 md:px-10 py-5 border-b border-white/10 flex flex-col md:flex-row items-center justify-between sticky top-0 bg-[#020617]/80 backdrop-blur-3xl z-[60] no-print gap-6 shadow-2xl">
                <div className="flex flex-col md:flex-row items-center gap-6 md:gap-14 w-full md:w-auto">
                    <NavigationControls />

                    <div className="flex flex-col">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.9)]"></div>
                            <h1 className="text-2xl font-black tracking-tighter uppercase italic leading-none flex items-center gap-3">
                                <span className="text-slate-500">CONTROL</span>
                                <span className="text-white">CENTER</span>
                            </h1>
                        </div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] ml-5">Terminal Global • v{__APP_VERSION__}</p>
                    </div>

                    {(role === 'ADMIN' || role === 'COORDENADOR') && (
                        <div className="flex items-center gap-3 bg-white/5 p-1.5 rounded-[1.2rem] border border-white/10 backdrop-blur-xl shadow-inner">
                            <button
                                onClick={() => setSelectedClass('TODAS')}
                                className={`px-6 py-2.5 rounded-[0.9rem] text-[10px] font-black transition-all uppercase tracking-widest ${selectedClass === 'TODAS' ? 'bg-emerald-500 text-slate-950 shadow-[0_8px_20px_rgba(16,185,129,0.3)]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                            >
                                TODAS AS UNIDADES
                            </button>
                            <div className="relative group">
                                <select
                                    value={selectedClass}
                                    onChange={(e) => setSelectedClass(e.target.value)}
                                    className="appearance-none bg-white/5 border border-white/5 text-white text-[10px] font-black uppercase tracking-widest rounded-[0.9rem] pl-6 pr-10 py-2.5 hover:bg-white/10 transition-all outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer"
                                >
                                    <option value="TODAS" className="text-slate-900 bg-white">FILTRAR POR SALA</option>
                                    {allClasses.map(c => (
                                        <option key={c} value={c} className="text-slate-900 bg-white">{c}</option>
                                    ))}
                                </select>
                                <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none rotate-90" />
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-8">
                    {/* Advanced Monitoring HUD */}
                    <div className="hidden xl:flex items-center gap-8">
                        <div className="flex flex-col text-right">
                            <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1.5 opacity-70">Integridade da Fila</p>
                            <div className="flex items-center justify-end gap-3">
                                <div className="flex -space-x-2">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="w-5 h-5 rounded-full border-2 border-[#020617] bg-slate-800 flex items-center justify-center">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500/40" />
                                        </div>
                                    ))}
                                </div>
                                <span className="text-2xl font-black italic tracking-tighter leading-none text-white">{requests.length}</span>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">SOLICITAÇÕES</span>
                            </div>
                        </div>

                        <div className="h-10 w-px bg-white/5" />

                        <div className="flex flex-col text-right">
                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1.5 opacity-70">Uptime do Sistema</p>
                            <div className="flex items-center justify-end gap-2 text-blue-100 font-black italic tracking-tighter">
                                <span className="text-2xl leading-none">99.9%</span>
                                <span className="text-[10px] text-slate-500 uppercase tracking-widest">SAÚDE</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSoundEnabled(!soundEnabled)}
                            className={`p-4 rounded-[1.2rem] transition-all border-2 ${soundEnabled ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 shadow-xl shadow-emerald-500/10' : 'bg-slate-900/50 border-white/5 text-slate-600'}`}
                        >
                            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                        </button>
                        <button onClick={handleLogout} className="p-4 bg-rose-500/10 border-2 border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white rounded-[1.2rem] transition-all shadow-xl shadow-rose-500/10">
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative z-10">
                {/* Priority Pipeline (Left Sidebar) */}
                <PriorityPipeline
                    userId={user?.id || ''}
                    selectedClass={selectedClass}
                    activeRequestId={activeRequest?.id}
                    onSelectRequest={handleSelectRequest}
                    onQueueChange={(reqs) => setRequests(reqs)}
                    escolaId={escolaId}
                />

                {/* Focus Spotlight (Main Content) */}
                <div className="flex-1 relative flex flex-col justify-center items-center p-4 md:p-8 xl:p-16 overflow-y-auto w-full custom-scrollbar">
                    {activeRequest ? (
                        <div className="w-full max-w-6xl animate-in fade-in zoom-in-95 duration-700">
                            {/* Spotlight Main Engine Card */}
                            <div className="relative bg-white/[0.03] border border-white/10 rounded-[2.5rem] md:rounded-[4rem] p-6 md:p-8 xl:p-12 backdrop-blur-3xl shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col lg:flex-row items-center gap-8 md:gap-10 xl:gap-16 ring-1 ring-white/5 overflow-hidden">

                                {/* UI HUD Elements (Decorative) */}
                                <div className="absolute top-12 left-12 opacity-20 hidden lg:block">
                                    <div className="flex flex-col gap-2">
                                        <div className="w-32 h-1.5 bg-white/20 rounded-full overflow-hidden">
                                            <div className="w-2/3 h-full bg-emerald-500 animate-pulse"></div>
                                        </div>
                                        <div className="w-20 h-1 bg-white/10 rounded-full"></div>
                                    </div>
                                </div>
                                <div className="absolute bottom-12 right-12 text-[8px] font-black text-white/5 uppercase tracking-[0.5em] hidden lg:block vertical-text">
                                    SISRA • TERMINAL • OPS
                                </div>

                                {/* Student Visual Core */}
                                <div className="relative group shrink-0">
                                    <div className="absolute -inset-12 bg-emerald-500/20 rounded-full blur-[80px] opacity-40 group-hover:opacity-70 transition-all duration-1000 animate-pulse"></div>
                                    <div className="relative w-56 h-56 md:w-[260px] md:h-[260px] xl:w-[320px] xl:h-[320px] bg-slate-900 rounded-[3rem] md:rounded-[4rem] border-[8px] border-white/5 overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)] p-2.5 group-hover:border-emerald-500/20 transition-all duration-700">
                                        <div className="w-full h-full rounded-[3rem] md:rounded-[5rem] overflow-hidden bg-slate-800 relative">
                                            {activeRequest.aluno.foto_url ? (
                                                <img src={activeRequest.aluno.foto_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <UserIcon className="w-40 h-40 text-slate-700 group-hover:text-emerald-500/30 transition-colors" />
                                                </div>
                                            )}

                                            {/* Photo HUD Overlay */}
                                            <div className="absolute inset-0 border-[2px] border-white/5 rounded-[3rem] md:rounded-[5rem] pointer-events-none"></div>
                                            <div className="absolute top-8 right-8 w-12 h-12 rounded-2xl bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all">
                                                <UserIcon className="w-6 h-6" />
                                            </div>
                                        </div>

                                        {activeRequest.tipo_solicitacao === 'EMERGENCIA' && (
                                            <div className="absolute top-10 left-10 right-10">
                                                <div className="bg-rose-500 text-white py-3 px-6 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 shadow-[0_15px_40px_rgba(244,63,94,0.5)] animate-bounce">
                                                    <AlertTriangle className="w-4 h-4" /> PRIORIDADE CRÍTICA
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Student Information Engine */}
                                <div className="flex-1 min-w-0 text-center lg:text-left space-y-8 xl:space-y-12 relative">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-center lg:justify-start gap-4 flex-wrap">
                                            <div className="px-5 py-2 bg-emerald-500 text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-[0.3em] shadow-[0_8px_20px_rgba(16,185,129,0.3)]">
                                                TRANSMISSÃO SCT ATIVA
                                            </div>
                                            {activeRequest.aluno.observacoes && (
                                                <div className="px-5 py-2 bg-rose-500/20 text-rose-500 border-2 border-rose-500/30 rounded-xl text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping"></div>
                                                    ALERTA MÉDICO
                                                </div>
                                            )}
                                        </div>

                                        <h2 className="text-3xl md:text-4xl lg:text-5xl xl:text-7xl font-black tracking-tighter leading-[0.9] text-white italic uppercase break-words">
                                            {activeRequest.aluno.nome_completo.split(' ')[0]}<br />
                                            <span className="text-emerald-500 drop-shadow-[0_0_30px_rgba(16,185,129,0.2)]">{activeRequest.aluno.nome_completo.split(' ').slice(1).join(' ')}</span>
                                        </h2>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-6 lg:gap-10">
                                        <div className="flex flex-col items-center lg:items-start shrink-0">
                                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-2">Localização</h3>
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center shadow-inner group-hover:border-emerald-500/50 transition-all">
                                                    <School className="w-6 h-6 text-emerald-500" />
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-xl font-black italic tracking-tighter text-white leading-none mb-1">{activeRequest.aluno.sala}</p>
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{activeRequest.aluno.turma}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="h-10 w-px bg-white/10 hidden lg:block" />

                                        <div className="flex flex-col items-center lg:items-start shrink-0">
                                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-2">Status Portaria</h3>
                                            {activeRequest.status_geofence === 'CHEGOU' ? (
                                                <div className="bg-emerald-500/20 px-5 py-2.5 rounded-2xl border-2 border-emerald-500/30 flex items-center gap-3">
                                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping shadow-[0_0_10px_rgba(16,185,129,1)]"></div>
                                                    <span className="text-xs font-black italic text-emerald-400 uppercase tracking-tight">RESPONSÁVEL NO LOCAL</span>
                                                </div>
                                            ) : (
                                                <div className="bg-white/5 px-5 py-2.5 rounded-2xl border-2 border-white/5 flex items-center gap-3">
                                                    <Clock className="w-4 h-4 text-slate-500" />
                                                    <span className="text-xs font-black italic text-slate-500 uppercase tracking-tight">EM DESLOCAMENTO</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {activeRequest.mensagem_recepcao && (
                                        <div className="relative p-8 bg-blue-600/10 border-2 border-blue-500/20 rounded-[3rem] flex items-start gap-6 overflow-hidden group/msg transition-all hover:bg-blue-600/15">
                                            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover/msg:scale-150 transition-transform duration-1000">
                                                <MessageSquare className="w-24 h-24 text-blue-500" />
                                            </div>
                                            <div className="relative text-left">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">Nota da Unidade Central</p>
                                                </div>
                                                <p className="text-3xl font-black italic text-blue-50 font-serif leading-tight">
                                                    <span className="text-blue-500/40 text-4xl mr-2">"</span>
                                                    {activeRequest.mensagem_recepcao}
                                                    <span className="text-blue-500/40 text-4xl ml-2">"</span>
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Control Interface Hub */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-10">
                                <div className="lg:col-span-8 bg-white/[0.03] border border-white/10 rounded-[3.5rem] p-10 flex flex-col gap-10 backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[50px] group-hover:bg-emerald-500/10 transition-all duration-1000"></div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] flex items-center gap-3">
                                                <Send className="w-5 h-5 text-emerald-500" /> Atualização de Status da Missão
                                            </h3>
                                            <p className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em] ml-8">Transmissão em tempo real para a recepção</p>
                                        </div>
                                        <div className="bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                                            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Canal Criptografado</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        {['A caminho', 'Lanchando', 'No banheiro', 'Em atendimento'].map(note => (
                                            <button
                                                key={note}
                                                onClick={() => sendQuickNote(activeRequest.id, note)}
                                                disabled={sendingNote}
                                                className="group/note relative py-5 flex items-center justify-center bg-white/5 hover:bg-emerald-500 border border-white/5 rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] transition-all disabled:opacity-50 overflow-hidden px-1"
                                            >
                                                <span className="relative z-10 text-white group-hover/note:text-slate-950 transition-colors">{note}</span>
                                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/note:translate-y-0 transition-transform duration-300"></div>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="relative group/input">
                                        <div className="absolute inset-x-8 -top-8 bottom-0 bg-emerald-500/5 blur-3xl opacity-0 group-focus-within/input:opacity-100 transition-all duration-1000"></div>
                                        <input
                                            value={customNote}
                                            onChange={(e) => setCustomNote(e.target.value)}
                                            className="w-full bg-[#050a18]/60 border-2 border-white/5 rounded-[2.5rem] py-7 px-10 text-xl md:text-2xl focus:border-emerald-500/50 focus:bg-[#050a18]/80 outline-none transition-all font-black placeholder:text-slate-700 placeholder:text-lg italic pr-24 shadow-2xl"
                                            placeholder="Transmitir mensagem personalizada..."
                                            onKeyPress={(e) => e.key === 'Enter' && sendQuickNote(activeRequest.id, customNote)}
                                        />
                                        <button
                                            onClick={() => sendQuickNote(activeRequest.id, customNote)}
                                            disabled={sendingNote || !customNote}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 bg-emerald-500 w-16 h-16 rounded-[1.8rem] text-slate-950 hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/30 disabled:opacity-20 flex items-center justify-center group/send"
                                        >
                                            {sendingNote ? <Loader2 className="w-7 h-7 animate-spin" /> : <Send className="w-7 h-7 group-hover/send:translate-x-1 group-hover/send:-translate-y-1 transition-transform" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="lg:col-span-4 flex flex-col gap-6">
                                    <button
                                        onClick={() => handleResponse(activeRequest.id, 'LIBERAR')}
                                        className="flex-1 group relative py-10 bg-emerald-600 hover:bg-emerald-500 text-slate-950 rounded-[3.5rem] transition-all flex flex-col items-center justify-center gap-4 overflow-hidden shadow-[0_25px_60px_rgba(16,185,129,0.3)] border-b-4 border-emerald-800 min-h-[180px]"
                                    >
                                        <div className="relative z-10 flex flex-col items-center justify-center gap-4">
                                            <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center group-hover:scale-110 transition-transform duration-500 border-4 border-white/10">
                                                <Check className="w-10 h-10 text-white" />
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <span className="text-xs font-black uppercase tracking-[0.4em] mb-1">FINALIZAR &amp;</span>
                                                <span className="text-2xl font-black italic tracking-tighter">LIBERAR ALUNO</span>
                                            </div>
                                        </div>
                                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                                    </button>

                                    <div className="grid grid-cols-2 gap-6 h-56">
                                        <button
                                            onClick={() => {
                                                if (confirmPending === 'AGUARDAR') {
                                                    handleResponse(activeRequest.id, 'AGUARDAR');
                                                    setConfirmPending(null);
                                                } else {
                                                    setConfirmPending('AGUARDAR');
                                                    setTimeout(() => setConfirmPending(prev => prev === 'AGUARDAR' ? null : prev), 3000);
                                                }
                                            }}
                                            className={`border-2 rounded-[3rem] transition-all flex flex-col items-center justify-center gap-4 overflow-hidden relative shadow-xl ${confirmPending === 'AGUARDAR'
                                                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                                                    : 'bg-white/5 hover:bg-white/10 border-white/5 group/wait'
                                                }`}
                                        >
                                            <div className={`p-4 rounded-2xl transition-all border border-white/10 relative z-10 ${confirmPending === 'AGUARDAR' ? 'bg-amber-500/30 text-amber-400' : 'bg-slate-800/80 group-hover/wait:bg-emerald-500/20 group-hover/wait:text-emerald-500'
                                                }`}>
                                                <Clock className="w-7 h-7" />
                                            </div>
                                            <span className={`text-[11px] font-black uppercase tracking-widest relative z-10 ${confirmPending === 'AGUARDAR' ? 'text-amber-400' : 'text-slate-400 group-hover/wait:text-white'
                                                }`}>
                                                {confirmPending === 'AGUARDAR' ? 'CONFIRMAR?' : 'AGUARDAR'}
                                            </span>
                                            <div className="absolute inset-0 bg-emerald-500/5 translate-x-full group-hover/wait:translate-x-0 transition-transform duration-500"></div>
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (confirmPending === 'RECUSAR') {
                                                    handleResponse(activeRequest.id, 'RECUSAR');
                                                    setConfirmPending(null);
                                                } else {
                                                    setConfirmPending('RECUSAR');
                                                    setTimeout(() => setConfirmPending(prev => prev === 'RECUSAR' ? null : prev), 3000);
                                                }
                                            }}
                                            className={`border-2 rounded-[3rem] transition-all flex flex-col items-center justify-center gap-4 overflow-hidden relative shadow-xl ${confirmPending === 'RECUSAR'
                                                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                                                    : 'bg-white/5 hover:bg-rose-500/10 border-white/5 hover:border-rose-500/30 group/cancel'
                                                }`}
                                        >
                                            <div className={`p-4 rounded-2xl transition-all border border-white/10 relative z-10 ${confirmPending === 'RECUSAR' ? 'bg-rose-500/30 text-rose-400' : 'bg-slate-800/80 group-hover/cancel:bg-rose-500/20 group-hover/cancel:text-rose-500'
                                                }`}>
                                                <X className="w-7 h-7" />
                                            </div>
                                            <span className={`text-[11px] font-black uppercase tracking-widest relative z-10 ${confirmPending === 'RECUSAR' ? 'text-rose-400' : 'text-slate-400 group-hover/cancel:text-rose-500'
                                                }`}>
                                                {confirmPending === 'RECUSAR' ? 'CONFIRMAR?' : 'REJEITAR'}
                                            </span>
                                            <div className="absolute inset-0 bg-rose-500/5 -translate-x-full group-hover/cancel:translate-x-0 transition-transform duration-500"></div>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center space-y-12 animate-in fade-in zoom-in-95 duration-1000 relative">
                            {/* Decorative Orbitals */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-white/5 rounded-full animate-[spin_60s_linear_infinite]" />
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-white/[0.03] rounded-full animate-[spin_40s_linear_infinite_reverse]" />

                            <div className="relative mx-auto w-64 h-64 md:w-80 md:h-80 group">
                                <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-[80px] animate-pulse"></div>
                                <div className="relative w-full h-full bg-slate-900 border-4 border-white/10 rounded-full flex flex-col items-center justify-center backdrop-blur-3xl shadow-2xl overflow-hidden ring-px ring-white/5 group-hover:border-emerald-500/30 transition-all duration-700">
                                    <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/5 to-transparent"></div>
                                    <Bell className="w-24 h-24 md:w-32 md:h-32 text-slate-700 group-hover:text-emerald-500 transition-all duration-700 animate-[bounce_3s_infinite]" />

                                    {/* Scanning Line */}
                                    <div className="absolute inset-x-0 h-4 bg-emerald-500/20 blur-xl animate-[scan_3s_linear_infinite]" />
                                </div>
                            </div>
                            <div className="relative space-y-4">
                                <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter uppercase italic leading-none">
                                    Aguardando <br />
                                    <span className="text-emerald-500">Transmissão</span>
                                </h2>
                                <div className="flex items-center justify-center gap-3 bg-white/5 px-6 py-2 rounded-full border border-white/5 w-fit mx-auto backdrop-blur-md">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                                    <p className="text-slate-500 text-xs font-black uppercase tracking-[0.4em]">Varredura Ativa</p>
                                </div>
                                <p className="text-slate-400 text-base font-medium max-w-md mx-auto leading-relaxed border-t border-white/10 pt-6 mt-6 opacity-60">
                                    Varredura em tempo real por novas solicitações de retirada via geofencing e portaria central.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
