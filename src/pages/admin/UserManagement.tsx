import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Search, Trash2, Edit2, Save, X, User } from 'lucide-react';
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

export default function UserManagement() {
    const toast = useToast();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [initialEmail, setInitialEmail] = useState('');

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

        if (!error && data) {
            setUsers(data as UserProfile[]);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);

            if (editingId) {
                // Update existing user
                const updateData: any = {
                    nome: formData.nome,
                    tipo_usuario: formData.tipo_usuario,
                    sala_atribuida: formData.tipo_usuario === 'SCT' ? formData.sala_atribuida : (formData.tipo_usuario === 'ADMIN' ? 'TODAS' : null)
                };

                // Track email change for Supabase Auth sync
                const emailChanged = formData.email !== initialEmail;
                if (emailChanged) {
                    updateData.email = formData.email;
                }

                const { error } = await supabase
                    .from('usuarios')
                    .update(updateData)
                    .eq('id', editingId);

                if (error) throw error;

                // Handle credential updates (email/password) in Supabase Auth
                if (formData.password || emailChanged) {
                    // Note: Administrative credential updates require specific RPC or Service Role
                    const { error: syncError } = await supabase.rpc('admin_update_user_credentials', {
                        user_id: editingId,
                        new_email: emailChanged ? formData.email : null,
                        new_password: formData.password || null
                    });

                    if (syncError) {
                        console.warn('Credential sync RPC failed:', syncError);

                        // Fallback attempt for password if that was the only change (self-update context)
                        if (formData.password && !emailChanged) {
                            const { error: authError } = await supabase.auth.updateUser({
                                password: formData.password
                            });
                            if (authError) {
                                throw new Error('Perfil atualizado, mas erro na sincronização: ' + authError.message);
                            }
                        } else {
                            throw new Error('Perfil atualizado, mas houve um erro ao sincronizar credenciais com o Supabase Auth. Verifique a RPC admin_update_user_credentials.');
                        }
                    }
                }

                toast.success('Usuário atualizado', 'As alterações foram salvas.');
            } else {
                // Create new user
                // 1. Create Auth User
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: formData.email,
                    password: formData.password,
                });

                if (authError) throw authError;
                if (!authData.user) throw new Error('Falha ao criar usuário no Auth');

                // 2. Create Profile
                // Get school ID - in a real app this comes from context
                const escola_id = 'e6328325-1845-420a-b333-87a747953259';

                const { error: profileError } = await supabase
                    .from('usuarios')
                    .insert({
                        id: authData.user.id,
                        escola_id,
                        nome: formData.nome,
                        email: formData.email,
                        tipo_usuario: formData.tipo_usuario,
                        sala_atribuida: formData.tipo_usuario === 'SCT' ? formData.sala_atribuida : (formData.tipo_usuario === 'ADMIN' ? 'TODAS' : null),
                        ativo: true
                    });

                if (profileError) throw profileError;
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

    const openEditModal = (user: UserProfile) => {
        setEditingId(user.id);
        setInitialEmail(user.email);
        setFormData({
            nome: user.nome,
            email: user.email,
            password: '',
            tipo_usuario: user.tipo_usuario,
            sala_atribuida: user.sala_atribuida || ''
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingId(null);
        setInitialEmail('');
        setFormData({
            nome: '',
            email: '',
            password: '',
            tipo_usuario: 'RECEPCIONISTA' as UserProfile['tipo_usuario'],
            sala_atribuida: '',
        });
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja desativar este usuário?')) return;

        try {
            const { error } = await supabase
                .from('usuarios')
                .update({ ativo: false })
                .eq('id', id);

            if (error) throw error;
            fetchUsers();
        } catch (error: any) {
            console.error('Error deleting user:', error);
            toast.error('Erro ao deletar usuário', error.message);
        }
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
            case 'TODAS': return 'Todas';
            default: return 'N/A';
        }
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
                                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-3">
                                            <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-500">
                                                <User className="w-4 h-4" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-900">{user.nome}</span>
                                                {user.tipo_usuario === 'SCT' && user.sala_atribuida && (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] text-blue-600 font-bold uppercase">{user.sala_atribuida}</span>
                                                        <span className="text-slate-300 text-[8px]">|</span>
                                                        <span className="text-[10px] text-emerald-600 font-bold uppercase">
                                                            {getTurmaFromSala(user.sala_atribuida)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">{user.email}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-md text-xs font-bold ${user.tipo_usuario === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                                                user.tipo_usuario === 'RECEPCIONISTA' ? 'bg-blue-100 text-blue-700' :
                                                    user.tipo_usuario === 'SCT' ? 'bg-emerald-100 text-emerald-700' :
                                                        user.tipo_usuario === 'COORDENADOR' ? 'bg-amber-100 text-amber-700' :
                                                            'bg-slate-100 text-slate-700'
                                                }`}>
                                                {user.tipo_usuario === 'RECEPCIONISTA' ? 'RECEPÇÃO' :
                                                    user.tipo_usuario === 'SCT' ? 'SCT' :
                                                        user.tipo_usuario === 'COORDENADOR' ? 'COORDENADOR' :
                                                            user.tipo_usuario}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                {user.ativo ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openEditModal(user)}
                                                    className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-900"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(user.id)}
                                                    className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500"
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

            {/* New User Modal */}
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
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    {editingId ? 'Nova Senha (deixe em branco para manter)' : 'Senha Inicial'}
                                </label>
                                <div className="relative">
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
                                    <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 mb-2">
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
                                            <option value="TODAS">TODAS AS SALAS</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 font-medium hover:bg-slate-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" /> {loading ? 'Salvando...' : (editingId ? 'Salvar Alterações' : 'Criar Usuário')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
