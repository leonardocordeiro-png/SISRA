import { useCallback, useEffect, useState } from 'react';
import {
    AlertTriangle,
    CheckCircle,
    Clock,
    Loader2,
    Moon,
    Play,
    RefreshCw,
    Sun,
    X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import NavigationControls from '../../components/NavigationControls';
import { useToast } from '../../components/ui/Toast';

type Preview = {
    total: number;
    morning: number;
    afternoon: number;
    unknown: number;
    unknown_examples: string[];
};

type Result = {
    updated: number;
    skipped: number;
    errors: number;
    morning?: number;
    afternoon?: number;
};

const EMPTY_PREVIEW: Preview = {
    total: 0,
    morning: 0,
    afternoon: 0,
    unknown: 0,
    unknown_examples: [],
};

function friendlyError(error: unknown) {
    const message = String((error as { message?: string })?.message ?? error ?? '');
    const map: Record<string, string> = {
        ACESSO_NEGADO: 'Apenas administradores ativos podem executar esta manutencao.',
        HORARIO_INVALIDO: 'Informe horarios validos no formato HH:MM.',
        JANELA_HORARIO_INVALIDA: 'O horario final deve ser posterior ao horario inicial.',
    };

    const known = Object.keys(map).find(key => message.includes(key));
    return known ? map[known] : message || 'Erro inesperado.';
}

function normalizePreview(data: unknown): Preview {
    const payload = (data ?? {}) as Partial<Preview>;
    return {
        total: Number(payload.total ?? 0),
        morning: Number(payload.morning ?? 0),
        afternoon: Number(payload.afternoon ?? 0),
        unknown: Number(payload.unknown ?? 0),
        unknown_examples: Array.isArray(payload.unknown_examples)
            ? payload.unknown_examples.map(String)
            : [],
    };
}

function ConfirmRunModal({
    total,
    morningWindow,
    afternoonWindow,
    loading,
    onCancel,
    onConfirm,
}: {
    total: number;
    morningWindow: string;
    afternoonWindow: string;
    loading: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900">Executar atualizacao?</h3>
                            <p className="text-xs text-slate-500">Esta acao altera horarios em massa.</p>
                        </div>
                    </div>
                    <button type="button" onClick={onCancel} disabled={loading} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="space-y-4 p-6">
                    <p className="text-sm leading-relaxed text-slate-600">
                        O sistema vai atualizar a janela semanal de retirada de <strong>{total}</strong> aluno(s)
                        identificados por periodo. Configuracoes sensiveis existentes serao preservadas.
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">Manha</p>
                            <p className="mt-1 font-bold text-amber-700">{morningWindow}</p>
                        </div>
                        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Tarde</p>
                            <p className="mt-1 font-bold text-blue-700">{afternoonWindow}</p>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={loading}
                            className="rounded-lg px-4 py-2 font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={loading}
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 font-bold text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                            {loading ? 'Atualizando...' : 'Confirmar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function MassScheduleUpdate() {
    const { escolaId } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();

    const [preview, setPreview] = useState<Preview>(EMPTY_PREVIEW);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [done, setDone] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [results, setResults] = useState<Result | null>(null);

    const [morningStart, setMorningStart] = useState('11:50');
    const [morningEnd, setMorningEnd] = useState('13:20');
    const [afternoonStart, setAfternoonStart] = useState('17:50');
    const [afternoonEnd, setAfternoonEnd] = useState('19:00');

    const morningConflict = morningStart >= morningEnd;
    const afternoonConflict = afternoonStart >= afternoonEnd;
    const anyConflict = morningConflict || afternoonConflict;
    const eligibleTotal = preview.morning + preview.afternoon;

    const loadPreview = useCallback(async () => {
        if (!escolaId) {
            setLoading(false);
            toast.error('Escola nao identificada', 'Faca login novamente.');
            return;
        }

        setLoading(true);
        setDone(false);
        setResults(null);

        try {
            const { data, error } = await supabase.rpc('sisra_preview_admin_schedule_maintenance', {
                p_escola_id: escolaId,
            });
            if (error) throw error;
            setPreview(normalizePreview(data));
        } catch (error) {
            toast.error('Erro ao carregar alunos', friendlyError(error));
        } finally {
            setLoading(false);
        }
    }, [escolaId, toast]);

    useEffect(() => {
        loadPreview();
    }, [loadPreview]);

    const handleRunUpdate = async () => {
        if (!escolaId || running || anyConflict || eligibleTotal === 0) return;
        setRunning(true);

        try {
            const { data, error } = await supabase.rpc('sisra_run_admin_schedule_maintenance', {
                p_escola_id: escolaId,
                p_morning_start: morningStart,
                p_morning_end: morningEnd,
                p_afternoon_start: afternoonStart,
                p_afternoon_end: afternoonEnd,
            });
            if (error) throw error;

            const payload = data as Result;
            setResults({
                updated: Number(payload?.updated ?? 0),
                skipped: Number(payload?.skipped ?? 0),
                errors: Number(payload?.errors ?? 0),
                morning: Number(payload?.morning ?? 0),
                afternoon: Number(payload?.afternoon ?? 0),
            });
            setDone(true);
            setShowConfirm(false);
            toast.success('Atualizacao concluida', `${Number(payload?.updated ?? 0)} alunos atualizados com sucesso.`);
        } catch (error) {
            toast.error('Erro na atualizacao', friendlyError(error));
        } finally {
            setRunning(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800">
            <div className="mx-auto max-w-4xl px-6 py-8">
                <NavigationControls />

                <div className="mb-10">
                    <h1 className="mb-2 text-3xl font-bold text-slate-900">Manutencao de Horarios</h1>
                    <p className="text-slate-500">
                        Atualize a janela semanal de retirada dos alunos por periodo, com execucao segura no banco de dados.
                    </p>
                </div>

                <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className={`rounded-3xl border bg-white p-6 shadow-sm transition-all ${morningConflict ? 'border-red-300' : 'border-slate-200'}`}>
                        <div className="mb-5 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
                                <Sun className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900">Periodo da Manha</h3>
                                <p className="text-xs text-slate-400">Turmas com codigo terminando em M</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400">Inicio</label>
                                <input
                                    type="time"
                                    value={morningStart}
                                    onChange={event => setMorningStart(event.target.value)}
                                    className={`w-full rounded-xl border bg-amber-50 px-4 py-3 text-sm font-bold outline-none transition-all focus:ring-2 ${morningConflict ? 'border-red-300 focus:ring-red-200' : 'border-amber-200 focus:border-amber-400 focus:ring-amber-200'}`}
                                />
                            </div>
                            <span className="mt-5 font-bold text-slate-300">-</span>
                            <div className="flex-1">
                                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400">Fim</label>
                                <input
                                    type="time"
                                    value={morningEnd}
                                    onChange={event => setMorningEnd(event.target.value)}
                                    className={`w-full rounded-xl border bg-amber-50 px-4 py-3 text-sm font-bold outline-none transition-all focus:ring-2 ${morningConflict ? 'border-red-300 focus:ring-red-200' : 'border-amber-200 focus:border-amber-400 focus:ring-amber-200'}`}
                                />
                            </div>
                        </div>

                        {morningConflict && (
                            <p className="mt-2 text-xs font-medium text-red-500">O horario de fim deve ser posterior ao inicio.</p>
                        )}

                        <p className="mt-4 text-center text-sm font-semibold text-slate-500">
                            {loading ? '...' : <>{preview.morning} aluno{preview.morning !== 1 ? 's' : ''}</>}
                        </p>
                    </div>

                    <div className={`rounded-3xl border bg-white p-6 shadow-sm transition-all ${afternoonConflict ? 'border-red-300' : 'border-slate-200'}`}>
                        <div className="mb-5 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-500">
                                <Moon className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900">Periodo da Tarde</h3>
                                <p className="text-xs text-slate-400">Turmas com codigo terminando em T</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400">Inicio</label>
                                <input
                                    type="time"
                                    value={afternoonStart}
                                    onChange={event => setAfternoonStart(event.target.value)}
                                    className={`w-full rounded-xl border bg-blue-50 px-4 py-3 text-sm font-bold outline-none transition-all focus:ring-2 ${afternoonConflict ? 'border-red-300 focus:ring-red-200' : 'border-blue-200 focus:border-blue-400 focus:ring-blue-200'}`}
                                />
                            </div>
                            <span className="mt-5 font-bold text-slate-300">-</span>
                            <div className="flex-1">
                                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400">Fim</label>
                                <input
                                    type="time"
                                    value={afternoonEnd}
                                    onChange={event => setAfternoonEnd(event.target.value)}
                                    className={`w-full rounded-xl border bg-blue-50 px-4 py-3 text-sm font-bold outline-none transition-all focus:ring-2 ${afternoonConflict ? 'border-red-300 focus:ring-red-200' : 'border-blue-200 focus:border-blue-400 focus:ring-blue-200'}`}
                                />
                            </div>
                        </div>

                        {afternoonConflict && (
                            <p className="mt-2 text-xs font-medium text-red-500">O horario de fim deve ser posterior ao inicio.</p>
                        )}

                        <p className="mt-4 text-center text-sm font-semibold text-slate-500">
                            {loading ? '...' : <>{preview.afternoon} aluno{preview.afternoon !== 1 ? 's' : ''}</>}
                        </p>
                    </div>
                </div>

                <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="mb-4 flex items-center gap-2 font-bold text-slate-900">
                        <Clock className="h-5 w-5 text-blue-500" />
                        Resumo da Atualizacao
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-center md:grid-cols-4">
                        <div className="rounded-2xl bg-slate-100 p-4">
                            <p className="text-2xl font-black text-slate-700">{loading ? '-' : preview.total}</p>
                            <p className="text-xs font-semibold text-slate-500">Total</p>
                        </div>
                        <div className="rounded-2xl bg-amber-50 p-4">
                            <p className="text-2xl font-black text-amber-600">{loading ? '-' : preview.morning}</p>
                            <p className="text-xs font-semibold text-amber-500">Manha</p>
                        </div>
                        <div className="rounded-2xl bg-blue-50 p-4">
                            <p className="text-2xl font-black text-blue-600">{loading ? '-' : preview.afternoon}</p>
                            <p className="text-xs font-semibold text-blue-500">Tarde</p>
                        </div>
                        <div className="rounded-2xl bg-slate-100 p-4">
                            <p className="text-2xl font-black text-slate-400">{loading ? '-' : preview.unknown}</p>
                            <p className="text-xs font-semibold text-slate-400">Nao identificados</p>
                        </div>
                    </div>

                    {!loading && preview.unknown > 0 && (
                        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                            <p className="text-xs text-amber-700">
                                <strong>{preview.unknown} aluno(s)</strong> com codigo de turma sem sufixo M ou T nao serao atualizados.
                                {preview.unknown_examples.length > 0 && <> Exemplos: {preview.unknown_examples.join(', ')}.</>}
                            </p>
                        </div>
                    )}
                </div>

                {done && results && (
                    <div className="mb-8 flex items-start gap-4 rounded-3xl border border-emerald-100 bg-emerald-50 p-6">
                        <CheckCircle className="mt-0.5 h-6 w-6 shrink-0 text-emerald-500" />
                        <div>
                            <h4 className="mb-1 font-bold text-emerald-800">Atualizacao concluida com sucesso</h4>
                            <p className="text-sm text-slate-600">
                                {results.updated} alunos atualizados. {results.skipped} ignorados por periodo desconhecido.
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-4">
                    <button
                        type="button"
                        onClick={() => setShowConfirm(true)}
                        disabled={loading || running || anyConflict || eligibleTotal === 0}
                        className="flex items-center gap-3 rounded-2xl bg-blue-600 px-10 py-4 font-bold text-white shadow-xl shadow-blue-500/25 transition-all hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {running ? (
                            <><Loader2 className="h-5 w-5 animate-spin" /> Atualizando...</>
                        ) : (
                            <><Play className="h-5 w-5" /> Executar Atualizacao em Massa</>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={loadPreview}
                        disabled={loading || running}
                        className="flex items-center gap-3 rounded-2xl bg-slate-200 px-8 py-4 font-bold text-slate-700 transition-all hover:bg-slate-300 disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Recarregar
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/admin')}
                        className="px-8 py-4 font-bold text-slate-500 transition-colors hover:text-slate-700"
                    >
                        Voltar ao Dashboard
                    </button>
                </div>

                <div className="mt-10 flex items-start gap-4 rounded-3xl bg-slate-100 p-6">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                    <p className="text-sm leading-relaxed text-slate-600">
                        Esta operacao sobrescreve apenas o campo de horario semanal dos alunos com periodo identificado.
                        PIN, restricoes de custodia, pessoas bloqueadas e demais configuracoes de seguranca sao preservadas.
                        A acao e registrada no log de auditoria.
                    </p>
                </div>
            </div>

            {showConfirm && (
                <ConfirmRunModal
                    total={eligibleTotal}
                    morningWindow={`${morningStart} - ${morningEnd}`}
                    afternoonWindow={`${afternoonStart} - ${afternoonEnd}`}
                    loading={running}
                    onCancel={() => setShowConfirm(false)}
                    onConfirm={handleRunUpdate}
                />
            )}
        </div>
    );
}
