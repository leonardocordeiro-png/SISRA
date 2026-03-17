import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/audit';
import {
    BarChart2, Calendar, Clock, User, Shield, CheckCircle2,
    AlertCircle, Search, Download, TrendingUp,
    TrendingDown, Minus, Filter, Eye, X, AlertTriangle,
    Activity, FileText, Users, RefreshCw, ArrowLeft, ArrowRight, Printer,
    Table2, ChevronDown
} from 'lucide-react';
import NavigationControls from '../../components/NavigationControls';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

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

// Status color mapping (dark theme)
const STATUS_COLOR: Record<string, { color: string; border: string; bg: string }> = {
    LIBERADO:   { color: '#00e676', border: 'rgba(0,230,118,0.4)',  bg: 'rgba(0,230,118,0.08)'  },
    CONFIRMADO: { color: '#a64dff', border: 'rgba(166,77,255,0.4)', bg: 'rgba(166,77,255,0.08)' },
    SOLICITADO: { color: '#4da6ff', border: 'rgba(77,166,255,0.4)', bg: 'rgba(77,166,255,0.08)' },
    CANCELADO:  { color: 'rgba(255,69,0,0.9)', border: 'rgba(255,69,0,0.4)', bg: 'rgba(255,69,0,0.08)' },
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

function MiniBarChart({ data, color = '#4da6ff' }: { data: { label: string; value: number }[]; color?: string }) {
    const max = Math.max(...data.map(d => d.value), 1);
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '80px' }}>
            {data.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', position: 'relative' }}
                    className="group">
                    <div style={{
                        width: '100%',
                        borderRadius: '3px 3px 0 0',
                        height: `${(d.value / max) * 56}px`,
                        backgroundColor: color,
                        opacity: 0.4 + (d.value / max) * 0.6,
                        transition: 'height 0.5s',
                    }} />
                    <span style={{ fontSize: '8px', color: '#8892b0', fontFamily: 'Roboto Mono, monospace', whiteSpace: 'nowrap' }}>{d.label}</span>
                    <div style={{
                        position: 'absolute', top: '-28px', left: '50%', transform: 'translateX(-50%)',
                        background: 'rgba(10,15,30,0.95)', color: '#e0e6ed', fontSize: '10px',
                        padding: '2px 6px', borderRadius: '4px', pointerEvents: 'none', whiteSpace: 'nowrap',
                        border: '1px solid rgba(77,166,255,0.3)', zIndex: 10,
                    }} className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {d.value} retirada{d.value !== 1 ? 's' : ''}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
    const s = STATUS_COLOR[status] || { color: '#8892b0', border: 'rgba(136,146,176,0.4)', bg: 'rgba(136,146,176,0.08)' };
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '3px 10px', borderRadius: '4px',
            border: `1px solid ${s.border}`,
            background: s.bg,
            color: s.color,
            fontSize: '10px', fontFamily: 'Roboto Mono, monospace',
            fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            boxShadow: `0 0 6px ${s.border}`,
        }}>
            {STATUS_PT[status] || status}
        </span>
    );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, icon: Icon, glowColor, sub, trend }: {
    label: string; value: string | number; sub?: string;
    icon: React.ComponentType<{ size?: number; color?: string }>;
    glowColor: string; trend?: 'up' | 'down' | 'neutral';
}) {
    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
    const trendColor = trend === 'up' ? '#00e676' : trend === 'down' ? 'rgba(255,69,0,0.9)' : '#8892b0';
    return (
        <div style={{
            background: 'rgba(10,15,30,0.6)',
            border: `1px solid ${glowColor}`,
            borderRadius: '12px',
            padding: '20px',
            boxShadow: `0 0 18px ${glowColor}`,
            backdropFilter: 'blur(12px)',
            display: 'flex', flexDirection: 'column', gap: '14px',
        }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{
                    width: 60, height: 60, borderRadius: '10px',
                    border: `1px solid ${glowColor}`,
                    background: 'rgba(255,255,255,0.04)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 0 12px ${glowColor}`,
                }}>
                    <Icon size={24} color={glowColor.replace('rgba(', '').split(',').slice(0, 3).join(',').replace(',', 'rgb(') || '#4da6ff'} />
                </div>
                {trend && <TrendIcon size={16} color={trendColor} />}
            </div>
            <div>
                <p style={{ fontSize: '9px', fontFamily: 'Roboto Mono, monospace', color: '#8892b0', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px' }}>{label}</p>
                <p style={{ fontSize: '28px', fontFamily: 'Roboto Mono, monospace', fontWeight: 700, color: '#e0e6ed', animation: 'pulse 3s ease-in-out infinite' }}>{value}</p>
                {sub && <p style={{ fontSize: '10px', color: '#8892b0', marginTop: '2px' }}>{sub}</p>}
            </div>
        </div>
    );
}

// ─── Record Detail Modal ─────────────────────────────────────────────────────

function RecordDetail({ record, onClose }: { record: PickupRecord; onClose: () => void }) {
    const stages = [
        { label: 'Solicitação', time: record.horario_solicitacao, color: '#8892b0' },
        { label: 'Notificação Sala', time: record.horario_notificacao, color: '#b0914f' },
        { label: 'Chegou na Recepção', time: record.horario_confirmacao, color: '#a64dff' },
        { label: 'Liberado', time: record.horario_liberacao, color: '#00e676' },
    ];

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '16px', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: 'rgba(10,15,30,0.97)', border: '1px solid rgba(255,215,0,0.2)',
                    borderRadius: '16px', width: '100%', maxWidth: '520px', overflow: 'hidden',
                    boxShadow: '0 0 40px rgba(77,166,255,0.15)',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(77,166,255,0.15) 0%, rgba(166,77,255,0.15) 100%)',
                    borderBottom: '1px solid rgba(255,215,0,0.2)',
                    padding: '24px 32px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {record.aluno?.foto_url ? (
                            <img src={record.aluno.foto_url} style={{ width: 48, height: 48, borderRadius: '8px', objectFit: 'cover', border: '1px solid rgba(255,215,0,0.3)' }} alt="" />
                        ) : (
                            <div style={{
                                width: 48, height: 48, borderRadius: '8px', background: 'rgba(77,166,255,0.15)',
                                border: '1px solid rgba(77,166,255,0.3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#4da6ff', fontFamily: 'Roboto Mono, monospace', fontSize: '20px', fontWeight: 700,
                            }}>
                                {record.aluno?.nome_completo?.[0] || '?'}
                            </div>
                        )}
                        <div>
                            <p style={{ color: '#e0e6ed', fontWeight: 700, fontSize: '14px', lineHeight: '1.3' }}>{record.aluno?.nome_completo}</p>
                            <p style={{ color: '#8892b0', fontSize: '11px', fontFamily: 'Roboto Mono, monospace' }}>{record.aluno?.turma} · Sala {record.aluno?.sala}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px', padding: '8px', cursor: 'pointer', color: '#8892b0',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.color = '#e0e6ed'; }}
                        onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.color = '#8892b0'; }}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Status */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <StatusBadge status={record.status} />
                        <span style={{ fontSize: '11px', color: '#8892b0', fontFamily: 'Roboto Mono, monospace' }}>{fmtDate(record.horario_solicitacao)}</span>
                    </div>

                    {/* Guardian */}
                    <div style={{
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,215,0,0.15)',
                        borderRadius: '10px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px',
                    }}>
                        {record.responsavel?.foto_url ? (
                            <img src={record.responsavel.foto_url} style={{ width: 40, height: 40, borderRadius: '8px', objectFit: 'cover' }} alt="" />
                        ) : (
                            <div style={{
                                width: 40, height: 40, borderRadius: '8px', background: 'rgba(77,166,255,0.1)',
                                border: '1px solid rgba(77,166,255,0.3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <User size={18} color="#4da6ff" />
                            </div>
                        )}
                        <div>
                            <p style={{ fontSize: '13px', fontWeight: 700, color: '#e0e6ed' }}>{record.responsavel?.nome_completo || '—'}</p>
                            <p style={{ fontSize: '11px', color: '#8892b0', fontFamily: 'Roboto Mono, monospace' }}>CPF: {record.responsavel?.cpf || '—'}</p>
                        </div>
                    </div>

                    {/* Timeline */}
                    <div>
                        <p style={{ fontSize: '9px', fontFamily: 'Roboto Mono, monospace', color: '#8892b0', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '14px' }}>Linha do Tempo da Retirada</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {stages.map((s, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{
                                        width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                                        background: s.time ? s.color : 'rgba(136,146,176,0.3)',
                                        boxShadow: s.time ? `0 0 6px ${s.color}` : 'none',
                                    }} />
                                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#8892b0', flex: 1 }}>{s.label}</span>
                                    <span style={{ fontSize: '11px', fontFamily: 'Roboto Mono, monospace', fontWeight: 700, color: s.time ? '#e0e6ed' : 'rgba(136,146,176,0.4)' }}>
                                        {fmtTime(s.time)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Wait time */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: 'rgba(77,166,255,0.06)', border: '1px solid rgba(77,166,255,0.2)',
                        borderRadius: '10px', padding: '14px 18px',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4da6ff' }}>
                            <Clock size={16} />
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#4da6ff' }}>Tempo Total de Espera</span>
                        </div>
                        <span style={{ fontSize: '18px', fontFamily: 'Roboto Mono, monospace', fontWeight: 700, color: '#4da6ff' }}>{waitLabel(record.tempo_espera_segundos)}</span>
                    </div>

                    {/* Notes */}
                    {record.observacoes && (
                        <div style={{
                            background: 'rgba(176,145,79,0.06)', border: '1px solid rgba(176,145,79,0.25)',
                            borderRadius: '10px', padding: '14px 16px',
                        }}>
                            <p style={{ fontSize: '9px', fontFamily: 'Roboto Mono, monospace', color: '#b0914f', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Observações</p>
                            <p style={{ fontSize: '12px', color: '#e0e6ed', lineHeight: '1.6' }}>{record.observacoes}</p>
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
    const [methodFilter, setMethodFilter] = useState('all');
    const [detailRecord, setDetailRecord] = useState<PickupRecord | null>(null);
    const [activeView, setActiveView] = useState<'list' | 'analytics'>('list');
    const [page, setPage] = useState(0);
    const [exportMenuOpen, setExportMenuOpen] = useState(false);
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
        if (methodFilter !== 'all') {
            r = r.filter(x => methodFilter === 'TOTEM' ? x.tipo_solicitacao === 'ROTINA' : x.tipo_solicitacao !== 'ROTINA');
        }
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
    }, [records, statusFilter, methodFilter, searchTerm]);

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
        const header = ['Data', 'Hora Solicitação', 'Hora Liberação', 'Aluno', 'Matrícula', 'Turma', 'Sala', 'Responsável', 'CPF', 'Status', 'Método', 'Tempo Espera (seg)', 'Observações'];
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
            r.tipo_solicitacao === 'ROTINA' ? 'Totem' : 'Recepção',
            r.tempo_espera_segundos?.toString() || '',
            r.observacoes || '',
        ]);
        const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `retiradas_${period}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click(); URL.revokeObjectURL(url);

        logAudit('EXPORTACAO_DADOS', 'solicitacoes_retirada', undefined, {
            formato: 'CSV',
            periodo: period,
            de: from,
            ate: to,
            registros: filtered.length,
        });
    };

    // ── Export Excel (XLSX) ──
    const exportXLSX = () => {
        const header = ['Data', 'Hora Solicitação', 'Hora Liberação', 'Aluno', 'Matrícula', 'Turma', 'Sala', 'Responsável', 'CPF', 'Status', 'Método', 'Tempo Espera (seg)', 'Observações'];
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
            r.tipo_solicitacao === 'ROTINA' ? 'Totem' : 'Recepção',
            r.tempo_espera_segundos ?? '',
            r.observacoes || '',
        ]);

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);

        // Column widths
        ws['!cols'] = [12,10,10,30,12,22,8,30,14,12,12,14,40].map(w => ({ wch: w }));

        // Summary sheet
        const summaryData = [
            ['Relatório de Retiradas — La Salle, Cheguei!'],
            ['Período:', `${fmtDate(from)} até ${fmtDate(to)}`],
            ['Gerado em:', new Date().toLocaleString('pt-BR')],
            [],
            ['Total de Registros', analytics.total],
            ['Liberados', analytics.liberados],
            ['Cancelados / Alertas', analytics.cancelados],
            ['Tempo Médio de Espera', waitLabel(analytics.avgWait)],
        ];
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        wsSummary['!cols'] = [{ wch: 30 }, { wch: 30 }];

        XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');
        XLSX.utils.book_append_sheet(wb, ws, 'Registros');

        XLSX.writeFile(wb, `retiradas_${period}_${new Date().toISOString().split('T')[0]}.xlsx`);

        logAudit('EXPORTACAO_DADOS', 'solicitacoes_retirada', undefined, {
            formato: 'XLSX',
            periodo: period,
            de: from,
            ate: to,
            registros: filtered.length,
        });
    };

    // ── Export PDF ──
    const exportPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        // Header
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('La Salle, Cheguei! — Relatório de Retiradas', 14, 18);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(`Período: ${fmtDate(from)} até ${fmtDate(to)}`, 14, 26);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 31);

        // KPI summary row
        doc.setFontSize(9);
        doc.setTextColor(50);
        const kpis = [
            `Total: ${analytics.total}`,
            `Liberados: ${analytics.liberados}`,
            `Cancelados: ${analytics.cancelados}`,
            `Tempo Médio: ${waitLabel(analytics.avgWait)}`,
        ];
        kpis.forEach((k, i) => doc.text(k, 14 + i * 65, 38));

        // Table
        autoTable(doc, {
            startY: 44,
            head: [['Data', 'Hora', 'Aluno', 'Turma', 'Responsável', 'Método', 'Status', 'Espera', 'Observações']],
            body: filtered.map(r => [
                fmtDate(r.horario_solicitacao),
                fmtTime(r.horario_solicitacao),
                r.aluno?.nome_completo || '—',
                r.aluno?.turma || '—',
                r.responsavel?.nome_completo || '—',
                r.tipo_solicitacao === 'ROTINA' ? 'Totem' : 'Recepção',
                STATUS_PT[r.status] || r.status,
                waitLabel(r.tempo_espera_segundos),
                r.observacoes || '',
            ]),
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 7 },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0: { cellWidth: 22 },
                1: { cellWidth: 14 },
                2: { cellWidth: 44 },
                3: { cellWidth: 32 },
                4: { cellWidth: 44 },
                5: { cellWidth: 18 },
                6: { cellWidth: 20 },
                7: { cellWidth: 14 },
                8: { cellWidth: 'auto' },
            },
            didDrawPage: (data: any) => {
                const pageCount = (doc as any).internal.getNumberOfPages();
                doc.setFontSize(7);
                doc.setTextColor(150);
                doc.text(
                    `Página ${data.pageNumber} de ${pageCount}`,
                    doc.internal.pageSize.getWidth() - 14,
                    doc.internal.pageSize.getHeight() - 8,
                    { align: 'right' }
                );
            },
        });

        doc.save(`retiradas_${period}_${new Date().toISOString().split('T')[0]}.pdf`);

        logAudit('EXPORTACAO_DADOS', 'solicitacoes_retirada', undefined, {
            formato: 'PDF',
            periodo: period,
            de: from,
            ate: to,
            registros: filtered.length,
        });
    };

    const PERIOD_LABELS: Record<Period, string> = {
        day: 'Hoje', week: 'Esta Semana', month: 'Este Mês', year: 'Este Ano',
        custom: 'Intervalo', 'pick-day': 'Dia', 'pick-month': 'Mês', 'pick-year': 'Ano'
    };

    const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

    // ── Shared style helpers ──
    const darkBtn = (active: boolean, activeColor = '#4da6ff'): React.CSSProperties => ({
        padding: '6px 14px',
        borderRadius: '6px',
        border: active ? `1px solid ${activeColor}` : '1px solid rgba(255,215,0,0.2)',
        background: active ? `rgba(77,166,255,0.12)` : 'rgba(255,255,255,0.03)',
        color: active ? activeColor : '#8892b0',
        fontFamily: 'Roboto Mono, monospace',
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase' as const,
        cursor: 'pointer',
        transition: 'all 0.2s',
        boxShadow: active ? `0 0 8px ${activeColor}40` : 'none',
        whiteSpace: 'nowrap' as const,
    });

    const inputStyle: React.CSSProperties = {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(77,166,255,0.25)',
        borderRadius: '6px',
        color: '#e0e6ed',
        fontFamily: 'Roboto Mono, monospace',
        fontSize: '12px',
        fontWeight: 700,
        padding: '4px 8px',
        outline: 'none',
    };

    const selectStyle: React.CSSProperties = {
        background: 'rgba(10,15,30,0.95)',
        border: '1px solid rgba(77,166,255,0.25)',
        borderRadius: '6px',
        color: '#e0e6ed',
        fontFamily: 'Roboto Mono, monospace',
        fontSize: '12px',
        fontWeight: 700,
        padding: '4px 8px',
        outline: 'none',
        cursor: 'pointer',
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050b1d' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                        width: 48, height: 48,
                        border: '3px solid rgba(77,166,255,0.2)',
                        borderTop: '3px solid #4da6ff',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                    }} />
                    <p style={{ fontFamily: 'Roboto Mono, monospace', color: '#8892b0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Carregando Relatórios...</p>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.7} }`}</style>
            </div>
        );
    }

    return (
        <div style={{ background: '#050b1d', minHeight: '100vh', color: '#e0e6ed', fontFamily: 'Roboto, sans-serif' }}>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.75} }
                @keyframes pulseDot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.4)} }
                .ph-hover-row:hover { background: rgba(77,166,255,0.05) !important; }
                .ph-btn-icon:hover { color: #4da6ff !important; border-color: rgba(77,166,255,0.4) !important; }
                .ph-export-item:hover { background: rgba(77,166,255,0.08) !important; }
                .ph-filter-btn:hover { color: #e0e6ed !important; border-color: rgba(77,166,255,0.35) !important; }
            `}</style>

            {/* ── Header ── */}
            <header style={{
                position: 'sticky', top: 0, zIndex: 30,
                background: 'rgba(5,11,29,0.97)', backdropFilter: 'blur(12px)',
                borderBottom: '1px solid rgba(255,215,0,0.2)',
                boxShadow: '0 2px 20px rgba(0,0,0,0.5)',
            }}>
                <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                    {/* Left: title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: '8px',
                            border: '1px solid rgba(255,215,0,0.3)',
                            background: 'rgba(255,215,0,0.06)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 0 14px rgba(255,215,0,0.15)',
                        }}>
                            <BarChart2 size={20} color="#b0914f" />
                        </div>
                        <div>
                            <span style={{ display: 'block', fontFamily: 'Roboto Mono, monospace', fontSize: '13px', fontWeight: 700, color: '#e0e6ed', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: '1.2' }}>
                                Central de Relatórios
                            </span>
                            <span style={{ fontSize: '10px', color: '#8892b0', fontFamily: 'Roboto Mono, monospace' }}>Relatórios · Auditoria · Análise</span>
                        </div>
                    </div>

                    {/* Right: action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {/* View toggle */}
                        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: '8px', padding: '3px', gap: '3px' }}>
                            <button
                                onClick={() => setActiveView('list')}
                                style={{
                                    padding: '5px 14px', borderRadius: '5px', border: 'none',
                                    background: activeView === 'list' ? 'rgba(77,166,255,0.15)' : 'transparent',
                                    color: activeView === 'list' ? '#4da6ff' : '#8892b0',
                                    fontFamily: 'Roboto Mono, monospace', fontSize: '10px', fontWeight: 700,
                                    textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    transition: 'all 0.2s',
                                }}
                            >
                                <FileText size={13} /> Registros
                            </button>
                            <button
                                onClick={() => setActiveView('analytics')}
                                style={{
                                    padding: '5px 14px', borderRadius: '5px', border: 'none',
                                    background: activeView === 'analytics' ? 'rgba(77,166,255,0.15)' : 'transparent',
                                    color: activeView === 'analytics' ? '#4da6ff' : '#8892b0',
                                    fontFamily: 'Roboto Mono, monospace', fontSize: '10px', fontWeight: 700,
                                    textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    transition: 'all 0.2s',
                                }}
                            >
                                <Activity size={13} /> Análise
                            </button>
                        </div>

                        {/* Refresh */}
                        <button
                            onClick={() => fetchRecords(true)}
                            className="ph-btn-icon"
                            style={{
                                width: 36, height: 36, borderRadius: '7px',
                                border: '1px solid rgba(255,215,0,0.2)',
                                background: 'rgba(255,255,255,0.03)',
                                color: '#8892b0', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                animation: refreshing ? 'spin 0.8s linear infinite' : 'none',
                                transition: 'all 0.2s',
                            }}
                        >
                            <RefreshCw size={15} />
                        </button>

                        {/* Print */}
                        <button
                            onClick={() => window.print()}
                            className="ph-btn-icon"
                            style={{
                                padding: '7px 14px', borderRadius: '7px',
                                border: '1px solid rgba(255,215,0,0.2)',
                                background: 'rgba(255,255,255,0.03)',
                                color: '#8892b0', cursor: 'pointer',
                                fontFamily: 'Roboto Mono, monospace', fontSize: '10px', fontWeight: 700,
                                textTransform: 'uppercase', letterSpacing: '0.06em',
                                display: 'flex', alignItems: 'center', gap: '7px',
                                transition: 'all 0.2s',
                            }}
                        >
                            <Printer size={14} /> <span>Imprimir</span>
                        </button>

                        {/* Export dropdown */}
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setExportMenuOpen(o => !o)}
                                style={{
                                    padding: '7px 14px', borderRadius: '7px',
                                    border: '1px solid rgba(255,215,0,0.35)',
                                    background: 'rgba(255,215,0,0.07)',
                                    color: '#b0914f', cursor: 'pointer',
                                    fontFamily: 'Roboto Mono, monospace', fontSize: '10px', fontWeight: 700,
                                    textTransform: 'uppercase', letterSpacing: '0.06em',
                                    display: 'flex', alignItems: 'center', gap: '7px',
                                    boxShadow: '0 0 10px rgba(255,215,0,0.1)',
                                }}
                            >
                                <Download size={14} /> Exportar <ChevronDown size={11} />
                            </button>

                            {exportMenuOpen && (
                                <>
                                    <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setExportMenuOpen(false)} />
                                    <div style={{
                                        position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 50,
                                        background: 'rgba(10,15,30,0.98)', border: '1px solid rgba(255,215,0,0.2)',
                                        borderRadius: '10px', overflow: 'hidden', minWidth: '168px',
                                        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                                    }}>
                                        <button
                                            onClick={() => { exportPDF(); setExportMenuOpen(false); }}
                                            className="ph-export-item"
                                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 16px', background: 'transparent', border: 'none', color: '#e0e6ed', fontFamily: 'Roboto Mono, monospace', fontSize: '11px', fontWeight: 700, cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s' }}
                                        >
                                            <FileText size={14} color="rgba(255,69,0,0.85)" />
                                            Exportar PDF
                                        </button>
                                        <button
                                            onClick={() => { exportXLSX(); setExportMenuOpen(false); }}
                                            className="ph-export-item"
                                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 16px', background: 'transparent', border: 'none', color: '#e0e6ed', fontFamily: 'Roboto Mono, monospace', fontSize: '11px', fontWeight: 700, cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s' }}
                                        >
                                            <Table2 size={14} color="#00e676" />
                                            Exportar Planilha
                                        </button>
                                        <div style={{ borderTop: '1px solid rgba(255,215,0,0.1)' }} />
                                        <button
                                            onClick={() => { exportCSV(); setExportMenuOpen(false); }}
                                            className="ph-export-item"
                                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 16px', background: 'transparent', border: 'none', color: '#e0e6ed', fontFamily: 'Roboto Mono, monospace', fontSize: '11px', fontWeight: 700, cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s' }}
                                        >
                                            <Download size={14} color="#8892b0" />
                                            Exportar CSV
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
                <NavigationControls />

                {/* ── Period Selector ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Quick presets + custom pickers row */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '9px', fontFamily: 'Roboto Mono, monospace', color: '#8892b0', textTransform: 'uppercase', letterSpacing: '0.12em', flexShrink: 0 }}>Período:</span>
                        {(['day', 'week', 'month', 'year'] as Period[]).map(p => (
                            <button
                                key={p}
                                onClick={() => { setPeriod(p); setPage(0); }}
                                className="ph-filter-btn"
                                style={darkBtn(period === p, '#4da6ff')}
                            >
                                {PERIOD_LABELS[p]}
                            </button>
                        ))}
                        <div style={{ width: '1px', height: '18px', background: 'rgba(255,215,0,0.2)', margin: '0 4px' }} />
                        {(['pick-day', 'pick-month', 'pick-year', 'custom'] as Period[]).map(p => (
                            <button
                                key={p}
                                onClick={() => { setPeriod(p); setPage(0); }}
                                className="ph-filter-btn"
                                style={darkBtn(period === p, '#a64dff')}
                            >
                                {PERIOD_LABELS[p]}
                            </button>
                        ))}
                    </div>

                    {/* Contextual sub-picker */}
                    {period === 'pick-day' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(166,77,255,0.25)', borderRadius: '8px', padding: '10px 16px', width: 'fit-content' }}>
                            <Calendar size={15} color="#a64dff" />
                            <span style={{ fontSize: '11px', color: '#8892b0', fontFamily: 'Roboto Mono, monospace' }}>Selecione o dia:</span>
                            <input
                                type="date"
                                value={pickDay}
                                max={new Date().toISOString().split('T')[0]}
                                onChange={e => { setPickDay(e.target.value); setPage(0); }}
                                style={inputStyle}
                            />
                        </div>
                    )}

                    {period === 'pick-month' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(166,77,255,0.25)', borderRadius: '8px', padding: '10px 16px', width: 'fit-content', flexWrap: 'wrap' }}>
                            <Calendar size={15} color="#a64dff" />
                            <span style={{ fontSize: '11px', color: '#8892b0', fontFamily: 'Roboto Mono, monospace' }}>Mês:</span>
                            <select value={pickMonth} onChange={e => { setPickMonth(Number(e.target.value)); setPage(0); }} style={selectStyle}>
                                {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                            </select>
                            <span style={{ fontSize: '11px', color: '#8892b0', fontFamily: 'Roboto Mono, monospace' }}>Ano:</span>
                            <select value={pickMonthYear} onChange={e => { setPickMonthYear(Number(e.target.value)); setPage(0); }} style={selectStyle}>
                                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    )}

                    {period === 'pick-year' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(166,77,255,0.25)', borderRadius: '8px', padding: '10px 16px', width: 'fit-content' }}>
                            <Calendar size={15} color="#a64dff" />
                            <span style={{ fontSize: '11px', color: '#8892b0', fontFamily: 'Roboto Mono, monospace' }}>Ano:</span>
                            <select value={pickYear} onChange={e => { setPickYear(Number(e.target.value)); setPage(0); }} style={selectStyle}>
                                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    )}

                    {period === 'custom' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(166,77,255,0.25)', borderRadius: '8px', padding: '10px 16px', width: 'fit-content', flexWrap: 'wrap' }}>
                            <Calendar size={15} color="#a64dff" />
                            <span style={{ fontSize: '11px', color: '#8892b0', fontFamily: 'Roboto Mono, monospace' }}>De:</span>
                            <input type="date" value={customStart} max={new Date().toISOString().split('T')[0]} onChange={e => setCustomStart(e.target.value)} style={inputStyle} />
                            <span style={{ fontSize: '11px', color: '#8892b0', fontFamily: 'Roboto Mono, monospace' }}>até:</span>
                            <input type="date" value={customEnd} max={new Date().toISOString().split('T')[0]} onChange={e => setCustomEnd(e.target.value)} style={inputStyle} />
                            <button
                                onClick={() => { setPage(0); fetchRecords(); }}
                                disabled={!customStart || !customEnd}
                                style={{
                                    padding: '5px 14px', borderRadius: '6px',
                                    border: '1px solid rgba(166,77,255,0.4)',
                                    background: 'rgba(166,77,255,0.12)',
                                    color: '#a64dff', fontFamily: 'Roboto Mono, monospace', fontSize: '10px', fontWeight: 700,
                                    cursor: 'pointer', opacity: (!customStart || !customEnd) ? 0.4 : 1,
                                }}
                            >
                                Aplicar
                            </button>
                        </div>
                    )}

                    {/* Active range label */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#8892b0', fontFamily: 'Roboto Mono, monospace' }}>
                        <Clock size={13} />
                        <span>Exibindo: <strong style={{ color: '#e0e6ed' }}>{fmtDate(from)}</strong> até <strong style={{ color: '#e0e6ed' }}>{fmtDate(to)}</strong></span>
                    </div>
                </div>

                {/* ── Summary Cards ── */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,215,0,0.15)', borderRadius: '14px', padding: '24px', backdropFilter: 'blur(12px)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                        <SummaryCard
                            label="Total Retiradas"
                            value={analytics.total}
                            icon={Activity}
                            glowColor="rgba(77,166,255,0.35)"
                            sub={period === 'day' ? 'neste dia' : undefined}
                        />
                        <SummaryCard
                            label="Liberados"
                            value={analytics.liberados}
                            icon={CheckCircle2}
                            glowColor="rgba(0,230,118,0.4)"
                            sub={analytics.total ? `${Math.round(analytics.liberados / analytics.total * 100)}% do total` : undefined}
                            trend={analytics.liberados > 0 ? 'up' : 'neutral'}
                        />
                        <SummaryCard
                            label="Cancelados"
                            value={analytics.cancelados}
                            icon={AlertTriangle}
                            glowColor="rgba(255,69,0,0.4)"
                            trend={analytics.cancelados > 0 ? 'down' : 'neutral'}
                        />
                        <SummaryCard
                            label="Tempo Médio"
                            value={waitLabel(analytics.avgWait)}
                            icon={Clock}
                            glowColor="rgba(255,215,0,0.3)"
                            sub="registros liberados"
                        />
                    </div>
                </div>

                {/* ─── ANALYTICS VIEW ─────────────────────────────────────────── */}
                {activeView === 'analytics' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
                        {/* Retiradas por Hora do Dia */}
                        <div style={{ background: 'rgba(10,15,30,0.6)', border: '1px solid rgba(77,166,255,0.3)', borderRadius: '12px', padding: '24px', backdropFilter: 'blur(12px)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                                <Clock size={15} color="#4da6ff" />
                                <h3 style={{ fontSize: '12px', fontFamily: 'Roboto Mono, monospace', fontWeight: 700, color: '#e0e6ed', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Retiradas por Hora do Dia</h3>
                            </div>
                            {records.length > 0 ? (
                                <MiniBarChart data={analytics.hourBuckets} color="#4da6ff" />
                            ) : (
                                <p style={{ fontSize: '11px', color: '#8892b0', textAlign: 'center', padding: '32px 0', fontStyle: 'italic' }}>Sem dados para o período.</p>
                            )}
                        </div>

                        {/* Retiradas por Dia da Semana */}
                        <div style={{ background: 'rgba(10,15,30,0.6)', border: '1px solid rgba(166,77,255,0.3)', borderRadius: '12px', padding: '24px', backdropFilter: 'blur(12px)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                                <Calendar size={15} color="#a64dff" />
                                <h3 style={{ fontSize: '12px', fontFamily: 'Roboto Mono, monospace', fontWeight: 700, color: '#e0e6ed', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Retiradas por Dia da Semana</h3>
                            </div>
                            {records.length > 0 ? (
                                <MiniBarChart data={analytics.dayBuckets} color="#a64dff" />
                            ) : (
                                <p style={{ fontSize: '11px', color: '#8892b0', textAlign: 'center', padding: '32px 0', fontStyle: 'italic' }}>Sem dados para o período.</p>
                            )}
                        </div>

                        {/* Top Responsáveis */}
                        <div style={{ background: 'rgba(10,15,30,0.6)', border: '1px solid rgba(77,166,255,0.3)', borderRadius: '12px', padding: '24px', backdropFilter: 'blur(12px)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                                <Users size={15} color="#4da6ff" />
                                <h3 style={{ fontSize: '12px', fontFamily: 'Roboto Mono, monospace', fontWeight: 700, color: '#e0e6ed', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Responsáveis Mais Frequentes</h3>
                            </div>
                            {analytics.topGuardians.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {analytics.topGuardians.map((g, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                                width: 26, height: 26, borderRadius: '6px', flexShrink: 0,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: i === 0 ? 'rgba(77,166,255,0.2)' : 'rgba(255,255,255,0.05)',
                                                border: i === 0 ? '1px solid rgba(77,166,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                                                color: i === 0 ? '#4da6ff' : '#8892b0',
                                                fontFamily: 'Roboto Mono, monospace', fontSize: '10px', fontWeight: 700,
                                            }}>{i + 1}</div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ fontSize: '12px', fontWeight: 700, color: '#e0e6ed', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</p>
                                                <div style={{ width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', height: '4px', marginTop: '4px' }}>
                                                    <div style={{ background: '#4da6ff', height: '4px', borderRadius: '3px', width: `${(g.count / (analytics.topGuardians[0]?.count || 1)) * 100}%` }} />
                                                </div>
                                            </div>
                                            <span style={{ fontSize: '11px', fontFamily: 'Roboto Mono, monospace', fontWeight: 700, color: '#4da6ff', flexShrink: 0 }}>{g.count}x</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ fontSize: '11px', color: '#8892b0', textAlign: 'center', padding: '32px 0', fontStyle: 'italic' }}>Sem dados.</p>
                            )}
                        </div>

                        {/* Alunos com mais retiradas */}
                        <div style={{ background: 'rgba(10,15,30,0.6)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '12px', padding: '24px', backdropFilter: 'blur(12px)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                                <Shield size={15} color="#00e676" />
                                <h3 style={{ fontSize: '12px', fontFamily: 'Roboto Mono, monospace', fontWeight: 700, color: '#e0e6ed', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Alunos com Mais Retiradas</h3>
                            </div>
                            {analytics.topStudents.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {analytics.topStudents.map((s, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                                width: 26, height: 26, borderRadius: '6px', flexShrink: 0,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: i === 0 ? 'rgba(0,230,118,0.15)' : 'rgba(255,255,255,0.05)',
                                                border: i === 0 ? '1px solid rgba(0,230,118,0.4)' : '1px solid rgba(255,255,255,0.08)',
                                                color: i === 0 ? '#00e676' : '#8892b0',
                                                fontFamily: 'Roboto Mono, monospace', fontSize: '10px', fontWeight: 700,
                                            }}>{i + 1}</div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ fontSize: '12px', fontWeight: 700, color: '#e0e6ed', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                                                <p style={{ fontSize: '10px', color: '#8892b0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.turma}</p>
                                                <div style={{ width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', height: '4px', marginTop: '4px' }}>
                                                    <div style={{ background: '#00e676', height: '4px', borderRadius: '3px', width: `${(s.count / (analytics.topStudents[0]?.count || 1)) * 100}%` }} />
                                                </div>
                                            </div>
                                            <span style={{ fontSize: '11px', fontFamily: 'Roboto Mono, monospace', fontWeight: 700, color: '#00e676', flexShrink: 0 }}>{s.count}x</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ fontSize: '11px', color: '#8892b0', textAlign: 'center', padding: '32px 0', fontStyle: 'italic' }}>Sem dados.</p>
                            )}
                        </div>

                        {/* Auditoria de Segurança */}
                        <div style={{ background: 'rgba(10,15,30,0.6)', border: '1px solid rgba(255,69,0,0.3)', borderRadius: '12px', padding: '24px', backdropFilter: 'blur(12px)', gridColumn: 'span 2' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                <TrendingUp size={15} color="#b0914f" />
                                <h3 style={{ fontSize: '12px', fontFamily: 'Roboto Mono, monospace', fontWeight: 700, color: '#e0e6ed', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Auditoria de Segurança — Alertas e Cancelamentos</h3>
                            </div>
                            {analytics.cancelados > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {records.filter(r => r.status === 'CANCELADO').slice(0, 8).map(r => (
                                        <div
                                            key={r.id}
                                            onClick={() => setDetailRecord(r)}
                                            className="ph-hover-row"
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '14px',
                                                padding: '12px 14px', borderRadius: '8px',
                                                background: 'rgba(255,69,0,0.05)', border: '1px solid rgba(255,69,0,0.2)',
                                                cursor: 'pointer', transition: 'background 0.2s',
                                            }}
                                        >
                                            <AlertCircle size={16} color="rgba(255,69,0,0.85)" style={{ flexShrink: 0 }} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ fontSize: '12px', fontWeight: 700, color: '#e0e6ed', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.aluno?.nome_completo}</p>
                                                <p style={{ fontSize: '10px', color: '#8892b0', fontFamily: 'Roboto Mono, monospace' }}>{r.responsavel?.nome_completo || 'Responsável não identificado'} · {fmtDate(r.horario_solicitacao)} às {fmtTime(r.horario_solicitacao)}</p>
                                            </div>
                                            {r.observacoes && <p style={{ fontSize: '10px', color: 'rgba(255,69,0,0.8)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{r.observacoes}</p>}
                                            <Eye size={15} color="rgba(255,69,0,0.5)" style={{ flexShrink: 0 }} />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '20px 18px', background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.2)', borderRadius: '8px' }}>
                                    <CheckCircle2 size={18} color="#00e676" style={{ flexShrink: 0 }} />
                                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#00e676' }}>Nenhum cancelamento ou alerta registrado no período.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ─── LIST VIEW ──────────────────────────────────────────────── */}
                {activeView === 'list' && (
                    <>
                        {/* Filters row */}
                        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,215,0,0.15)', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {/* Search */}
                            <div style={{ position: 'relative' }}>
                                <Search size={15} color="#8892b0" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                <input
                                    type="text"
                                    placeholder="Buscar aluno, responsável, turma..."
                                    value={searchTerm}
                                    onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
                                    style={{
                                        width: '100%', paddingLeft: '36px', paddingRight: '16px', paddingTop: '9px', paddingBottom: '9px',
                                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(77,166,255,0.2)',
                                        borderRadius: '8px', color: '#e0e6ed',
                                        fontFamily: 'Roboto, sans-serif', fontSize: '12px',
                                        outline: 'none', boxSizing: 'border-box',
                                    }}
                                />
                            </div>

                            {/* Method + Status filters */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
                                <Filter size={14} color="#8892b0" style={{ flexShrink: 0 }} />
                                {/* Method */}
                                <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,215,0,0.12)', borderRadius: '7px', padding: '3px' }}>
                                    {['all', 'TOTEM', 'RECEPCAO'].map(m => (
                                        <button
                                            key={m}
                                            onClick={() => { setMethodFilter(m); setPage(0); }}
                                            className="ph-filter-btn"
                                            style={darkBtn(methodFilter === m)}
                                        >
                                            {m === 'all' ? 'Todos Métodos' : m === 'TOTEM' ? 'Totem' : 'Recepção'}
                                        </button>
                                    ))}
                                </div>
                                {/* Status */}
                                <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,215,0,0.12)', borderRadius: '7px', padding: '3px', flexWrap: 'wrap' }}>
                                    {['all', 'LIBERADO', 'CONFIRMADO', 'SOLICITADO', 'CANCELADO'].map(s => (
                                        <button
                                            key={s}
                                            onClick={() => { setStatusFilter(s); setPage(0); }}
                                            className="ph-filter-btn"
                                            style={darkBtn(statusFilter === s, STATUS_COLOR[s]?.color || '#4da6ff')}
                                        >
                                            {s === 'all' ? 'Todos Status' : STATUS_PT[s]}
                                        </button>
                                    ))}
                                </div>
                                <span style={{ fontSize: '10px', fontFamily: 'Roboto Mono, monospace', color: '#8892b0', marginLeft: 'auto' }}>
                                    {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                        </div>

                        {/* Table panel */}
                        <div style={{ background: 'rgba(10,15,30,0.6)', border: '1px solid rgba(77,166,255,0.2)', borderRadius: '14px', overflow: 'hidden', backdropFilter: 'blur(12px)' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(77,166,255,0.15)' }}>
                                            {['Aluno', 'Turma / Sala', 'Responsável', 'Método', 'Status', 'Solicitado', 'Liberado', 'Espera', ''].map((h, i) => (
                                                <th
                                                    key={i}
                                                    style={{
                                                        padding: '14px 18px',
                                                        fontSize: '9px', fontFamily: 'Roboto Mono, monospace', fontWeight: 700,
                                                        color: '#8892b0', textTransform: 'uppercase', letterSpacing: '0.1em',
                                                        textAlign: 'left', whiteSpace: 'nowrap',
                                                        background: 'rgba(255,255,255,0.02)',
                                                    }}
                                                >{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginated.map(record => (
                                            <tr
                                                key={record.id}
                                                className="ph-hover-row"
                                                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                                            >
                                                {/* Aluno */}
                                                <td style={{ padding: '14px 18px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        {record.aluno?.foto_url ? (
                                                            <img src={record.aluno.foto_url} style={{ width: 32, height: 32, borderRadius: '7px', objectFit: 'cover', border: '1px solid rgba(77,166,255,0.2)', flexShrink: 0 }} alt="" />
                                                        ) : (
                                                            <div style={{
                                                                width: 32, height: 32, borderRadius: '7px', flexShrink: 0,
                                                                background: 'rgba(77,166,255,0.1)', border: '1px solid rgba(77,166,255,0.2)',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                color: '#4da6ff', fontFamily: 'Roboto Mono, monospace', fontSize: '12px', fontWeight: 700,
                                                            }}>
                                                                {record.aluno?.nome_completo?.[0] || '?'}
                                                            </div>
                                                        )}
                                                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#e0e6ed', whiteSpace: 'nowrap' }}>{record.aluno?.nome_completo || '—'}</p>
                                                    </div>
                                                </td>
                                                {/* Turma / Sala */}
                                                <td style={{ padding: '14px 18px' }}>
                                                    <p style={{ fontSize: '12px', fontWeight: 700, color: '#e0e6ed', fontFamily: 'Roboto Mono, monospace' }}>{record.aluno?.turma || '—'}</p>
                                                    <p style={{ fontSize: '10px', color: '#8892b0', fontFamily: 'Roboto Mono, monospace' }}>Sala {record.aluno?.sala || '—'}</p>
                                                </td>
                                                {/* Responsável */}
                                                <td style={{ padding: '14px 18px' }}>
                                                    <p style={{ fontSize: '12px', fontWeight: 700, color: '#e0e6ed' }}>{record.responsavel?.nome_completo || '—'}</p>
                                                    <p style={{ fontSize: '10px', color: '#8892b0', fontFamily: 'Roboto Mono, monospace' }}>{record.responsavel?.cpf || ''}</p>
                                                </td>
                                                {/* Método */}
                                                <td style={{ padding: '14px 18px' }}>
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                        padding: '3px 10px', borderRadius: '5px',
                                                        border: record.tipo_solicitacao === 'ROTINA' ? '1px solid rgba(166,77,255,0.35)' : '1px solid rgba(77,166,255,0.35)',
                                                        background: record.tipo_solicitacao === 'ROTINA' ? 'rgba(166,77,255,0.08)' : 'rgba(77,166,255,0.08)',
                                                        color: record.tipo_solicitacao === 'ROTINA' ? '#a64dff' : '#4da6ff',
                                                        fontSize: '10px', fontFamily: 'Roboto Mono, monospace', fontWeight: 700,
                                                        textTransform: 'uppercase', letterSpacing: '0.06em',
                                                    }}>
                                                        {record.tipo_solicitacao === 'ROTINA' ? 'Totem' : 'Recepção'}
                                                    </span>
                                                </td>
                                                {/* Status */}
                                                <td style={{ padding: '14px 18px' }}>
                                                    <StatusBadge status={record.status} />
                                                </td>
                                                {/* Solicitado */}
                                                <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                                                    <p style={{ fontSize: '11px', fontFamily: 'Roboto Mono, monospace', fontWeight: 700, color: '#e0e6ed' }}>{fmtDate(record.horario_solicitacao)}</p>
                                                    <p style={{ fontSize: '10px', fontFamily: 'Roboto Mono, monospace', color: '#8892b0' }}>{fmtTime(record.horario_solicitacao)}</p>
                                                </td>
                                                {/* Liberado */}
                                                <td style={{ padding: '14px 18px', fontSize: '11px', fontFamily: 'Roboto Mono, monospace', fontWeight: 700, color: '#00e676', whiteSpace: 'nowrap' }}>
                                                    {fmtTime(record.horario_liberacao)}
                                                </td>
                                                {/* Espera */}
                                                <td style={{ padding: '14px 18px', fontSize: '11px', fontFamily: 'Roboto Mono, monospace', fontWeight: 700, color: '#4da6ff', whiteSpace: 'nowrap' }}>
                                                    {waitLabel(record.tempo_espera_segundos)}
                                                </td>
                                                {/* Detail */}
                                                <td style={{ padding: '14px 18px' }}>
                                                    <button
                                                        onClick={() => setDetailRecord(record)}
                                                        className="ph-btn-icon"
                                                        style={{
                                                            width: 32, height: 32, borderRadius: '7px',
                                                            border: '1px solid rgba(255,255,255,0.08)',
                                                            background: 'transparent', cursor: 'pointer',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            color: 'rgba(136,146,176,0.5)', transition: 'all 0.2s',
                                                        }}
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {paginated.length === 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '72px 24px' }}>
                                        <div style={{
                                            width: 56, height: 56, borderRadius: '50%',
                                            border: '2px solid rgba(77,166,255,0.3)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px',
                                            animation: 'pulseDot 2s ease-in-out infinite',
                                        }}>
                                            <Search size={24} color="rgba(77,166,255,0.5)" />
                                        </div>
                                        <p style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '12px', fontWeight: 700, color: '#8892b0', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Nenhum Registro Encontrado</p>
                                        <p style={{ fontSize: '11px', color: 'rgba(136,146,176,0.5)', marginTop: '6px' }}>Ajuste os filtros ou o período selecionado.</p>
                                    </div>
                                )}
                            </div>

                            {/* Pagination */}
                            <div style={{
                                padding: '14px 20px', borderTop: '1px solid rgba(77,166,255,0.12)',
                                background: 'rgba(255,255,255,0.02)',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}>
                                <span style={{ fontSize: '10px', fontFamily: 'Roboto Mono, monospace', color: '#8892b0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                    {filtered.length} registro{filtered.length !== 1 ? 's' : ''} · Página {page + 1} de {Math.max(totalPages, 1)}
                                </span>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        disabled={page === 0}
                                        onClick={() => setPage(p => p - 1)}
                                        className="ph-filter-btn"
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '5px',
                                            padding: '6px 12px', borderRadius: '6px',
                                            border: '1px solid rgba(255,215,0,0.2)', background: 'rgba(255,255,255,0.03)',
                                            color: page === 0 ? 'rgba(136,146,176,0.3)' : '#8892b0',
                                            fontFamily: 'Roboto Mono, monospace', fontSize: '10px', fontWeight: 700,
                                            cursor: page === 0 ? 'default' : 'pointer',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <ArrowLeft size={13} /> Anterior
                                    </button>
                                    <button
                                        disabled={page >= totalPages - 1}
                                        onClick={() => setPage(p => p + 1)}
                                        className="ph-filter-btn"
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '5px',
                                            padding: '6px 12px', borderRadius: '6px',
                                            border: '1px solid rgba(255,215,0,0.2)', background: 'rgba(255,255,255,0.03)',
                                            color: page >= totalPages - 1 ? 'rgba(136,146,176,0.3)' : '#8892b0',
                                            fontFamily: 'Roboto Mono, monospace', fontSize: '10px', fontWeight: 700,
                                            cursor: page >= totalPages - 1 ? 'default' : 'pointer',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        Próxima <ArrowRight size={13} />
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