import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { User, ArrowRight, ShieldCheck, Loader2, Smartphone, Lock, CheckCircle2, Bell } from 'lucide-react';

export default function ParentLogin() {
    const toast = useToast();
    const [cpf, setCpf] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState<'CPF' | 'SELECT_STUDENT' | 'SUCCESS'>('CPF');
    const [students, setStudents] = useState<any[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [guardianName, setGuardianName] = useState('');
    const [guardianId, setGuardianId] = useState('');

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const cleanCpf = cpf.replace(/\D/g, '');

            const { data: responsavel, error: respError } = await supabase
                .from('responsaveis')
                .select('id, nome_completo')
                .eq('cpf', cleanCpf)
                .single();

            if (respError || !responsavel) {
                throw new Error('Responsável não encontrado. Verifique o CPF informado.');
            }

            setGuardianId(responsavel.id);
            setGuardianName(responsavel.nome_completo);

            const { data: links, error: linkError } = await supabase
                .from('alunos_responsaveis')
                .select(`
                    aluno:alunos (
                        id,
                        nome_completo,
                        turma,
                        foto_url,
                        escola_id
                    )
                `)
                .eq('responsavel_id', responsavel.id);

            if (linkError) throw linkError;

            if (!links || links.length === 0) {
                throw new Error('Identificamos seu CPF, mas não há estudantes vinculados a ele. Por favor, entre em contato com a secretaria da escola para regularizar seu cadastro.');
            }

            const foundStudents = links.map((l: any) => l.aluno);
            setStudents(foundStudents);
            setSelectedIds(new Set(foundStudents.map((s: any) => s.id)));
            setStep('SELECT_STUDENT');

            localStorage.setItem('sisra_parent_session', JSON.stringify({
                id: responsavel.id,
                nome: responsavel.nome_completo,
                cpf: cleanCpf
            }));

        } catch (err: any) {
            setError(err.message || 'Falha na verificação de sinal.');
        } finally {
            setLoading(false);
        }
    };

    const toggleStudent = (id: string) => {
        setSelectedIds((prev: Set<string>) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleCallStudents = async () => {
        if (selectedIds.size === 0 || sending) return;
        setSending(true);

        try {
            const requests = Array.from(selectedIds).map((id: string) => {
                const student = students.find((s: any) => s.id === id);
                if (!student) throw new Error('Falha de segurança: Tentativa de retirar aluno não vinculado.');

                return {
                    escola_id: student.escola_id || 'e6328325-1845-420a-b333-87a747953259',
                    aluno_id: id,
                    responsavel_id: guardianId,
                    recepcionista_id: null,
                    status: 'SOLICITADO',
                    tipo_solicitacao: 'ROTINA'
                };
            });

            const { error } = await supabase
                .from('solicitacoes_retirada')
                .insert(requests);

            if (error) throw error;

            toast.success(
                selectedIds.size === 1 ? 'Solicitação enviada!' : `${selectedIds.size} solicitações enviadas!`,
                'Aguarde a liberação na saída.'
            );
            setStep('SUCCESS');
        } catch (err: any) {
            toast.error('Erro ao solicitar', err.message || 'Tente novamente.');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 w-full max-w-full overflow-x-hidden relative selection:bg-blue-500/30 font-sans">
            {/* Ambient HUD Layer */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[70%] h-[70%] bg-blue-500/[0.03] blur-[120px] rounded-full animate-pulse-slow" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-indigo-500/[0.03] blur-[120px] rounded-full animate-pulse-slow" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
                <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent top-1/3 animate-scan opacity-30" />
            </div>

            <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-1000">
                {/* Brand Header */}
                <div className="text-center mb-10 space-y-4">
                    <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 mb-2">
                        <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Portal do Guardião v{__APP_VERSION__}</span>
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">Identificação de Acesso</h1>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center justify-center gap-2">
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                            Protocolo de Retirada Seguro
                        </p>
                    </div>
                </div>

                {/* Glassmorphism Logic Card */}
                <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 md:p-10 backdrop-blur-3xl shadow-2xl relative overflow-hidden group shadow-blue-900/40">
                    <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent top-0 animate-scan opacity-30" />

                    {step === 'CPF' ? (
                        <form onSubmit={handleSearch} className="space-y-8 relative z-10">
                            <div className="space-y-6">
                                <div className="space-y-3 group/input">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                                        <Lock className="w-3 h-3" />
                                        CPF do Responsável
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="cpf-input"
                                            type="text"
                                            value={cpf}
                                            onChange={(e) => setCpf(e.target.value)}
                                            placeholder="000.000.000-00"
                                            className="w-full bg-[#020617]/50 border border-white/5 rounded-2xl px-6 py-5 text-white font-mono text-xl placeholder:text-slate-700 focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all duration-500 text-center tracking-[0.1em]"
                                            required
                                        />
                                    </div>
                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest text-center mt-2 flex items-center justify-center gap-2">
                                        <ShieldCheck className="w-3 h-3 text-emerald-500/50" />
                                        Protocolo de Segurança SSL/TLS Ativo
                                    </p>
                                </div>
                            </div>

                            {error && (
                                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl animate-in fade-in slide-in-from-top-2">
                                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest text-center">
                                        {error}
                                    </p>
                                </div>
                            )}

                            <button
                                id="verify-button"
                                type="submit"
                                disabled={loading}
                                className="w-full relative group/btn overflow-hidden rounded-[2rem] py-5 px-8 bg-blue-600 border border-blue-400/30 hover:bg-blue-500 transition-all duration-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl shadow-blue-500/20"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-1000" />
                                <div className="relative z-10 flex items-center justify-center gap-4">
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 text-white animate-spin" />
                                            <span className="text-sm font-black text-white uppercase italic tracking-[0.2em]">Verificando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-sm font-black text-white uppercase italic tracking-[0.2em]">Verificar Identidade</span>
                                            <ArrowRight className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </div>
                            </button>
                        </form>
                    ) : step === 'SELECT_STUDENT' ? (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="text-center space-y-2">
                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Identidade Confirmada</p>
                                <h3 className="text-xl font-black text-white italic uppercase tracking-tight">{guardianName.split(' ')[0]}, quem você vai buscar?</h3>
                            </div>

                            <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                                {students.map((student) => {
                                    const isSelected = selectedIds.has(student.id);
                                    return (
                                        <button
                                            id={`student-${student.id}`}
                                            key={student.id}
                                            onClick={() => toggleStudent(student.id)}
                                            className={`w-full flex items-center gap-5 p-5 border-2 rounded-3xl transition-all duration-300 group relative overflow-hidden active:scale-[0.98] ${isSelected
                                                ? 'bg-blue-500/10 border-blue-500 shadow-lg shadow-blue-500/10'
                                                : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-blue-500/30'
                                                }`}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                            <div className={`relative w-14 h-14 rounded-2xl overflow-hidden border-2 transition-colors shadow-2xl ${isSelected ? 'border-blue-500' : 'border-white/10'}`}>
                                                {student.foto_url ? (
                                                    <img src={student.foto_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                                                        <User className="w-6 h-6 text-slate-500" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex-1 text-left relative z-10">
                                                <p className={`font-black transition-colors uppercase italic tracking-tighter text-lg ${isSelected ? 'text-blue-400' : 'text-white'}`}>{student.nome_completo}</p>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Unidade: {student.turma}</p>
                                            </div>

                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center border-2 transition-all duration-500 ${isSelected ? 'bg-blue-500 border-blue-400 text-white animate-in zoom-in' : 'border-white/10 text-transparent'}`}>
                                                <CheckCircle2 className="w-5 h-5 shadow-2xl" />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="space-y-4 pt-4 border-t border-white/5">
                                <button
                                    onClick={handleCallStudents}
                                    disabled={selectedIds.size === 0 || sending}
                                    className="w-full relative group/btn overflow-hidden rounded-[2rem] py-6 px-8 bg-blue-600 border border-blue-400/30 hover:bg-blue-500 transition-all duration-500 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-2xl shadow-blue-500/20"
                                >
                                    <div className="relative z-10 flex items-center justify-center gap-4">
                                        {sending ? (
                                            <>
                                                <Loader2 className="w-6 h-6 text-white animate-spin" />
                                                <span className="text-base font-black text-white uppercase italic tracking-[0.2em]">Processando...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Bell className="w-6 h-6 text-white group-hover:rotate-12 transition-transform" />
                                                <span className="text-base font-black text-white uppercase italic tracking-[0.2em]">
                                                    {selectedIds.size > 1 ? `Chamar ${selectedIds.size} Alunos` : 'Chamar Agora'}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </button>

                                <button
                                    onClick={() => setStep('CPF')}
                                    className="w-full py-4 text-slate-500 font-black text-[10px] uppercase tracking-[0.3em] hover:text-blue-400 transition-colors"
                                >
                                    Alterar Protocolo / Não sou eu
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-700 py-6 text-center">
                            <div className="relative mx-auto w-24 h-24 mb-6">
                                <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-2xl animate-pulse"></div>
                                <div className="relative w-full h-full bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/40">
                                    <CheckCircle2 className="w-12 h-12 text-white" />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter">Solicitação Concluída!</h3>
                                <p className="text-slate-400 text-sm font-bold uppercase tracking-widest leading-relaxed">
                                    Suas notificações foram enviadas.<br />
                                    Por favor, aguarde na área de saída.
                                </p>
                            </div>
                            <button
                                onClick={() => setStep('CPF')}
                                className="mt-8 px-10 py-4 bg-white/5 border border-white/10 rounded-2xl text-slate-400 font-black text-xs uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all active:scale-95"
                            >
                                Iniciar Nova Retirada
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer Telemetry */}
                <div className="mt-12 pt-8 border-t border-white/5 flex items-center justify-between opacity-50">
                    <div className="space-y-1">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block">Sistema de Retirada</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter italic">SISRA // v{__APP_VERSION__}</span>
                    </div>
                    <div className="text-right">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block">Status do Link</span>
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter flex items-center justify-end gap-1.5">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                            Estável
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
