import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Shield, Search, Filter, AlertTriangle, CheckCircle,
    Activity, Clock,
    Lock, Terminal, ChevronLeft, ChevronRight, Trash2
} from 'lucide-react';
import NavigationControls from '../../components/NavigationControls';

type AuditLog = {
    id: string;
    usuario_id: string;
    acao: string;
    detalhes: any;
    descricao?: string;
    tabela_afetada?: string;
    registro_id?: string;
    ip_address: string;
    user_agent: string;
    criado_em: string;
    usuario?: { nome_completo: string; email: string };
};

export default function SecurityAuditLog() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [error, setError] = useState<string | null>(null);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [totalCount, setTotalCount] = useState(0);

    const PAGINATION_OPTIONS = [20, 40, 60, 80, 100];

    useEffect(() => {
        fetchLogs();
    }, [currentPage, pageSize, filterType]);

    const fetchLogs = async () => {
        setLoading(true);
        setError(null);
        try {
            let query = supabase
                .from('logs_auditoria')
                .select(`
                    *,
                    usuario:usuarios(nome_completo, email)
                `, { count: 'exact' });

            if (filterType !== 'all') {
                query = query.eq('acao', filterType);
            }

            if (searchTerm) {
                query = query.or(`acao.ilike.%${searchTerm}%,tabela_afetada.ilike.%${searchTerm}%`);
            }

            const from = (currentPage - 1) * pageSize;
            const to = from + pageSize - 1;

            const { data, error, count } = await query
                .order('criado_em', { ascending: false })
                .range(from, to);

            if (error) throw error;
            setLogs(data || []);
            setTotalCount(count || 0);
        } catch (err: any) {
            console.error('Erro ao buscar logs:', err);
            if (err.code === '42501') {
                setError('Permissão negada (RLS). As políticas de segurança do banco de dados precisam ser ajustadas.');
            } else {
                setError('Ocorreu um erro ao carregar os registros de auditoria.');
            }
        } finally {
            setLoading(false);
        }
    };

    const totalPages = Math.ceil(totalCount / pageSize);

    const getEventStyle = (tipo: string) => {
        switch (tipo) {
            case 'LOGIN_SUCESSO': case 'SISTEMA_LOGIN': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            case 'LOGIN_FALHA': return 'bg-rose-50 text-rose-700 border-rose-100';
            case 'LIMPEZA_REGISTROS': case 'EXCLUSAO_ESTUDANTE': case 'EXCLUSAO_ESTUDANTE_MASSA': return 'bg-rose-50 text-rose-700 border-rose-100';
            case 'CADASTRO_ESTUDANTE': case 'CADASTRO_RESPONSAVEL': return 'bg-blue-50 text-blue-700 border-blue-100';
            case 'EDICAO_ESTUDANTE': case 'REMANEJAMENTO_TURMA': return 'bg-amber-50 text-amber-700 border-amber-100';
            case 'SOLICITACAO_RETIRADA': case 'CONFIRMACAO_ENTREGA': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
            case 'SISTEMA_LOGOUT': return 'bg-slate-50 text-slate-700 border-slate-100';
            case 'ANALISE': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
            case 'ACESSO_NEGADO': return 'bg-amber-50 text-amber-700 border-amber-100';
            default: return 'bg-indigo-50 text-indigo-700 border-indigo-100';
        }
    };

    const getEventIcon = (tipo: string) => {
        switch (tipo) {
            case 'LOGIN_SUCESSO': case 'SISTEMA_LOGIN': return <CheckCircle className="w-3 h-3" />;
            case 'LOGIN_FALHA': return <Lock className="w-3 h-3" />;
            case 'LIMPEZA_REGISTROS': case 'EXCLUSAO_ESTUDANTE': case 'EXCLUSAO_ESTUDANTE_MASSA': return <Trash2 className="w-3 h-3" />;
            case 'CADASTRO_ESTUDANTE': case 'CADASTRO_RESPONSAVEL': return <Activity className="w-3 h-3" />;
            case 'EDICAO_ESTUDANTE': case 'REMANEJAMENTO_TURMA': return <Filter className="w-3 h-3" />;
            case 'SOLICITACAO_RETIRADA': case 'CONFIRMACAO_ENTREGA': return <Activity className="w-3 h-3" />;
            case 'SISTEMA_LOGOUT': return <Clock className="w-3 h-3" />;
            case 'ANALISE': return <Search className="w-3 h-3" />;
            case 'ACESSO_NEGADO': return <AlertTriangle className="w-3 h-3" />;
            default: return <Activity className="w-3 h-3" />;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0f172a]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-rose-600 border-t-transparent rounded-full animate-spin" />
                    <p className="font-bold text-slate-400 animate-pulse uppercase tracking-widest text-xs">Acessando Logs Seguros...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-50 dark:bg-[#0f172a] min-h-screen text-slate-800 dark:text-slate-100 font-display">
            {/* Header */}
            <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-30 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-rose-600 rounded-xl flex items-center justify-center shadow-lg shadow-rose-600/20">
                            <Shield className="text-white w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-sm font-bold block leading-none">Auditoria de Segurança</span>
                            <span className="text-[10px] text-slate-400 font-medium">Log de Conformidade</span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                <NavigationControls />

                {error && (
                    <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-4 animate-in slide-in-from-top-2">
                        <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold text-rose-900 mb-1 uppercase tracking-tight">Falha na Sincronização de Auditoria</h4>
                            <p className="text-xs text-rose-700 font-medium leading-relaxed">{error}</p>
                        </div>
                    </div>
                )}

                {/* Stats Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 mt-6">
                    {[
                        { label: 'Total de Registros', value: totalCount, icon: Terminal, color: 'indigo' },
                        { label: 'Filtro Ativo', value: filterType === 'all' ? 'Tudo' : filterType.replace('_', ' '), icon: Filter, color: 'emerald' },
                        { label: 'Itens por Página', value: pageSize, icon: Activity, color: 'amber' },
                        { label: 'Página Atual', value: `${currentPage}/${totalPages || 1}`, icon: Shield, color: 'rose' },
                    ].map((stat, i) => (
                        <div key={i} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                                    <h4 className="text-xl font-black">{stat.value}</h4>
                                </div>
                                <div className={`p-2 rounded-lg bg-${stat.color}-50 dark:bg-${stat.color}-500/10 text-${stat.color}-600`}>
                                    <stat.icon className="w-5 h-5" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-80">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Buscar por ação ou tabela..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-semibold placeholder:text-slate-400 focus:ring-2 focus:ring-rose-600/10 dark:focus:ring-rose-600/20 transition-all outline-none"
                            />
                        </div>
                        <button
                            onClick={() => { setCurrentPage(1); fetchLogs(); }}
                            className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-slate-100"
                        >
                            <Search className="w-4 h-4 text-slate-500" />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex gap-2 items-center bg-slate-50 dark:bg-slate-800 p-1 rounded-xl overflow-x-auto no-scrollbar">
                            {['all', 'LOGIN_SUCESSO', 'LOGIN_FALHA', 'CADASTRO_ESTUDANTE', 'EXCLUSAO_ESTUDANTE', 'SOLICITACAO_RETIRADA', 'CONFIRMACAO_ENTREGA'].map(s => (
                                <button
                                    key={s}
                                    onClick={() => { setFilterType(s); setCurrentPage(1); }}
                                    className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${filterType === s ? 'bg-white dark:bg-slate-700 shadow-sm text-rose-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {s === 'all' ? 'Tudo' : s.replace(/_/g, ' ')}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Logs Table */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo de Evento</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Operador</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Detalhe da Atividade</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Infra de Rede</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data/Hora</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                        <td className="px-6 py-5">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${getEventStyle(log.acao || 'default')}`}>
                                                {getEventIcon(log.acao || 'default')}
                                                {(log.acao || 'SISTEMA').replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black uppercase">
                                                    {log.usuario?.nome_completo?.[0] || 'S'}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white leading-none mb-1">{log.usuario?.nome_completo || 'Motor do Sistema'}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium leading-none">{log.usuario?.email || 'automated@lasallecheguei.local'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <p className="text-sm text-slate-600 dark:text-slate-300 font-medium max-w-sm">
                                                {log.descricao || (() => {
                                                    const d = log.detalhes;
                                                    if (!d) return 'Ação registrada via sistema.';

                                                    switch (log.acao) {
                                                        case 'CADASTRO_ESTUDANTE': return `Cadastrou aluno: ${d.nome} (${d.turma})`;
                                                        case 'EDICAO_ESTUDANTE': return `Editou aluno: ${d.nome} (${d.turma})`;
                                                        case 'EXCLUSAO_ESTUDANTE': return `Removeu aluno: ${d.nome} (${d.matricula})`;
                                                        case 'EXCLUSAO_ESTUDANTE_MASSA': return `Removeu ${d.quantidade} alunos em massa.`;
                                                        case 'LIMPEZA_REGISTROS': return `Limpou banco de dados: ${d.alunos_removidos} alunos removidos.`;
                                                        case 'REMANEJAMENTO_TURMA': return `Moveu ${d.nome} de ${d.turma_anterior} para ${d.turma_nova}.`;
                                                        case 'GERACAO_LINK_ACESSO': return `Gerou Link Mágico para ${d.aluno_nome}.`;
                                                        case 'SOLICITACAO_RETIRADA': return `Solicitação de retirada para ${d.aluno_nome} por ${d.responsavel_nome} via ${d.tipo}.`;
                                                        case 'CONFIRMACAO_ENTREGA': return `Entrega confirmada: ${d.aluno_nome} retirado por ${d.responsavel_nome}.`;
                                                        case 'LOGIN_SUCESSO': return `Login administrativo realizado (${d.email})`;
                                                        case 'LOGIN_FALHA': return `Falha de login: ${d.motivo} (${d.email})`;
                                                        case 'SISTEMA_LOGOUT': return `Logout do sistema (${d.email})`;
                                                        default: return d.message || d.motivo || 'Ação registrada.';
                                                    }
                                                })()}
                                            </p>
                                        </td>
                                        <td className="px-6 py-5 font-mono text-[10px] text-slate-400 tracking-tighter">
                                            {log.ip_address}
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2 text-xs font-bold">
                                                <Clock className="w-3 h-3 text-slate-300" />
                                                {new Date(log.criado_em).toLocaleTimeString('pt-BR')}
                                                <span className="text-[10px] text-slate-400 font-normal ml-1">
                                                    {new Date(log.criado_em).toLocaleDateString('pt-BR')}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {logs.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 bg-slate-50/20">
                                <Terminal className="w-12 h-12 text-slate-200 mb-4" />
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Nenhum Log de Auditoria Encontrado</p>
                            </div>
                        )}
                    </div>

                    {/* Pagination Footer */}
                    <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-slate-500">
                            <span>{totalCount} Registros • Página {currentPage} de {totalPages || 1}</span>
                            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700"></div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px]">Exibir</span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => {
                                        setPageSize(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 outline-none text-[10px] focus:ring-2 focus:ring-rose-500/20"
                                >
                                    {PAGINATION_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 disabled:opacity-30 transition-all shadow-sm"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>

                            <div className="flex gap-1">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    const pageNum = i + 1;
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setCurrentPage(pageNum)}
                                            className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all ${currentPage === pageNum ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 disabled:opacity-30 transition-all shadow-sm"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
