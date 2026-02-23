import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Search, Trash2, Edit2, Save, X, School, Loader2, Power, PowerOff } from 'lucide-react';
import NavigationControls from '../../components/NavigationControls';
import { useToast } from '../../components/ui/Toast';

type Turma = {
    id: string;
    nome: string;
    descricao: string;
    ativa: boolean;
};

export default function ClassroomManagement() {
    const [turmas, setTurmas] = useState<Turma[]>([]);
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [formData, setFormData] = useState({
        serie: '1º Ano',
        grau: 'Ensino Fundamental I',
        secao: '111M',
        descricao: '',
        ativa: true
    });

    const SERIES = ['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano'];
    const GRAUS = ['Ensino Fundamental I'];
    const SECOES = [
        '111M', '112T', '113T', '121M', '122T', '123T', '131M', '132M', '133T',
        '141M', '142M', '143T', '144T', '151M', '152M', '153T', '154T'
    ];

    useEffect(() => {
        fetchTurmas();
    }, []);

    const fetchTurmas = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('turmas')
            .select('*')
            .order('nome');

        if (!error && data) {
            setTurmas(data);
        }
        setLoading(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);

            // Get escola_id - in a real app this comes from context
            const { data: userData } = await supabase.auth.getUser();
            const { data: profile } = await supabase.from('usuarios').select('escola_id').eq('id', userData.user?.id).single();
            const escola_id = profile?.escola_id || 'e6328325-1845-420a-b333-87a747953259';

            const nomeCompleto = `${formData.serie} - ${formData.grau} (${formData.secao})`;

            if (editingId) {
                const { error } = await supabase
                    .from('turmas')
                    .update({
                        nome: nomeCompleto,
                        descricao: formData.descricao,
                        ativa: formData.ativa
                    })
                    .eq('id', editingId);

                if (error) throw error;
                toast.success('Turma atualizada', 'As alterações foram salvas com sucesso.');
            } else {
                const { error } = await supabase
                    .from('turmas')
                    .insert([{
                        escola_id,
                        nome: nomeCompleto,
                        descricao: formData.descricao,
                        ativa: true
                    }]);

                if (error) throw error;
                toast.success('Turma criada', 'A nova turma foi adicionada ao sistema.');
            }

            closeModal();
            fetchTurmas();
        } catch (error: any) {
            console.error('Error saving turma:', error);
            toast.error('Erro ao salvar turma', error.message || 'Verifique se a turma já existe.');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (turma: Turma) => {
        // Attempt to parse existing name: "1º Ano - Ensino Fundamental I (111M)"
        const parts = turma.nome.match(/^(.*?) - (.*?) \((.*?)\)$/);

        setEditingId(turma.id);
        setFormData({
            serie: parts ? parts[1] : '1º Ano',
            grau: parts ? parts[2] : 'Ensino Fundamental I',
            secao: parts ? parts[3] : '111M',
            descricao: turma.descricao || '',
            ativa: turma.ativa
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingId(null);
        setFormData({
            serie: '1º Ano',
            grau: 'Ensino Fundamental I',
            secao: '111M',
            descricao: '',
            ativa: true
        });
    };

    const handleToggleActive = async (turma: Turma) => {
        const action = turma.ativa ? 'desativar' : 'ativar';
        if (!confirm(`Deseja realmente ${action} esta turma?`)) return;

        try {
            const { error } = await supabase
                .from('turmas')
                .update({ ativa: !turma.ativa })
                .eq('id', turma.id);

            if (error) throw error;
            fetchTurmas();
        } catch (error: any) {
            console.error('Error toggling turma status:', error);
            toast.error('Erro ao alterar status', error.message);
        }
    };

    const handlePermanentDelete = async (id: string) => {
        if (!confirm('ATENÇÃO: Esta ação é irreversível e excluirá permanentemente a turma. Deseja continuar?')) return;

        try {
            const { error } = await supabase
                .from('turmas')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success('Turma excluída', 'A turma foi removida permanentemente.');
            fetchTurmas();
        } catch (error: any) {
            console.error('Error deleting turma:', error);
            toast.error('Erro ao excluir', error.message);
        }
    };

    const filteredTurmas = turmas.filter(t =>
        t.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-6xl mx-auto">
                <NavigationControls />
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Gerenciar Turmas</h1>
                        <p className="text-slate-500">Cadastro e organização das salas de aula do sistema.</p>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
                    >
                        <Plus className="w-5 h-5" /> Nova Turma
                    </button>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-200 bg-slate-50/50">
                        <div className="relative max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar turmas..."
                                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-200">
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Identificação da Turma</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Descrição</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading && turmas.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center">
                                            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-2" />
                                            <p className="text-slate-500">Carregando turmas...</p>
                                        </td>
                                    </tr>
                                ) : filteredTurmas.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                            Nenhuma turma encontrada.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTurmas.map(turma => (
                                        <tr key={turma.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${turma.ativa ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                                        <School className="w-4 h-4" />
                                                    </div>
                                                    <span className={`font-semibold ${turma.ativa ? 'text-slate-900' : 'text-slate-400 italic'}`}>{turma.nome}</span>
                                                </div>
                                            </td>
                                            <td className={`px-6 py-4 text-sm ${turma.ativa ? 'text-slate-500' : 'text-slate-400 italic'}`}>
                                                {turma.descricao || '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${turma.ativa ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                                    }`}>
                                                    {turma.ativa ? 'Ativa' : 'Inativa'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleEdit(turma)}
                                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                        title="Editar"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleActive(turma)}
                                                        className={`p-2 transition-all rounded-lg ${turma.ativa ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                                                        title={turma.ativa ? 'Desativar' : 'Ativar'}
                                                    >
                                                        {turma.ativa ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                                                    </button>
                                                    <button
                                                        onClick={() => handlePermanentDelete(turma.id)}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                        title="Excluir Permanentemente"
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

            {/* Modal de Cadastro/Edição */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h2 className="text-lg font-bold text-slate-900">
                                {editingId ? 'Editar Turma' : 'Nova Turma'}
                            </h2>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Série</label>
                                <select
                                    required
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                    value={formData.serie}
                                    onChange={e => setFormData({ ...formData, serie: e.target.value })}
                                >
                                    {SERIES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Grau</label>
                                <select
                                    required
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                    value={formData.grau}
                                    onChange={e => setFormData({ ...formData, grau: e.target.value })}
                                >
                                    {GRAUS.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Turma / Seção</label>
                                <select
                                    required
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                    value={formData.secao}
                                    onChange={e => setFormData({ ...formData, secao: e.target.value })}
                                >
                                    {SECOES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição (Opcional)</label>
                                <textarea
                                    rows={3}
                                    placeholder="Detalhes adicionais sobre a turma..."
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none"
                                    value={formData.descricao}
                                    onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                                />
                            </div>

                            {editingId && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="ativa"
                                        checked={formData.ativa}
                                        onChange={e => setFormData({ ...formData, ativa: e.target.checked })}
                                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                                    />
                                    <label htmlFor="ativa" className="text-sm font-medium text-slate-700">Turma Ativa</label>
                                </div>
                            )}

                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {editingId ? 'Salvar Alterações' : 'Criar Turma'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
