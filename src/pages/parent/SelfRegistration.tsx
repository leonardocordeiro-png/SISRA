import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import GuardianRegistrationFlow from '../../components/parent/GuardianRegistrationFlow';
import {
    getRegistrationStudentByToken,
    lookupRegistrationGuardianByCpf,
    registerGuardianByToken,
} from '../../lib/publicApi';

export default function SelfRegistration() {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();

    const [validating, setValidating] = useState(true);
    const [student, setStudent] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        validateToken();
    }, [token]);

    const validateToken = async () => {
        if (!token) {
            setError('Token de acesso não fornecido.');
            setValidating(false);
            return;
        }

        try {
            const { student: tokenStudent } = await getRegistrationStudentByToken(token);
            if (!tokenStudent) {
                setError('Link de acesso inválido ou expirado.');
            } else {
                setStudent(tokenStudent);
            }
        } catch (err) {
            setError('Erro ao validar acesso.');
        } finally {
            setValidating(false);
        }
    };

    if (validating) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Validando seu acesso seguro...</p>
                </div>
            </div>
        );
    }

    if (error || !student) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-200 text-center max-w-md">
                    <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 mb-2">Acesso Negado</h2>
                    <p className="text-slate-500 mb-8">{error || 'Aluno não encontrado.'}</p>
                    <button
                        onClick={() => navigate('/')}
                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold uppercase tracking-widest text-xs"
                    >
                        Voltar ao Início
                    </button>
                </div>
            </div>
        );
    }

    return (
        <GuardianRegistrationFlow
            studentName={student.nome_completo}
            onRegister={async (input) => {
                const { guardian } = await registerGuardianByToken({ token: token!, ...input });
                return guardian;
            }}
            onLookupCpf={async (cpf) => {
                const { guardian } = await lookupRegistrationGuardianByCpf(token!, cpf);
                return guardian
                    ? { nome_completo: guardian.nome_completo, telefone: guardian.telefone, foto_url: guardian.foto_url }
                    : null;
            }}
        />
    );
}
