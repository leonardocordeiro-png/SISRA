import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shield, Loader2, ArrowRight, AlertCircle, GraduationCap, Calendar, CheckCircle2, UserSearch } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import GuardianRegistrationFlow from '../../components/parent/GuardianRegistrationFlow';
import {
    identifyStudentByMatricula,
    registerGuardianByMatricula,
    lookupAutocadastroGuardianByCpf,
} from '../../lib/publicApi';

export default function SelfRegistrationByMatricula() {
    const { escolaId } = useParams<{ escolaId: string }>();
    const navigate = useNavigate();
    const toast = useToast();

    const [step, setStep] = useState<'identify' | 'register'>('identify');
    const [matricula, setMatricula] = useState('');
    const [dataNascimento, setDataNascimento] = useState('');
    const [identifying, setIdentifying] = useState(false);
    const [confirmedStudent, setConfirmedStudent] = useState<{ nome_mascarado: string; turma: string | null } | null>(null);

    const handleIdentify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!escolaId) {
            toast.error('QR inválido', 'Código da escola ausente. Escaneie o QR da recepção novamente.');
            return;
        }
        setIdentifying(true);
        try {
            const { student, error } = await identifyStudentByMatricula({
                escolaId,
                matricula: matricula.trim(),
                dataNascimento,
            });

            if (error === 'BLOQUEADO') {
                toast.error('Muitas tentativas', 'Aguarde alguns minutos antes de tentar novamente.');
                return;
            }
            if (error === 'CADASTRO_INCOMPLETO') {
                toast.error('Cadastro do aluno incompleto', 'A data de nascimento do aluno não está cadastrada. Procure a secretaria da escola.');
                return;
            }
            if (!student) {
                toast.error('Não encontrado', 'Matrícula ou data de nascimento incorretas. Confira os dados e tente novamente.');
                return;
            }

            setConfirmedStudent(student);
        } catch (err: any) {
            toast.error('Erro ao identificar', err.message);
        } finally {
            setIdentifying(false);
        }
    };

    // Step 2: guardian registration (only after the student is confirmed)
    if (step === 'register' && confirmedStudent) {
        return (
            <GuardianRegistrationFlow
                studentName={confirmedStudent.nome_mascarado}
                onRegister={async (input) => {
                    const { guardian } = await registerGuardianByMatricula({
                        escolaId: escolaId!,
                        matricula: matricula.trim(),
                        dataNascimento,
                        ...input,
                    });
                    return guardian;
                }}
                onLookupCpf={async (cpf) => {
                    const { guardian } = await lookupAutocadastroGuardianByCpf(escolaId!, cpf);
                    return guardian
                        ? { nome_completo: guardian.nome_completo, telefone: guardian.telefone, foto_url: guardian.foto_url }
                        : null;
                }}
            />
        );
    }

    if (!escolaId) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-200 text-center max-w-md">
                    <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 mb-2">QR inválido</h2>
                    <p className="text-slate-500 mb-8">Escaneie o QR de cadastro disponível na recepção da escola.</p>
                    <button onClick={() => navigate('/')} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold uppercase tracking-widest text-xs">
                        Voltar ao Início
                    </button>
                </div>
            </div>
        );
    }

    // Step 1: identify student by matrícula + birthdate
    return (
        <div className="min-h-screen bg-slate-50 font-display p-4 md:p-8">
            <div className="max-w-md mx-auto">
                <div className="mb-10 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-4">
                        <Shield className="w-3 h-3" /> Auto-cadastro Seguro
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight italic">Cadastro de Responsável</h1>
                    <p className="text-slate-500 font-medium italic">Identifique o aluno para iniciar seu cadastro como responsável autorizado.</p>
                </div>

                <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/60 border border-slate-200/60 overflow-hidden p-8 md:p-10">
                    {confirmedStudent ? (
                        <div className="text-center animate-in zoom-in duration-300">
                            <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                <CheckCircle2 className="w-10 h-10" />
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Aluno localizado</p>
                            <h2 className="text-2xl font-black text-slate-900 mb-1">{confirmedStudent.nome_mascarado}</h2>
                            {confirmedStudent.turma && (
                                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mb-8">Turma {confirmedStudent.turma}</p>
                            )}
                            <p className="text-slate-500 text-sm mb-8">É este o aluno que você vai retirar? Confirme para cadastrar seus dados.</p>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => setStep('register')}
                                    className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95"
                                >
                                    Sim, continuar <ArrowRight className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setConfirmedStudent(null)}
                                    className="w-full py-4 bg-white text-slate-400 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:text-slate-600 transition-all"
                                >
                                    Não, tentar outra matrícula
                                </button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleIdentify} className="space-y-8">
                            <div className="flex flex-col items-center text-center mb-2">
                                <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-3xl flex items-center justify-center mb-4">
                                    <UserSearch className="w-8 h-8" />
                                </div>
                                <p className="text-slate-500 text-sm font-medium">Use a <strong>matrícula</strong> e a <strong>data de nascimento</strong> do aluno para confirmarmos a identidade.</p>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Matrícula do Aluno</label>
                                <div className="relative">
                                    <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                    <input
                                        required
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="Ex: 20231234"
                                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-slate-800"
                                        value={matricula}
                                        onChange={e => setMatricula(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Data de Nascimento do Aluno</label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                    <input
                                        required
                                        type="date"
                                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-slate-800"
                                        value={dataNascimento}
                                        onChange={e => setDataNascimento(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={identifying}
                                className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-50"
                            >
                                {identifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Identificar Aluno <ArrowRight className="w-5 h-5" /></>}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
