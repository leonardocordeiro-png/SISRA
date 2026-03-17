import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/audit';
import { useAuth } from '../../context/AuthContext';
import { Plus, Search, Trash2, Edit2, Save, X, User, ShieldOff, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import NavigationControls from '../../components/NavigationControls';
import { useToast } from '../../components/ui/Toast';

type UserProfile = {
    id: string;
    nome: string;
    email: string;
    tipo_usuario: 'ADMIN' | 'RECEPCIONISTA' | 'SCT' | 'COORDENADOR';
    turma_atribuida?: string;
    sala_atribuida?: string;
    ativo: boolean;
};

// ── Confirmation Modal ────────────────────────────────────────────────────────
function ConfirmModal({
    title,
    message,
    confirmLabel,
    confirmClass,
    icon: Icon,
    onConfirm,
    onCancel,
    loading,
}: {
    title: string;
    message: string;
    confirmLabel: string;
    confirmClass: string;
    icon: any;
    onConfirm: () => void;
    onCancel: () => void;
    loading: boolean;
}) {
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in duration-200">
                <div className="p-6 flex flex-col items-center text-center gap-4">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center ${confirmClass.includes('red') ? 'bg-red-50' : 'bg-amber-50'}`}>
                        <Icon className={`w-7 h-7 ${confirmClass.includes('red') ? 'text-red-500' : 'text-amber-500'}`} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 mb-1">{title}</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">{message}</p>
                    </div>
                    <div className="flex gap-3 w-full pt-2">
                        <button
                            onClick={onCancel}
                            disabled={loading}
                            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={loading}
                            className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${confirmClass}`}
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                            {loading ? 'Aguarde...' : confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function UserManagement() {
    const toast = useToast();
    const { user: currentUser, escolaId } = useAuth();

    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [initialEmail, setInitialEmail] = useState('');

    // Confirm dialogs
    const [blockTarget, setBlockTarget] = useState<UserProfile | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);

    const [formData, setFormData] = useState({
        nome: '',
        email: '',
        password: '',
        tipo_usuario: 'RECEPCIONISTA' as UserProfile['tipo_usuario'],
        sala_atribuida: '',
    });

    const fetchUsers = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('usuarios')
            .select('*')
            .order('nome');

        if (!error && data) setUsers(data as UserProfile[]);
        setLoading(false);
    };

    useEffect(() => { fetchUsers(); }, []);

    // ── Create / Edit ──────────────────────────────────────────────────────────
    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);

            if (editingId) {
                const updateData: any = {
                    nome: formData.nome,
                    tipo_usuario: formData.tipo_usuario,
                    sala_atribuida: formData.tipo_usuario === 'SCT'
                        ? formData.sala_atribuida
                        : (formData.tipo_usuario === 'ADMIN' || formData.tipo_usuario === 'COORDENADOR' ? 'TODAS' : null)
                };

                const emailChanged = formData.email !== initialEmail;
                if (emailChanged) updateData.email = formData.email;

                const { error } = await supabase.from('usuarios').update(updateData).eq('id', editingId);
                if (error) throw error;

                if (formData.password || emailChanged) {
                    const { error: syncError } = await supabase.rpc('admin_update_user_credentials', {
                        user_id: editingId,
                        new_email: emailChanged ? formData.email : null,
                        new_password: formData.password || null
                    });

                    if (syncError) {
                        if (formData.password && !emailChanged) {
                            const { error: authError } = await supabase.auth.updateUser({ password: formData.password });
                            if (authError) throw new Error('Perfil atualizado, mas erro na sincronização: ' + authError.message);
                        } else {
                            throw new Error('Perfil atualizado, mas houve um erro ao sincronizar credenciais.');
                        }
                    }
                }

                await logAudit('ALTERACAO_CONFIGURACAO', 'usuarios', editingId, {
                    acao: 'EDICAO_USUARIO',
                    nome: formData.nome,
                    tipo: formData.tipo_usuario,
                });
                toast.success('Usuário atualizado', 'As alterações foram salvas.');
            } else {
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: formData.email,
                    password: formData.password,
                });
                if (authError) throw authError;
                if (!authData.user) throw new Error('Falha ao criar usuário no Auth');

                const escola_id = escolaId ?? import.meta.env.VITE_ESCOLA_ID ?? 'e6328325-1845-420a-b333-87a747953259';
                const { error: profileError } = await supabase.from('usuarios').insert({
                    id: authData.user.id,
                    escola_id,
                    nome: formData.nome,
                    email: formData.email,
                    tipo_usuario: formData.tipo_usuario,
                    sala_atribuida: formData.tipo_usuario === 'SCT'
                        ? formData.sala_atribuida
                        : (formData.tipo_usuario === 'ADMIN' || formData.tipo_usuario === 'COORDENADOR' ? 'TODAS' : null),
                    ativo: true
                });
                if (profileError) throw profileError;

                await logAudit('ALTERACAO_CONFIGURACAO', 'usuarios', authData.user.id, {
                    acao: 'CRIACAO_USUARIO',
                    nome: formData.nome,
                    tipo: formData.tipo_usuario,
                });
                toast.success('Usuário criado', 'O novo usuário foi adicionado ao sistema.');
            }

            closeModal();
            fetchUsers();
        } catch (error: any) {
            console.error('Error saving user:', error);
            toast.error('Erro ao salvar usuário', error.message);
        } finally {
            setLoading(false);
        }
    };

    // ── Block / Unblock ────────────────────────────────────────────────────────
    const handleToggleBlock = async () => {
        if (!blockTarget) return;
        setActionLoading(true);
        try {
            const newStatus = !blockTarget.ativo;
            const { error } = await supabase
                .from('usuarios')
                .update({ ativo: newStatus })
                .eq('id', blockTarget.id);

            if (error) throw error;

            await logAudit('ALTERACAO_CONFIGURACAO', 'usuarios', blockTarget.id, {
                acao: newStatus ? 'DESBLOQUEIO_USUARIO' : 'BLOQUEIO_USUARIO',
                nome: blockTarget.nome,
                email: blockTarget.email,
                novo_status: newStatus ? 'ATIVO' : 'BLOQUEADO',
                executado_por: currentUser?.id,
            });

            toast.success(
                newStatus ? 'Usuário desbloqueado' : 'Usuário bloqueado',
                `${blockTarget.nome} foi ${newStatus ? 'reativado' : 'bloqueado'} com sucesso.`
            );
            setBlockTarget(null);
            fetchUsers();
        } catch (error: any) {
            toast.error('Erro ao alterar status', error.message);
        } finally {
            setActionLoading(false);
        }
    };

    // ── Delete ─────────────────────────────────────────────────────────────────
    const handleDelete = async () => {
        if (!deleteTarget) return;
        if (deleteTarget.id === currentUser?.id) {
            toast.error('Operação não permitida', 'Você não pode excluir sua própria conta.');
            setDeleteTarget(null);
            return;
        }
        setActionLoading(true);
        try {
            const { error } = await supabase
                .from('usuarios')
                .delete()
                .eq('id', deleteTarget.id);

            if (error) throw error;

            await logAudit('EXCLUSAO_USUARIO', 'usuarios', deleteTarget.id, {
                acao: 'EXCLUSAO_USUARIO',
                nome: deleteTarget.nome,
                email: deleteTarget.email,
                tipo: deleteTarget.tipo_usuario,
                executado_por: currentUser?.id,
            });

            toast.success('Usuário excluído', `${deleteTarget.nome} foi removido do sistema.`);
            setDeleteTarget(null);
            fetchUsers();
        } catch (error: any) {
            toast.error('Erro ao excluir usuário', error.message);
        } finally {
            setActionLoading(false);
        }
    };

    // ── Helpers ────────────────────────────────────────────────────────────────
    const openEditModal = (user: UserProfile) => {
        setEditingId(user.id);
        setInitialEmail(user.email);
        setFormData({ nome: user.nome, email: user.email, password: '', tipo_usuario: user.tipo_usuario, sala_atribuida: user.sala_atribuida || '' });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingId(null);
        setInitialEmail('');
        setFormData({ nome: '', email: '', password: '', tipo_usuario: 'RECEPCIONISTA', sala_atribuida: '' });
    };

    const filteredUsers = users.filter(u =>
        u.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getTurmaFromSala = (sala: string | undefined) => {
        switch (sala) {
            case 'Sala 101': return '3º Ano';
            case 'Sala 102': return '4º Ano';
            case 'Sala 103': return '1º e 2º Ano';
            case 'Sala 104': return '5º Ano';
            case 'Sala 109': return '4º Ano';
            case 'TODAS': return 'Todas';
            default: return 'N/A';
        }
    };

    const TIPO_LABEL: Record<string, string> = {
        ADMIN: 'ADMIN', RECEPCIONISTA: 'RECEPÇÃO', SCT: 'SCT', COORDENADOR: 'COORDENADOR',
    };
    const TIPO_CLASS: Record<string, string> = {
        ADMIN: 'bg-purple-100 text-purple-700',
        RECEPCIONISTA: 'bg-blue-100 text-blue-700',
        SCT: 'bg-emerald-100 text-emerald-700',
        COORDENADOR: 'bg-amber-100 text-amber-700',
    };

    return (
        <div className="p-8">
            <NavigationControls />
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Gerenciar Usuários</h1>
                    <p className="text-slate-500">Controle de acesso e permissões do sistema</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
                >
                    <Plus className="w-5 h-5" /> Novo Usuário
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50/50">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Buscar por nome ou email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-900 font-semibold border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">Nome</th>
                                <th className="px-6 py-4">Email</th>
                                <th className="px-6 py-4">Tipo</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">Carregando...</td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">Nenhum usuário encontrado.</td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user.id} className={`transition-colors ${!user.ativo ? 'bg-slate-50 opacity-60' : 'hover:bg-slate-50'}`}>
                                        <td className="px-6 py-4 font-medium text-slate-900">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${user.ativo ? 'bg-slate-200 text-slate-500' : 'bg-red-100 text-red-400'}`}>
                                                    <User className="w-4 h-4" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-900">{user.nome}</span>
                                                    {(user.tipo_usuario === 'SCT' || user.tipo_usuario === 'COORDENADOR') && user.sala_atribuida && (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] text-blue-600 font-bold uppercase">{user.sala_atribuida}</span>
                                                            <span className="text-slate-300 text-[8px]">|</span>
                                                            <span className="text-[10px] text-emerald-600 font-bold uppercase">{getTurmaFromSala(user.sala_atribuida)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">{user.email}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-md text-xs font-bold ${TIPO_CLASS[user.tipo_usuario] || 'bg-slate-100 text-slate-700'}`}>
                                                {TIPO_LABEL[user.tipo_usuario] || user.tipo_usuario}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                                {user.ativo ? 'Ativo' : 'Bloqueado'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {/* Edit */}
                                                <button
                                                    title="Editar usuário"
                                                    onClick={() => openEditModal(user)}
                                                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>

                                                {/* Block / Unblock */}
                                                <button
                                                    title={user.ativo ? 'Bloquear acesso' : 'Desbloquear acesso'}
                                                    onClick={() => setBlockTarget(user)}
                                                    disabled={user.id === currentUser?.id}
                                                    className={`p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${user.ativo
                                                        ? 'hover:bg-amber-50 text-slate-400 hover:text-amber-600'
                                                        : 'hover:bg-emerald-50 text-slate-400 hover:text-emerald-600'
                                                    }`}
                                                >
                                                    {user.ativo
                                                        ? <ShieldOff className="w-4 h-4" />
                                                        : <ShieldCheck className="w-4 h-4" />
                                                    }
                                                </button>

                                                {/* Delete */}
                                                <button
                                                    title="Excluir usuário permanentemente"
                                                    onClick={() => setDeleteTarget(user)}
                                                    disabled={user.id === currentUser?.id}
                                                    className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Block/Unblock Confirm Modal ──────────────────────────────────── */}
            {blockTarget && (
                <ConfirmModal
                    title={blockTarget.ativo ? 'Bloquear usuário?' : 'Desbloquear usuário?'}
                    message={blockTarget.ativo
                        ? `${blockTarget.nome} perderá o acesso imediatamente e não poderá fazer login até ser desbloqueado.`
                        : `${blockTarget.nome} terá o acesso restaurado e poderá fazer login normalmente.`
                    }
                    confirmLabel={blockTarget.ativo ? 'Bloquear' : 'Desbloquear'}
                    confirmClass={blockTarget.ativo ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}
                    icon={blockTarget.ativo ? ShieldOff : ShieldCheck}
                    onConfirm={handleToggleBlock}
                    onCancel={() => setBlockTarget(null)}
                    loading={actionLoading}
                />
            )}

            {/* ── Delete Confirm Modal ─────────────────────────────────────────── */}
            {deleteTarget && (
                <ConfirmModal
                    title="Excluir usuário permanentemente?"
                    message={`Esta ação não pode ser desfeita. O perfil de ${deleteTarget.nome} (${deleteTarget.email}) será removido do sistema. O acesso será revogado imediatamente.`}
                    confirmLabel="Excluir definitivamente"
                    confirmClass="bg-red-600 hover:bg-red-700"
                    icon={AlertTriangle}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteTarget(null)}
                    loading={actionLoading}
                />
            )}

            {/* ── Create / Edit Modal ──────────────────────────────────────────── */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-900">{editingId ? 'Editar Usuário' : 'Novo Usuário'}</h2>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                                <input
                                    required
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={formData.nome}
                                    onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    required
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    {editingId ? 'Nova Senha (deixe em branco para manter)' : 'Senha Inicial'}
                                </label>
                                <input
                                    type="password"
                                    required={!editingId}
                                    minLength={6}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    placeholder={editingId ? '••••••••' : ''}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Usuário</label>
                                <select
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={formData.tipo_usuario}
                                    onChange={e => setFormData({ ...formData, tipo_usuario: e.target.value as any })}
                                >
                                    <option value="RECEPCIONISTA">Recepção</option>
                                    <option value="SCT">SCT</option>
                                    <option value="COORDENADOR">Coordenador</option>
                                    <option value="ADMIN">Administrador</option>
                                </select>
                            </div>

                            {formData.tipo_usuario === 'SCT' && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
                                    <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                                        <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">Configuração SCT</p>
                                        <p className="text-[11px] text-slate-500 mt-0.5">Escolha a sala para gerenciar as turmas automaticamente.</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Sala de Saída</label>
                                        <select
                                            required={formData.tipo_usuario === 'SCT'}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={formData.sala_atribuida}
                                            onChange={e => setFormData({ ...formData, sala_atribuida: e.target.value })}
                                        >
                                            <option value="">Selecione...</option>
                                            <option value="Sala 101">Sala 101 (3º Ano)</option>
                                            <option value="Sala 102">Sala 102 (4º Ano)</option>
                                            <option value="Sala 103">Sala 103 (1º e 2º Ano)</option>
                                            <option value="Sala 104">Sala 104 (5º Ano)</option>
                                            <option value="Sala 109">Sala 109 (4º Ano)</option>
                                            <option value="TODAS">TODAS AS SALAS</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={closeModal} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 font-medium hover:bg-slate-50">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={loading} className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 flex items-center gap-2 disabled:opacity-50">
                                    <Save className="w-4 h-4" />
                                    {loading ? 'Salvando...' : (editingId ? 'Salvar Alterações' : 'Criar Usuário')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
