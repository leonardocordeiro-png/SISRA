import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Plus, Search, Trash2, Edit2, Save, X, DoorOpen, Loader2, Power, PowerOff, Users } from 'lucide-react';
import NavigationControls from '../../components/NavigationControls';
import { useToast } from '../../components/ui/Toast';

type Sala = {
    id: string;
    nome: string;
    descricao: string | null;
    ativa: boolean;
    turmas_count?: number;
};

const DEFAULT_FORM = { nome: '', descricao: '', ativa: true };

export default function SalaManagement() {
    const { escolaId } = useAuth();
    const toast = useToast();

    const [salas, setSalas] = useState<Sala[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState(DEFAULT_FORM);

    useEffect(() => {
        fetchSalas();
    }, []);

    const fetchSalas = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('salas')
            .select('id, nome, descricao, ativa')
            .order('nome');

        if (error) {
            toast.error('Erro ao carregar salas', error.message);
        } else if (data) {
            // Count turmas linked to each sala
            const { data: turmasData } = await supabase
                .from('turmas')
                .select('sala_id')
                .not('sala_id', 'is', null);

            const countMap: Record<string, number> = {};
            (turmasData || []).forEach((t: any) => {
                if (t.sala_id) countMap[t.sala_id] = (countMap[t.sala_id] || 0) + 1;
            });

            setSalas(data.map(s => ({ ...s, turmas_count: countMap[s.id] || 0 })));
        }
        setLoading(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nome.trim()) {
            toast.error('Nome obrigatório', 'Informe um nome para a sala de saída.');
            return;
        }

        setSaving(true);
        try {
            if (editingId) {
                const { error } = await supabase
                    .from('salas')
                    .update({ nome: formData.nome.trim(), descricao: formData.descricao || null, ativa: formData.ativa })
                    .eq('id', editingId);
                if (error) throw error;
                toast.success('Sala atualizada', 'As alterações foram salvas.');
            } else {
                const escola_id = escolaId || import.meta.env.VITE_ESCOLA_ID;
                if (!escola_id) throw new Error('Escola não identificada. Faça login novamente.');

                const { error } = await supabase
                    .from('salas')
                    .insert({ nome: formData.nome.trim(), descricao: formData.descricao || null, escola_id, ativa: true });
                if (error) throw error;
                toast.success('Sala criada', 'A sala de saída foi adicionada ao sistema.');
            }
            closeModal();
            fetchSalas();
        } catch (err: any) {
            toast.error('Erro ao salvar', err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (sala: Sala) => {
        setEditingId(sala.id);
        setFormData({ nome: sala.nome, descricao: sala.descricao || '', ativa: sala.ativa });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingId(null);
        setFormData(DEFAULT_FORM);
    };

    const handleToggleActive = async (sala: Sala) => {
        try {
            const { error } = await supabase
                .from('salas')
                .update({ ativa: !sala.ativa })
                .eq('id', sala.id);
            if (error) throw error;
            fetchSalas();
        } catch (err: any) {
            toast.error('Erro ao alterar status', err.message);
        }
    };

    const handleDelete = async (sala: Sala) => {
        if (sala.turmas_count && sala.turmas_count > 0) {
            toast.error('Sala em uso', `Esta sala está vinculada a ${sala.turmas_count} turma(s). Desvincule as turmas antes de excluir.`);
            return;
        }
        if (!confirm(`Excluir permanentemente "${sala.nome}"? Esta ação não pode ser desfeita.`)) return;

        try {
            const { error } = await supabase.from('salas').delete().eq('id', sala.id);
            if (error) throw error;
            toast.success('Sala excluída', 'A sala foi removida do sistema.');
            fetchSalas();
        } catch (err: any) {
            toast.error('Erro ao excluir', err.message);
        }
    };

    const filtered = salas.filter(s =>
        s.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.descricao || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-5xl mx-auto">
                <NavigationControls />

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Salas de Saída</h1>
                        <p className="text-slate-500">Cadastre e gerencie as salas físicas onde os alunos aguardam a retirada.</p>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
                    >
                        <Plus className="w-5 h-5" /> Nova Sala
                    </button>
                </div>

                {/* Info banner */}
                <div className="mb-6 bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3 items-start">
                    <DoorOpen className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-700 leading-relaxed">
                        As salas de saída são os locais físicos onde os alunos aguardam durante a retirada (ex: Sala 101, Sala 102).
                        Depois de criar as salas aqui, vincule cada turma à sua sala em{' '}
                        <a href="/admin/turmas" className="font-bold underline">Gerenciar Turmas</a>.
                        O sistema usará essa vinculação ao cadastrar novos alunos automaticamente.
                    </p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-200 bg-slate-50/50">
                        <div className="relative max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar salas..."
                                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-200">
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Sala de Saída</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Descrição</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Turmas Vinculadas</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading && salas.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center">
                                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
                                            <p className="text-slate-500">Carregando salas...</p>
                                        </td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center">
                                            <DoorOpen className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                            <p className="text-slate-500 font-medium">Nenhuma sala cadastrada.</p>
                                            <p className="text-slate-400 text-sm mt-1">Clique em "Nova Sala" para começar.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map(sala => (
                                        <tr key={sala.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${sala.ativa ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                                        <DoorOpen className="w-4 h-4" />
                                                    </div>
                                                    <span className={`font-semibold ${sala.ativa ? 'text-slate-900' : 'text-slate-400 italic'}`}>{sala.nome}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500">{sala.descricao || '—'}</td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-600">
                                                    <Users className="w-3 h-3" />
                                                    {sala.turmas_count ?? 0} turma{sala.turmas_count !== 1 ? 's' : ''}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${sala.ativa ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                                                    {sala.ativa ? 'Ativa' : 'Inativa'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleEdit(sala)}
                                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                        title="Editar"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleActive(sala)}
                                                        className={`p-2 rounded-lg transition-all ${sala.ativa ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                                                        title={sala.ativa ? 'Desativar' : 'Ativar'}
                                                    >
                                                        {sala.ativa ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(sala)}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                        title="Excluir"
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
            </div>

            {/* Modal criar/editar */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h2 className="text-lg font-bold text-slate-900">
                                {editingId ? 'Editar Sala de Saída' : 'Nova Sala de Saída'}
                            </h2>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                    Nome da Sala *
                                </label>
                                <input
                                    required
                                    autoFocus
                                    type="text"
                                    placeholder="Ex: Sala 101, Sala Principal, Auditório..."
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium"
                                    value={formData.nome}
                                    onChange={e => setFormData(f => ({ ...f, nome: e.target.value }))}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                    Descrição <span className="text-slate-400 font-normal">(opcional)</span>
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="Localização, características ou observações..."
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all resize-none"
                                    value={formData.descricao}
                                    onChange={e => setFormData(f => ({ ...f, descricao: e.target.value }))}
                                />
                            </div>

                            {editingId && (
                                <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer border border-slate-100 hover:border-blue-200 transition-all">
                                    <input
                                        type="checkbox"
                                        checked={formData.ativa}
                                        onChange={e => setFormData(f => ({ ...f, ativa: e.target.checked }))}
                                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-medium text-slate-700">Sala ativa no sistema</span>
                                </label>
                            )}

                            <div className="pt-2 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {editingId ? 'Salvar Alterações' : 'Criar Sala'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
