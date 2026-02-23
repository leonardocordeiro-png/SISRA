import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
    BarChart2, Calendar, Clock, User, Shield, CheckCircle2,
    AlertCircle, Search, Download, TrendingUp,
    TrendingDown, Minus, Filter, Eye, X, AlertTriangle,
    Activity, FileText, Users, RefreshCw, ArrowLeft, ArrowRight
} from 'lucide-react';
import NavigationControls from '../../components/NavigationControls';

// ─── Types ───────────────────────────────────────────────────────────────────

type PickupRecord = {
    id: string;
    status: string;
    tipo_solicitacao: string;
    horario_solicitacao: string;
    horario_notificacao: string | null;
    horario_confirmacao: string | null;
    horario_liberacao: string | null;
    tempo_espera_segundos: number | null;
    observacoes: string | null;
    mensagem_recepcao: string | null;
    aluno: { nome_completo: string; matricula: string; turma: string; sala: string; foto_url: string | null } | null;
    responsavel: { nome_completo: string; cpf: string; foto_url: string | null } | null;
};

type Period = 'day' | 'week' | 'month' | 'year' | 'custom' | 'pick-day' | 'pick-month' | 'pick-year';

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (iso: string | null, opts: Intl.DateTimeFormatOptions) =>
    iso ? new Date(iso).toLocaleString('pt-BR', opts) : '—';

const fmtTime = (iso: string | null) => fmt(iso, { hour: '2-digit', minute: '2-digit' });
const fmtDate = (iso: string | null) => fmt(iso, { day: '2-digit', month: '2-digit', year: 'numeric' });

const waitLabel = (secs: number | null) => {
    if (!secs) return '—';
    const m = Math.floor(secs / 60), s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const STATUS_STYLE: Record<string, string> = {
    LIBERADO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    CONFIRMADO: 'bg-blue-50 text-blue-700 border-blue-200',
    SOLICITADO: 'bg-amber-50 text-amber-700 border-amber-200',
    CANCELADO: 'bg-rose-50 text-rose-700 border-rose-200',
};

const STATUS_PT: Record<string, string> = {
    LIBERADO: 'Liberado', CONFIRMADO: 'Na Recepção',
    SOLICITADO: 'Solicitado', CANCELADO: 'Cancelado',
};

function periodRange(
    period: Period,
    customStart?: string,
    customEnd?: string,
    pickDay?: string,
    pickMonth?: number,
    pickMonthYear?: number,
    pickYear?: number
): { from: string; to: string } {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (period === 'custom' && customStart && customEnd) {
        return { from: `${customStart}T00:00:00`, to: `${customEnd}T23:59:59` };
    }
    if (period === 'pick-day' && pickDay) {
        return { from: `${pickDay}T00:00:00`, to: `${pickDay}T23:59:59` };
    }
    if (period === 'pick-month') {
        const y = pickMonthYear ?? now.getFullYear();
        const m = pickMonth ?? now.getMonth();
        const first = new Date(y, m, 1);
        const last = new Date(y, m + 1, 0);
        return { from: `${toISO(first)}T00:00:00`, to: `${toISO(last)}T23:59:59` };
    }
    if (period === 'pick-year') {
        const y = pickYear ?? now.getFullYear();
        return { from: `${y}-01-01T00:00:00`, to: `${y}-12-31T23:59:59` };
    }
    if (period === 'day') {
        const d = toISO(now);
        return { from: `${d}T00:00:00`, to: `${d}T23:59:59` };
    }
    if (period === 'week') {
        const dow = now.getDay();
        const mon = new Date(now); mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
        const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
        return { from: `${toISO(mon)}T00:00:00`, to: `${toISO(sun)}T23:59:59` };
    }
    if (period === 'month') {
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return { from: `${toISO(first)}T00:00:00`, to: `${toISO(last)}T23:59:59` };
    }
    // year
    const first = new Date(now.getFullYear(), 0, 1);
    const last = new Date(now.getFullYear(), 11, 31);
    return { from: `${toISO(first)}T00:00:00`, to: `${toISO(last)}T23:59:59` };
}

// ─── Mini bar chart (SVG) ───────────────────────────────────────────────────

function MiniBarChart({ data, color = '#6366f1' }: { data: { label: string; value: number }[]; color?: string }) {
    const max = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="flex items-end gap-1.5 h-20">
            {data.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div
                        className="w-full rounded-t-lg transition-all duration-500"
                        style={{ height: `${(d.value / max) * 64}px`, backgroundColor: color, opacity: 0.7 + (d.value / max) * 0.3 }}
                    />
                    <span className="text-[9px] text-slate-400 font-bold truncate w-full text-center">{d.label}</span>
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap z-10">
                        {d.value} retirada{d.value !== 1 ? 's' : ''}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color, trend }: {
    label: string; value: string | number; sub?: string;
    icon: any; color: string; trend?: 'up' | 'down' | 'neutral';
}) {
    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
    const trendColor = trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-rose-500' : 'text-slate-400';
    return (
        <div className={`bg-white rounded-2xl border p-5 shadow-sm flex flex-col gap-3 ${color}`}>
            <div className="flex items-start justify-between">
                <div className={`p-2.5 rounded-xl ${color.replace('border-', 'bg-').replace(/\/\S+/, '/10')}`}>
                    <Icon className="w-5 h-5" />
                </div>
                {trend && <TrendIcon className={`w-4 h-4 ${trendColor}`} />}
            </div>
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                <p className="text-2xl font-black text-slate-900">{value}</p>
                {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

// ─── Record Detail Modal ─────────────────────────────────────────────────────

function RecordDetail({ record, onClose }: { record: PickupRecord; onClose: () => void }) {
    const stages = [
        { label: 'Solicitação', time: record.horario_solicitacao, color: 'bg-slate-400' },
        { label: 'Notificação Sala', time: record.horario_notificacao, color: 'bg-amber-400' },
        { label: 'Chegou na Recepção', time: record.horario_confirmacao, color: 'bg-blue-500' },
        { label: 'Liberado', time: record.horario_liberacao, color: 'bg-emerald-500' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {record.aluno?.foto_url ? (
                            <img src={record.aluno.foto_url} className="w-12 h-12 rounded-xl object-cover border-2 border-white/30" alt="" />
                        ) : (
                            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white font-black text-xl">
                                {record.aluno?.nome_completo?.[0] || '?'}
                            </div>
                        )}
                        <div>
                            <p className="text-white font-black text-base leading-tight">{record.aluno?.nome_completo}</p>
                            <p className="text-indigo-200 text-xs">{record.aluno?.turma} · Sala {record.aluno?.sala}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white/70 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-8 space-y-6">
                    {/* Status */}
                    <div className="flex items-center justify-between">
                        <span className={`px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider ${STATUS_STYLE[record.status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                            {STATUS_PT[record.status] || record.status}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">{fmtDate(record.horario_solicitacao)}</span>
                    </div>

                    {/* Guardian */}
                    <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-4">
                        {record.responsavel?.foto_url ? (
                            <img src={record.responsavel.foto_url} className="w-10 h-10 rounded-xl object-cover" alt="" />
                        ) : (
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                                <User className="w-5 h-5" />
                            </div>
                        )}
                        <div>
                            <p className="text-sm font-bold text-slate-900">{record.responsavel?.nome_completo || '—'}</p>
                            <p className="text-xs text-slate-400">CPF: {record.responsavel?.cpf || '—'}</p>
                        </div>
                    </div>

                    {/* Timeline */}
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Linha do Tempo da Retirada</p>
                        <div className="space-y-3">
                            {stages.map((s, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.time ? s.color : 'bg-slate-200'}`} />
                                    <span className="text-xs font-bold text-slate-600 flex-1">{s.label}</span>
                                    <span className={`text-xs font-bold ${s.time ? 'text-slate-900' : 'text-slate-300'}`}>
                                        {fmtTime(s.time)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Wait time */}
                    <div className="flex items-center justify-between bg-indigo-50 rounded-2xl px-5 py-4">
                        <div className="flex items-center gap-2 text-indigo-600">
                            <Clock className="w-4 h-4" />
                            <span className="text-xs font-bold">Tempo Total de Espera</span>
                        </div>
                        <span className="text-lg font-black text-indigo-700">{waitLabel(record.tempo_espera_segundos)}</span>
                    </div>

                    {/* Notes */}
                    {record.observacoes && (
                        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Observações</p>
                            <p className="text-xs text-amber-800 leading-relaxed">{record.observacoes}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PickupHistoryView() {
    const [records, setRecords] = useState<PickupRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [period, setPeriod] = useState<Period>('day');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    // granular pickers
    const [pickDay, setPickDay] = useState(() => new Date().toISOString().split('T')[0]);
    const [pickMonth, setPickMonth] = useState(() => new Date().getMonth());
    const [pickMonthYear, setPickMonthYear] = useState(() => new Date().getFullYear());
    const [pickYear, setPickYear] = useState(() => new Date().getFullYear());
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [detailRecord, setDetailRecord] = useState<PickupRecord | null>(null);
    const [activeView, setActiveView] = useState<'list' | 'analytics'>('list');
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 20;

    const { from, to } = useMemo(
        () => periodRange(period, customStart, customEnd, pickDay, pickMonth, pickMonthYear, pickYear),
        [period, customStart, customEnd, pickDay, pickMonth, pickMonthYear, pickYear]
    );

    const fetchRecords = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            const { data, error } = await supabase
                .from('solicitacoes_retirada')
                .select(`
                    id, status, tipo_solicitacao, horario_solicitacao,
                    horario_notificacao, horario_confirmacao, horario_liberacao,
                    tempo_espera_segundos, observacoes, mensagem_recepcao,
                    aluno:alunos(nome_completo, matricula, turma, sala, foto_url),
                    responsavel:responsaveis(nome_completo, cpf, foto_url)
                `)
                .gte('horario_solicitacao', from)
                .lte('horario_solicitacao', to)
                .order('horario_solicitacao', { ascending: false })
                .limit(500);

            if (error) throw error;
            setRecords((data as any[]) || []);
            setPage(0);
        } catch (err) {
            console.error('Erro ao buscar registros:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [from, to]);

    useEffect(() => { fetchRecords(); }, [fetchRecords]);

    // ── Filtered records ──
    const filtered = useMemo(() => {
        let r = records;
        if (statusFilter !== 'all') r = r.filter(x => x.status === statusFilter);
        if (searchTerm.trim()) {
            const s = searchTerm.toLowerCase();
            r = r.filter(x =>
                x.aluno?.nome_completo?.toLowerCase().includes(s) ||
                x.responsavel?.nome_completo?.toLowerCase().includes(s) ||
                x.aluno?.matricula?.includes(searchTerm) ||
                x.aluno?.turma?.toLowerCase().includes(s)
            );
        }
        return r;
    }, [records, statusFilter, searchTerm]);

    const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

    // ── Analytics ──
    const analytics = useMemo(() => {
        const total = records.length;
        const liberados = records.filter(r => r.status === 'LIBERADO');
        const cancelados = records.filter(r => r.status === 'CANCELADO');
        const avgWait = liberados.length
            ? Math.round(liberados.reduce((a, r) => a + (r.tempo_espera_segundos || 0), 0) / liberados.length)
            : 0;

        // Pickups by hour bucket (6 buckets: 6h-23h)
        const hours: Record<number, number> = {};
        records.forEach(r => {
            if (r.horario_solicitacao) {
                const h = new Date(r.horario_solicitacao).getHours();
                hours[h] = (hours[h] || 0) + 1;
            }
        });
        const hourBuckets = Array.from({ length: 18 }, (_, i) => i + 6).map(h => ({
            label: `${String(h).padStart(2, '0')}h`,
            value: hours[h] || 0,
        }));

        // Top guardians
        const guardianMap: Record<string, { name: string; count: number }> = {};
        records.forEach(r => {
            if (r.responsavel?.cpf) {
                const key = r.responsavel.cpf;
                if (!guardianMap[key]) guardianMap[key] = { name: r.responsavel.nome_completo, count: 0 };
                guardianMap[key].count++;
            }
        });
        const topGuardians = Object.values(guardianMap).sort((a, b) => b.count - a.count).slice(0, 5);

        // Top students (most pickups)
        const studentMap: Record<string, { name: string; turma: string; count: number }> = {};
        records.forEach(r => {
            if (r.aluno?.matricula) {
                const key = r.aluno.matricula;
                if (!studentMap[key]) studentMap[key] = { name: r.aluno.nome_completo, turma: r.aluno.turma, count: 0 };
                studentMap[key].count++;
            }
        });
        const topStudents = Object.values(studentMap).sort((a, b) => b.count - a.count).slice(0, 5);

        // By day (for week/month/year periods)
        const dayMap: Record<string, number> = {};
        records.forEach(r => {
            if (r.horario_solicitacao) {
                const d = new Date(r.horario_solicitacao).toLocaleDateString('pt-BR', { weekday: 'short' });
                dayMap[d] = (dayMap[d] || 0) + 1;
            }
        });
        const weekDays = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
        const dayBuckets = weekDays.map(d => ({ label: d, value: dayMap[d] || 0 }));

        return { total, liberados: liberados.length, cancelados: cancelados.length, avgWait, hourBuckets, dayBuckets, topGuardians, topStudents };
    }, [records]);

    // ── Export CSV ──
    const exportCSV = () => {
        const header = ['Data', 'Hora Solicitação', 'Hora Liberação', 'Aluno', 'Matrícula', 'Turma', 'Sala', 'Responsável', 'CPF', 'Status', 'Tempo Espera (seg)', 'Observações'];
        const rows = filtered.map(r => [
            fmtDate(r.horario_solicitacao),
            fmtTime(r.horario_solicitacao),
            fmtTime(r.horario_liberacao),
            r.aluno?.nome_completo || '',
            r.aluno?.matricula || '',
            r.aluno?.turma || '',
            r.aluno?.sala || '',
            r.responsavel?.nome_completo || '',
            r.responsavel?.cpf || '',
            STATUS_PT[r.status] || r.status,
            r.tempo_espera_segundos?.toString() || '',
            r.observacoes || '',
        ]);
        const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `retiradas_${period}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click(); URL.revokeObjectURL(url);
    };

    const PERIOD_LABELS: Record<Period, string> = {
        day: 'Hoje', week: 'Esta Semana', month: 'Este Mês', year: 'Este Ano',
        custom: 'Intervalo', 'pick-day': 'Dia', 'pick-month': 'Mês', 'pick-year': 'Ano'
    };

    const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <p className="font-bold text-slate-400 animate-pulse uppercase tracking-widest text-xs">Carregando Relatórios...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-50 min-h-screen text-slate-800 font-display">
            {/* Sticky Header */}
            <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                            <BarChart2 className="text-white w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-sm font-black text-slate-900 block leading-none">Central de Relatórios</span>
                            <span className="text-[10px] text-slate-400 font-medium">Retiradas · Auditoria · Análise</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* View toggle */}
                        <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                            <button onClick={() => setActiveView('list')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeView === 'list' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-700'}`}>
                                <FileText className="w-3.5 h-3.5" /> Registros
                            </button>
                            <button onClick={() => setActiveView('analytics')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeView === 'analytics' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-700'}`}>
                                <Activity className="w-3.5 h-3.5" /> Análise
                            </button>
                        </div>
                        <button onClick={() => fetchRecords(true)} className={`p-2 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all text-slate-400 hover:text-indigo-600 ${refreshing ? 'animate-spin' : ''}`}>
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95">
                            <Download className="w-4 h-4" /> Exportar CSV
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
                <NavigationControls />

                {/* Period Selector */}
                <div className="space-y-3">
                    {/* Quick presets row */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">Atalhos:</span>
                        {(['day', 'week', 'month', 'year'] as Period[]).map(p => (
                            <button key={p} onClick={() => { setPeriod(p); setPage(0); }}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${period === p
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                                    }`}>{PERIOD_LABELS[p]}</button>
                        ))}
                        <div className="h-5 w-px bg-slate-200 mx-1" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">Personalizado:</span>
                        {(['pick-day', 'pick-month', 'pick-year', 'custom'] as Period[]).map(p => (
                            <button key={p} onClick={() => { setPeriod(p); setPage(0); }}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${period === p
                                    ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-200'
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300 hover:text-violet-600'
                                    }`}>{PERIOD_LABELS[p]}</button>
                        ))}
                    </div>

                    {/* Contextual Sub-picker */}
                    {period === 'pick-day' && (
                        <div className="flex items-center gap-3 bg-white border border-violet-200 rounded-2xl px-5 py-3 shadow-sm w-fit">
                            <Calendar className="w-4 h-4 text-violet-500 shrink-0" />
                            <span className="text-xs font-bold text-slate-500">Selecione o dia:</span>
                            <input
                                type="date"
                                value={pickDay}
                                max={new Date().toISOString().split('T')[0]}
                                onChange={e => { setPickDay(e.target.value); setPage(0); }}
                                className="text-sm font-bold text-slate-800 outline-none bg-transparent border-b-2 border-violet-300 focus:border-violet-600 transition-colors px-1"
                            />
                        </div>
                    )}

                    {period === 'pick-month' && (
                        <div className="flex items-center gap-3 bg-white border border-violet-200 rounded-2xl px-5 py-3 shadow-sm w-fit">
                            <Calendar className="w-4 h-4 text-violet-500 shrink-0" />
                            <span className="text-xs font-bold text-slate-500">Mês:</span>
                            <select
                                value={pickMonth}
                                onChange={e => { setPickMonth(Number(e.target.value)); setPage(0); }}
                                className="text-sm font-bold text-slate-800 outline-none bg-transparent border-b-2 border-violet-300 focus:border-violet-600 transition-colors px-1 pr-6"
                            >
                                {MONTH_NAMES.map((m, i) => (
                                    <option key={i} value={i}>{m}</option>
                                ))}
                            </select>
                            <span className="text-xs font-bold text-slate-500">Ano:</span>
                            <select
                                value={pickMonthYear}
                                onChange={e => { setPickMonthYear(Number(e.target.value)); setPage(0); }}
                                className="text-sm font-bold text-slate-800 outline-none bg-transparent border-b-2 border-violet-300 focus:border-violet-600 transition-colors px-1 pr-4"
                            >
                                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    )}

                    {period === 'pick-year' && (
                        <div className="flex items-center gap-3 bg-white border border-violet-200 rounded-2xl px-5 py-3 shadow-sm w-fit">
                            <Calendar className="w-4 h-4 text-violet-500 shrink-0" />
                            <span className="text-xs font-bold text-slate-500">Ano:</span>
                            <select
                                value={pickYear}
                                onChange={e => { setPickYear(Number(e.target.value)); setPage(0); }}
                                className="text-sm font-bold text-slate-800 outline-none bg-transparent border-b-2 border-violet-300 focus:border-violet-600 transition-colors px-1 pr-4"
                            >
                                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    )}

                    {period === 'custom' && (
                        <div className="flex flex-wrap items-center gap-3 bg-white border border-violet-200 rounded-2xl px-5 py-3 shadow-sm w-fit">
                            <Calendar className="w-4 h-4 text-violet-500 shrink-0" />
                            <span className="text-xs font-bold text-slate-500">De:</span>
                            <input type="date" value={customStart}
                                max={new Date().toISOString().split('T')[0]}
                                onChange={e => setCustomStart(e.target.value)}
                                className="text-sm font-bold text-slate-800 outline-none bg-transparent border-b-2 border-violet-300 focus:border-violet-600 transition-colors px-1" />
                            <span className="text-xs font-bold text-slate-400">até:</span>
                            <input type="date" value={customEnd}
                                max={new Date().toISOString().split('T')[0]}
                                onChange={e => setCustomEnd(e.target.value)}
                                className="text-sm font-bold text-slate-800 outline-none bg-transparent border-b-2 border-violet-300 focus:border-violet-600 transition-colors px-1" />
                            <button onClick={() => { setPage(0); fetchRecords(); }}
                                disabled={!customStart || !customEnd}
                                className="px-4 py-1.5 bg-violet-600 text-white rounded-xl text-xs font-bold disabled:opacity-40 hover:bg-violet-700 transition-colors">
                                Aplicar
                            </button>
                        </div>
                    )}

                    {/* Active range label */}
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Exibindo: <strong className="text-slate-600">{fmtDate(from)}</strong> até <strong className="text-slate-600">{fmtDate(to)}</strong></span>
                    </div>
                </div>

                {/* KPI Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Total de Retiradas" value={analytics.total} icon={Activity}
                        color="border-slate-200 text-slate-600" sub={period === 'day' ? 'neste dia' : undefined} />
                    <StatCard label="Liberados" value={analytics.liberados} icon={CheckCircle2}
                        color="border-emerald-200 text-emerald-600"
                        sub={analytics.total ? `${Math.round(analytics.liberados / analytics.total * 100)}% do total` : undefined}
                        trend={analytics.liberados > 0 ? 'up' : 'neutral'} />
                    <StatCard label="Cancelados / Alertas" value={analytics.cancelados} icon={AlertTriangle}
                        color="border-rose-200 text-rose-600"
                        trend={analytics.cancelados > 0 ? 'down' : 'neutral'} />
                    <StatCard label="Tempo Médio de Espera" value={waitLabel(analytics.avgWait)} icon={Clock}
                        color="border-indigo-200 text-indigo-600"
                        sub="registros liberados" />
                </div>

                {/* ─── ANALYTICS VIEW ─────────────────────────────────────────── */}
                {activeView === 'analytics' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Retiradas por Hora do Dia */}
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                            <div className="flex items-center gap-2 mb-6">
                                <Clock className="w-4 h-4 text-indigo-600" />
                                <h3 className="text-sm font-black text-slate-900">Retiradas por Hora do Dia</h3>
                            </div>
                            {records.length > 0 ? (
                                <MiniBarChart data={analytics.hourBuckets} color="#6366f1" />
                            ) : (
                                <p className="text-xs text-slate-400 italic text-center py-8">Sem dados para o período.</p>
                            )}
                        </div>

                        {/* Retiradas por Dia da Semana */}
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                            <div className="flex items-center gap-2 mb-6">
                                <Calendar className="w-4 h-4 text-violet-600" />
                                <h3 className="text-sm font-black text-slate-900">Retiradas por Dia da Semana</h3>
                            </div>
                            {records.length > 0 ? (
                                <MiniBarChart data={analytics.dayBuckets} color="#7c3aed" />
                            ) : (
                                <p className="text-xs text-slate-400 italic text-center py-8">Sem dados para o período.</p>
                            )}
                        </div>

                        {/* Top Responsáveis */}
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                            <div className="flex items-center gap-2 mb-6">
                                <Users className="w-4 h-4 text-blue-600" />
                                <h3 className="text-sm font-black text-slate-900">Responsáveis Mais Frequentes</h3>
                            </div>
                            {analytics.topGuardians.length > 0 ? (
                                <div className="space-y-3">
                                    {analytics.topGuardians.map((g, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${i === 0 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-slate-900 truncate">{g.name}</p>
                                                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
                                                    <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${(g.count / (analytics.topGuardians[0]?.count || 1)) * 100}%` }} />
                                                </div>
                                            </div>
                                            <span className="text-xs font-black text-indigo-600 shrink-0">{g.count}x</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic text-center py-8">Sem dados.</p>
                            )}
                        </div>

                        {/* Alunos com mais retiradas */}
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                            <div className="flex items-center gap-2 mb-6">
                                <Shield className="w-4 h-4 text-emerald-600" />
                                <h3 className="text-sm font-black text-slate-900">Alunos com Mais Retiradas</h3>
                            </div>
                            {analytics.topStudents.length > 0 ? (
                                <div className="space-y-3">
                                    {analytics.topStudents.map((s, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${i === 0 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-slate-900 truncate">{s.name}</p>
                                                <p className="text-[10px] text-slate-400 truncate">{s.turma}</p>
                                                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
                                                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${(s.count / (analytics.topStudents[0]?.count || 1)) * 100}%` }} />
                                                </div>
                                            </div>
                                            <span className="text-xs font-black text-emerald-600 shrink-0">{s.count}x</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic text-center py-8">Sem dados.</p>
                            )}
                        </div>

                        {/* Tempo médio por hora */}
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:col-span-2">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-amber-600" />
                                    <h3 className="text-sm font-black text-slate-900">Auditoria de Segurança — Alertas e Cancelamentos</h3>
                                </div>
                            </div>
                            {analytics.cancelados > 0 ? (
                                <div className="space-y-2">
                                    {records.filter(r => r.status === 'CANCELADO').slice(0, 8).map(r => (
                                        <div key={r.id} onClick={() => setDetailRecord(r)}
                                            className="flex items-center gap-4 p-3 bg-rose-50 border border-rose-100 rounded-2xl hover:border-rose-300 cursor-pointer transition-all group">
                                            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-slate-900 truncate">{r.aluno?.nome_completo}</p>
                                                <p className="text-[10px] text-slate-400">{r.responsavel?.nome_completo || 'Responsável não identificado'} · {fmtDate(r.horario_solicitacao)} às {fmtTime(r.horario_solicitacao)}</p>
                                            </div>
                                            {r.observacoes && <p className="text-[10px] text-rose-500 italic truncate max-w-[180px]">{r.observacoes}</p>}
                                            <Eye className="w-4 h-4 text-rose-300 group-hover:text-rose-500 shrink-0" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 p-6 bg-emerald-50 rounded-2xl">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                                    <p className="text-sm font-bold text-emerald-700">Nenhum cancelamento ou alerta registrado no período. ✓</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ─── LIST VIEW ──────────────────────────────────────────────── */}
                {activeView === 'list' && (
                    <>
                        {/* Filters */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                            <div className="relative flex-1 md:w-80 w-full">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Buscar aluno, responsável, turma..."
                                    value={searchTerm}
                                    onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-semibold placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-slate-400" />
                                <div className="flex bg-slate-50 p-1 rounded-xl gap-1">
                                    {['all', 'LIBERADO', 'CONFIRMADO', 'SOLICITADO', 'CANCELADO'].map(s => (
                                        <button key={s} onClick={() => { setStatusFilter(s); setPage(0); }}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${statusFilter === s ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                                            {s === 'all' ? 'Todos' : STATUS_PT[s]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            {['Aluno', 'Turma / Sala', 'Responsável', 'Status', 'Solicitado', 'Liberado', 'Espera', ''].map((h, i) => (
                                                <th key={i} className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {paginated.map(record => (
                                            <tr key={record.id} className="hover:bg-indigo-50/30 transition-colors group">
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        {record.aluno?.foto_url ? (
                                                            <img src={record.aluno.foto_url} className="w-8 h-8 rounded-xl object-cover shrink-0" alt="" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xs shrink-0">
                                                                {record.aluno?.nome_completo?.[0] || '?'}
                                                            </div>
                                                        )}
                                                        <p className="text-sm font-bold text-slate-900 whitespace-nowrap">{record.aluno?.nome_completo || '—'}</p>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <p className="text-xs font-bold text-slate-700">{record.aluno?.turma || '—'}</p>
                                                    <p className="text-[10px] text-slate-400">Sala: {record.aluno?.sala || '—'}</p>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <p className="text-xs font-bold text-slate-700">{record.responsavel?.nome_completo || '—'}</p>
                                                    <p className="text-[10px] text-slate-400 font-mono">{record.responsavel?.cpf || ''}</p>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLE[record.status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                                        {STATUS_PT[record.status] || record.status}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 text-xs font-bold text-slate-600 whitespace-nowrap">
                                                    <p>{fmtDate(record.horario_solicitacao)}</p>
                                                    <p className="text-slate-400">{fmtTime(record.horario_solicitacao)}</p>
                                                </td>
                                                <td className="px-5 py-4 text-xs font-bold text-emerald-600 whitespace-nowrap">
                                                    {fmtTime(record.horario_liberacao)}
                                                </td>
                                                <td className="px-5 py-4 text-xs font-bold text-indigo-600 whitespace-nowrap">
                                                    {waitLabel(record.tempo_espera_segundos)}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <button onClick={() => setDetailRecord(record)}
                                                        className="p-2 rounded-xl text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all">
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {paginated.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-20">
                                        <Search className="w-12 h-12 text-slate-200 mb-4" />
                                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Nenhum registro encontrado</p>
                                        <p className="text-xs text-slate-300 mt-2">Ajuste os filtros ou o período selecionado.</p>
                                    </div>
                                )}
                            </div>

                            {/* Pagination */}
                            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    {filtered.length} registro{filtered.length !== 1 ? 's' : ''} · Página {page + 1} de {Math.max(totalPages, 1)}
                                </span>
                                <div className="flex gap-2">
                                    <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-500 hover:text-indigo-600 hover:border-indigo-300 disabled:opacity-30 transition-all">
                                        <ArrowLeft className="w-3.5 h-3.5" /> Anterior
                                    </button>
                                    <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-500 hover:text-indigo-600 hover:border-indigo-300 disabled:opacity-30 transition-all">
                                        Próxima <ArrowRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </main>

            {/* Detail Modal */}
            {detailRecord && <RecordDetail record={detailRecord} onClose={() => setDetailRecord(null)} />}
        </div>
    );
}
