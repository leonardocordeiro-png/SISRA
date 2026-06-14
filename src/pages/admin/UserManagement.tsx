import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
    AlertTriangle,
    Edit2,
    Loader2,
    Plus,
    Save,
    Search,
    ShieldCheck,
    ShieldOff,
    Trash2,
    User,
    X,
} from 'lucide-react';
import NavigationControls from '../../components/NavigationControls';
import { useToast } from '../../components/ui/Toast';

type UserRole = 'ADMIN' | 'RECEPCIONISTA' | 'SCT' | 'COORDENADOR';

type UserProfile = {
    id: string;
    nome: string;
    email: string;
    tipo_usuario: UserRole;
    turma_atribuida?: string | null;
    sala_atribuida?: string | null;
    ativo: boolean;
};

type SalaComTurmas = {
    id: string;
    nome: string;
    turmas: { nome: string }[];
};

type FormState = {
    nome: string;
    email: string;
    password: string;
    tipo_usuario: UserRole;
    sala_atribuida: string;
};

const EMPTY_FORM: FormState = {
    nome: '',
    email: '',
    password: '',
    tipo_usuario: 'RECEPCIONISTA',
    sala_atribuida: '',
};

function friendlyError(error: unknown) {
    const message = String((error as { message?: string })?.message ?? error ?? '');
    if (message.includes('ACESSO_NEGADO')) return 'Apenas administradores ativos podem gerenciar usuarios.';
    if (message.includes('SUPABASE_SERVICE_ROLE_KEY')) return 'A chave SUPABASE_SERVICE_ROLE_KEY ainda nao esta configurada na Vercel.';
    return message || 'Erro inesperado.';
}

function ConfirmModal({
    title,
    message,
    confirmLabel,
    tone,
    icon: Icon,
    onConfirm,
    onCancel,
    loading,
}: {
    title: string;
    message: string;
    confirmLabel: string;
    tone: 'danger' | 'warning' | 'success';
    icon: typeof AlertTriangle;
    onConfirm: () => void;
    onCancel: () => void;
    loading: boolean;
}) {
    const palette = {
        danger: 'bg-red-600 hover:bg-red-700 text-white',
        warning: 'bg-amber-500 hover:bg-amber-600 text-white',
        success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    }[tone];
    const iconPalette = {
        danger: 'bg-red-50 text-red-500',
        warning: 'bg-amber-50 text-amber-500',
        success: 'bg-emerald-50 text-emerald-600',
    }[tone];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
                <div className="flex flex-col items-center gap-4 p-6 text-center">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-full ${iconPalette}`}>
                        <Icon className="h-7 w-7" />
                    </div>
                    <div>
                        <h3 className="mb-1 text-lg font-bold text-slate-900">{title}</h3>
                        <p className="text-sm leading-relaxed text-slate-500">{message}</p>
                    </div>
                    <div className="flex w-full gap-3 pt-2">
                        <button
                            onClick={onCancel}
                            disabled={loading}
                            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={loading}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-bold transition-colors disabled:opacity-50 ${palette}`}
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                            {loading ? 'Aguarde...' : confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function UserManagement() {
    const toast = useToast();
    const { user: currentUser, escolaId } = useAuth();

    const [users, setUsers] = useState<UserProfile[]>([]);
    const [salasDisponiveis, setSalasDisponiveis] = useState<SalaComTurmas[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
    const [blockTarget, setBlockTarget] = useState<UserProfile | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);

    const escola_id = escolaId ?? (import.meta.env.VITE_ESCOLA_ID as string | undefined)?.trim() ?? null;

    const apiRequest = useCallback(async (method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, unknown>) => {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error('Sessao expirada. Faca login novamente.');

        const response = await fetch('/api/admin-users', {
            method,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Falha na operacao administrativa.');
        return payload;
    }, []);

    const fetchUsers = useCallback(async () => {
        if (!escola_id) {
            setLoading(false);
            toast.error('Escola nao identificada', 'Faca login novamente.');
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('sisra_list_admin_users', {
                p_escola_id: escola_id,
            });
            if (error) throw error;
            setUsers(Array.isArray(data) ? data as UserProfile[] : []);
        } catch (error) {
            toast.error('Erro ao carregar usuarios', friendlyError(error));
        } finally {
            setLoading(false);
        }
    }, [escola_id, toast]);

    const fetchSalas = useCallback(async () => {
        if (!escola_id) return;
        try {
            const { data, error } = await supabase.rpc('sisra_list_active_exit_rooms', {
                p_escola_id: escola_id,
            });
            if (error) throw error;
            setSalasDisponiveis(Array.isArray(data) ? data as SalaComTurmas[] : []);
        } catch (error) {
            toast.warning('Salas indisponiveis', friendlyError(error));
        }
    }, [escola_id, toast]);

    useEffect(() => {
        fetchUsers();
        fetchSalas();
    }, [fetchUsers, fetchSalas]);

    const closeModal = () => {
        setShowModal(false);
        setEditingId(null);
        setFormData(EMPTY_FORM);
    };

    const openCreateModal = () => {
        setEditingId(null);
        setFormData(EMPTY_FORM);
        setShowModal(true);
    };

    const openEditModal = (profile: UserProfile) => {
        setEditingId(profile.id);
        setFormData({
            nome: profile.nome,
            email: profile.email,
            password: '',
            tipo_usuario: profile.tipo_usuario,
            sala_atribuida: profile.sala_atribuida || '',
        });
        setShowModal(true);
    };

    const validateForm = () => {
        if (!formData.nome.trim()) throw new Error('Informe o nome completo.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) throw new Error('Informe um e-mail valido.');
        if (!editingId && formData.password.length < 8) throw new Error('A senha inicial deve ter no minimo 8 caracteres.');
        if (editingId && formData.password && formData.password.length < 8) throw new Error('A nova senha deve ter no minimo 8 caracteres.');
        if (formData.tipo_usuario === 'SCT' && !formData.sala_atribuida) throw new Error('Selecione uma sala para usuarios SCT.');
    };

    const handleSave = async (event: React.FormEvent) => {
        event.preventDefault();
        setSaving(true);
        try {
            validateForm();
            await apiRequest(editingId ? 'PATCH' : 'POST', {
                action: editingId ? 'update' : 'create',
                id: editingId ?? undefined,
                nome: formData.nome.trim(),
                email: formData.email.trim(),
                password: formData.password,
                tipo_usuario: formData.tipo_usuario,
                sala_atribuida: formData.sala_atribuida || null,
            });

            toast.success(editingId ? 'Usuario atualizado' : 'Usuario criado', 'Credenciais e perfil foram sincronizados com seguranca.');
            closeModal();
            await fetchUsers();
        } catch (error) {
            toast.error('Erro ao salvar usuario', friendlyError(error));
        } finally {
            setSaving(false);
        }
    };

    const handleToggleBlock = async () => {
        if (!blockTarget) return;
        setActionLoading(true);
        try {
            const ativo = !blockTarget.ativo;
            await apiRequest('PATCH', {
                action: 'set_status',
                id: blockTarget.id,
                ativo,
            });
            toast.success(ativo ? 'Usuario desbloqueado' : 'Usuario bloqueado', `${blockTarget.nome} foi atualizado com sucesso.`);
            setBlockTarget(null);
            await fetchUsers();
        } catch (error) {
            toast.error('Erro ao alterar status', friendlyError(error));
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setActionLoading(true);
        try {
            await apiRequest('DELETE', {
                action: 'delete',
                id: deleteTarget.id,
            });
            toast.success('Acesso revogado', `${deleteTarget.nome} foi removido da lista ativa e bloqueado.`);
            setDeleteTarget(null);
            await fetchUsers();
        } catch (error) {
            toast.error('Erro ao revogar acesso', friendlyError(error));
        } finally {
            setActionLoading(false);
        }
    };

    const filteredUsers = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return users;
        return users.filter(profile =>
            profile.nome.toLowerCase().includes(term) ||
            profile.email.toLowerCase().includes(term) ||
            profile.tipo_usuario.toLowerCase().includes(term)
        );
    }, [searchTerm, users]);

    const getTurmaFromSala = (salaNome: string | null | undefined) => {
        if (!salaNome) return 'N/A';
        if (salaNome === 'TODAS') return 'Todas';
        const sala = salasDisponiveis.find(item => item.nome === salaNome);
        if (!sala?.turmas?.length) return salaNome;
        const series = [...new Set(sala.turmas.map(turma => {
            const match = turma.nome.match(/^(.*?) -/);
            return match ? match[1].trim() : turma.nome;
        }))];
        return series.join(', ');
    };

    const getSalaLabel = (sala: SalaComTurmas) => {
        if (!sala.turmas?.length) return sala.nome;
        const series = [...new Set(sala.turmas.map(turma => {
            const match = turma.nome.match(/^(.*?) -/);
            return match ? match[1].trim() : turma.nome;
        }))];
        return `${sala.nome} (${series.join(', ')})`;
    };

    const roleLabel: Record<UserRole, string> = {
        ADMIN: 'ADMIN',
        RECEPCIONISTA: 'RECEPCAO',
        SCT: 'SCT',
        COORDENADOR: 'COORDENADOR',
    };
    const roleClass: Record<UserRole, string> = {
        ADMIN: 'bg-purple-100 text-purple-700',
        RECEPCIONISTA: 'bg-blue-100 text-blue-700',
        SCT: 'bg-emerald-100 text-emerald-700',
        COORDENADOR: 'bg-amber-100 text-amber-700',
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8 text-slate-800">
            <NavigationControls />

            <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Usuarios e Equipe</h1>
                    <p className="text-slate-500">Controle real de funcionarios, credenciais, perfis e permissoes da escola.</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 font-medium text-white transition-colors hover:bg-slate-800"
                >
                    <Plus className="h-5 w-5" />
                    Novo Usuario da Equipe
                </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 bg-slate-50/60 p-4">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nome, email ou perfil..."
                            value={searchTerm}
                            onChange={event => setSearchTerm(event.target.value)}
                            className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-900">
                            <tr>
                                <th className="px-6 py-4">Nome</th>
                                <th className="px-6 py-4">Email</th>
                                <th className="px-6 py-4">Tipo</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Acoes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                                        <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
                                        Carregando usuarios...
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-slate-400">Nenhum usuario encontrado.</td>
                                </tr>
                            ) : (
                                filteredUsers.map(profile => {
                                    const isSelf = profile.id === currentUser?.id;
                                    return (
                                        <tr key={profile.id} className={`transition-colors ${profile.ativo ? 'hover:bg-slate-50' : 'bg-slate-50 opacity-70'}`}>
                                            <td className="px-6 py-4 font-medium text-slate-900">
                                                <div className="flex items-center gap-3">
                                                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${profile.ativo ? 'bg-slate-200 text-slate-500' : 'bg-red-100 text-red-400'}`}>
                                                        <User className="h-4 w-4" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span>{profile.nome}</span>
                                                        {isSelf && <span className="text-[10px] font-bold uppercase text-indigo-600">Sua conta</span>}
                                                        {(profile.tipo_usuario === 'SCT' || profile.tipo_usuario === 'COORDENADOR') && profile.sala_atribuida && (
                                                            <span className="text-[10px] font-bold uppercase text-emerald-600">
                                                                {profile.sala_atribuida} | {getTurmaFromSala(profile.sala_atribuida)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">{profile.email}</td>
                                            <td className="px-6 py-4">
                                                <span className={`rounded-md px-2 py-1 text-xs font-bold ${roleClass[profile.tipo_usuario]}`}>
                                                    {roleLabel[profile.tipo_usuario]}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`rounded-full px-2 py-1 text-xs font-medium ${profile.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                                    {profile.ativo ? 'Ativo' : 'Bloqueado'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        title="Editar usuario"
                                                        onClick={() => openEditModal(profile)}
                                                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        title={profile.ativo ? 'Bloquear acesso' : 'Desbloquear acesso'}
                                                        onClick={() => setBlockTarget(profile)}
                                                        disabled={isSelf}
                                                        className={`rounded-lg p-2 text-slate-400 transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                                                            profile.ativo ? 'hover:bg-amber-50 hover:text-amber-600' : 'hover:bg-emerald-50 hover:text-emerald-600'
                                                        }`}
                                                    >
                                                        {profile.ativo ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                                                    </button>
                                                    <button
                                                        title="Revogar acesso"
                                                        onClick={() => setDeleteTarget(profile)}
                                                        disabled={isSelf}
                                                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {blockTarget && (
                <ConfirmModal
                    title={blockTarget.ativo ? 'Bloquear usuario?' : 'Desbloquear usuario?'}
                    message={blockTarget.ativo
                        ? `${blockTarget.nome} perdera o acesso imediatamente.`
                        : `${blockTarget.nome} tera o acesso restaurado.`
                    }
                    confirmLabel={blockTarget.ativo ? 'Bloquear' : 'Desbloquear'}
                    tone={blockTarget.ativo ? 'warning' : 'success'}
                    icon={blockTarget.ativo ? ShieldOff : ShieldCheck}
                    onConfirm={handleToggleBlock}
                    onCancel={() => setBlockTarget(null)}
                    loading={actionLoading}
                />
            )}

            {deleteTarget && (
                <ConfirmModal
                    title="Revogar acesso?"
                    message={`${deleteTarget.nome} sera removido da lista ativa, bloqueado e mantido apenas para auditoria historica.`}
                    confirmLabel="Revogar acesso"
                    tone="danger"
                    icon={AlertTriangle}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteTarget(null)}
                    loading={actionLoading}
                />
            )}

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-100 p-6">
                            <h2 className="text-xl font-bold text-slate-900">{editingId ? 'Editar Usuario' : 'Novo Usuario'}</h2>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="space-y-4 p-6">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Nome Completo</label>
                                <input
                                    required
                                    value={formData.nome}
                                    onChange={event => setFormData(current => ({ ...current, nome: event.target.value }))}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={event => setFormData(current => ({ ...current, email: event.target.value }))}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    {editingId ? 'Nova senha (opcional)' : 'Senha inicial'}
                                </label>
                                <input
                                    type="password"
                                    required={!editingId}
                                    minLength={8}
                                    value={formData.password}
                                    onChange={event => setFormData(current => ({ ...current, password: event.target.value }))}
                                    placeholder={editingId ? 'Deixe em branco para manter' : 'Minimo 8 caracteres'}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Tipo de Usuario</label>
                                <select
                                    value={formData.tipo_usuario}
                                    onChange={event => setFormData(current => ({
                                        ...current,
                                        tipo_usuario: event.target.value as UserRole,
                                        sala_atribuida: event.target.value === 'SCT' ? current.sala_atribuida : '',
                                    }))}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value="RECEPCIONISTA">Recepcao</option>
                                    <option value="SCT">SCT</option>
                                    <option value="COORDENADOR">Coordenador</option>
                                    <option value="ADMIN">Administrador</option>
                                </select>
                            </div>

                            {formData.tipo_usuario === 'SCT' && (
                                <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Configuracao SCT</p>
                                        <p className="mt-0.5 text-[11px] text-slate-500">Escolha a sala de saida para este usuario.</p>
                                    </div>
                                    <select
                                        required
                                        value={formData.sala_atribuida}
                                        onChange={event => setFormData(current => ({ ...current, sala_atribuida: event.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Selecione...</option>
                                        {salasDisponiveis.map(sala => (
                                            <option key={sala.id} value={sala.nome}>{getSalaLabel(sala)}</option>
                                        ))}
                                        <option value="TODAS">TODAS AS SALAS</option>
                                    </select>
                                    {salasDisponiveis.length === 0 && (
                                        <p className="text-[10px] text-amber-700">Nenhuma sala ativa encontrada. Cadastre em /admin/salas.</p>
                                    )}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    {saving ? 'Salvando...' : editingId ? 'Salvar Alteracoes' : 'Criar Usuario'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
