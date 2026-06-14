import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
    AlertTriangle,
    DoorOpen,
    Edit2,
    Loader2,
    Plus,
    Power,
    PowerOff,
    Save,
    Search,
    Trash2,
    Users,
    X,
} from 'lucide-react';
import NavigationControls from '../../components/NavigationControls';
import { useToast } from '../../components/ui/Toast';

type Sala = {
    id: string;
    nome: string;
    descricao: string | null;
    ativa: boolean;
    turmas_count?: number;
    criado_em?: string;
    atualizado_em?: string | null;
};

type FormState = {
    nome: string;
    descricao: string;
    ativa: boolean;
};

type ConfirmState = {
    title: string;
    message: string;
    confirmLabel: string;
    tone: 'danger' | 'warning' | 'success';
    icon: typeof AlertTriangle;
    onConfirm: () => Promise<void>;
};

const DEFAULT_FORM: FormState = { nome: '', descricao: '', ativa: true };

function friendlyError(error: unknown) {
    const message = String((error as { message?: string })?.message ?? error ?? '');
    const map: Record<string, string> = {
        ACESSO_NEGADO: 'Apenas administradores ativos podem gerenciar salas.',
        NOME_SALA_INVALIDO: 'Informe um nome valido com ate 120 caracteres.',
        DESCRICAO_MUITO_LONGA: 'A descricao deve ter no maximo 500 caracteres.',
        SALA_DUPLICADA: 'Ja existe uma sala ativa com este nome.',
        SALA_NAO_ENCONTRADA: 'Sala nao encontrada nesta escola.',
        SALA_COM_TURMAS_VINCULADAS: 'Esta sala possui turmas vinculadas. Desvincule as turmas antes de arquivar.',
    };

    const known = Object.keys(map).find(key => message.includes(key));
    return known ? map[known] : message || 'Erro inesperado.';
}

function ConfirmModal({
    state,
    loading,
    onCancel,
}: {
    state: ConfirmState;
    loading: boolean;
    onCancel: () => void;
}) {
    const Icon = state.icon;
    const buttonClass = {
        danger: 'bg-red-600 hover:bg-red-700',
        warning: 'bg-amber-500 hover:bg-amber-600',
        success: 'bg-blue-600 hover:bg-blue-700',
    }[state.tone];
    const iconClass = {
        danger: 'bg-red-50 text-red-600',
        warning: 'bg-amber-50 text-amber-600',
        success: 'bg-blue-50 text-blue-600',
    }[state.tone];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
                <div className="flex flex-col items-center gap-4 p-6 text-center">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-full ${iconClass}`}>
                        <Icon className="h-7 w-7" />
                    </div>
                    <div>
                        <h3 className="mb-1 text-lg font-bold text-slate-900">{state.title}</h3>
                        <p className="text-sm leading-relaxed text-slate-500">{state.message}</p>
                    </div>
                    <div className="flex w-full gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={loading}
                            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={state.onConfirm}
                            disabled={loading}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-bold text-white transition-colors disabled:opacity-50 ${buttonClass}`}
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                            {loading ? 'Aguarde...' : state.confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function SalaManagement() {
    const { escolaId } = useAuth();
    const toast = useToast();

    const [salas, setSalas] = useState<Sala[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState<FormState>(DEFAULT_FORM);
    const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

    const fetchSalas = useCallback(async () => {
        if (!escolaId) {
            setLoading(false);
            toast.error('Escola nao identificada', 'Faca login novamente.');
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('sisra_list_admin_exit_rooms', {
                p_escola_id: escolaId,
            });
            if (error) throw error;
            setSalas(Array.isArray(data) ? data as Sala[] : []);
        } catch (error) {
            toast.error('Erro ao carregar salas', friendlyError(error));
        } finally {
            setLoading(false);
        }
    }, [escolaId, toast]);

    useEffect(() => {
        fetchSalas();
    }, [fetchSalas]);

    const filtered = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return salas;
        return salas.filter(sala =>
            sala.nome.toLowerCase().includes(term) ||
            (sala.descricao || '').toLowerCase().includes(term)
        );
    }, [salas, searchTerm]);

    const closeModal = () => {
        setShowModal(false);
        setEditingId(null);
        setFormData(DEFAULT_FORM);
    };

    const openCreateModal = () => {
        setEditingId(null);
        setFormData(DEFAULT_FORM);
        setShowModal(true);
    };

    const openEditModal = (sala: Sala) => {
        setEditingId(sala.id);
        setFormData({ nome: sala.nome, descricao: sala.descricao || '', ativa: sala.ativa });
        setShowModal(true);
    };

    const handleSave = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!escolaId) return;
        if (!formData.nome.trim()) {
            toast.error('Nome obrigatorio', 'Informe um nome para a sala de saida.');
            return;
        }
        if (formData.descricao.length > 500) {
            toast.error('Descricao muito longa', 'Use no maximo 500 caracteres.');
            return;
        }

        setSaving(true);
        try {
            const { data, error } = await supabase.rpc('sisra_save_admin_exit_room', {
                p_escola_id: escolaId,
                p_id: editingId,
                p_nome: formData.nome,
                p_descricao: formData.descricao,
                p_ativa: formData.ativa,
            });
            if (error) throw error;

            const saved = data as Sala;
            setSalas(current => {
                if (editingId) return current.map(item => item.id === saved.id ? saved : item);
                return [...current, saved].sort((a, b) => a.nome.localeCompare(b.nome));
            });
            toast.success(editingId ? 'Sala atualizada' : 'Sala criada', 'As alteracoes foram salvas.');
            closeModal();
        } catch (error) {
            toast.error('Erro ao salvar sala', friendlyError(error));
        } finally {
            setSaving(false);
        }
    };

    const runConfirmedAction = async () => {
        if (!confirmState) return;
        setActionLoading(true);
        try {
            await confirmState.onConfirm();
            setConfirmState(null);
        } finally {
            setActionLoading(false);
        }
    };

    const askToggleActive = (sala: Sala) => {
        const willActivate = !sala.ativa;
        setConfirmState({
            title: willActivate ? 'Ativar sala?' : 'Desativar sala?',
            message: willActivate
                ? `${sala.nome} voltara a aparecer como sala disponivel para vincular turmas.`
                : `${sala.nome} deixara de aparecer como opcao ativa, mas os vinculos existentes serao preservados.`,
            confirmLabel: willActivate ? 'Ativar' : 'Desativar',
            tone: willActivate ? 'success' : 'warning',
            icon: willActivate ? Power : PowerOff,
            onConfirm: async () => {
                if (!escolaId) return;
                const { data, error } = await supabase.rpc('sisra_set_admin_exit_room_status', {
                    p_escola_id: escolaId,
                    p_id: sala.id,
                    p_ativa: willActivate,
                });
                if (error) {
                    toast.error('Erro ao alterar status', friendlyError(error));
                    return;
                }
                const updated = data as Sala;
                setSalas(current => current.map(item => item.id === updated.id ? updated : item));
                toast.success(willActivate ? 'Sala ativada' : 'Sala desativada');
            },
        });
    };

    const askArchive = (sala: Sala) => {
        setConfirmState({
            title: 'Arquivar sala?',
            message: sala.turmas_count && sala.turmas_count > 0
                ? `${sala.nome} possui ${sala.turmas_count} turma(s) vinculada(s). Desvincule em /admin/turmas antes de arquivar.`
                : `${sala.nome} sera removida da lista ativa e mantida no historico de auditoria.`,
            confirmLabel: 'Arquivar',
            tone: 'danger',
            icon: AlertTriangle,
            onConfirm: async () => {
                if (!escolaId) return;
                const { error } = await supabase.rpc('sisra_archive_admin_exit_room', {
                    p_escola_id: escolaId,
                    p_id: sala.id,
                });
                if (error) {
                    toast.error('Erro ao arquivar sala', friendlyError(error));
                    return;
                }
                setSalas(current => current.filter(item => item.id !== sala.id));
                toast.success('Sala arquivada', 'O registro foi preservado para auditoria.');
            },
        });
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="mx-auto max-w-5xl">
                <NavigationControls />

                <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Salas de Saida</h1>
                        <p className="text-slate-500">Cadastre e gerencie os locais fisicos onde os alunos aguardam a retirada.</p>
                    </div>
                    <button
                        type="button"
                        onClick={openCreateModal}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-700"
                    >
                        <Plus className="h-5 w-5" /> Nova Sala
                    </button>
                </div>

                <div className="mb-6 flex gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                    <DoorOpen className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
                    <p className="text-sm leading-relaxed text-blue-700">
                        As salas de saida sao os locais onde os alunos aguardam durante a retirada. Depois de criar as salas aqui,
                        vincule cada turma a sua sala em <a href="/admin/turmas" className="font-bold underline">Gerenciar Turmas</a>.
                    </p>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 bg-slate-50/50 p-4">
                        <div className="relative max-w-md">
                            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar salas..."
                                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 outline-none transition-all focus:ring-2 focus:ring-blue-500"
                                value={searchTerm}
                                onChange={event => setSearchTerm(event.target.value)}
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/50">
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Sala de Saida</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Descricao</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Turmas Vinculadas</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Acoes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading && salas.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center">
                                            <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-blue-500" />
                                            <p className="text-slate-500">Carregando salas...</p>
                                        </td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center">
                                            <DoorOpen className="mx-auto mb-3 h-12 w-12 text-slate-200" />
                                            <p className="font-medium text-slate-500">Nenhuma sala encontrada.</p>
                                            <p className="mt-1 text-sm text-slate-400">Crie uma nova sala ou ajuste a busca.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map(sala => (
                                        <tr key={sala.id} className="group transition-colors hover:bg-slate-50/50">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${sala.ativa ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                                        <DoorOpen className="h-4 w-4" />
                                                    </div>
                                                    <span className={`font-semibold ${sala.ativa ? 'text-slate-900' : 'text-slate-400 italic'}`}>{sala.nome}</span>
                                                </div>
                                            </td>
                                            <td className="max-w-sm px-6 py-4 text-sm text-slate-500">
                                                {sala.descricao || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                                                    <Users className="h-3 w-3" />
                                                    {sala.turmas_count ?? 0} turma{sala.turmas_count !== 1 ? 's' : ''}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-widest ${sala.ativa ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                                                    {sala.ativa ? 'Ativa' : 'Inativa'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                                                    <button
                                                        type="button"
                                                        onClick={() => openEditModal(sala)}
                                                        className="rounded-lg p-2 text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600"
                                                        title="Editar"
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => askToggleActive(sala)}
                                                        className={`rounded-lg p-2 transition-all ${sala.ativa ? 'text-slate-400 hover:bg-amber-50 hover:text-amber-600' : 'text-blue-500 hover:bg-blue-50 hover:text-blue-600'}`}
                                                        title={sala.ativa ? 'Desativar' : 'Ativar'}
                                                    >
                                                        {sala.ativa ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => askArchive(sala)}
                                                        className="rounded-lg p-2 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
                                                        title="Arquivar"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
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

            {confirmState && (
                <ConfirmModal
                    state={{ ...confirmState, onConfirm: runConfirmedAction }}
                    loading={actionLoading}
                    onCancel={() => setConfirmState(null)}
                />
            )}

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                            <h2 className="text-lg font-bold text-slate-900">
                                {editingId ? 'Editar Sala de Saida' : 'Nova Sala de Saida'}
                            </h2>
                            <button type="button" onClick={closeModal} className="text-slate-400 transition-colors hover:text-slate-600">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="space-y-4 p-6">
                            <div>
                                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                    Nome da Sala *
                                </label>
                                <input
                                    required
                                    autoFocus
                                    type="text"
                                    maxLength={120}
                                    placeholder="Ex: Sala 101, Sala Principal, Auditorio..."
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-medium outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                                    value={formData.nome}
                                    onChange={event => setFormData(current => ({ ...current, nome: event.target.value }))}
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                    Descricao <span className="font-normal text-slate-400">(opcional)</span>
                                </label>
                                <textarea
                                    rows={3}
                                    maxLength={500}
                                    placeholder="Localizacao, caracteristicas ou observacoes..."
                                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                                    value={formData.descricao}
                                    onChange={event => setFormData(current => ({ ...current, descricao: event.target.value }))}
                                />
                                <p className="mt-1 text-right text-[10px] text-slate-400">{formData.descricao.length}/500</p>
                            </div>

                            {editingId && (
                                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 transition-all hover:border-blue-200">
                                    <input
                                        type="checkbox"
                                        checked={formData.ativa}
                                        onChange={event => setFormData(current => ({ ...current, ativa: event.target.checked }))}
                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-medium text-slate-700">Sala ativa no sistema</span>
                                </label>
                            )}

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="rounded-lg px-4 py-2 font-medium text-slate-600 transition-colors hover:bg-slate-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    {saving ? 'Salvando...' : editingId ? 'Salvar Alteracoes' : 'Criar Sala'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
