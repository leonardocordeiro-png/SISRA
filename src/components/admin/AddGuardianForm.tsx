import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, UserCheck, Phone, Mail, Shield } from 'lucide-react';

type GuardianFormData = {
    nome_completo: string;
    cpf: string;
    telefone: string;
    email: string;
    parentesco: string;
    foto_documento_url: string;
};

type AuthorizationFormData = {
    aluno_id: string;
    tipo_autorizacao: 'PRINCIPAL' | 'SECUNDARIO' | 'EMERGENCIA';
    ativa: boolean;
};

type AddGuardianFormProps = {
    isOpen: boolean;
    onClose: () => void;
    escolaId: string;
    onSuccess: () => void;
};

export default function AddGuardianForm({ isOpen, onClose, escolaId, onSuccess }: AddGuardianFormProps) {
    const [guardianData, setGuardianData] = useState<GuardianFormData>({
        nome_completo: '',
        cpf: '',
        telefone: '',
        email: '',
        parentesco: '',
        foto_documento_url: ''
    });
    const [authData, setAuthData] = useState<AuthorizationFormData>({
        aluno_id: '',
        tipo_autorizacao: 'PRINCIPAL',
        ativa: true
    });
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchStudents();
        }
    }, [isOpen, escolaId]);

    const fetchStudents = async () => {
        const { data } = await supabase
            .from('alunos')
            .select('id, nome_completo, matricula, turma')
            .eq('escola_id', escolaId)
            .order('nome_completo');

        setStudents(data || []);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // 1. Check if guardian already exists by CPF
            const { data: existingGuardian } = await supabase
                .from('responsaveis')
                .select('id')
                .eq('cpf', guardianData.cpf)
                .maybeSingle();

            let guardianId;

            if (existingGuardian) {
                // Update existing guardian info
                const { error: uError } = await supabase
                    .from('responsaveis')
                    .update({
                        nome_completo: guardianData.nome_completo,
                        telefone: guardianData.telefone,
                        email: guardianData.email,
                        parentesco: guardianData.parentesco,
                        foto_documento_url: guardianData.foto_documento_url
                    })
                    .eq('id', existingGuardian.id);

                if (uError) throw uError;
                guardianId = existingGuardian.id;
            } else {
                // Create new guardian
                const { data: newGuardian, error: gError } = await supabase
                    .from('responsaveis')
                    .insert(guardianData)
                    .select()
                    .single();

                if (gError) throw gError;
                guardianId = newGuardian.id;
            }

            // 2. Create authorization link
            const { error: authError } = await supabase
                .from('autorizacoes')
                .insert({
                    aluno_id: authData.aluno_id,
                    responsavel_id: guardianId,
                    tipo_autorizacao: authData.tipo_autorizacao,
                    ativa: authData.ativa
                });

            if (authError) throw authError;

            onSuccess();
            resetForm();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Erro ao adicionar responsável');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setGuardianData({
            nome_completo: '',
            cpf: '',
            telefone: '',
            email: '',
            parentesco: '',
            foto_documento_url: ''
        });
        setAuthData({
            aluno_id: '',
            tipo_autorizacao: 'PRINCIPAL',
            ativa: true
        });
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
            <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 rounded-lg">
                            <UserCheck className="w-5 h-5 text-emerald-600" />
                        </div>
                        <h2 className="text-lg font-bold">Adicionar Responsável</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6">
                    <div className="space-y-6">
                        {/* Guardian Info */}
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 mb-4">Dados do Responsável</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Nome Completo *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={guardianData.nome_completo}
                                        onChange={(e) => setGuardianData({ ...guardianData, nome_completo: e.target.value })}
                                        className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        CPF *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={guardianData.cpf}
                                        onChange={(e) => setGuardianData({ ...guardianData, cpf: e.target.value })}
                                        className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                                        placeholder="000.000.000-00"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                                        <Phone className="w-4 h-4" />
                                        Telefone *
                                    </label>
                                    <input
                                        type="tel"
                                        required
                                        value={guardianData.telefone}
                                        onChange={(e) => setGuardianData({ ...guardianData, telefone: e.target.value })}
                                        className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                                        <Mail className="w-4 h-4" />
                                        E-mail
                                    </label>
                                    <input
                                        type="email"
                                        value={guardianData.email}
                                        onChange={(e) => setGuardianData({ ...guardianData, email: e.target.value })}
                                        className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Parentesco *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={guardianData.parentesco}
                                        onChange={(e) => setGuardianData({ ...guardianData, parentesco: e.target.value })}
                                        className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                                        placeholder="Ex: Mãe, Pai, Avó"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Authorization */}
                        <div className="pt-4 border-t">
                            <h3 className="text-sm font-bold text-slate-900 mb-4">Autorização</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Aluno *
                                    </label>
                                    <select
                                        required
                                        value={authData.aluno_id}
                                        onChange={(e) => setAuthData({ ...authData, aluno_id: e.target.value })}
                                        className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    >
                                        <option value="">Selecione um aluno</option>
                                        {students.map(student => (
                                            <option key={student.id} value={student.id}>
                                                {student.nome_completo} - {student.turma}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                                        <Shield className="w-4 h-4" />
                                        Tipo de Responsável *
                                    </label>
                                    <select
                                        required
                                        value={authData.tipo_autorizacao}
                                        onChange={(e) => setAuthData({ ...authData, tipo_autorizacao: e.target.value as any })}
                                        className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    >
                                        <option value="PRINCIPAL">Principal</option>
                                        <option value="SECUNDARIO">Secundário</option>
                                        <option value="EMERGENCIA">Emergência</option>
                                    </select>
                                </div>

                                <label className="flex items-center gap-3 p-4 bg-emerald-50 rounded-lg cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={authData.ativa}
                                        onChange={(e) => setAuthData({ ...authData, ativa: e.target.checked })}
                                        className="w-5 h-5 text-emerald-600 rounded focus:ring-2 focus:ring-emerald-500"
                                    />
                                    <span className="text-sm font-medium text-slate-700">
                                        Autorizado a retirar o aluno
                                    </span>
                                </label>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                                {error}
                            </div>
                        )}
                    </div>
                </form>

                {/* Actions */}
                <div className="border-t px-6 py-4 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-3 border rounded-lg hover:bg-slate-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                    >
                        {loading ? 'Salvando...' : 'Adicionar Responsável'}
                    </button>
                </div>
            </div>
        </>
    );
}
