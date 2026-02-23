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
        } catch (err) {
            console.error('Erro ao buscar logs:', err);
        } finally {
            setLoading(false);
        }
    };

    const totalPages = Math.ceil(totalCount / pageSize);

    const getEventStyle = (tipo: string) => {
        switch (tipo) {
            case 'LOGIN_SUCESSO': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            case 'LOGIN_FALHA': return 'bg-rose-50 text-rose-700 border-rose-100';
            case 'LIMPEZA_REGISTROS': return 'bg-rose-50 text-rose-700 border-rose-100';
            case 'ANALISE': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
            case 'ACESSO_NEGADO': return 'bg-amber-50 text-amber-700 border-amber-100';
            default: return 'bg-indigo-50 text-indigo-700 border-indigo-100';
        }
    };

    const getEventIcon = (tipo: string) => {
        switch (tipo) {
            case 'LOGIN_SUCESSO': return <CheckCircle className="w-3 h-3" />;
            case 'LOGIN_FALHA': return <Lock className="w-3 h-3" />;
            case 'LIMPEZA_REGISTROS': return <Trash2 className="w-3 h-3" />;
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
                        <div className="flex gap-2 items-center bg-slate-50 dark:bg-slate-800 p-1 rounded-xl">
                            {['all', 'LOGIN_SUCESSO', 'LOGIN_FALHA', 'LIMPEZA_REGISTROS', 'EXCLUSAO_ESTUDANTE', 'ANALISE'].map(s => (
                                <button
                                    key={s}
                                    onClick={() => { setFilterType(s); setCurrentPage(1); }}
                                    className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${filterType === s ? 'bg-white dark:bg-slate-700 shadow-sm text-rose-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {s === 'all' ? 'Tudo' : s.replace('_', ' ')}
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
                                                {(log.acao || 'SISTEMA').replace('_', ' ')}
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
                                            <p className="text-sm text-slate-600 dark:text-slate-300 font-medium max-w-xs">{log.descricao || (log.detalhes as any)?.message || 'Ação registrada via sistema.'}</p>
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
