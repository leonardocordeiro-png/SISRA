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
    School,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import NavigationControls from '../../components/NavigationControls';
import { useToast } from '../../components/ui/Toast';

type Turma = {
    id: string;
    nome: string;
    descricao: string | null;
    ativa: boolean;
    sala_id: string | null;
    sala?: { id: string; nome: string } | null;
    alunos_count?: number;
};

type SalaOpcao = { id: string; nome: string };

type FormState = {
    serie: string;
    grau: string;
    secao: string;
    descricao: string;
    ativa: boolean;
    sala_id: string;
};

type ConfirmState = {
    title: string;
    message: string;
    confirmLabel: string;
    tone: 'danger' | 'warning' | 'success';
    icon: typeof AlertTriangle;
    onConfirm: () => Promise<void>;
};

const SERIES = ['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano'];
const GRAUS = ['Ensino Fundamental I'];
const SECOES = [
    '111M', '112T', '113T', '121M', '122T', '123T', '131M', '132M', '133T',
    '141M', '142M', '143T', '144T', '151M', '152M', '153T', '154T',
];

const EMPTY_FORM: FormState = {
    serie: SERIES[0],
    grau: GRAUS[0],
    secao: SECOES[0],
    descricao: '',
    ativa: true,
    sala_id: '',
};

function friendlyError(error: unknown) {
    const message = String((error as { message?: string })?.message ?? error ?? '');
    const map: Record<string, string> = {
        ACESSO_NEGADO: 'Apenas administradores ativos podem gerenciar turmas.',
        NOME_TURMA_INVALIDO: 'Informe uma identificacao valida para a turma.',
        DESCRICAO_MUITO_LONGA: 'A descricao deve ter no maximo 500 caracteres.',
        SALA_INVALIDA: 'Selecione uma sala ativa desta escola.',
        TURMA_DUPLICADA: 'Ja existe uma turma ativa com esta identificacao.',
        TURMA_NAO_ENCONTRADA: 'Turma nao encontrada nesta escola.',
        TURMA_COM_ALUNOS_ATIVOS: 'Esta turma possui alunos vinculados. Remaneje os alunos antes de arquivar.',
    };

    const known = Object.keys(map).find(key => message.includes(key));
    return known ? map[known] : message || 'Erro inesperado.';
}

function parseTurmaName(nome: string): Pick<FormState, 'serie' | 'grau' | 'secao'> {
    const parts = nome.match(/^(.*?) - (.*?) \((.*?)\)$/);
    return {
        serie: parts?.[1] || SERIES[0],
        grau: parts?.[2] || GRAUS[0],
        secao: parts?.[3] || SECOES[0],
    };
}

function buildTurmaName(form: FormState) {
    return `${form.serie} - ${form.grau} (${form.secao})`;
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
        success: 'bg-emerald-600 hover:bg-emerald-700',
    }[state.tone];
    const iconClass = {
        danger: 'bg-red-50 text-red-600',
        warning: 'bg-amber-50 text-amber-600',
        success: 'bg-emerald-50 text-emerald-600',
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

export default function ClassroomManagement() {
    const { escolaId } = useAuth();
    const toast = useToast();
    const [turmas, setTurmas] = useState<Turma[]>([]);
    const [salas, setSalas] = useState<SalaOpcao[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
    const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

    const escola_id = escolaId ?? (import.meta.env.VITE_ESCOLA_ID as string | undefined)?.trim() ?? null;

    const fetchTurmas = useCallback(async () => {
        if (!escola_id) {
            setLoading(false);
            toast.error('Escola nao identificada', 'Faca login novamente.');
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('sisra_list_admin_classrooms', {
                p_escola_id: escola_id,
            });
            if (error) throw error;
            setTurmas(Array.isArray(data) ? data as Turma[] : []);
        } catch (error) {
            toast.error('Erro ao carregar turmas', friendlyError(error));
        } finally {
            setLoading(false);
        }
    }, [escola_id, toast]);

    const fetchSalas = useCallback(async () => {
        if (!escola_id) return;
        try {
            const { data, error } = await supabase.rpc('sisra_list_admin_classroom_rooms', {
                p_escola_id: escola_id,
            });
            if (error) throw error;
            setSalas(Array.isArray(data) ? data as SalaOpcao[] : []);
        } catch (error) {
            toast.warning('Salas indisponiveis', friendlyError(error));
        }
    }, [escola_id, toast]);

    useEffect(() => {
        fetchTurmas();
        fetchSalas();
    }, [fetchTurmas, fetchSalas]);

    const filteredTurmas = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return turmas;
        return turmas.filter(turma =>
            turma.nome.toLowerCase().includes(term) ||
            (turma.descricao || '').toLowerCase().includes(term) ||
            (turma.sala?.nome || '').toLowerCase().includes(term)
        );
    }, [searchTerm, turmas]);

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

    const openEditModal = (turma: Turma) => {
        setEditingId(turma.id);
        setFormData({
            ...parseTurmaName(turma.nome),
            descricao: turma.descricao || '',
            ativa: turma.ativa,
            sala_id: turma.sala_id || '',
        });
        setShowModal(true);
    };

    const handleSave = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!escola_id) return;
        if (formData.descricao.length > 500) {
            toast.error('Descricao muito longa', 'Use no maximo 500 caracteres.');
            return;
        }

        setSaving(true);
        try {
            const { data, error } = await supabase.rpc('sisra_save_admin_classroom', {
                p_escola_id: escola_id,
                p_id: editingId,
                p_nome: buildTurmaName(formData),
                p_descricao: formData.descricao,
                p_ativa: formData.ativa,
                p_sala_id: formData.sala_id || null,
            });
            if (error) throw error;

            const saved = data as Turma;
            setTurmas(current => {
                if (editingId) return current.map(item => item.id === saved.id ? saved : item);
                return [...current, saved].sort((a, b) => a.nome.localeCompare(b.nome));
            });
            toast.success(editingId ? 'Turma atualizada' : 'Turma criada', 'As alteracoes foram salvas.');
            closeModal();
        } catch (error) {
            toast.error('Erro ao salvar turma', friendlyError(error));
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

    const askToggleStatus = (turma: Turma) => {
        const willActivate = !turma.ativa;
        setConfirmState({
            title: willActivate ? 'Ativar turma?' : 'Desativar turma?',
            message: willActivate
                ? `${turma.nome} voltara a aparecer nos cadastros e remanejamentos.`
                : `${turma.nome} deixara de aparecer como opcao ativa, mas permanecera no historico.`,
            confirmLabel: willActivate ? 'Ativar' : 'Desativar',
            tone: willActivate ? 'success' : 'warning',
            icon: willActivate ? Power : PowerOff,
            onConfirm: async () => {
                if (!escola_id) return;
                const { data, error } = await supabase.rpc('sisra_set_admin_classroom_status', {
                    p_escola_id: escola_id,
                    p_id: turma.id,
                    p_ativa: willActivate,
                });
                if (error) {
                    toast.error('Erro ao alterar status', friendlyError(error));
                    return;
                }
                const updated = data as Turma;
                setTurmas(current => current.map(item => item.id === updated.id ? updated : item));
                toast.success(willActivate ? 'Turma ativada' : 'Turma desativada');
            },
        });
    };

    const askArchive = (turma: Turma) => {
        setConfirmState({
            title: 'Arquivar turma?',
            message: turma.alunos_count && turma.alunos_count > 0
                ? `${turma.nome} possui ${turma.alunos_count} aluno(s) vinculado(s). Remaneje-os antes de arquivar.`
                : `${turma.nome} sera removida da lista ativa e mantida apenas para auditoria.`,
            confirmLabel: 'Arquivar',
            tone: 'danger',
            icon: AlertTriangle,
            onConfirm: async () => {
                if (!escola_id) return;
                const { error } = await supabase.rpc('sisra_archive_admin_classroom', {
                    p_escola_id: escola_id,
                    p_id: turma.id,
                });
                if (error) {
                    toast.error('Erro ao arquivar turma', friendlyError(error));
                    return;
                }
                setTurmas(current => current.filter(item => item.id !== turma.id));
                toast.success('Turma arquivada', 'O registro foi preservado para auditoria.');
            },
        });
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="mx-auto max-w-6xl">
                <NavigationControls />
                <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Gerenciar Turmas</h1>
                        <p className="text-slate-500">Cadastro, salas de saida e status operacional das turmas.</p>
                    </div>
                    <button
                        type="button"
                        onClick={openCreateModal}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white shadow-lg shadow-emerald-600/20 transition-colors hover:bg-emerald-700"
                    >
                        <Plus className="h-5 w-5" /> Nova Turma
                    </button>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 bg-slate-50/50 p-4">
                        <div className="relative max-w-md">
                            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar turmas..."
                                value={searchTerm}
                                onChange={event => setSearchTerm(event.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 outline-none transition-all focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/50">
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Identificacao da Turma</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Sala de Saida</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Alunos</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Acoes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading && turmas.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center">
                                            <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-emerald-500" />
                                            <p className="text-slate-500">Carregando turmas...</p>
                                        </td>
                                    </tr>
                                ) : filteredTurmas.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                            Nenhuma turma encontrada.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTurmas.map(turma => (
                                        <tr key={turma.id} className="group transition-colors hover:bg-slate-50/50">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${turma.ativa ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                                        <School className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <span className={`font-semibold ${turma.ativa ? 'text-slate-900' : 'text-slate-400'}`}>{turma.nome}</span>
                                                        {turma.descricao && <p className="mt-0.5 text-xs text-slate-500">{turma.descricao}</p>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {turma.sala ? (
                                                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                                                        <DoorOpen className="h-3 w-3" />
                                                        {turma.sala.nome}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs italic text-slate-400">Nao vinculada</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                                                    {turma.alunos_count ?? 0}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-widest ${turma.ativa ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                    {turma.ativa ? 'Ativa' : 'Inativa'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                                                    <button
                                                        type="button"
                                                        onClick={() => openEditModal(turma)}
                                                        className="rounded-lg p-2 text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600"
                                                        title="Editar"
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => askToggleStatus(turma)}
                                                        className={`rounded-lg p-2 transition-all ${turma.ativa ? 'text-slate-400 hover:bg-amber-50 hover:text-amber-600' : 'text-emerald-500 hover:bg-emerald-50 hover:text-emerald-600'}`}
                                                        title={turma.ativa ? 'Desativar' : 'Ativar'}
                                                    >
                                                        {turma.ativa ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => askArchive(turma)}
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
                                {editingId ? 'Editar Turma' : 'Nova Turma'}
                            </h2>
                            <button type="button" onClick={closeModal} className="text-slate-400 transition-colors hover:text-slate-600">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="space-y-4 p-6">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Serie</label>
                                <select
                                    required
                                    value={formData.serie}
                                    onChange={event => setFormData(current => ({ ...current, serie: event.target.value }))}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition-all focus:ring-2 focus:ring-emerald-500"
                                >
                                    {SERIES.map(serie => <option key={serie} value={serie}>{serie}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Grau</label>
                                <select
                                    required
                                    value={formData.grau}
                                    onChange={event => setFormData(current => ({ ...current, grau: event.target.value }))}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition-all focus:ring-2 focus:ring-emerald-500"
                                >
                                    {GRAUS.map(grau => <option key={grau} value={grau}>{grau}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Turma / Secao</label>
                                <select
                                    required
                                    value={formData.secao}
                                    onChange={event => setFormData(current => ({ ...current, secao: event.target.value }))}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition-all focus:ring-2 focus:ring-emerald-500"
                                >
                                    {SECOES.map(secao => <option key={secao} value={secao}>{secao}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Sala de Saida</label>
                                <div className="relative">
                                    <DoorOpen className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <select
                                        value={formData.sala_id}
                                        onChange={event => setFormData(current => ({ ...current, sala_id: event.target.value }))}
                                        className="w-full appearance-none rounded-lg border border-slate-300 py-2 pl-9 pr-4 outline-none transition-all focus:ring-2 focus:ring-emerald-500"
                                    >
                                        <option value="">Nenhuma sala vinculada</option>
                                        {salas.map(sala => <option key={sala.id} value={sala.id}>{sala.nome}</option>)}
                                    </select>
                                </div>
                                {salas.length === 0 && (
                                    <p className="mt-1 text-xs text-amber-600">
                                        Nenhuma sala ativa encontrada. <a href="/admin/salas" className="font-bold underline">Crie salas de saida</a> primeiro.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Descricao (opcional)</label>
                                <textarea
                                    rows={3}
                                    maxLength={500}
                                    placeholder="Detalhes adicionais sobre a turma..."
                                    value={formData.descricao}
                                    onChange={event => setFormData(current => ({ ...current, descricao: event.target.value }))}
                                    className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 outline-none transition-all focus:ring-2 focus:ring-emerald-500"
                                />
                                <p className="mt-1 text-right text-[10px] text-slate-400">{formData.descricao.length}/500</p>
                            </div>

                            {editingId && (
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={formData.ativa}
                                        onChange={event => setFormData(current => ({ ...current, ativa: event.target.checked }))}
                                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    Turma ativa
                                </label>
                            )}

                            <div className="flex justify-end gap-3 pt-4">
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
                                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2 font-bold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    {saving ? 'Salvando...' : editingId ? 'Salvar Alteracoes' : 'Criar Turma'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
