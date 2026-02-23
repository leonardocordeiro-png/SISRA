import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Bell, Clock, LogOut, Check, X, User as UserIcon, Volume2, VolumeX, Send, AlertTriangle, MessageSquare } from 'lucide-react';
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
        foto_url: string;
        observacoes?: string;
    };
    mensagem_recepcao?: string;
    status_geofence?: string;
    distancia_estimada_metros?: number;
};

export default function ClassroomDashboard() {
    const { user, signOut, role } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const [requests, setRequests] = useState<PickupRequest[]>([]);
    const [activeRequest, setActiveRequest] = useState<PickupRequest | null>(null);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [teacherClass, setTeacherClass] = useState<string | null>(null);
    const [allClasses, setAllClasses] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState<string | 'TODAS'>('TODAS');
    const [customNote, setCustomNote] = useState('');
    const [sendingNote, setSendingNote] = useState(false);
    const [escolaId, setEscolaId] = useState<string | undefined>();
    const [prevTotalRequests, setPrevTotalRequests] = useState(0);

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
                        setTeacherClass(data.sala_atribuida);
                        setSelectedClass(data.sala_atribuida === 'TODAS' ? 'TODAS' : data.sala_atribuida);
                    } else if (data?.turma_atribuida) {
                        setTeacherClass(data.turma_atribuida);
                        setSelectedClass(data.turma_atribuida);
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

    // Sound notification logic when requests change
    useEffect(() => {
        if (requests.length > prevTotalRequests) {
            if (soundEnabled) {
                playNotificationSound();
            }
        }
        setPrevTotalRequests(requests.length);
    }, [requests.length, soundEnabled]);

    // Auto-select and details sync
    useEffect(() => {
        if (requests.length > 0) {
            if (!activeRequest) {
                setActiveRequest(requests[0]);
            } else {
                const refreshed = requests.find(r => r.id === activeRequest.id);
                if (refreshed) {
                    // Update if details (like message) changed
                    if (JSON.stringify(refreshed) !== JSON.stringify(activeRequest)) {
                        setActiveRequest(refreshed);
                    }
                } else {
                    // Previous active request is no longer in queue, pick the next first one
                    setActiveRequest(requests[0]);
                }
            }
        } else {
            setActiveRequest(null);
        }
    }, [requests]);

    // Handle Request Selection from Pipeline
    const handleSelectRequest = (req: any) => {
        setActiveRequest(req);
    };

    const playNotificationSound = () => {
        // High quality notification sound
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.volume = 0.5;
        audio.play().catch(e => console.log('Audio play failed - ensure user interacted with page', e));
    };

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
        <div className="min-h-screen bg-[#0f172a] text-white flex flex-col font-sans selection:bg-emerald-500/30 overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full" />
            </div>

            <header className="px-8 py-5 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[#0f172a]/80 backdrop-blur-xl z-[60] no-print">
                <div className="flex items-center gap-12">
                    <NavigationControls />
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-0.5">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                            <h1 className="text-xl font-black tracking-tight uppercase italic">
                                {(role === 'ADMIN' || role === 'COORDENADOR')
                                    ? (selectedClass === 'TODAS' ? 'Central de Controle' : selectedClass)
                                    : (teacherClass || 'Terminal SCT')}
                            </h1>
                        </div>
                    </div>

                    {(role === 'ADMIN' || role === 'COORDENADOR') && (
                        <div className="flex items-center gap-3 bg-white/5 p-1 rounded-2xl border border-white/10 backdrop-blur-md">
                            <button
                                onClick={() => setSelectedClass('TODAS')}
                                className={`px-5 py-2 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest ${selectedClass === 'TODAS' ? 'bg-emerald-500 text-slate-900 shadow-xl shadow-emerald-500/20' : 'text-slate-400 hover:text-white'}`}
                            >
                                TODAS
                            </button>
                            <select
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                className="bg-white/5 border border-white/10 text-white text-xs font-black uppercase tracking-widest rounded-xl px-4 py-2 hover:bg-white/10 transition-all outline-none focus:ring-2 focus:ring-emerald-500/50"
                            >
                                <option value="TODAS" className="text-slate-900 bg-white">TODAS AS SALAS / TURMAS</option>
                                {allClasses.map(c => (
                                    <option key={c} value={c} className="text-slate-900 bg-white">{c}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-6">
                    <div className="hidden lg:flex flex-col text-right">
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Status da Fila</p>
                        <div className="flex items-center justify-end gap-2">
                            <span className="text-2xl font-black italic tracking-tighter leading-none">{requests.length}</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Pendente(s)</span>
                        </div>
                    </div>

                    <div className="w-px h-10 bg-white/10 mx-2"></div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSoundEnabled(!soundEnabled)}
                            className={`p-3.5 rounded-2xl transition-all border ${soundEnabled ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 shadow-lg shadow-emerald-500/5' : 'bg-slate-800/50 border-white/5 text-slate-500'}`}
                        >
                            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                        </button>
                        <button onClick={handleLogout} className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white rounded-2xl transition-all shadow-lg shadow-rose-500/5">
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 flex overflow-hidden">
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
                <div className="flex-1 relative flex flex-col justify-center items-center p-12 overflow-y-auto">
                    {activeRequest ? (
                        <div className="w-full max-w-5xl animate-in fade-in slide-in-from-right-8 duration-500">
                            {/* Spotlight Header Card */}
                            <div className="relative bg-white/5 border border-white/10 rounded-[4rem] p-12 backdrop-blur-3xl shadow-3xl flex flex-col lg:flex-row items-center gap-16 overflow-hidden">
                                {/* Geometric Accents */}
                                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full -mr-32 -mt-32"></div>
                                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full -ml-32 -mb-32"></div>

                                <div className="relative group shrink-0">
                                    <div className="absolute -inset-8 bg-emerald-500/20 rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity"></div>
                                    <div className="relative w-64 h-64 md:w-80 md:h-80 bg-slate-900 rounded-[3rem] border-8 border-white/5 overflow-hidden shadow-2xl p-2 group-hover:border-emerald-500/20 transition-all duration-500">
                                        <div className="w-full h-full rounded-[2.2rem] overflow-hidden bg-slate-800">
                                            {activeRequest.aluno.foto_url ? (
                                                <img src={activeRequest.aluno.foto_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <UserIcon className="w-32 h-32 text-slate-700 group-hover:text-emerald-500/40 transition-colors" />
                                                </div>
                                            )}
                                        </div>

                                        {activeRequest.tipo_solicitacao === 'EMERGENCIA' && (
                                            <div className="absolute top-6 left-6 right-6">
                                                <div className="bg-rose-500 text-white py-2 px-4 rounded-full text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-2xl shadow-rose-500/50 animate-pulse">
                                                    <AlertTriangle className="w-3 h-3" /> EMERGÊNCIA
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex-1 text-center lg:text-left space-y-8 relative">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-center lg:justify-start gap-4">
                                            <span className="px-4 py-1.5 bg-emerald-500 text-slate-900 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/20">Aluno Ativo</span>
                                            {activeRequest.aluno.observacoes && (
                                                <span className="px-4 py-1.5 bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">Médico/Alerta</span>
                                            )}
                                        </div>
                                        <h2 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] text-white italic">
                                            {activeRequest.aluno.nome_completo.split(' ')[0]}<br />
                                            <span className="text-emerald-500">{activeRequest.aluno.nome_completo.split(' ').slice(1).join(' ')}</span>
                                        </h2>
                                    </div>

                                    <div className="flex flex-col">
                                        <h3 className="text-xl font-black italic tracking-tighter text-emerald-500 mb-1">DESTAQUE</h3>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">SALA DE CONTROLE</span>
                                            </div>
                                            <span className="text-slate-500 py-1 font-bold text-[10px] uppercase tracking-widest px-3 border-l border-white/10">
                                                {activeRequest.aluno.turma} • {activeRequest.aluno.sala}
                                            </span>
                                        </div>
                                    </div>

                                    {activeRequest.mensagem_recepcao && (
                                        <div className="relative p-6 bg-blue-500/10 border border-blue-500/20 rounded-[2.5rem] flex items-start gap-4 overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-150 transition-transform duration-700">
                                                <MessageSquare className="w-16 h-16 text-blue-500" />
                                            </div>
                                            <div className="relative">
                                                <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-2">Nota Interna da Recepção</p>
                                                <p className="text-2xl font-black italic text-blue-100 leading-tight">"{activeRequest.mensagem_recepcao}"</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* HUD - Arrival Alert (Fixed Size) */}
                                    <div className="absolute top-0 right-12 mt-12 w-80">
                                        {activeRequest.status_geofence === 'CHEGOU' ? (
                                            <div className="bg-emerald-500/90 backdrop-blur-md text-slate-900 px-6 py-4 rounded-3xl flex items-center gap-4 shadow-2xl border border-white/20 animate-in slide-in-from-top-4 duration-500">
                                                <div className="bg-white/30 p-2 rounded-xl">
                                                    <Check className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-80 leading-none mb-1">Status Portaria</p>
                                                    <p className="text-sm font-black italic leading-tight uppercase">RESPONSÁVEL NA PORTA</p>
                                                </div>
                                            </div>
                                        ) : (activeRequest.status_geofence === 'LONGE' || (activeRequest.distancia_estimada_metros && activeRequest.distancia_estimada_metros > 1000)) ? (
                                            <div className="bg-amber-500/80 backdrop-blur-md text-black px-6 py-4 rounded-3xl flex items-center gap-4 shadow-2xl border border-white/10 opacity-60">
                                                <div className="bg-white/20 p-2 rounded-xl text-amber-900">
                                                    <AlertTriangle className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-80 leading-none mb-1">Posição Pai/Mãe</p>
                                                    <p className="text-xs font-black italic leading-tight uppercase">RESPONSÁVEL EM TRÂNSITO</p>
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </div>

                            {/* Control Interface */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
                                <div className="lg:col-span-8 bg-white/5 border border-white/10 rounded-[3rem] p-10 flex flex-col gap-8 backdrop-blur-xl">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3">
                                            <Send className="w-5 h-5 text-emerald-500" /> Notas Rápidas do Despachante
                                        </h3>
                                        <div className="flex gap-1">
                                            <div className="w-1 h-1 bg-emerald-500 rounded-full animate-ping"></div>
                                            <div className="w-1 h-1 bg-emerald-500/50 rounded-full"></div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-3">
                                        {['A caminho', 'Terminando lanche', 'No banheiro', 'Em atendimento'].map(note => (
                                            <div key={note} className="flex-1">
                                                <button
                                                    onClick={() => sendQuickNote(activeRequest.id, note)}
                                                    disabled={sendingNote}
                                                    className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                                >
                                                    {note === 'Liberando agora' ? 'Liberando' :
                                                        note === 'Já desceu' ? 'Já desceu' :
                                                            note === 'Em 5 minutos' ? '5 min' : note}
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="relative">
                                        <input
                                            value={customNote}
                                            onChange={(e) => setCustomNote(e.target.value)}
                                            className="w-full bg-[#0a0f1d] border-2 border-white/5 rounded-[2rem] py-6 px-10 text-xl focus:border-emerald-500/50 focus:ring-0 transition-all font-black placeholder:text-white/10 italic"
                                            placeholder="Transmitir dados de missão personalizados..."
                                            onKeyPress={(e) => e.key === 'Enter' && sendQuickNote(activeRequest.id, customNote)}
                                        />
                                        <button
                                            onClick={() => sendQuickNote(activeRequest.id, customNote)}
                                            disabled={sendingNote || !customNote}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 bg-emerald-500 p-4 rounded-2xl text-slate-900 hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-30 disabled:grayscale"
                                        >
                                            <Send className="w-6 h-6" />
                                        </button>
                                    </div>
                                </div>

                                <div className="lg:col-span-4 flex flex-col gap-4">
                                    <button
                                        onClick={() => handleResponse(activeRequest.id, 'LIBERAR')}
                                        className="flex-1 group relative py-8 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.3em] transition-all flex flex-col items-center justify-center gap-4 overflow-hidden shadow-2xl shadow-emerald-500/20"
                                    >
                                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                                        <div className="relative flex flex-col items-center gap-3">
                                            <Check className="w-8 h-8" />
                                            <span>LIBERAR AGORA</span>
                                        </div>
                                    </button>

                                    <div className="grid grid-cols-2 gap-4 h-48">
                                        <button
                                            onClick={() => handleResponse(activeRequest.id, 'AGUARDAR')}
                                            className="px-12 bg-white/5 hover:bg-white/10 border border-white/10 rounded-[2.5rem] font-black text-[10px] uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-3"
                                        >
                                            <Clock className="w-5 h-5 opacity-40" />
                                            <span>AGUARDAR</span>
                                        </button>
                                        <button
                                            onClick={() => handleResponse(activeRequest.id, 'RECUSAR')}
                                            className="bg-white/5 border border-white/10 hover:border-rose-500/30 hover:bg-rose-500/10 rounded-[2.5rem] flex flex-col items-center justify-center gap-2 transition-all group"
                                        >
                                            <X className="w-8 h-8 text-rose-500 group-hover:scale-110 transition-transform" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white">RECUSAR</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center space-y-8 animate-in fade-in zoom-in-95 duration-700">
                            <div className="relative mx-auto w-48 h-48">
                                <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-3xl animate-pulse"></div>
                                <div className="relative w-48 h-48 bg-slate-800/50 border border-white/10 rounded-full flex items-center justify-center backdrop-blur-xl">
                                    <Bell className="w-20 h-20 text-slate-600 animate-bounce" />
                                </div>
                            </div>
                            <div>
                                <h2 className="text-4xl font-black text-slate-200 tracking-tight uppercase italic mb-3">Aguardando Transmissão</h2>
                                <p className="text-slate-500 text-lg font-medium max-w-sm mx-auto leading-relaxed uppercase tracking-widest text-[10px]">Varredura em tempo real por novas solicitações...</p>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
