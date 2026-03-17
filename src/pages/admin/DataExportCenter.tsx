import { useState, useCallback } from 'react';
import {
    Download, FileText, Users, Shield, Calendar, Clock,
    Trash2, AlertTriangle, X, MessageSquare, CheckCircle2,
    Loader2, History, RefreshCw,
} from 'lucide-react';
import NavigationControls from '../../components/NavigationControls';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/audit';
import { useToast } from '../../components/ui/Toast';

// ── CSV helpers ────────────────────────────────────────────────────────────────
function buildCSV(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
    const escape = (v: string | number | boolean | null | undefined) => {
        const s = v == null ? '' : String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"`
            : s;
    };
    return [headers, ...rows].map(row => row.map(escape).join(',')).join('\n');
}

function downloadCSV(csv: string, filename: string) {
    const bom = '\uFEFF'; // UTF-8 BOM for Excel compatibility
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ── Types ─────────────────────────────────────────────────────────────────────
type ExportRecord = {
    id: number;
    name: string;
    type: string;
    date: string;
    rows: number;
    format: 'CSV';
};

type CleanupPreview = { requests: number } | null;

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({ title, subtitle, icon: Icon, iconColor, iconBg, children, footer }: {
    title: string; subtitle: string;
    icon: React.ElementType; iconColor: string; iconBg: string;
    children: React.ReactNode; footer?: React.ReactNode;
}) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex items-center gap-3">
                <div className={`p-2 ${iconBg} rounded-lg`}>
                    <Icon className={`${iconColor} w-5 h-5`} />
                </div>
                <div>
                    <h2 className="font-bold text-slate-900 dark:text-white">{title}</h2>
                    <p className="text-xs text-slate-500">{subtitle}</p>
                </div>
            </div>
            <div className="p-8">{children}</div>
            {footer && (
                <div className="p-6 bg-slate-50/50 dark:bg-slate-800/10 border-t border-slate-100 dark:border-slate-800">
                    {footer}
                </div>
            )}
        </div>
    );
}

// ── Export button ──────────────────────────────────────────────────────────────
function ExportBtn({ loading, onClick }: { loading: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            disabled={loading}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
        >
            {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Download className="w-5 h-5" />}
            {loading ? 'Gerando...' : 'Exportar CSV'}
        </button>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function DataExportCenter() {
    const { role, user, escolaId } = useAuth();
    const toast = useToast();

    // ── Export history (session only) ──────────────────────────────────────────
    const [exports, setExports] = useState<ExportRecord[]>([]);
    const addExport = (name: string, type: string, rows: number) => {
        setExports(prev => [{
            id: Date.now(),
            name,
            type,
            rows,
            format: 'CSV',
            date: new Date().toLocaleString('pt-BR'),
        }, ...prev].slice(0, 10));
    };

    // ── Loading states ─────────────────────────────────────────────────────────
    const [loadingStudents,  setLoadingStudents]  = useState(false);
    const [loadingPickups,   setLoadingPickups]   = useState(false);
    const [loadingAudit,     setLoadingAudit]     = useState(false);

    // ── Date filters ───────────────────────────────────────────────────────────
    const [pickupDateFrom, setPickupDateFrom] = useState(
        new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]
    );
    const [pickupDateTo, setPickupDateTo] = useState(new Date().toISOString().split('T')[0]);

    // ── Cleanup state ──────────────────────────────────────────────────────────
    const [cleanupDate, setCleanupDate] = useState(
        new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().split('T')[0]
    );
    const [cleaning,          setCleaning]          = useState(false);
    const [previewing,        setPreviewing]        = useState(false);
    const [showCleanupModal,  setShowCleanupModal]  = useState(false);
    const [cleanupPreview,    setCleanupPreview]    = useState<CleanupPreview>(null);
    const [justification,     setJustification]     = useState('');

    // ── Export: Alunos ────────────────────────────────────────────────────────
    const exportStudents = useCallback(async () => {
        setLoadingStudents(true);
        try {
            const { data, error } = await supabase
                .from('alunos')
                .select('matricula, nome_completo, turma, sala, ativo')
                .order('nome_completo');
            if (error) throw error;

            const rows = (data ?? []).map(a => [
                a.matricula, a.nome_completo, a.turma, a.sala,
                a.ativo ? 'Sim' : 'Não',
            ]);
            const csv = buildCSV(['Matrícula', 'Nome Completo', 'Turma', 'Sala', 'Ativo'], rows);
            const filename = 'alunos_export';
            downloadCSV(csv, filename);
            addExport(`${filename}_${new Date().toISOString().split('T')[0]}.csv`, 'Alunos', rows.length);
            await logAudit('EXPORTACAO_DADOS', 'alunos', undefined, { registros: rows.length }, user?.id, escolaId || undefined);
            toast.success('Exportação concluída', `${rows.length} alunos exportados.`);
        } catch (err: any) {
            toast.error('Erro na exportação', err.message);
        } finally {
            setLoadingStudents(false);
        }
    }, [user, escolaId]);

    // ── Export: Histórico de Retiradas ────────────────────────────────────────
    const exportPickups = useCallback(async () => {
        setLoadingPickups(true);
        try {
            const { data, error } = await supabase
                .from('solicitacoes_retirada')
                .select(`
                    horario_solicitacao, horario_liberacao, horario_confirmacao,
                    status, tipo_solicitacao, mensagem_sala, mensagem_recepcao,
                    aluno:alunos(nome_completo, turma, sala),
                    responsavel:responsaveis(nome_completo)
                `)
                .gte('horario_solicitacao', `${pickupDateFrom}T00:00:00`)
                .lte('horario_solicitacao', `${pickupDateTo}T23:59:59`)
                .order('horario_solicitacao', { ascending: false })
                .limit(50000);
            if (error) throw error;

            const rows = (data ?? []).map((r: any) => [
                new Date(r.horario_solicitacao).toLocaleString('pt-BR'),
                r.horario_liberacao ? new Date(r.horario_liberacao).toLocaleString('pt-BR') : '',
                r.horario_confirmacao ? new Date(r.horario_confirmacao).toLocaleString('pt-BR') : '',
                r.status,
                r.tipo_solicitacao,
                r.aluno?.nome_completo ?? '',
                r.aluno?.turma ?? '',
                r.aluno?.sala ?? '',
                r.responsavel?.nome_completo ?? '',
                r.mensagem_sala ?? '',
                r.mensagem_recepcao ?? '',
            ]);

            const csv = buildCSV([
                'Horário Solicitação', 'Horário Liberação', 'Horário Confirmação',
                'Status', 'Tipo', 'Aluno', 'Turma', 'Sala',
                'Responsável', 'Mensagem Sala', 'Mensagem Recepção',
            ], rows);

            const filename = `retiradas_${pickupDateFrom}_${pickupDateTo}`;
            downloadCSV(csv, filename);
            addExport(`${filename}.csv`, 'Retiradas', rows.length);
            await logAudit('EXPORTACAO_DADOS', 'solicitacoes_retirada', undefined, { registros: rows.length, de: pickupDateFrom, ate: pickupDateTo }, user?.id, escolaId || undefined);
            toast.success('Exportação concluída', `${rows.length} registros exportados.`);
        } catch (err: any) {
            toast.error('Erro na exportação', err.message);
        } finally {
            setLoadingPickups(false);
        }
    }, [pickupDateFrom, pickupDateTo, user, escolaId]);

    // ── Export: Logs de Auditoria ─────────────────────────────────────────────
    const exportAuditLogs = useCallback(async () => {
        setLoadingAudit(true);
        try {
            const { data, error } = await supabase
                .from('logs_auditoria')
                .select('criado_em, acao, tabela_afetada, registro_id, ip_address, user_agent, detalhes, usuario_id')
                .order('criado_em', { ascending: false })
                .limit(100000);
            if (error) throw error;

            const rows = (data ?? []).map((l: any) => [
                new Date(l.criado_em).toLocaleString('pt-BR'),
                l.acao,
                l.tabela_afetada ?? '',
                l.registro_id ?? '',
                l.usuario_id ?? '',
                l.ip_address ?? '',
                l.user_agent ?? '',
                l.detalhes ? JSON.stringify(l.detalhes) : '',
            ]);

            const csv = buildCSV([
                'Data/Hora', 'Ação', 'Tabela', 'Registro ID',
                'Usuário ID', 'IP', 'User Agent', 'Detalhes',
            ], rows);

            const filename = 'logs_auditoria_export';
            downloadCSV(csv, filename);
            addExport(`${filename}_${new Date().toISOString().split('T')[0]}.csv`, 'Auditoria', rows.length);
            await logAudit('EXPORTACAO_DADOS', 'logs_auditoria', undefined, { registros: rows.length }, user?.id, escolaId || undefined);
            toast.success('Exportação concluída', `${rows.length} logs exportados.`);
        } catch (err: any) {
            toast.error('Erro na exportação', err.message);
        } finally {
            setLoadingAudit(false);
        }
    }, [user, escolaId]);

    // ── Cleanup: preview count ────────────────────────────────────────────────
    const previewCleanup = useCallback(async () => {
        setPreviewing(true);
        try {
            const { count } = await supabase
                .from('solicitacoes_retirada')
                .select('*', { count: 'exact', head: true })
                .lt('horario_solicitacao', cleanupDate)
                .eq('escola_id', escolaId);
            setCleanupPreview({ requests: count ?? 0 });
            setShowCleanupModal(true);
        } catch (err: any) {
            toast.error('Erro ao verificar registros', err.message);
        } finally {
            setPreviewing(false);
        }
    }, [cleanupDate, escolaId]);

    // ── Cleanup: execute ───────────────────────────────────────────────────────
    const handleCleanup = async () => {
        if (!justification.trim()) {
            toast.error('Justificativa Obrigatória', 'Por favor, informe o motivo da exclusão.');
            return;
        }
        setCleaning(true);
        try {
            const { count: reqCount, error: reqError } = await supabase
                .from('solicitacoes_retirada')
                .delete({ count: 'exact' })
                .lt('horario_solicitacao', cleanupDate)
                .eq('escola_id', escolaId);
            if (reqError) throw reqError;

            await logAudit(
                'LIMPEZA_REGISTROS',
                'solicitacoes_retirada',
                undefined,
                {
                    justificativa: justification,
                    data_limite: cleanupDate,
                    registros_excluidos: reqCount,
                },
                user?.id,
                escolaId || undefined
            );

            toast.success('Limpeza Concluída', `${reqCount} solicitações removidas.`);
            setShowCleanupModal(false);
            setJustification('');
            setCleanupPreview(null);
        } catch (err: any) {
            toast.error('Erro na Limpeza', err.message);
        } finally {
            setCleaning(false);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="bg-slate-50 dark:bg-[#0f172a] min-h-screen text-slate-800 dark:text-slate-100 font-display">
            {/* Header */}
            <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-30 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                            <Download className="text-white w-5 h-5" />
                        </div>
                        <span className="text-xl font-bold tracking-tight">La Salle, Cheguei!</span>
                    </div>
                    <span className="text-sm font-medium text-slate-400">Centro de Exportação</span>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-10">
                <NavigationControls />
                <div className="mb-10">
                    <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">Centro de Exportação</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">Exporte dados do sistema em CSV e gerencie a manutenção do banco.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* ── Left: exports ── */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* 1. Alunos */}
                        <Section
                            title="Alunos Cadastrados"
                            subtitle="Lista completa de alunos — matrícula, turma e sala"
                            icon={Users} iconColor="text-indigo-600" iconBg="bg-indigo-50 dark:bg-indigo-500/10"
                            footer={
                                <div className="flex justify-end">
                                    <ExportBtn loading={loadingStudents} onClick={exportStudents} />
                                </div>
                            }
                        >
                            <div className="flex items-center gap-3 p-4 bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-900/30 rounded-xl text-xs text-indigo-700 dark:text-indigo-300">
                                <FileText className="w-4 h-4 shrink-0" />
                                <span>Campos exportados: <strong>Matrícula, Nome Completo, Turma, Sala, Ativo</strong></span>
                            </div>
                        </Section>

                        {/* 2. Histórico de Retiradas */}
                        <Section
                            title="Histórico de Retiradas"
                            subtitle="Todas as solicitações concluídas no período selecionado"
                            icon={History} iconColor="text-emerald-600" iconBg="bg-emerald-50 dark:bg-emerald-500/10"
                            footer={
                                <div className="flex justify-between items-center flex-wrap gap-4">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">De</label>
                                            <input
                                                type="date"
                                                value={pickupDateFrom}
                                                onChange={e => setPickupDateFrom(e.target.value)}
                                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Até</label>
                                            <input
                                                type="date"
                                                value={pickupDateTo}
                                                onChange={e => setPickupDateTo(e.target.value)}
                                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20"
                                            />
                                        </div>
                                    </div>
                                    <ExportBtn loading={loadingPickups} onClick={exportPickups} />
                                </div>
                            }
                        >
                            <div className="flex items-center gap-3 p-4 bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-900/30 rounded-xl text-xs text-emerald-700 dark:text-emerald-300">
                                <Calendar className="w-4 h-4 shrink-0" />
                                <span>Campos exportados: <strong>Horários (solicitação / liberação / confirmação), Status, Tipo, Aluno, Turma, Sala, Responsável, Mensagens</strong></span>
                            </div>
                        </Section>

                        {/* 3. Logs de Auditoria */}
                        <Section
                            title="Logs de Auditoria"
                            subtitle="Trilha completa de ações e eventos de segurança"
                            icon={Shield} iconColor="text-violet-600" iconBg="bg-violet-50 dark:bg-violet-500/10"
                            footer={
                                <div className="flex justify-end">
                                    <ExportBtn loading={loadingAudit} onClick={exportAuditLogs} />
                                </div>
                            }
                        >
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 p-4 bg-violet-50/50 dark:bg-violet-500/5 border border-violet-100 dark:border-violet-900/30 rounded-xl text-xs text-violet-700 dark:text-violet-300">
                                    <Shield className="w-4 h-4 shrink-0" />
                                    <span>Campos exportados: <strong>Data/Hora, Ação, Tabela, Registro ID, Usuário ID, IP, User Agent, Detalhes</strong></span>
                                </div>
                                <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl text-xs text-amber-700 dark:text-amber-400">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    <span>Arquivo pode ser grande. Exporta os últimos <strong>100.000 eventos</strong> em ordem decrescente.</span>
                                </div>
                            </div>
                        </Section>

                        {/* 4. Manutenção — ADMIN ONLY */}
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
                                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-rose-200/50 dark:border-rose-900/30">
                                        <h4 className="font-bold text-slate-900 dark:text-white mb-1">Expurgar Solicitações Antigas</h4>
                                        <p className="text-xs text-slate-500 leading-relaxed mb-6">
                                            Remove permanentemente registros de <strong>solicitações de retirada</strong> anteriores à data de corte.
                                            <span className="font-bold text-rose-500"> Esta ação não pode ser desfeita.</span>
                                            <br />
                                            <span className="text-amber-600 font-semibold">Os logs de auditoria NÃO são apagados</span> — são mantidos para conformidade legal.
                                        </p>
                                        <div className="flex flex-col sm:flex-row items-end gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data de Corte</label>
                                                <input
                                                    type="date"
                                                    value={cleanupDate}
                                                    onChange={e => { setCleanupDate(e.target.value); setCleanupPreview(null); }}
                                                    className="bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-rose-500/50 transition-all"
                                                />
                                            </div>
                                            <button
                                                onClick={previewCleanup}
                                                disabled={previewing || cleaning}
                                                className="flex items-center gap-2 px-6 py-3 border-2 border-rose-300 dark:border-rose-800 text-rose-600 rounded-xl font-bold text-xs hover:bg-rose-50 dark:hover:bg-rose-900/10 disabled:opacity-50 transition-all"
                                            >
                                                {previewing
                                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                                    : <RefreshCw className="w-4 h-4" />}
                                                Verificar e Limpar
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30">
                                        <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                        <p className="text-[10px] text-amber-700 dark:text-amber-500 font-medium leading-relaxed">
                                            <strong>Auditoria Obrigatória:</strong> Todas as ações de limpeza são registradas permanentemente
                                            no log de conformidade, incluindo o ID do operador, a justificativa e a contagem de registros afetados.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Right sidebar ── */}
                    <div className="space-y-8">
                        {/* Export history */}
                        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-lg">Exportações desta sessão</h3>
                                {exports.length > 0 && (
                                    <button
                                        onClick={() => setExports([])}
                                        className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-rose-500 transition-colors"
                                    >
                                        Limpar
                                    </button>
                                )}
                            </div>

                            {exports.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-slate-400 text-center gap-3">
                                    <Clock className="w-8 h-8 opacity-30" />
                                    <p className="text-xs font-medium">Nenhuma exportação realizada ainda.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {exports.map(item => (
                                        <div key={item.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 shrink-0">
                                                    <FileText className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold truncate">{item.name}</p>
                                                    <p className="text-[10px] text-slate-500">{item.date}</p>
                                                </div>
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 ml-auto" />
                                            </div>
                                            <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-700/50">
                                                <span className="text-[10px] font-semibold text-slate-400">{item.type}</span>
                                                <span className="text-[10px] text-slate-300">·</span>
                                                <span className="text-[10px] font-semibold text-slate-400">{item.rows.toLocaleString('pt-BR')} linhas</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* Audit logs CTA */}
                        <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-600/20 relative overflow-hidden group">
                            <Shield className="absolute -bottom-4 -right-4 w-32 h-32 opacity-10 group-hover:scale-110 transition-transform duration-700" />
                            <h3 className="text-lg font-bold mb-2">Pacote de Auditoria</h3>
                            <p className="text-xs text-indigo-100 mb-6 leading-relaxed">
                                Baixe todos os logs de acesso e eventos de segurança para conformidade legal e análise forense.
                            </p>
                            <button
                                onClick={exportAuditLogs}
                                disabled={loadingAudit}
                                className="w-full bg-white text-indigo-600 font-bold py-3 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70"
                            >
                                {loadingAudit
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <Download className="w-4 h-4" />}
                                {loadingAudit ? 'Gerando...' : 'Gerar Pacote de Auditoria'}
                            </button>
                        </div>
                    </div>
                </div>
            </main>

            {/* ── Cleanup Confirmation Modal ── */}
            {showCleanupModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-rose-500/10 rounded-xl">
                                    <AlertTriangle className="text-rose-500 w-5 h-5" />
                                </div>
                                <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Confirmar Limpeza</h3>
                            </div>
                            <button
                                onClick={() => { setShowCleanupModal(false); setCleanupPreview(null); }}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            {/* Preview count */}
                            {cleanupPreview !== null && (
                                <div className="grid grid-cols-1 gap-3">
                                    <div className="flex items-center justify-between p-4 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 rounded-2xl">
                                        <span className="text-xs font-bold text-rose-700 dark:text-rose-400">Solicitações a excluir</span>
                                        <span className="text-2xl font-black text-rose-600">{cleanupPreview.requests.toLocaleString('pt-BR')}</span>
                                    </div>
                                </div>
                            )}

                            <div className="bg-rose-50 dark:bg-rose-900/10 p-4 rounded-2xl border border-rose-100 dark:border-rose-900/30">
                                <p className="text-xs text-rose-700 dark:text-rose-400 leading-relaxed font-medium">
                                    Serão removidas todas as solicitações anteriores a <strong>{new Date(cleanupDate + 'T12:00:00').toLocaleDateString('pt-BR')}</strong>.
                                    A exclusão é <strong>permanente</strong>. Os logs de auditoria são preservados.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    <MessageSquare className="w-3 h-3 text-indigo-500" />
                                    Justificativa da Exclusão
                                </label>
                                <textarea
                                    value={justification}
                                    onChange={e => setJustification(e.target.value)}
                                    placeholder="Ex: Limpeza periódica para otimização do banco de dados..."
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-xs font-medium outline-none focus:border-indigo-500/30 transition-all min-h-[100px] resize-none"
                                />
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                            <button
                                onClick={() => { setShowCleanupModal(false); setCleanupPreview(null); }}
                                className="flex-1 px-6 py-3 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCleanup}
                                disabled={cleaning || !justification.trim() || cleanupPreview?.requests === 0}
                                className="flex-[2] bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 transition-all active:scale-95"
                            >
                                {cleaning
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <Trash2 className="w-4 h-4" />}
                                {cleaning ? 'Excluindo...' : `Confirmar e Excluir ${cleanupPreview?.requests ? `(${cleanupPreview.requests})` : ''}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}