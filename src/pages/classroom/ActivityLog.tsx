import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    History, CheckCircle, Clock, AlertTriangle, Search,
    Download, ArrowLeft, Home, ChevronRight, ChevronLeft,
    Loader2, School, User as UserIcon, MessageSquare, RefreshCw,
} from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

// ── Types ─────────────────────────────────────────────────────────────────────

type LogEntry = {
    id: string;
    status: string;
    tipo_solicitacao: string;
    horario_solicitacao: string;
    horario_liberacao: string | null;
    horario_confirmacao: string | null;
    mensagem_sala: string | null;
    aluno: { nome_completo: string; turma: string; sala: string };
    responsavel: { nome_completo: string } | null;
};

// ── Design tokens (matches Dashboard.tsx) ─────────────────────────────────────

const D = {
    bgDark1: '#0A0F1F',
    bgDark2: '#121A2B',
    glassBg: 'rgba(255,255,255,0.03)',
    border:  'rgba(255,255,255,0.08)',
    gold:    '#F1C40F',
    blue:    '#3498DB',
    green:   '#38D9A9',
    red:     '#E40123',
    muted:   '#8C98A6',
    mutedDk: '#6A7788',
};

const STATUS_LABEL: Record<string, string> = {
    SOLICITADO: 'Aguardando',
    NOTIFICADO: 'Notificado',
    AGUARDANDO: 'Em Espera',
    LIBERADO:   'Liberado',
    CONFIRMADO: 'Na Recepção',
    CONCLUIDO:  'Concluído',
    CANCELADO:  'Cancelado',
};

const STATUS_STYLE: Record<string, React.CSSProperties> = {
    LIBERADO:   { color: '#fbbf24', background: 'rgba(251,191,36,0.1)',  borderColor: 'rgba(251,191,36,0.35)' },
    CONFIRMADO: { color: '#60a5fa', background: 'rgba(96,165,250,0.1)', borderColor: 'rgba(96,165,250,0.35)' },
    CONCLUIDO:  { color: '#34d399', background: 'rgba(52,211,153,0.1)', borderColor: 'rgba(52,211,153,0.35)' },
    CANCELADO:  { color: '#f87171', background: 'rgba(248,113,113,0.1)',borderColor: 'rgba(248,113,113,0.35)' },
    AGUARDANDO: { color: '#94a3b8', background: 'rgba(148,163,184,0.08)', borderColor: 'rgba(148,163,184,0.25)' },
    SOLICITADO: { color: '#94a3b8', background: 'rgba(148,163,184,0.08)', borderColor: 'rgba(148,163,184,0.25)' },
    NOTIFICADO: { color: '#60a5fa', background: 'rgba(96,165,250,0.08)', borderColor: 'rgba(96,165,250,0.25)' },
};

const PAGE_SIZE = 25;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fmtElapsed(isoA: string, isoB: string | null) {
    if (!isoB) return null;
    const ms = new Date(isoB).getTime() - new Date(isoA).getTime();
    if (ms < 0) return null;
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return m > 0 ? `${m}min ${s}s` : `${s}s`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color }: {
    icon: React.ReactNode; label: string; value: string | number; color: string;
}) {
    return (
        <div style={{
            background: D.glassBg, border: `1px solid ${D.border}`,
            borderRadius: 14, padding: '20px 22px', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', gap: 16,
        }}>
            <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: `${color}14`, border: `1px solid ${color}28`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
                {icon}
            </div>
            <div>
                <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: D.mutedDk, marginBottom: 4 }}>
                    {label}
                </p>
                <p style={{ fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{value}</p>
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ClassroomActivityLog() {
    const { user, role, escolaId: ctxEscolaId } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();

    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(0);
    const [escolaId, setEscolaId] = useState<string | null>(ctxEscolaId ?? null);
    const [salaAtribuida, setSalaAtribuida] = useState<string | null>(null);
    const [turmaAtribuida, setTurmaAtribuida] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        if (!document.getElementById('cls-montserrat')) {
            const link = document.createElement('link');
            link.id = 'cls-montserrat';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap';
            document.head.appendChild(link);
        }
        setTimeout(() => setMounted(true), 80);
    }, []);

    // Resolve escola_id and class assignment from DB profile
    useEffect(() => {
        if (!user) return;
        supabase.from('usuarios').select('escola_id, sala_atribuida, turma_atribuida')
            .eq('id', user.id).single()
            .then(({ data }) => {
                if (data?.escola_id) setEscolaId(data.escola_id);
                else if (ctxEscolaId) setEscolaId(ctxEscolaId);
                if (data?.sala_atribuida && data.sala_atribuida !== 'TODAS') setSalaAtribuida(data.sala_atribuida);
                if (data?.turma_atribuida) setTurmaAtribuida(data.turma_atribuida);
            });
    }, [user, ctxEscolaId]);

    const fetchLogs = useCallback(async () => {
        if (!escolaId) return;
        setLoading(true);
        try {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            let query = supabase
                .from('solicitacoes_retirada')
                .select(`
                    id, status, tipo_solicitacao,
                    horario_solicitacao, horario_liberacao, horario_confirmacao, mensagem_sala,
                    aluno:alunos!inner(nome_completo, turma, sala),
                    responsavel:responsaveis(nome_completo)
                `)
                .eq('escola_id', escolaId)
                .gte('horario_solicitacao', todayStart.toISOString())
                .order('horario_solicitacao', { ascending: false });

            // SCT role: scope to assigned class/sala
            if (role !== 'ADMIN' && role !== 'COORDENADOR') {
                if (salaAtribuida) {
                    query = query.eq('alunos.sala', salaAtribuida);
                } else if (turmaAtribuida) {
                    query = query.eq('alunos.turma', turmaAtribuida);
                }
            }

            const { data, error } = await query;
            if (error) throw error;
            setLogs((data as unknown as LogEntry[]) || []);
        } catch (err: any) {
            toast.error('Erro ao carregar log', err.message);
        } finally {
            setLoading(false);
        }
    }, [escolaId, role, salaAtribuida, turmaAtribuida]);

    useEffect(() => {
        if (escolaId) fetchLogs();
    }, [escolaId, fetchLogs]);

    // ── Derived data ──────────────────────────────────────────────────────────

    const filtered = logs.filter(l =>
        l.aluno.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.responsavel?.nome_completo || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages - 1);
    const paginated = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

    const released = logs.filter(l => ['LIBERADO', 'CONFIRMADO', 'CONCLUIDO'].includes(l.status));
    const withResponse = released.filter(l => l.horario_liberacao);
    const avgMinutes = withResponse.length > 0
        ? withResponse.reduce((acc, l) =>
            acc + (new Date(l.horario_liberacao!).getTime() - new Date(l.horario_solicitacao).getTime()) / 60000, 0
          ) / withResponse.length
        : 0;

    const classLabel = salaAtribuida ?? turmaAtribuida
        ?? ((role === 'ADMIN' || role === 'COORDENADOR') ? 'Todas as Turmas' : '—');

    // ── Export CSV ────────────────────────────────────────────────────────────

    const exportCSV = () => {
        if (filtered.length === 0) { toast.error('Sem dados', 'Nenhum registro para exportar.'); return; }
        const headers = ['Aluno', 'Turma', 'Sala', 'Responsável', 'Solicitado', 'Liberado', 'Confirmado', 'Tempo Resposta', 'Status', 'Tipo', 'Mensagem Sala'];
        const rows = filtered.map(l => [
            l.aluno.nome_completo,
            l.aluno.turma,
            l.aluno.sala,
            l.responsavel?.nome_completo || '',
            fmtTime(l.horario_solicitacao),
            fmtTime(l.horario_liberacao),
            fmtTime(l.horario_confirmacao),
            fmtElapsed(l.horario_solicitacao, l.horario_liberacao) || '',
            STATUS_LABEL[l.status] || l.status,
            l.tipo_solicitacao === 'EMERGENCIA' ? 'EMERGÊNCIA' : 'ROTINA',
            l.mensagem_sala || '',
        ]);
        const csv = [headers, ...rows]
            .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
            .join('\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `log_sala_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Exportado', `${filtered.length} registros exportados como CSV.`);
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div style={{
            minHeight: '100vh',
            background: `radial-gradient(circle at 75% 10%, ${D.bgDark2}, ${D.bgDark1} 70%)`,
            fontFamily: "'Montserrat', system-ui, sans-serif",
            color: '#FFFFFF',
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.4s',
        }}>
            <style>{`
                @keyframes cls-spin { to { transform: rotate(360deg); } }
                .alog-row:hover { background: rgba(255,255,255,0.03) !important; }
                .alog-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
                .alog-scroll::-webkit-scrollbar-track { background: transparent; }
                .alog-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
            `}</style>

            {/* ── Header ── */}
            <header style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '15px 30px',
                background: D.glassBg, backdropFilter: 'blur(10px)',
                borderBottom: `1px solid ${D.border}`,
                gap: 14, flexWrap: 'wrap',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={() => navigate(-1)} style={navBtn(D.blue)}>
                        <ArrowLeft size={14} /> VOLTAR
                    </button>
                    <button onClick={() => navigate('/sala/dashboard')} style={navBtn(D.gold)}>
                        <Home size={14} /> DASHBOARD
                    </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: D.gold, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <History size={15} style={{ color: D.bgDark1 }} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>LOG DE ATIVIDADES</h1>
                        <p style={{ margin: 0, fontSize: 11, color: D.muted }}>
                            {classLabel} · {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={fetchLogs} disabled={loading} style={{
                        width: 36, height: 36, borderRadius: 8,
                        border: `1px solid ${D.border}`, background: D.glassBg,
                        color: D.muted, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        {loading
                            ? <Loader2 size={14} style={{ animation: 'cls-spin 0.8s linear infinite' }} />
                            : <RefreshCw size={14} />
                        }
                    </button>
                    <button onClick={exportCSV} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '9px 18px', borderRadius: 8,
                        background: 'rgba(52,152,219,0.1)', border: '1px solid rgba(52,152,219,0.3)',
                        color: D.blue, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'Montserrat, sans-serif',
                    }}>
                        <Download size={13} /> Exportar CSV
                    </button>
                </div>
            </header>

            <main style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 30px' }}>

                {/* ── Stats ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
                    <StatCard
                        icon={<CheckCircle size={20} style={{ color: D.green }} />}
                        label="Liberados Hoje"
                        value={released.length}
                        color={D.green}
                    />
                    <StatCard
                        icon={<Clock size={20} style={{ color: D.blue }} />}
                        label="Tempo Médio de Resposta"
                        value={withResponse.length > 0 ? `${avgMinutes.toFixed(1)} min` : '—'}
                        color={D.blue}
                    />
                    <StatCard
                        icon={<AlertTriangle size={20} style={{ color: D.red }} />}
                        label="Emergências"
                        value={logs.filter(l => l.tipo_solicitacao === 'EMERGENCIA').length}
                        color={D.red}
                    />
                    <StatCard
                        icon={<MessageSquare size={20} style={{ color: D.gold }} />}
                        label="Total de Registros Hoje"
                        value={logs.length}
                        color={D.gold}
                    />
                </div>

                {/* ── Table card ── */}
                <div style={{
                    background: D.glassBg, border: `1px solid ${D.border}`,
                    borderRadius: 16, overflow: 'hidden', backdropFilter: 'blur(10px)',
                }}>
                    {/* Toolbar */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '14px 20px', borderBottom: `1px solid ${D.border}`,
                        flexWrap: 'wrap',
                    }}>
                        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                            <Search size={14} style={{
                                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                                color: D.muted, pointerEvents: 'none',
                            }} />
                            <input
                                value={searchTerm}
                                onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
                                placeholder="Buscar aluno ou responsável..."
                                style={{
                                    width: '100%', paddingLeft: 36, paddingRight: 14, paddingTop: 9, paddingBottom: 9,
                                    background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${D.border}`,
                                    borderRadius: 10, fontSize: 13, color: '#fff', outline: 'none',
                                    fontFamily: 'Montserrat, sans-serif', boxSizing: 'border-box',
                                }}
                            />
                        </div>
                        <span style={{ fontSize: 11, color: D.mutedDk, fontWeight: 600, flexShrink: 0 }}>
                            {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
                        </span>
                    </div>

                    {/* Table */}
                    <div className="alog-scroll" style={{ overflowX: 'auto' }}>
                        {loading ? (
                            <div style={{ padding: '60px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, opacity: 0.5 }}>
                                <Loader2 size={28} style={{ animation: 'cls-spin 0.8s linear infinite', color: D.blue }} />
                                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: D.muted }}>
                                    Carregando registros...
                                </p>
                            </div>
                        ) : paginated.length === 0 ? (
                            <div style={{ padding: '60px 0', textAlign: 'center', opacity: 0.4 }}>
                                <History size={32} style={{ color: D.muted, marginBottom: 12 }} />
                                <p style={{ fontSize: 13, fontWeight: 600, color: D.muted }}>
                                    {searchTerm ? 'Nenhum resultado encontrado.' : 'Nenhuma atividade registrada hoje.'}
                                </p>
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(255,255,255,0.015)' }}>
                                        {['Aluno', 'Turma / Sala', 'Responsável', 'Solicitado', 'Liberado', 'Resp. (min)', 'Confirmado', 'Status'].map(h => (
                                            <th key={h} style={{
                                                padding: '10px 16px', textAlign: 'left',
                                                fontSize: 9, fontWeight: 700,
                                                textTransform: 'uppercase', letterSpacing: '0.14em',
                                                color: D.mutedDk,
                                                borderBottom: `1px solid ${D.border}`,
                                                whiteSpace: 'nowrap',
                                            }}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginated.map(entry => {
                                        const elapsed = fmtElapsed(entry.horario_solicitacao, entry.horario_liberacao);
                                        const isEmerg = entry.tipo_solicitacao === 'EMERGENCIA';
                                        const sSt = STATUS_STYLE[entry.status] ?? STATUS_STYLE.SOLICITADO;
                                        return (
                                            <tr
                                                key={entry.id}
                                                className="alog-row"
                                                style={{
                                                    borderBottom: `1px solid rgba(255,255,255,0.04)`,
                                                    background: isEmerg ? 'rgba(228,1,35,0.04)' : 'transparent',
                                                    transition: 'background 0.15s',
                                                }}
                                            >
                                                <td style={{ padding: '11px 16px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                                        <div style={{
                                                            width: 28, height: 28, borderRadius: 7,
                                                            background: isEmerg ? 'rgba(228,1,35,0.12)' : 'rgba(52,152,219,0.1)',
                                                            border: `1px solid ${isEmerg ? 'rgba(228,1,35,0.3)' : 'rgba(52,152,219,0.22)'}`,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                                        }}>
                                                            <UserIcon size={12} style={{ color: isEmerg ? '#f87171' : D.blue }} />
                                                        </div>
                                                        <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>
                                                            {entry.aluno.nome_completo}
                                                        </span>
                                                        {isEmerg && (
                                                            <AlertTriangle size={11} style={{ color: '#f87171', flexShrink: 0 }} />
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '11px 16px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                        <School size={10} style={{ color: D.gold, flexShrink: 0 }} />
                                                        <span style={{ fontSize: 11, color: D.muted, fontWeight: 600 }}>
                                                            {entry.aluno.sala || entry.aluno.turma}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '11px 16px', fontSize: 12, color: D.muted, maxWidth: 160 }}>
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                                                        {entry.responsavel?.nome_completo || '—'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '11px 16px', fontSize: 12, color: D.muted, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                                    {fmtTime(entry.horario_solicitacao)}
                                                </td>
                                                <td style={{ padding: '11px 16px', fontSize: 12, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                                    <span style={{ color: entry.horario_liberacao ? D.gold : D.mutedDk }}>
                                                        {fmtTime(entry.horario_liberacao)}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '11px 16px', fontSize: 11, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                                    <span style={{ color: elapsed ? D.green : D.mutedDk }}>
                                                        {elapsed || '—'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '11px 16px', fontSize: 12, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                                    <span style={{ color: entry.horario_confirmacao ? D.green : D.mutedDk }}>
                                                        {fmtTime(entry.horario_confirmacao)}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '11px 16px', whiteSpace: 'nowrap' }}>
                                                    <span style={{
                                                        padding: '3px 10px', borderRadius: 99,
                                                        fontSize: 9, fontWeight: 700,
                                                        textTransform: 'uppercase', letterSpacing: '0.06em',
                                                        border: '1px solid',
                                                        ...sSt,
                                                    }}>
                                                        {STATUS_LABEL[entry.status] || entry.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Pagination */}
                    {!loading && totalPages > 1 && (
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 20px', borderTop: `1px solid ${D.border}`,
                            background: 'rgba(255,255,255,0.01)',
                        }}>
                            <span style={{ fontSize: 11, color: D.mutedDk, fontWeight: 600 }}>
                                Página {safePage + 1} de {totalPages} · {filtered.length} registros
                            </span>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                    onClick={() => setPage(p => Math.max(0, p - 1))}
                                    disabled={safePage === 0}
                                    style={paginBtn(safePage === 0)}
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                    disabled={safePage >= totalPages - 1}
                                    style={paginBtn(safePage >= totalPages - 1)}
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

// ── Style helpers ─────────────────────────────────────────────────────────────

function navBtn(color: string): React.CSSProperties {
    return {
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}40`,
        color, padding: '10px 18px', borderRadius: 8,
        fontWeight: 600, fontSize: 13, cursor: 'pointer',
        fontFamily: 'Montserrat, sans-serif',
        transition: 'all 0.2s',
    };
}

function paginBtn(disabled: boolean): React.CSSProperties {
    return {
        width: 32, height: 32, borderRadius: 7,
        border: '1px solid rgba(255,255,255,0.08)',
        background: disabled ? 'transparent' : 'rgba(255,255,255,0.05)',
        color: disabled ? '#3A4455' : '#8C98A6',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    };
}
