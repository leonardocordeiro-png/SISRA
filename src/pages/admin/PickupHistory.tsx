import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentType, CSSProperties, ReactNode } from 'react';
import {
    Activity,
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    BarChart3,
    CalendarDays,
    CheckCircle2,
    ChevronDown,
    Clock3,
    Download,
    Eye,
    FileSpreadsheet,
    FileText,
    Filter,
    Loader2,
    Printer,
    RefreshCcw,
    Search,
    ShieldCheck,
    Users,
    X,
    XCircle,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import NavigationControls from '../../components/NavigationControls';
import { useAuth } from '../../context/AuthContext';
import { logAudit } from '../../lib/audit';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';

type PickupStatus =
    | 'SOLICITADO'
    | 'NOTIFICADO'
    | 'AGUARDANDO'
    | 'CONFIRMADO'
    | 'LIBERADO'
    | 'CONCLUIDO'
    | 'FINALIZADO'
    | 'CANCELADO';

type PickupRecord = {
    id: string;
    status: PickupStatus | string;
    tipo_solicitacao: string | null;
    horario_solicitacao: string | null;
    horario_notificacao: string | null;
    horario_confirmacao: string | null;
    horario_liberacao: string | null;
    tempo_espera_segundos: number | null;
    observacoes: string | null;
    mensagem_sala: string | null;
    mensagem_recepcao: string | null;
    aluno: {
        nome_completo: string | null;
        matricula: string | null;
        turma: string | null;
        sala: string | null;
    } | null;
    responsavel: {
        nome_completo: string | null;
        cpf: string | null;
    } | null;
};

type HistoryPayload = {
    records: PickupRecord[];
    total_count: number;
    returned_count: number;
    limit: number;
    truncated: boolean;
};

type Period = 'day' | 'week' | 'month' | 'year' | 'pick-day' | 'pick-month' | 'pick-year' | 'custom';
type ViewMode = 'records' | 'analysis';

const PAGE_SIZE = 25;
const REPORT_LIMIT = 2000;

const PERIOD_LABELS: Record<Period, string> = {
    day: 'Hoje',
    week: 'Semana',
    month: 'Mes',
    year: 'Ano',
    'pick-day': 'Dia',
    'pick-month': 'Mes escolhido',
    'pick-year': 'Ano escolhido',
    custom: 'Intervalo',
};

const MONTH_NAMES = [
    'Janeiro',
    'Fevereiro',
    'Marco',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
];

const STATUS_LABELS: Record<string, string> = {
    SOLICITADO: 'Solicitado',
    NOTIFICADO: 'Notificado',
    AGUARDANDO: 'Aguardando',
    CONFIRMADO: 'Na recepcao',
    LIBERADO: 'Liberado',
    CONCLUIDO: 'Concluido',
    FINALIZADO: 'Finalizado',
    CANCELADO: 'Cancelado',
};

const STATUS_STYLES: Record<string, { className: string; dot: string }> = {
    SOLICITADO: { className: 'border-sky-200 bg-sky-50 text-sky-800', dot: 'bg-sky-500' },
    NOTIFICADO: { className: 'border-amber-200 bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
    AGUARDANDO: { className: 'border-orange-200 bg-orange-50 text-orange-800', dot: 'bg-orange-500' },
    CONFIRMADO: { className: 'border-violet-200 bg-violet-50 text-violet-800', dot: 'bg-violet-500' },
    LIBERADO: { className: 'border-emerald-200 bg-emerald-50 text-emerald-800', dot: 'bg-emerald-500' },
    CONCLUIDO: { className: 'border-teal-200 bg-teal-50 text-teal-800', dot: 'bg-teal-500' },
    FINALIZADO: { className: 'border-teal-200 bg-teal-50 text-teal-800', dot: 'bg-teal-500' },
    CANCELADO: { className: 'border-rose-200 bg-rose-50 text-rose-800', dot: 'bg-rose-500' },
};

const STATUS_OPTIONS = ['CONCLUIDO', 'FINALIZADO', 'LIBERADO', 'CONFIRMADO', 'NOTIFICADO', 'SOLICITADO', 'CANCELADO'];
const DONE_STATUSES = new Set(['LIBERADO', 'CONCLUIDO', 'FINALIZADO']);
const OPEN_STATUSES = new Set(['SOLICITADO', 'NOTIFICADO', 'AGUARDANDO', 'CONFIRMADO']);

const pad = (n: number) => String(n).padStart(2, '0');
const toDateInput = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

function periodRange(
    period: Period,
    customStart: string,
    customEnd: string,
    pickDay: string,
    pickMonth: number,
    pickMonthYear: number,
    pickYear: number
) {
    const now = new Date();
    const currentDay = toDateInput(now);

    if (period === 'custom' && customStart && customEnd) {
        return { from: `${customStart}T00:00:00`, to: `${customEnd}T23:59:59` };
    }

    if (period === 'pick-day' && pickDay) {
        return { from: `${pickDay}T00:00:00`, to: `${pickDay}T23:59:59` };
    }

    if (period === 'pick-month') {
        const first = new Date(pickMonthYear, pickMonth, 1);
        const last = new Date(pickMonthYear, pickMonth + 1, 0);
        return { from: `${toDateInput(first)}T00:00:00`, to: `${toDateInput(last)}T23:59:59` };
    }

    if (period === 'pick-year') {
        return { from: `${pickYear}-01-01T00:00:00`, to: `${pickYear}-12-31T23:59:59` };
    }

    if (period === 'week') {
        const dow = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return { from: `${toDateInput(monday)}T00:00:00`, to: `${toDateInput(sunday)}T23:59:59` };
    }

    if (period === 'month') {
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return { from: `${toDateInput(first)}T00:00:00`, to: `${toDateInput(last)}T23:59:59` };
    }

    if (period === 'year') {
        return { from: `${now.getFullYear()}-01-01T00:00:00`, to: `${now.getFullYear()}-12-31T23:59:59` };
    }

    return { from: `${currentDay}T00:00:00`, to: `${currentDay}T23:59:59` };
}

function formatDate(iso: string | null | undefined) {
    if (!iso) return '-';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(iso: string | null | undefined) {
    if (!iso) return '-';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function waitLabel(seconds: number | null | undefined) {
    if (!seconds || seconds <= 0) return '-';
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const min = minutes % 60;
        return `${hours}h ${min}min`;
    }
    return minutes > 0 ? `${minutes}min ${rest}s` : `${rest}s`;
}

function normalizePayload(data: unknown): HistoryPayload {
    const payload = (data ?? {}) as Partial<HistoryPayload>;
    return {
        records: Array.isArray(payload.records) ? payload.records : [],
        total_count: Number(payload.total_count ?? 0),
        returned_count: Number(payload.returned_count ?? 0),
        limit: Number(payload.limit ?? REPORT_LIMIT),
        truncated: Boolean(payload.truncated),
    };
}

function friendlyError(error: unknown) {
    const message = String((error as { message?: string })?.message ?? error ?? '');
    if (message.includes('ACESSO_NEGADO')) return 'Apenas administradores ativos podem consultar este relatorio.';
    if (message.includes('PERIODO_INVALIDO')) return 'O periodo informado e invalido.';
    return message || 'Nao foi possivel carregar o historico de retiradas.';
}

function methodLabel(value: string | null | undefined) {
    return value === 'ROTINA' ? 'Totem' : 'Recepcao';
}

function initials(name: string | null | undefined) {
    const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
}

function statusLabel(status: string | null | undefined) {
    return STATUS_LABELS[String(status ?? '')] ?? String(status ?? '-');
}

function StatusBadge({ status }: { status: string }) {
    const style = STATUS_STYLES[status] ?? { className: 'border-slate-200 bg-slate-50 text-slate-700', dot: 'bg-slate-400' };
    return (
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${style.className}`}>
            <span className={`h-2 w-2 rounded-full ${style.dot}`} />
            {statusLabel(status)}
        </span>
    );
}

function StatCard({
    label,
    value,
    sub,
    icon: Icon,
    tone,
}: {
    label: string;
    value: string | number;
    sub?: string;
    icon: ComponentType<{ className?: string }>;
    tone: 'blue' | 'green' | 'rose' | 'amber';
}) {
    const tones = {
        blue: 'border-blue-200 bg-blue-50 text-blue-700',
        green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        rose: 'border-rose-200 bg-rose-50 text-rose-700',
        amber: 'border-amber-200 bg-amber-50 text-amber-700',
    };

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{value}</p>
                    {sub && <p className="mt-2 text-sm font-medium text-slate-500">{sub}</p>}
                </div>
                <div className={`rounded-lg border p-3 ${tones[tone]}`}>
                    <Icon className="h-5 w-5" />
                </div>
            </div>
        </div>
    );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-lg border px-4 py-2 text-sm font-bold transition-colors ${
                active
                    ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700'
            }`}
        >
            {children}
        </button>
    );
}

function MiniBars({ data, color }: { data: { label: string; value: number }[]; color: string }) {
    const max = Math.max(...data.map(item => item.value), 1);
    return (
        <div className="flex h-48 items-end gap-2 rounded-lg border border-slate-200 bg-white p-4">
            {data.map(item => (
                <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <div className="flex h-32 w-full items-end rounded bg-slate-100">
                        <div
                            className="w-full rounded-t"
                            style={{ height: `${Math.max((item.value / max) * 100, item.value > 0 ? 8 : 0)}%`, background: color }}
                            title={`${item.label}: ${item.value}`}
                        />
                    </div>
                    <span className="text-[11px] font-bold text-slate-500">{item.label}</span>
                </div>
            ))}
        </div>
    );
}

function DetailModal({ record, onClose }: { record: PickupRecord; onClose: () => void }) {
    const stages = [
        { label: 'Solicitado', time: record.horario_solicitacao },
        { label: 'Sala notificada', time: record.horario_notificacao },
        { label: 'Na recepcao', time: record.horario_confirmacao },
        { label: 'Liberado', time: record.horario_liberacao },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
                <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Detalhe da retirada</p>
                        <h2 className="mt-1 text-xl font-black text-slate-950">{record.aluno?.nome_completo || 'Aluno nao identificado'}</h2>
                        <p className="mt-1 text-sm font-medium text-slate-500">
                            {record.aluno?.turma || 'Turma nao informada'} · Sala {record.aluno?.sala || '-'}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-900">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="grid gap-6 p-6 lg:grid-cols-[1fr_280px]">
                    <div className="space-y-5">
                        <div className="flex flex-wrap items-center gap-3">
                            <StatusBadge status={record.status} />
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                                {methodLabel(record.tipo_solicitacao)}
                            </span>
                            <span className="text-sm font-semibold text-slate-500">{formatDate(record.horario_solicitacao)} às {formatTime(record.horario_solicitacao)}</span>
                        </div>

                        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Responsavel</p>
                            <p className="mt-2 text-base font-black text-slate-950">{record.responsavel?.nome_completo || 'Nao informado'}</p>
                            <p className="mt-1 text-sm font-semibold text-slate-500">CPF: {record.responsavel?.cpf || '***.***.***-**'}</p>
                        </section>

                        <section>
                            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Linha do tempo</p>
                            <div className="space-y-3">
                                {stages.map((stage, index) => (
                                    <div key={stage.label} className="flex items-center gap-3">
                                        <div className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-black ${
                                            stage.time ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-400'
                                        }`}>
                                            {index + 1}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-slate-900">{stage.label}</p>
                                            <p className="text-xs font-semibold text-slate-500">{formatDate(stage.time)} · {formatTime(stage.time)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {(record.mensagem_sala || record.mensagem_recepcao || record.observacoes) && (
                            <section className="space-y-3">
                                {record.mensagem_sala && (
                                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                                        <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Mensagem da sala</p>
                                        <p className="mt-2 text-sm font-semibold text-slate-800">{record.mensagem_sala}</p>
                                    </div>
                                )}
                                {record.mensagem_recepcao && (
                                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                                        <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Mensagem da recepcao</p>
                                        <p className="mt-2 text-sm font-semibold text-slate-800">{record.mensagem_recepcao}</p>
                                    </div>
                                )}
                                {record.observacoes && (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                                        <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Observacoes</p>
                                        <p className="mt-2 text-sm font-semibold text-slate-800">{record.observacoes}</p>
                                    </div>
                                )}
                            </section>
                        )}
                    </div>

                    <aside className="rounded-lg border border-slate-200 bg-white p-5">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Tempo de espera</p>
                        <p className="mt-2 text-3xl font-black text-blue-700">{waitLabel(record.tempo_espera_segundos)}</p>
                        <div className="mt-5 border-t border-slate-200 pt-5">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Matricula</p>
                            <p className="mt-1 text-sm font-black text-slate-900">{record.aluno?.matricula || '-'}</p>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
}

export default function PickupHistoryView() {
    const { user, escolaId } = useAuth();
    const toast = useToast();

    const [records, setRecords] = useState<PickupRecord[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [truncated, setTruncated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [period, setPeriod] = useState<Period>('day');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [pickDay, setPickDay] = useState(() => toDateInput(new Date()));
    const [pickMonth, setPickMonth] = useState(() => new Date().getMonth());
    const [pickMonthYear, setPickMonthYear] = useState(() => new Date().getFullYear());
    const [pickYear, setPickYear] = useState(() => new Date().getFullYear());
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [methodFilter, setMethodFilter] = useState('all');
    const [view, setView] = useState<ViewMode>('records');
    const [page, setPage] = useState(0);
    const [exportOpen, setExportOpen] = useState(false);
    const [detailRecord, setDetailRecord] = useState<PickupRecord | null>(null);

    const currentYear = new Date().getFullYear();
    const yearOptions = useMemo(() => Array.from({ length: 7 }, (_, index) => currentYear - index), [currentYear]);

    const { from, to } = useMemo(
        () => periodRange(period, customStart, customEnd, pickDay, pickMonth, pickMonthYear, pickYear),
        [period, customStart, customEnd, pickDay, pickMonth, pickMonthYear, pickYear]
    );

    const fetchRecords = useCallback(async (silent = false) => {
        if (!escolaId) {
            setLoading(false);
            toast.error('Escola nao identificada', 'Faca login novamente para consultar os relatorios.');
            return;
        }

        if (period === 'custom' && (!customStart || !customEnd)) {
            setRecords([]);
            setTotalCount(0);
            setTruncated(false);
            setLoading(false);
            return;
        }

        if (period === 'custom' && customStart > customEnd) {
            setRecords([]);
            setTotalCount(0);
            setTruncated(false);
            setLoading(false);
            toast.warning('Periodo invalido', 'A data inicial precisa ser anterior ou igual a data final.');
            return;
        }

        if (silent) setRefreshing(true);
        else setLoading(true);

        try {
            const { data, error } = await supabase.rpc('sisra_admin_pickup_history', {
                p_escola_id: escolaId,
                p_from: from,
                p_to: to,
                p_limit: REPORT_LIMIT,
            });

            if (error) throw error;

            const payload = normalizePayload(data);
            setRecords(payload.records);
            setTotalCount(payload.total_count);
            setTruncated(payload.truncated);
            setPage(0);
        } catch (error) {
            console.error('Erro ao carregar historico de retiradas:', error);
            toast.error('Erro ao carregar historico', friendlyError(error));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [customEnd, customStart, escolaId, from, period, to, toast]);

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords]);

    const filtered = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return records.filter(record => {
            if (statusFilter !== 'all' && record.status !== statusFilter) return false;
            if (methodFilter === 'totem' && record.tipo_solicitacao !== 'ROTINA') return false;
            if (methodFilter === 'reception' && record.tipo_solicitacao === 'ROTINA') return false;
            if (!term) return true;

            const haystack = [
                record.aluno?.nome_completo,
                record.aluno?.matricula,
                record.aluno?.turma,
                record.aluno?.sala,
                record.responsavel?.nome_completo,
                record.responsavel?.cpf,
                statusLabel(record.status),
                methodLabel(record.tipo_solicitacao),
            ].join(' ').toLowerCase();

            return haystack.includes(term);
        });
    }, [methodFilter, records, searchTerm, statusFilter]);

    const analytics = useMemo(() => {
        const total = records.length;
        const done = records.filter(record => DONE_STATUSES.has(record.status)).length;
        const open = records.filter(record => OPEN_STATUSES.has(record.status)).length;
        const cancelled = records.filter(record => record.status === 'CANCELADO').length;
        const withWait = records.filter(record => Number(record.tempo_espera_segundos ?? 0) > 0);
        const avgWait = withWait.length
            ? Math.round(withWait.reduce((sum, record) => sum + Number(record.tempo_espera_segundos ?? 0), 0) / withWait.length)
            : 0;

        const byHourMap = new Map<number, number>();
        records.forEach(record => {
            if (!record.horario_solicitacao) return;
            const hour = new Date(record.horario_solicitacao).getHours();
            byHourMap.set(hour, (byHourMap.get(hour) ?? 0) + 1);
        });
        const byHour = Array.from({ length: 15 }, (_, index) => index + 6).map(hour => ({
            label: `${pad(hour)}h`,
            value: byHourMap.get(hour) ?? 0,
        }));

        const byStatus = STATUS_OPTIONS.map(status => ({
            label: statusLabel(status),
            value: records.filter(record => record.status === status).length,
        })).filter(item => item.value > 0);

        const students = new Map<string, { name: string; sub: string; count: number }>();
        const guardians = new Map<string, { name: string; sub: string; count: number }>();
        records.forEach(record => {
            const studentKey = record.aluno?.matricula || record.aluno?.nome_completo;
            if (studentKey) {
                const current = students.get(studentKey) ?? {
                    name: record.aluno?.nome_completo || 'Aluno nao identificado',
                    sub: record.aluno?.turma || 'Turma nao informada',
                    count: 0,
                };
                current.count += 1;
                students.set(studentKey, current);
            }

            const guardianKey = record.responsavel?.nome_completo || record.responsavel?.cpf;
            if (guardianKey) {
                const current = guardians.get(guardianKey) ?? {
                    name: record.responsavel?.nome_completo || 'Responsavel nao identificado',
                    sub: record.responsavel?.cpf || 'CPF mascarado',
                    count: 0,
                };
                current.count += 1;
                guardians.set(guardianKey, current);
            }
        });

        return {
            total,
            done,
            open,
            cancelled,
            avgWait,
            byHour,
            byStatus,
            topStudents: Array.from(students.values()).sort((a, b) => b.count - a.count).slice(0, 6),
            topGuardians: Array.from(guardians.values()).sort((a, b) => b.count - a.count).slice(0, 6),
        };
    }, [records]);

    const totalPages = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
    const safePage = Math.min(page, totalPages - 1);
    const paginated = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

    const dateRangeLabel = `${formatDate(from)} ate ${formatDate(to)}`;
    const hasFilters = searchTerm.trim() || statusFilter !== 'all' || methodFilter !== 'all';

    const logExport = useCallback((format: string) => {
        logAudit('EXPORTACAO_DADOS', 'solicitacoes_retirada', undefined, {
            formato: format,
            periodo: period,
            de: from,
            ate: to,
            registros: filtered.length,
        }, user?.id, escolaId || undefined);
    }, [escolaId, filtered.length, from, period, to, user?.id]);

    const exportRows = useMemo(() => filtered.map(record => [
        formatDate(record.horario_solicitacao),
        formatTime(record.horario_solicitacao),
        formatTime(record.horario_liberacao),
        record.aluno?.nome_completo || '',
        record.aluno?.matricula || '',
        record.aluno?.turma || '',
        record.aluno?.sala || '',
        record.responsavel?.nome_completo || '',
        record.responsavel?.cpf || '',
        methodLabel(record.tipo_solicitacao),
        statusLabel(record.status),
        waitLabel(record.tempo_espera_segundos),
        record.mensagem_sala || '',
        record.mensagem_recepcao || '',
        record.observacoes || '',
    ]), [filtered]);

    const downloadBlob = (blob: Blob, extension: string) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `retiradas_${period}_${new Date().toISOString().slice(0, 10)}.${extension}`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const exportCSV = () => {
        const header = ['Data', 'Solicitado', 'Liberado', 'Aluno', 'Matricula', 'Turma', 'Sala', 'Responsavel', 'CPF', 'Metodo', 'Status', 'Espera', 'Mensagem sala', 'Mensagem recepcao', 'Observacoes'];
        const csv = [header, ...exportRows]
            .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
            .join('\n');
        downloadBlob(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }), 'csv');
        logExport('CSV');
    };

    const exportSpreadsheet = () => {
        const header = ['Data', 'Solicitado', 'Liberado', 'Aluno', 'Matricula', 'Turma', 'Sala', 'Responsavel', 'CPF', 'Metodo', 'Status', 'Espera', 'Mensagem sala', 'Mensagem recepcao', 'Observacoes'];
        const escapeCell = (value: unknown) => String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        const rows = [header, ...exportRows]
            .map(row => `<tr>${row.map(cell => `<td>${escapeCell(cell)}</td>`).join('')}</tr>`)
            .join('');
        const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><h1>Historico de Retiradas</h1><p>${escapeCell(dateRangeLabel)}</p><table border="1"><tbody>${rows}</tbody></table></body></html>`;
        downloadBlob(new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' }), 'xls');
        logExport('XLS');
    };

    const exportPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('La Salle, Cheguei! - Historico de Retiradas', 14, 16);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Periodo: ${dateRangeLabel}`, 14, 24);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 30);

        autoTable(doc, {
            startY: 38,
            head: [['Data', 'Hora', 'Aluno', 'Turma', 'Responsavel', 'Metodo', 'Status', 'Espera']],
            body: filtered.map(record => [
                formatDate(record.horario_solicitacao),
                formatTime(record.horario_solicitacao),
                record.aluno?.nome_completo || '-',
                record.aluno?.turma || '-',
                record.responsavel?.nome_completo || '-',
                methodLabel(record.tipo_solicitacao),
                statusLabel(record.status),
                waitLabel(record.tempo_espera_segundos),
            ]),
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
        });

        doc.save(`retiradas_${period}_${new Date().toISOString().slice(0, 10)}.pdf`);
        logExport('PDF');
    };

    const actionButtonStyle: CSSProperties = { minHeight: 42 };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4 rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Carregando historico</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-950">
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; }
                    .print-panel { box-shadow: none !important; border-color: #cbd5e1 !important; }
                }
            `}</style>

            <header className="border-b border-slate-200 bg-white shadow-sm">
                <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 text-white">
                            <BarChart3 className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Central de relatorios</p>
                            <h1 className="text-2xl font-black tracking-tight text-slate-950">Historico de retiradas</h1>
                            <p className="mt-1 text-sm font-medium text-slate-500">Consulta operacional, auditoria e exportacao de registros.</p>
                        </div>
                    </div>

                    <div className="no-print flex flex-wrap items-center gap-2">
                        <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-1">
                            <button
                                type="button"
                                onClick={() => setView('records')}
                                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold ${view === 'records' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-950'}`}
                            >
                                <FileText className="h-4 w-4" />
                                Registros
                            </button>
                            <button
                                type="button"
                                onClick={() => setView('analysis')}
                                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold ${view === 'analysis' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-950'}`}
                            >
                                <Activity className="h-4 w-4" />
                                Analise
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => fetchRecords(true)}
                            className="rounded-lg border border-slate-200 bg-white p-3 text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700"
                            style={actionButtonStyle}
                            title="Atualizar"
                        >
                            <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700"
                            style={actionButtonStyle}
                        >
                            <Printer className="h-4 w-4" />
                            Imprimir
                        </button>

                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setExportOpen(open => !open)}
                                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
                                style={actionButtonStyle}
                            >
                                <Download className="h-4 w-4" />
                                Exportar
                                <ChevronDown className="h-4 w-4" />
                            </button>
                            {exportOpen && (
                                <>
                                    <button type="button" aria-label="Fechar menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setExportOpen(false)} />
                                    <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                                        <button type="button" onClick={() => { exportPDF(); setExportOpen(false); }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50">
                                            <FileText className="h-4 w-4 text-rose-600" />
                                            PDF
                                        </button>
                                        <button type="button" onClick={() => { exportSpreadsheet(); setExportOpen(false); }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50">
                                            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                                            Planilha
                                        </button>
                                        <button type="button" onClick={() => { exportCSV(); setExportOpen(false); }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50">
                                            <Download className="h-4 w-4 text-blue-600" />
                                            CSV
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <main className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-6">
                <div className="no-print">
                    <NavigationControls />
                </div>

                <section className="no-print rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-5">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="mr-1 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-500">
                                <CalendarDays className="h-4 w-4" />
                                Periodo
                            </span>
                            {(['day', 'week', 'month', 'year'] as Period[]).map(item => (
                                <FilterButton key={item} active={period === item} onClick={() => setPeriod(item)}>
                                    {PERIOD_LABELS[item]}
                                </FilterButton>
                            ))}
                            <span className="mx-1 h-8 w-px bg-slate-200" />
                            {(['pick-day', 'pick-month', 'pick-year', 'custom'] as Period[]).map(item => (
                                <FilterButton key={item} active={period === item} onClick={() => setPeriod(item)}>
                                    {PERIOD_LABELS[item]}
                                </FilterButton>
                            ))}
                        </div>

                        {period === 'pick-day' && (
                            <div className="flex flex-wrap items-center gap-3">
                                <label className="text-sm font-bold text-slate-600" htmlFor="pick-day">Dia</label>
                                <input id="pick-day" type="date" value={pickDay} max={toDateInput(new Date())} onChange={event => setPickDay(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900" />
                            </div>
                        )}

                        {period === 'pick-month' && (
                            <div className="flex flex-wrap items-center gap-3">
                                <label className="text-sm font-bold text-slate-600" htmlFor="pick-month">Mes</label>
                                <select id="pick-month" value={pickMonth} onChange={event => setPickMonth(Number(event.target.value))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900">
                                    {MONTH_NAMES.map((month, index) => <option key={month} value={index}>{month}</option>)}
                                </select>
                                <label className="text-sm font-bold text-slate-600" htmlFor="pick-month-year">Ano</label>
                                <select id="pick-month-year" value={pickMonthYear} onChange={event => setPickMonthYear(Number(event.target.value))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900">
                                    {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
                                </select>
                            </div>
                        )}

                        {period === 'pick-year' && (
                            <div className="flex flex-wrap items-center gap-3">
                                <label className="text-sm font-bold text-slate-600" htmlFor="pick-year">Ano</label>
                                <select id="pick-year" value={pickYear} onChange={event => setPickYear(Number(event.target.value))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900">
                                    {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
                                </select>
                            </div>
                        )}

                        {period === 'custom' && (
                            <div className="flex flex-wrap items-center gap-3">
                                <label className="text-sm font-bold text-slate-600" htmlFor="custom-start">De</label>
                                <input id="custom-start" type="date" value={customStart} max={toDateInput(new Date())} onChange={event => setCustomStart(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900" />
                                <label className="text-sm font-bold text-slate-600" htmlFor="custom-end">Ate</label>
                                <input id="custom-end" type="date" value={customEnd} max={toDateInput(new Date())} onChange={event => setCustomEnd(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900" />
                            </div>
                        )}

                        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
                            <span className="flex items-center gap-2 text-sm font-bold text-slate-600">
                                <Clock3 className="h-4 w-4 text-blue-600" />
                                Exibindo {dateRangeLabel}
                            </span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
                                {totalCount} registro{totalCount === 1 ? '' : 's'} no periodo
                            </span>
                            {truncated && (
                                <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800">
                                    Exibindo os {REPORT_LIMIT} mais recentes
                                </span>
                            )}
                        </div>
                    </div>
                </section>

                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Total no periodo" value={analytics.total} icon={Activity} tone="blue" sub={`${filtered.length} visivel apos filtros`} />
                    <StatCard label="Concluidas/liberadas" value={analytics.done} icon={CheckCircle2} tone="green" sub={analytics.total ? `${Math.round((analytics.done / analytics.total) * 100)}% do periodo` : 'Sem registros'} />
                    <StatCard label="Canceladas" value={analytics.cancelled} icon={XCircle} tone="rose" sub="Alertas operacionais" />
                    <StatCard label="Tempo medio" value={waitLabel(analytics.avgWait)} icon={Clock3} tone="amber" sub="Apenas registros com tempo medido" />
                </section>

                {view === 'records' && (
                    <>
                        <section className="no-print rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex flex-col gap-4">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={event => { setSearchTerm(event.target.value); setPage(0); }}
                                        placeholder="Buscar por aluno, responsavel, matricula, turma, sala, status..."
                                        className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                    />
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="mr-1 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-500">
                                        <Filter className="h-4 w-4" />
                                        Metodo
                                    </span>
                                    <FilterButton active={methodFilter === 'all'} onClick={() => { setMethodFilter('all'); setPage(0); }}>Todos</FilterButton>
                                    <FilterButton active={methodFilter === 'totem'} onClick={() => { setMethodFilter('totem'); setPage(0); }}>Totem</FilterButton>
                                    <FilterButton active={methodFilter === 'reception'} onClick={() => { setMethodFilter('reception'); setPage(0); }}>Recepcao</FilterButton>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="mr-1 text-sm font-black uppercase tracking-wide text-slate-500">Status</span>
                                    <FilterButton active={statusFilter === 'all'} onClick={() => { setStatusFilter('all'); setPage(0); }}>Todos</FilterButton>
                                    {STATUS_OPTIONS.map(status => (
                                        <FilterButton key={status} active={statusFilter === status} onClick={() => { setStatusFilter(status); setPage(0); }}>
                                            {statusLabel(status)}
                                        </FilterButton>
                                    ))}
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                                    <p className="text-sm font-bold text-slate-600">
                                        {filtered.length} registro{filtered.length === 1 ? '' : 's'} encontrado{filtered.length === 1 ? '' : 's'}
                                    </p>
                                    {hasFilters && (
                                        <button
                                            type="button"
                                            onClick={() => { setSearchTerm(''); setStatusFilter('all'); setMethodFilter('all'); setPage(0); }}
                                            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700"
                                        >
                                            Limpar filtros
                                        </button>
                                    )}
                                </div>
                            </div>
                        </section>

                        <section className="print-panel overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1050px] border-collapse">
                                    <thead className="bg-slate-100">
                                        <tr>
                                            {['Aluno', 'Turma / sala', 'Responsavel', 'Metodo', 'Status', 'Solicitado', 'Liberado', 'Espera', ''].map(header => (
                                                <th key={header} className="border-b border-slate-200 px-5 py-4 text-left text-xs font-black uppercase tracking-wide text-slate-600">
                                                    {header}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginated.map(record => (
                                            <tr key={record.id} className="border-b border-slate-100 hover:bg-blue-50/40">
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-sm font-black text-blue-700">
                                                            {initials(record.aluno?.nome_completo)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-black text-slate-950">{record.aluno?.nome_completo || 'Aluno nao identificado'}</p>
                                                            <p className="text-xs font-semibold text-slate-500">Matricula {record.aluno?.matricula || '-'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <p className="text-sm font-bold text-slate-900">{record.aluno?.turma || '-'}</p>
                                                    <p className="text-xs font-semibold text-slate-500">Sala {record.aluno?.sala || '-'}</p>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <p className="max-w-[220px] truncate text-sm font-bold text-slate-900">{record.responsavel?.nome_completo || 'Nao informado'}</p>
                                                    <p className="text-xs font-semibold text-slate-500">{record.responsavel?.cpf || '***.***.***-**'}</p>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className={`rounded-full px-3 py-1 text-xs font-black ${record.tipo_solicitacao === 'ROTINA' ? 'bg-violet-100 text-violet-800' : 'bg-cyan-100 text-cyan-800'}`}>
                                                        {methodLabel(record.tipo_solicitacao)}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4"><StatusBadge status={record.status} /></td>
                                                <td className="px-5 py-4">
                                                    <p className="text-sm font-black text-slate-900">{formatDate(record.horario_solicitacao)}</p>
                                                    <p className="text-xs font-semibold text-slate-500">{formatTime(record.horario_solicitacao)}</p>
                                                </td>
                                                <td className="px-5 py-4 text-sm font-black text-emerald-700">{formatTime(record.horario_liberacao)}</td>
                                                <td className="px-5 py-4 text-sm font-black text-blue-700">{waitLabel(record.tempo_espera_segundos)}</td>
                                                <td className="px-5 py-4">
                                                    <button
                                                        type="button"
                                                        onClick={() => setDetailRecord(record)}
                                                        className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                                                        title="Ver detalhes"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {paginated.length === 0 && (
                                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                                        <Search className="h-8 w-8" />
                                    </div>
                                    <h3 className="mt-4 text-lg font-black text-slate-900">Nenhum registro encontrado</h3>
                                    <p className="mt-2 max-w-md text-sm font-medium text-slate-500">Nao ha retiradas para o periodo e filtros selecionados.</p>
                                </div>
                            )}

                            <div className="no-print flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm font-bold text-slate-600">
                                    Pagina {safePage + 1} de {totalPages} · {filtered.length} registro{filtered.length === 1 ? '' : 's'}
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        disabled={safePage === 0}
                                        onClick={() => setPage(current => Math.max(current - 1, 0))}
                                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <ArrowLeft className="h-4 w-4" />
                                        Anterior
                                    </button>
                                    <button
                                        type="button"
                                        disabled={safePage >= totalPages - 1}
                                        onClick={() => setPage(current => Math.min(current + 1, totalPages - 1))}
                                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        Proxima
                                        <ArrowRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </section>
                    </>
                )}

                {view === 'analysis' && (
                    <section className="grid gap-5 lg:grid-cols-2">
                        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Distribuicao</p>
                                    <h2 className="text-lg font-black text-slate-950">Retiradas por horario</h2>
                                </div>
                                <Clock3 className="h-5 w-5 text-blue-600" />
                            </div>
                            <MiniBars data={analytics.byHour} color="#2563eb" />
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Status</p>
                                    <h2 className="text-lg font-black text-slate-950">Composicao do periodo</h2>
                                </div>
                                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div className="space-y-3">
                                {analytics.byStatus.length > 0 ? analytics.byStatus.map(item => (
                                    <div key={item.label}>
                                        <div className="flex items-center justify-between text-sm font-bold">
                                            <span className="text-slate-700">{item.label}</span>
                                            <span className="text-slate-950">{item.value}</span>
                                        </div>
                                        <div className="mt-2 h-3 rounded-full bg-slate-100">
                                            <div className="h-3 rounded-full bg-emerald-500" style={{ width: `${analytics.total ? (item.value / analytics.total) * 100 : 0}%` }} />
                                        </div>
                                    </div>
                                )) : (
                                    <p className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">Sem dados para analisar.</p>
                                )}
                            </div>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Alunos</p>
                                    <h2 className="text-lg font-black text-slate-950">Mais retirados</h2>
                                </div>
                                <Users className="h-5 w-5 text-blue-600" />
                            </div>
                            <RankingList rows={analytics.topStudents} empty="Sem alunos no periodo." />
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Responsaveis</p>
                                    <h2 className="text-lg font-black text-slate-950">Mais frequentes</h2>
                                </div>
                                <Users className="h-5 w-5 text-emerald-600" />
                            </div>
                            <RankingList rows={analytics.topGuardians} empty="Sem responsaveis no periodo." />
                        </div>

                        <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 shadow-sm lg:col-span-2">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="mt-1 h-6 w-6 text-rose-700" />
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wide text-rose-700">Auditoria operacional</p>
                                        <h2 className="text-lg font-black text-rose-950">Cancelamentos e alertas</h2>
                                        <p className="mt-1 text-sm font-semibold text-rose-800">
                                            {analytics.cancelled === 0
                                                ? 'Nenhum cancelamento registrado no periodo.'
                                                : `${analytics.cancelled} registro(s) cancelado(s) no periodo selecionado.`}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => { setView('records'); setStatusFilter('CANCELADO'); setPage(0); }}
                                    className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-800"
                                >
                                    Ver cancelamentos
                                </button>
                            </div>
                        </div>
                    </section>
                )}
            </main>

            {detailRecord && <DetailModal record={detailRecord} onClose={() => setDetailRecord(null)} />}
        </div>
    );
}

function RankingList({ rows, empty }: { rows: { name: string; sub: string; count: number }[]; empty: string }) {
    const top = rows[0]?.count || 1;

    if (rows.length === 0) {
        return <p className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">{empty}</p>;
    }

    return (
        <div className="space-y-4">
            {rows.map((row, index) => (
                <div key={`${row.name}-${index}`} className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-black text-slate-700">
                        {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-sm font-black text-slate-950">{row.name}</p>
                            <span className="text-sm font-black text-blue-700">{row.count}x</span>
                        </div>
                        <p className="truncate text-xs font-semibold text-slate-500">{row.sub}</p>
                        <div className="mt-2 h-2 rounded-full bg-slate-100">
                            <div className="h-2 rounded-full bg-blue-600" style={{ width: `${(row.count / top) * 100}%` }} />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
