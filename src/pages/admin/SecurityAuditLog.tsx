import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/audit';
import {
    Shield, Search, Filter, AlertTriangle,
    Activity, Clock, Terminal, ChevronLeft, ChevronRight,
    Trash2, Download, RefreshCw, ChevronDown, ChevronUp,
    LogIn, LogOut, UserCheck, QrCode, FileText, Settings,
    Users, Eye, XCircle, Calendar
} from 'lucide-react';
import NavigationControls from '../../components/NavigationControls';
import { useAuth } from '../../context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type AuditLog = {
    id: string;
    usuario_id: string | null;
    acao: string;
    detalhes: any;
    descricao?: string;
    tabela_afetada?: string;
    registro_id?: string;
    ip_address: string;
    user_agent: string;
    criado_em: string;
    escola_id?: string;
    usuario?: { nome: string; email: string } | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
    { id: 'all',         label: 'Todos',             icon: Shield,        color: 'rose' },
    { id: 'auth',        label: 'Autenticação',       icon: LogIn,         color: 'emerald' },
    { id: 'data',        label: 'Dados',              icon: Users,         color: 'blue' },
    { id: 'withdrawals', label: 'Retiradas',          icon: UserCheck,     color: 'indigo' },
    { id: 'qr',          label: 'Cartões QR',         icon: QrCode,        color: 'violet' },
    { id: 'system',      label: 'Sistema',            icon: Settings,      color: 'amber' },
    { id: 'alerts',      label: 'Alertas',            icon: AlertTriangle, color: 'red' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const TAB_FILTERS: Record<TabId, string[]> = {
    all:         [],
    auth:        ['LOGIN_SUCESSO', 'LOGIN_FALHA', 'SISTEMA_LOGIN', 'SISTEMA_LOGOUT', 'ACESSO_NEGADO'],
    data:        ['CADASTRO_ESTUDANTE', 'EDICAO_ESTUDANTE', 'EXCLUSAO_ESTUDANTE', 'EXCLUSAO_ESTUDANTE_MASSA',
                  'CADASTRO_RESPONSAVEL', 'REMANEJAMENTO_TURMA', 'LIMPEZA_REGISTROS', 'GERACAO_LINK_ACESSO',
                  'EXPORTACAO_DADOS', 'ANALISE'],
    withdrawals: ['SOLICITACAO_RETIRADA', 'CONFIRMACAO_ENTREGA'],
    qr:          ['GERACAO_CARTAO_QR', 'GERACAO_RELATORIO'],
    system:      ['ALTERACAO_CONFIGURACAO', 'MANUTENCAO', 'MANIPULACAO_DADOS'],
    alerts:      ['LOGIN_FALHA', 'ACESSO_NEGADO', 'EXCLUSAO_ESTUDANTE_MASSA', 'LIMPEZA_REGISTROS'],
};

const PAGINATION_OPTIONS = [20, 40, 60, 80, 100];

const AUTO_REFRESH_INTERVALS = [
    { label: 'Desativado', value: 0 },
    { label: '30s', value: 30 },
    { label: '1 min', value: 60 },
    { label: '5 min', value: 300 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEventStyle(acao: string) {
    switch (acao) {
        case 'LOGIN_SUCESSO': case 'SISTEMA_LOGIN':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20';
        case 'LOGIN_FALHA': case 'ACESSO_NEGADO':
            return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20';
        case 'LIMPEZA_REGISTROS': case 'EXCLUSAO_ESTUDANTE': case 'EXCLUSAO_ESTUDANTE_MASSA':
            return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20';
        case 'CADASTRO_ESTUDANTE': case 'CADASTRO_RESPONSAVEL':
            return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20';
        case 'EDICAO_ESTUDANTE': case 'REMANEJAMENTO_TURMA':
            return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20';
        case 'SOLICITACAO_RETIRADA': case 'CONFIRMACAO_ENTREGA':
            return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20';
        case 'SISTEMA_LOGOUT':
            return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20';
        case 'GERACAO_CARTAO_QR': case 'GERACAO_LINK_ACESSO': case 'GERACAO_RELATORIO':
            return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20';
        case 'ANALISE': case 'EXPORTACAO_DADOS':
            return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20';
        case 'ALTERACAO_CONFIGURACAO': case 'MANUTENCAO':
            return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20';
        default:
            return 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20';
    }
}

function getEventIcon(acao: string) {
    const cls = 'w-3 h-3';
    switch (acao) {
        case 'LOGIN_SUCESSO': case 'SISTEMA_LOGIN': return <LogIn className={cls} />;
        case 'LOGIN_FALHA': case 'ACESSO_NEGADO': return <XCircle className={cls} />;
        case 'SISTEMA_LOGOUT': return <LogOut className={cls} />;
        case 'LIMPEZA_REGISTROS': case 'EXCLUSAO_ESTUDANTE': case 'EXCLUSAO_ESTUDANTE_MASSA': return <Trash2 className={cls} />;
        case 'CADASTRO_ESTUDANTE': case 'CADASTRO_RESPONSAVEL': return <Users className={cls} />;
        case 'EDICAO_ESTUDANTE': case 'REMANEJAMENTO_TURMA': return <Filter className={cls} />;
        case 'SOLICITACAO_RETIRADA': case 'CONFIRMACAO_ENTREGA': return <UserCheck className={cls} />;
        case 'GERACAO_CARTAO_QR': case 'GERACAO_LINK_ACESSO': return <QrCode className={cls} />;
        case 'GERACAO_RELATORIO': case 'ANALISE': case 'EXPORTACAO_DADOS': return <FileText className={cls} />;
        case 'ALTERACAO_CONFIGURACAO': case 'MANUTENCAO': return <Settings className={cls} />;
        default: return <Activity className={cls} />;
    }
}

function describeLog(log: AuditLog): string {
    const d = log.detalhes;
    if (!d) return 'Ação registrada via sistema.';
    switch (log.acao) {
        case 'CADASTRO_ESTUDANTE': return `Cadastrou aluno: ${d.nome || '—'} (${d.turma || '—'})`;
        case 'EDICAO_ESTUDANTE': return `Editou aluno: ${d.nome || '—'} (${d.turma || '—'})`;
        case 'EXCLUSAO_ESTUDANTE': return `Removeu aluno: ${d.nome || '—'} (Matrícula: ${d.matricula || '—'})`;
        case 'EXCLUSAO_ESTUDANTE_MASSA': return `Removeu ${d.quantidade || '?'} alunos em massa.`;
        case 'LIMPEZA_REGISTROS': return `Limpeza de banco: ${d.alunos_removidos ?? '?'} alunos removidos.`;
        case 'REMANEJAMENTO_TURMA': return `Moveu ${d.nome || '—'} de ${d.turma_anterior || '—'} → ${d.turma_nova || '—'}.`;
        case 'GERACAO_LINK_ACESSO': return `Gerou link mágico para ${d.aluno_nome || '—'}.`;
        case 'GERACAO_CARTAO_QR': return `Cartão QR ${d.acao === 'REATIVACAO' ? 'reativado' : 'gerado'} para ${d.responsavel_nome || '—'}.`;
        case 'GERACAO_RELATORIO': return `Relatório gerado: ${d.tipo || '—'} (${d.total_registros ?? '?'} registros).`;
        case 'SOLICITACAO_RETIRADA': return `Retirada: ${d.aluno_nome || '—'} por ${d.responsavel_nome || 'responsável'} via ${d.tipo || '—'}.`;
        case 'CONFIRMACAO_ENTREGA': return `Entrega confirmada: ${d.aluno_nome || '—'} retirado por ${d.responsavel_nome || '—'}.`;
        case 'LOGIN_SUCESSO': case 'SISTEMA_LOGIN': return `Login: ${d.email || '—'} (${d.portal || d.role || 'ADMIN'})`;
        case 'LOGIN_FALHA': return `Falha de login: ${d.motivo || '—'} — ${d.email || '—'} (${d.portal || 'ADMIN'})`;
        case 'ACESSO_NEGADO': return `Acesso negado: ${d.email || '—'} — Perfil: ${d.perfil || '—'} (${d.portal || '—'})`;
        case 'SISTEMA_LOGOUT': return `Logout: ${d.email || '—'}`;
        case 'CADASTRO_RESPONSAVEL': return `Responsável: ${d.nome || '—'} cadastrado.`;
        case 'EXPORTACAO_DADOS': case 'ANALISE': return d.message || d.motivo || `Análise/exportação: ${d.tipo || 'dados'}.`;
        case 'ALTERACAO_CONFIGURACAO': return `Configuração alterada: ${d.campo || d.message || '—'}`;
        default: return d.message || d.motivo || log.descricao || 'Ação registrada.';
    }
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportToCSV(logs: AuditLog[], tabLabel: string) {
    const headers = ['ID', 'Data/Hora', 'Ação', 'Operador', 'Email', 'Detalhe', 'Tabela Afetada', 'IP', 'User Agent'];
    const rows = logs.map(log => [
        log.id,
        new Date(log.criado_em).toLocaleString('pt-BR'),
        log.acao,
        log.usuario?.nome || 'Sistema',
        log.usuario?.email || '—',
        describeLog(log).replace(/,/g, ';'),
        log.tabela_afetada || '—',
        log.ip_address || '—',
        (log.user_agent || '—').replace(/,/g, ';').slice(0, 100),
    ]);

    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const bom = '\uFEFF'; // UTF-8 BOM for Excel
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `auditoria_${tabLabel.toLowerCase().replace(/\s+/g, '_')}_${date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SecurityAuditLog() {
    const { escolaId } = useAuth();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<TabId>('all');
    const [error, setError] = useState<string | null>(null);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [totalCount, setTotalCount] = useState(0);

    // Date range
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Auto-refresh
    const [refreshInterval, setRefreshInterval] = useState(0);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [isRefreshing, setIsRefreshing] = useState(false);
    const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Tab counts
    const [tabCounts, setTabCounts] = useState<Record<string, number>>({});

    const totalPages = Math.ceil(totalCount / pageSize);

    const fetchLogs = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        else setIsRefreshing(true);
        setError(null);

        try {
            let query = supabase
                .from('logs_auditoria')
                .select('*, usuario:usuarios(nome, email)', { count: 'exact' });

            if (escolaId) query = query.eq('escola_id', escolaId);

            const tabActions = TAB_FILTERS[activeTab];
            if (tabActions.length > 0) {
                query = query.in('acao', tabActions);
            }

            if (searchTerm.trim()) {
                const safeTerm = searchTerm.trim().replace(/[%_\\]/g, '\\$&').slice(0, 100);
                query = query.or(`acao.ilike.%${safeTerm}%,tabela_afetada.ilike.%${safeTerm}%,ip_address.ilike.%${safeTerm}%`);
            }

            if (dateFrom) query = query.gte('criado_em', new Date(dateFrom).toISOString());
            if (dateTo) {
                const to = new Date(dateTo);
                to.setHours(23, 59, 59, 999);
                query = query.lte('criado_em', to.toISOString());
            }

            const from = (currentPage - 1) * pageSize;
            const to = from + pageSize - 1;

            const { data, error: fetchError, count } = await query
                .order('criado_em', { ascending: false })
                .range(from, to);

            if (fetchError) throw fetchError;
            setLogs(data || []);
            setTotalCount(count || 0);
            setLastRefresh(new Date());
        } catch (err: any) {
            if (!silent) {
                setError(err.code === '42501'
                    ? 'Permissão negada (RLS). Verifique as políticas de segurança do banco de dados.'
                    : 'Erro ao carregar registros de auditoria.');
            }
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [activeTab, searchTerm, currentPage, pageSize, dateFrom, dateTo, escolaId]);

    const fetchTabCounts = useCallback(async () => {
        try {
            const results: Record<string, number> = {};
            await Promise.all(
                TABS.filter(t => t.id !== 'all').map(async tab => {
                    const actions = TAB_FILTERS[tab.id];
                    if (actions.length === 0) return;
                    let cq = supabase
                        .from('logs_auditoria')
                        .select('id', { count: 'exact', head: true })
                        .in('acao', actions);
                    if (escolaId) cq = cq.eq('escola_id', escolaId);
                    const { count } = await cq;
                    results[tab.id] = count || 0;
                })
            );
            setTabCounts(results);
        } catch { /* silent */ }
    }, [escolaId]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);
    useEffect(() => { fetchTabCounts(); }, [fetchTabCounts]);

    useEffect(() => {
        if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
        if (refreshInterval > 0) {
            refreshTimerRef.current = setInterval(() => fetchLogs(true), refreshInterval * 1000);
        }
        return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
    }, [refreshInterval, fetchLogs]);

    useEffect(() => { setCurrentPage(1); }, [activeTab, searchTerm, dateFrom, dateTo]);

    const handleExportCSV = () => {
        const tab = TABS.find(t => t.id === activeTab);
        const label = tab?.label || 'todos';
        logAudit('GERACAO_RELATORIO', 'logs_auditoria', undefined, {
            tipo: `CSV - Auditoria: ${label}`,
            total_registros: totalCount,
            filtros: { tab: activeTab, searchTerm, dateFrom, dateTo }
        });
        exportToCSV(logs, label);
    };

    // ─── Loading State ──────────────────────────────────────────────────────

    if (loading && logs.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0a0f1e]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-rose-600 border-t-transparent rounded-full animate-spin" />
                    <p className="font-bold text-slate-400 animate-pulse uppercase tracking-widest text-xs">Acessando Logs Seguros...</p>
                </div>
            </div>
        );
    }

    const activeTabInfo = TABS.find(t => t.id === activeTab)!;

    return (
        <div className="bg-slate-50 dark:bg-[#0a0f1e] min-h-screen text-slate-800 dark:text-slate-100">

            {/* ── Header ──────────────────────────────────────────────────── */}
            <header className="border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950 sticky top-0 z-30 shadow-sm">
                <div className="max-w-screen-2xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-rose-600 to-rose-700 rounded-xl flex items-center justify-center shadow-lg shadow-rose-600/20">
                            <Shield className="text-white w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-sm font-black block leading-none tracking-tight">Auditoria de Segurança</span>
                            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
                                Log de Conformidade · Tempo Real
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            <div className={`w-1.5 h-1.5 rounded-full ${refreshInterval > 0 ? 'bg-emerald-500 animate-ping' : 'bg-slate-300 dark:bg-slate-700'}`} />
                            <span className="hidden md:inline">
                                {refreshInterval > 0
                                    ? `Auto · ${AUTO_REFRESH_INTERVALS.find(i => i.value === refreshInterval)?.label}`
                                    : 'Manual'}
                            </span>
                            <span className="text-slate-500 hidden lg:inline">
                                · {lastRefresh.toLocaleTimeString('pt-BR')}
                            </span>
                        </div>
                        <button
                            onClick={() => fetchLogs(true)}
                            disabled={isRefreshing}
                            title="Atualizar agora"
                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
                <NavigationControls />

                {/* ── Error Banner ─────────────────────────────────────────── */}
                {error && (
                    <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold text-rose-900 dark:text-rose-400 mb-0.5">Falha na Sincronização</h4>
                            <p className="text-xs text-rose-700 dark:text-rose-300/70">{error}</p>
                        </div>
                    </div>
                )}

                {/* ── Stats Row ────────────────────────────────────────────── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: 'Total de Registros', value: totalCount.toLocaleString('pt-BR'), icon: Terminal, accent: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10' },
                        { label: 'Aba Ativa', value: activeTabInfo.label, icon: activeTabInfo.icon, accent: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300' },
                        { label: 'Itens / Página', value: String(pageSize), icon: Eye, accent: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10' },
                        { label: 'Página Atual', value: `${currentPage} / ${totalPages || 1}`, icon: ChevronRight, accent: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10' },
                    ].map((stat, i) => (
                        <div key={i} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${stat.accent} flex-shrink-0`}>
                                <stat.icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">{stat.label}</p>
                                <p className="text-lg font-black leading-tight mt-0.5 truncate">{stat.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Main Panel ───────────────────────────────────────────── */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">

                    {/* Tabs */}
                    <div className="flex overflow-x-auto border-b border-slate-100 dark:border-slate-800">
                        {TABS.map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            const count = tab.id === 'all' ? null : (tabCounts[tab.id] ?? null);
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-1.5 px-4 py-3.5 text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all border-b-2 flex-shrink-0 ${
                                        isActive
                                            ? 'border-rose-500 text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-500/5'
                                            : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                    }`}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    {tab.label}
                                    {count !== null && count > 0 && (
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                                            isActive
                                                ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                        }`}>
                                            {count > 9999 ? '9999+' : count.toLocaleString('pt-BR')}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Toolbar */}
                    <div className="p-4 flex flex-col xl:flex-row gap-3 border-b border-slate-100 dark:border-slate-800">
                        {/* Search */}
                        <div className="relative flex-1 min-w-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Buscar por ação, tabela ou IP..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && fetchLogs()}
                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold placeholder:text-slate-400 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 outline-none transition-all"
                            />
                        </div>

                        {/* Date range */}
                        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                            <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-rose-500/20 outline-none text-slate-600 dark:text-slate-300 w-[140px]"
                            />
                            <span className="text-slate-400 text-xs font-bold">até</span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-rose-500/20 outline-none text-slate-600 dark:text-slate-300 w-[140px]"
                            />
                            {(dateFrom || dateTo) && (
                                <button
                                    onClick={() => { setDateFrom(''); setDateTo(''); }}
                                    title="Limpar datas"
                                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-all"
                                >
                                    <XCircle className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Auto-refresh */}
                        <select
                            value={refreshInterval}
                            onChange={e => setRefreshInterval(Number(e.target.value))}
                            className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-rose-500/20 text-slate-600 dark:text-slate-300 flex-shrink-0"
                        >
                            {AUTO_REFRESH_INTERVALS.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label === 'Desativado' ? '↺ Auto-refresh' : `↺ ${opt.label}`}
                                </option>
                            ))}
                        </select>

                        {/* Items per page */}
                        <select
                            value={pageSize}
                            onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                            className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-rose-500/20 text-slate-600 dark:text-slate-300 flex-shrink-0"
                        >
                            {PAGINATION_OPTIONS.map(opt => (
                                <option key={opt} value={opt}>{opt} / pág</option>
                            ))}
                        </select>

                        {/* Export CSV */}
                        <button
                            onClick={handleExportCSV}
                            disabled={logs.length === 0}
                            title={`Exportar ${activeTabInfo.label} para CSV`}
                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm flex-shrink-0"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>CSV</span>
                        </button>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto relative">
                        {(loading || isRefreshing) && logs.length > 0 && (
                            <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 flex items-center justify-center z-10 backdrop-blur-sm">
                                <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700">
                                    <RefreshCw className="w-3.5 h-3.5 text-rose-600 animate-spin" />
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Atualizando...</span>
                                </div>
                            </div>
                        )}
                        <table className="w-full text-left border-collapse min-w-[760px]">
                            <thead>
                                <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                                    <th className="px-3 py-3.5 w-10"></th>
                                    <th className="px-5 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Evento</th>
                                    <th className="px-5 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Operador</th>
                                    <th className="px-5 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Atividade</th>
                                    <th className="px-5 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">IP / Rede</th>
                                    <th className="px-5 py-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Data / Hora</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {logs.map(log => {
                                    const isExpanded = expandedRow === log.id;
                                    const hasDetails = log.detalhes && Object.keys(log.detalhes).length > 0;
                                    return (
                                        <>
                                            <tr
                                                key={log.id}
                                                className={`transition-colors ${isExpanded ? 'bg-slate-50 dark:bg-slate-800/50' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'}`}
                                            >
                                                {/* Expand */}
                                                <td className="px-3 py-4 text-center">
                                                    {hasDetails && (
                                                        <button
                                                            onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                                                            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-all"
                                                        >
                                                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                        </button>
                                                    )}
                                                </td>
                                                {/* Event */}
                                                <td className="px-5 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-wider ${getEventStyle(log.acao || '')}`}>
                                                        {getEventIcon(log.acao || '')}
                                                        {(log.acao || 'SISTEMA').replace(/_/g, ' ')}
                                                    </span>
                                                </td>
                                                {/* Operator */}
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 flex-shrink-0">
                                                            {log.usuario?.nome?.[0] || 'S'}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-black text-slate-800 dark:text-white leading-none mb-0.5 truncate max-w-[130px]">
                                                                {log.usuario?.nome || 'Sistema'}
                                                            </p>
                                                            <p className="text-[9px] text-slate-400 font-medium leading-none truncate max-w-[130px]">
                                                                {log.usuario?.email || 'auto@sisra.local'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                {/* Activity */}
                                                <td className="px-5 py-4">
                                                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium max-w-xs leading-relaxed line-clamp-2">
                                                        {describeLog(log)}
                                                    </p>
                                                    {log.tabela_afetada && (
                                                        <span className="text-[9px] text-slate-400 font-mono mt-0.5 block">{log.tabela_afetada}</span>
                                                    )}
                                                </td>
                                                {/* IP */}
                                                <td className="px-5 py-4 font-mono text-[10px] text-slate-400 tracking-tighter whitespace-nowrap">
                                                    {log.ip_address || '—'}
                                                </td>
                                                {/* Timestamp */}
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                                                        <Clock className="w-3 h-3 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                                                        {new Date(log.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                    </div>
                                                    <p className="text-[9px] text-slate-400 font-medium mt-0.5 pl-4">
                                                        {new Date(log.criado_em).toLocaleDateString('pt-BR')}
                                                    </p>
                                                </td>
                                            </tr>

                                            {/* Expanded details */}
                                            {isExpanded && hasDetails && (
                                                <tr key={`${log.id}-expanded`} className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700">
                                                    <td colSpan={6} className="px-8 py-4">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Dados Detalhados do Evento</p>
                                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 mb-3">
                                                            {Object.entries(log.detalhes || {}).map(([key, val]) => {
                                                                let display = val === null || val === undefined ? '—' : String(val);
                                                                // Mask CPF in details view
                                                                if (key === 'cpf' && /^\d{11}$/.test(display)) {
                                                                    display = `${display.slice(0, 3)}.***.*${display.slice(-2)}`;
                                                                }
                                                                return (
                                                                    <div key={key} className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{key.replace(/_/g, ' ')}</p>
                                                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 break-words leading-tight">{display}</p>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        {log.user_agent && (
                                                            <p className="text-[9px] text-slate-400 font-mono truncate">
                                                                <span className="font-black text-slate-500 not-italic uppercase tracking-wider">Agent: </span>
                                                                {log.user_agent}
                                                            </p>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    );
                                })}
                            </tbody>
                        </table>

                        {logs.length === 0 && !loading && (
                            <div className="flex flex-col items-center justify-center py-24 gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                    <Terminal className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Nenhum Registro</p>
                                    <p className="text-xs text-slate-400 mt-1">Ajuste os filtros ou o intervalo de datas.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    <div className="px-5 py-4 bg-slate-50/80 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            <span>{totalCount.toLocaleString('pt-BR')} registros · Página {currentPage} de {totalPages || 1}</span>
                            {(dateFrom || dateTo) && (
                                <span className="px-2 py-1 bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg border border-amber-200 dark:border-amber-500/20 text-[9px]">
                                    Filtro de data ativo
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                className="px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 transition-all text-xs font-black"
                            >«</button>
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 transition-all"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>

                            <div className="flex gap-1">
                                {(() => {
                                    const pages: number[] = [];
                                    for (let p = Math.max(1, currentPage - 2); p <= Math.min(totalPages, currentPage + 2); p++) {
                                        pages.push(p);
                                    }
                                    return pages.map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setCurrentPage(p)}
                                            className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all ${
                                                currentPage === p
                                                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20'
                                                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                                            }`}
                                        >{p}</button>
                                    ));
                                })()}
                            </div>

                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage >= totalPages || totalPages === 0}
                                className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 transition-all"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage >= totalPages || totalPages === 0}
                                className="px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 transition-all text-xs font-black"
                            >»</button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
