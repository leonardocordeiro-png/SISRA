import { useState } from 'react';
import { Download, FileText, Users, Shield, Calendar, Filter, Clock, ChevronDown, Trash2, AlertTriangle, X, MessageSquare } from 'lucide-react';
import NavigationControls from '../../components/NavigationControls';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/audit';
import { useToast } from '../../components/ui/Toast';

export default function DataExportCenter() {
    const { role, user, escolaId } = useAuth();
    const toast = useToast();
    const [recentExports] = useState([
        { id: 1, name: 'Relatorio_Presenca_Q1.csv', type: 'Presença', date: '12 Out, 2023', size: '1.2 MB', status: 'Concluído' },
        { id: 2, name: 'Lista_Alunos_Final_2023.pdf', type: 'Alunos', date: '28 Set, 2023', size: '4.5 MB', status: 'Concluído' },
        { id: 3, name: 'Log_Seguranca_Semana42.json', type: 'Sistema', date: '05 Out, 2023', size: '850 KB', status: 'Expirado' },
    ]);

    const [cleanupDate, setCleanupDate] = useState(
        new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().split('T')[0]
    );
    const [cleaning, setCleaning] = useState(false);
    const [showCleanupModal, setShowCleanupModal] = useState(false);
    const [justification, setJustification] = useState('');

    const handleCleanup = async () => {
        if (!justification.trim()) {
            toast.error('Justificativa Obrigatória', 'Por favor, informe o motivo da exclusão.');
            return;
        }

        setCleaning(true);
        try {
            // 1. Clean Withdrawal Requests
            const { count: reqCount, error: reqError } = await supabase
                .from('solicitacoes_retirada')
                .delete({ count: 'exact' })
                .lt('horario_solicitacao', cleanupDate)
                .eq('escola_id', escolaId);

            if (reqError) throw reqError;

            // 2. Clean Audit Logs
            const { count: logCount, error: logError } = await supabase
                .from('logs_auditoria')
                .delete({ count: 'exact' })
                .lt('criado_em', cleanupDate)
                .eq('escola_id', escolaId);

            if (logError) throw logError;

            // 3. Log the cleanup action itself with "ANALISE" action type as per user request
            await logAudit(
                'ANALISE',
                'solicitacoes_retirada, logs_auditoria',
                undefined,
                {
                    tipo_operacao: 'LIMPEZA_REGISTROS',
                    justificativa: justification,
                    data_limite: cleanupDate,
                    registros_excluidos: reqCount,
                    logs_excluidos: logCount
                },
                user?.id,
                escolaId || undefined
            );

            toast.success('Limpeza Concluída', `${reqCount} solicitações e ${logCount} logs foram removidos.`);
            setShowCleanupModal(false);
            setJustification('');
        } catch (err: any) {
            console.error('Cleanup Error:', err);
            toast.error('Erro na Limpeza', err.message);
        } finally {
            setCleaning(false);
        }
    };

    return (
        <div className="bg-slate-50 dark:bg-[#0f172a] min-h-screen text-slate-800 dark:text-slate-100 font-display">
            {/* Top Header */}
            <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-30 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                            <Download className="text-white w-5 h-5" />
                        </div>
                        <span className="text-xl font-bold tracking-tight">La Salle, Cheguei!</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm font-medium">
                        <span className="text-slate-400">Gestão de Dados</span>
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                            <Users className="text-slate-500 w-4 h-4" />
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-10">
                <NavigationControls />
                <div className="mb-10">
                    <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">Centro de Exportação</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">Configure e baixe relatórios seguros do sistema.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Config Area */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Student & Guardian Records */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg">
                                        <Users className="text-indigo-600 w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="font-bold text-slate-900 dark:text-white">Registros de Alunos e Responsáveis</h2>
                                        <p className="text-xs text-slate-500">Dados Demográficos e Vínculos</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                        <Filter className="w-4 h-4 text-slate-400" />
                                    </button>
                                </div>
                            </div>
                            <div className="p-8 space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Seleção de Campos</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {['Matricula', 'Nome Completo', 'Turma', 'Nome Responsável', 'CPF', 'Telefone'].map(field => (
                                            <label key={field} className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-500/5 transition-colors group">
                                                <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 group-hover:text-indigo-600 transition-colors">{field}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Filtrar por Série</label>
                                        <div className="relative">
                                            <select className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all">
                                                <option>Todas as Séries</option>
                                                <option>Ensino Fundamental</option>
                                                <option>Ensino Médio</option>
                                            </select>
                                            <ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Intervalo de Datas</label>
                                        <div className="flex items-center p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                                            <Calendar className="w-4 h-4 text-slate-400 mr-2" />
                                            <span className="text-xs font-medium">01 Jan, 2023 - 31 Dez, 2023</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 bg-slate-50/50 dark:bg-slate-800/10 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <div className="flex gap-2">
                                    <button className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">PDF</button>
                                    <button className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold ring-2 ring-indigo-500 text-indigo-600">CSV</button>
                                    <button className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">JSON</button>
                                </div>
                                <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95">
                                    <Download className="w-5 h-5" />
                                    Gerar Exportação
                                </button>
                            </div>
                        </div>

                        {/* Attendance & Pickup History */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden opacity-90 transition-opacity hover:opacity-100">
                            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg">
                                        <Clock className="text-emerald-600 w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="font-bold text-slate-900 dark:text-white">Histórico de Chamada e Retirada</h2>
                                        <p className="text-xs text-slate-500">Registros de segurança e assinaturas da equipe</p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-8 flex items-center justify-center border-dashed border-2 border-slate-100 dark:border-slate-800 m-6 rounded-2xl h-32">
                                <div className="text-center">
                                    <p className="text-sm font-medium text-slate-400">Detalhes da seção minimizados</p>
                                    <button className="text-xs font-bold text-indigo-500 uppercase tracking-widest mt-2">Expandir Configuração</button>
                                </div>
                            </div>
                        </div>

                        {/* SYSTEM MAINTENANCE - ADMIN ONLY */}
                        {role === 'ADMIN' && (
                            <div className="bg-rose-50/50 dark:bg-rose-500/5 rounded-3xl border border-rose-100 dark:border-rose-900/50 overflow-hidden">
                                <div className="p-6 border-b border-rose-100 dark:border-rose-900/30 bg-white dark:bg-slate-900 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-rose-500 rounded-xl shadow-lg shadow-rose-500/20">
                                            <Trash2 className="text-white w-5 h-5" />
                                        </div>
                                        <div>
                                            <h2 className="font-bold text-slate-900 dark:text-white">Manutenção do Banco de Dados</h2>
                                            <p className="text-[10px] text-rose-600 font-bold uppercase tracking-widest">Apenas Administradores</p>
                                        </div>
                                    </div>
                                    <AlertTriangle className="text-rose-500 animate-pulse w-5 h-5" />
                                </div>
                                <div className="p-8 space-y-6">
                                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-rose-200/50 dark:border-rose-900/30 flex flex-col md:flex-row items-center gap-6">
                                        <div className="flex-1 space-y-1">
                                            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                Expurgar Dados Antigos
                                            </h4>
                                            <p className="text-xs text-slate-500 leading-relaxed">
                                                Remova permanentemente registros de solicitações e logs para otimizar o sistema.
                                                <span className="font-bold text-rose-500"> Esta ação não pode ser desfeita.</span>
                                            </p>
                                        </div>
                                        <div className="flex flex-col sm:flex-row items-center gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data de Corte</label>
                                                <input
                                                    type="date"
                                                    value={cleanupDate}
                                                    onChange={e => setCleanupDate(e.target.value)}
                                                    className="bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-rose-500/50 transition-all"
                                                />
                                            </div>
                                            <button
                                                onClick={() => setShowCleanupModal(true)}
                                                disabled={cleaning}
                                                className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-rose-600/20 transition-all active:scale-95 mt-4 sm:mt-0"
                                            >
                                                {cleaning ? (
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-4 h-4" />
                                                )}
                                                Limpar Agora
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30">
                                        <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                        <p className="text-[10px] text-amber-700 dark:text-amber-500 font-medium leading-relaxed">
                                            <strong>Auditoria Obrigatória:</strong> Todas as ações de limpeza são registradas permanentemente no log de conformidade, incluindo o ID do operador e a contagem de registros afetados.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Recent Exports & Logs */}
                    <div className="space-y-8">
                        {/* Recent Exports Card */}
                        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-lg">Exportações Recentes</h3>
                                <button className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest hover:underline">Limpar Lista</button>
                            </div>
                            <div className="space-y-4">
                                {recentExports.map(item => (
                                    <div key={item.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex flex-col gap-3 group">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${item.status === 'Expirado' ? 'bg-slate-200 text-slate-400' : 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600'}`}>
                                                    <FileText className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold truncate max-w-[120px]">{item.name}</p>
                                                    <p className="text-[10px] text-slate-500">{item.date}</p>
                                                </div>
                                            </div>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.status === 'Expirado' ? 'bg-slate-100 dark:bg-slate-800 text-slate-400' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                                {item.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/50">
                                            <span className="text-[10px] font-medium text-slate-400">{item.size}</span>
                                            {item.status !== 'Expirado' && (
                                                <button className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                    <Download className="w-3 h-3" />
                                                    Baixar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* System Audit Logs Overlay */}
                        <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-600/20 relative overflow-hidden group">
                            <Shield className="absolute -bottom-4 -right-4 w-32 h-32 opacity-10 group-hover:scale-110 transition-transform duration-700" />
                            <h3 className="text-lg font-bold mb-2">Logs de Auditoria</h3>
                            <p className="text-xs text-indigo-100 mb-6 leading-relaxed">Baixe uma trilha completa de todos os acessos e eventos de segurança para conformidade legal.</p>
                            <button className="w-full bg-white text-indigo-600 font-bold py-3 rounded-xl shadow-lg transition-transform active:scale-95">
                                Gerar Pacote de Auditoria
                            </button>
                        </div>
                    </div>
                </div>
            </main>

            {/* Cleanup Confirmation Modal */}
            {showCleanupModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-rose-500/10 rounded-xl">
                                    <AlertTriangle className="text-rose-500 w-5 h-5" />
                                </div>
                                <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Confirmar Limpeza</h3>
                            </div>
                            <button
                                onClick={() => setShowCleanupModal(false)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="bg-rose-50 dark:bg-rose-900/10 p-4 rounded-2xl border border-rose-100 dark:border-rose-900/30">
                                <p className="text-xs text-rose-700 dark:text-rose-400 leading-relaxed font-medium">
                                    Esta ação removerá todos os registros anteriores a <strong>{new Date(cleanupDate).toLocaleDateString()}</strong>.
                                    A exclusão é <strong>permanente</strong> e será registrada na auditoria como uma <strong>Análise de Manutenção</strong>.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    <MessageSquare className="w-3 h-3 text-indigo-500" />
                                    Justificativa da Exclusão
                                </label>
                                <textarea
                                    value={justification}
                                    onChange={(e) => setJustification(e.target.value)}
                                    placeholder="Ex: Limpeza periódica para otimização do banco de dados..."
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-xs font-medium outline-none focus:border-indigo-500/30 transition-all min-h-[100px] resize-none"
                                />
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                            <button
                                onClick={() => setShowCleanupModal(false)}
                                className="flex-1 px-6 py-3 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCleanup}
                                disabled={cleaning || !justification.trim()}
                                className="flex-[2] bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 transition-all active:scale-95"
                            >
                                {cleaning ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                                Confirmar e Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
