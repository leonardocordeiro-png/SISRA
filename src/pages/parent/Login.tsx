import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { User, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';

export default function ParentLogin() {
    const navigate = useNavigate();
    const [cpf, setCpf] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState<'CPF' | 'SELECT_STUDENT'>('CPF');
    const [students, setStudents] = useState<any[]>([]);
    const [guardianName, setGuardianName] = useState('');

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Normalize CPF (remove non-digits)
            const cleanCpf = cpf.replace(/\D/g, '');

            // 1. Find Responsavel by CPF
            const { data: responsavel, error: respError } = await supabase
                .from('responsaveis')
                .select('id, nome_completo')
                .eq('cpf', cleanCpf) // Ensure your DB stores CPF clean or handle formatting
                .single();

            if (respError || !responsavel) {
                throw new Error('Responsável não encontrado. Verifique o CPF.');
            }

            setGuardianName(responsavel.nome_completo);

            // 2. Find Students connected to this Responsavel
            const { data: links, error: linkError } = await supabase
                .from('alunos_responsaveis')
                .select(`
                    aluno:alunos (
                        id,
                        nome_completo,
                        turma,
                        foto_url
                    )
                `)
                .eq('responsavel_id', responsavel.id);

            if (linkError) throw linkError;

            if (!links || links.length === 0) {
                throw new Error('Nenhum aluno vinculado a este responsável.');
            }

            setStudents(links.map((l: any) => l.aluno));
            setStep('SELECT_STUDENT');

            // Store guardian info locally for "session"
            localStorage.setItem('sisra_parent_session', JSON.stringify({
                id: responsavel.id,
                nome: responsavel.nome_completo,
                cpf: cleanCpf
            }));

        } catch (err: any) {
            setError(err.message || 'Erro ao buscar cadastro.');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectStudent = (studentId: string) => {
        navigate(`/parent/status/${studentId}`);
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden">
                <div className="bg-blue-600 p-8 text-center">
                    <div className="mx-auto bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm">
                        <User className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-1">Acesso dos Pais</h1>
                    <p className="text-blue-100 text-sm">Identifique-se para buscar seu filho</p>
                </div>

                <div className="p-8">
                    {step === 'CPF' ? (
                        <form onSubmit={handleSearch} className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    Informe seu CPF
                                </label>
                                <input
                                    type="text"
                                    value={cpf}
                                    onChange={(e) => setCpf(e.target.value)}
                                    placeholder="000.000.000-00"
                                    className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:font-normal"
                                    required
                                />
                                <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3" />
                                    Ambiente seguro. Seus dados estão protegidos.
                                </p>
                            </div>

                            {error && (
                                <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold uppercase tracking-wider transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continuar <ArrowRight className="w-5 h-5" /></>}
                            </button>
                        </form>
                    ) : (
                        <div className="space-y-6">
                            <div className="text-center">
                                <p className="text-slate-500 text-sm">Olá, <strong className="text-slate-900">{guardianName}</strong></p>
                                <h3 className="text-xl font-bold text-slate-800">Quem você vai buscar?</h3>
                            </div>

                            <div className="space-y-3">
                                {students.map((student) => (
                                    <button
                                        key={student.id}
                                        onClick={() => handleSelectStudent(student.id)}
                                        className="w-full flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all group text-left"
                                    >
                                        <div className="w-12 h-12 bg-slate-100 rounded-full overflow-hidden">
                                            {student.foto_url ? (
                                                <img src={student.foto_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <User className="w-6 h-6 m-3 text-slate-300" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{student.nome_completo}</p>
                                            <p className="text-xs text-slate-500">Turma {student.turma}</p>
                                        </div>
                                        <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500" />
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() => setStep('CPF')}
                                className="w-full py-3 text-slate-400 font-bold text-sm hover:text-slate-600"
                            >
                                Voltar / Não sou eu
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
