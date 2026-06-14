import { useCallback, useMemo, useState } from 'react';
import {
    AlertTriangle,
    Calendar,
    CheckCircle2,
    Clock,
    Database,
    Download,
    FileText,
    History,
    Info,
    Loader2,
    Lock,
    Shield,
    Users,
} from 'lucide-react';
import NavigationControls from '../../components/NavigationControls';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';

type CsvValue = string | number | boolean | null | undefined;

type ExportRecord = {
    id: number;
    name: string;
    type: string;
    date: string;
    rows: number;
    total: number;
    truncated: boolean;
};

type ExportResponse<T> = {
    records?: T[];
    total_count?: number;
    returned_count?: number;
    limit?: number;
    truncated?: boolean;
};

type StudentExportRow = {
    matricula?: string | null;
    nome_completo?: string | null;
    turma?: string | null;
    sala?: string | null;
    ativo?: boolean | null;
};

type PickupExportRow = {
    horario_solicitacao?: string | null;
    horario_notificacao?: string | null;
    horario_liberacao?: string | null;
    horario_confirmacao?: string | null;
    tempo_espera_segundos?: number | null;
    status?: string | null;
    tipo_solicitacao?: string | null;
    aluno?: {
        matricula?: string | null;
        nome_completo?: string | null;
        turma?: string | null;
        sala?: string | null;
    } | null;
    responsavel?: {
        nome_completo?: string | null;
        cpf?: string | null;
    } | null;
    observacoes?: string | null;
    mensagem_sala?: string | null;
    mensagem_recepcao?: string | null;
};

type AuditExportRow = {
    criado_em?: string | null;
    acao?: string | null;
    tabela_afetada?: string | null;
    registro_id?: string | null;
    usuario_id?: string | null;
    usuario_nome?: string | null;
    usuario_email?: string | null;
    ip_address?: string | null;
    user_agent?: string | null;
    detalhes?: unknown;
};

function buildCSV(headers: string[], rows: CsvValue[][]): string {
    const escape = (value: CsvValue) => {
        const text = value == null ? '' : String(value);
        return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    return [headers, ...rows].map(row => row.map(escape).join(',')).join('\n');
}

function downloadCSV(csv: string, filename: string) {
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}

function todayInputValue() {
    return new Date().toISOString().slice(0, 10);
}

function monthsAgoInputValue(months: number) {
    const date = new Date();
    date.setMonth(date.getMonth() - months);
    return date.toISOString().slice(0, 10);
}

function dateStartIso(date: string) {
    return new Date(`${date}T00:00:00`).toISOString();
}

function dateEndIso(date: string) {
    return new Date(`${date}T23:59:59.999`).toISOString();
}

function formatDateTime(value?: string | null) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('pt-BR');
}

function secondsToMinutes(value?: number | null) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '';
    return Math.round(value / 60);
}

function friendlyError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error || '');
    if (message.includes('ACESSO_NEGADO')) return 'Acesso negado. Apenas administradores da escola podem exportar dados.';
    if (message.includes('PERIODO_INVALIDO')) return 'Periodo invalido. Confira as datas de inicio e fim.';
    return message || 'Nao foi possivel concluir a exportacao.';
}

export default function DataExportCenter() {
    const { role, escolaId } = useAuth();
    const toast = useToast();
    const [exports, setExports] = useState<ExportRecord[]>([]);
    const [pickupDateFrom, setPickupDateFrom] = useState(monthsAgoInputValue(1));
    const [pickupDateTo, setPickupDateTo] = useState(todayInputValue());
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [loadingPickups, setLoadingPickups] = useState(false);
    const [loadingAudit, setLoadingAudit] = useState(false);

    const isAdmin = role === 'ADMIN';
    const now = useMemo(
        () => new Date().toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }),
        []
    );

    const addExport = useCallback((name: string, type: string, payload: ExportResponse<unknown>) => {
        setExports(prev => [{
            id: Date.now(),
            name,
            type,
            rows: payload.returned_count ?? payload.records?.length ?? 0,
            total: payload.total_count ?? payload.records?.length ?? 0,
            truncated: Boolean(payload.truncated),
            date: new Date().toLocaleString('pt-BR'),
        }, ...prev].slice(0, 10));
    }, []);

    const ensureCanExport = useCallback(() => {
        if (!escolaId) {
            toast.error('Escola nao identificada', 'Entre novamente no sistema e tente exportar outra vez.');
            return false;
        }

        if (!isAdmin) {
            toast.error('Acesso negado', 'Somente administradores podem exportar dados administrativos.');
            return false;
        }

        return true;
    }, [escolaId, isAdmin, toast]);

    const notifySuccess = useCallback((label: string, payload: ExportResponse<unknown>) => {
        const rows = payload.returned_count ?? payload.records?.length ?? 0;
        const total = payload.total_count ?? rows;

        if (payload.truncated) {
            toast.warning(
                'Exportacao gerada com limite',
                `${rows.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')} registros foram exportados.`
            );
            return;
        }

        toast.success('Exportacao concluida', `${label}: ${rows.toLocaleString('pt-BR')} registros exportados.`);
    }, [toast]);

    const exportStudents = useCallback(async () => {
        if (!ensureCanExport()) return;

        setLoadingStudents(true);
        try {
            const { data, error } = await supabase.rpc('sisra_admin_export_students', {
                p_escola_id: escolaId,
                p_limit: 50000,
            });

            if (error) throw error;

            const payload = (data || {}) as ExportResponse<StudentExportRow>;
            const records = Array.isArray(payload.records) ? payload.records : [];
            const rows = records.map(student => [
                student.matricula,
                student.nome_completo,
                student.turma,
                student.sala,
                student.ativo ? 'Sim' : 'Nao',
            ]);

            downloadCSV(buildCSV(['Matricula', 'Nome completo', 'Turma', 'Sala', 'Ativo'], rows), 'alunos');
            addExport('alunos.csv', 'Alunos', payload);
            notifySuccess('Alunos', payload);
        } catch (error) {
            toast.error('Erro na exportacao', friendlyError(error));
        } finally {
            setLoadingStudents(false);
        }
    }, [addExport, escolaId, ensureCanExport, notifySuccess, toast]);

    const exportPickups = useCallback(async () => {
        if (!ensureCanExport()) return;

        if (!pickupDateFrom || !pickupDateTo || pickupDateTo < pickupDateFrom) {
            toast.error('Periodo invalido', 'A data final deve ser maior ou igual a data inicial.');
            return;
        }

        setLoadingPickups(true);
        try {
            const { data, error } = await supabase.rpc('sisra_admin_export_pickups', {
                p_escola_id: escolaId,
                p_from: dateStartIso(pickupDateFrom),
                p_to: dateEndIso(pickupDateTo),
                p_limit: 50000,
            });

            if (error) throw error;

            const payload = (data || {}) as ExportResponse<PickupExportRow>;
            const records = Array.isArray(payload.records) ? payload.records : [];
            const rows = records.map(item => [
                formatDateTime(item.horario_solicitacao),
                formatDateTime(item.horario_notificacao),
                formatDateTime(item.horario_liberacao),
                formatDateTime(item.horario_confirmacao),
                secondsToMinutes(item.tempo_espera_segundos),
                item.status,
                item.tipo_solicitacao,
                item.aluno?.matricula,
                item.aluno?.nome_completo,
                item.aluno?.turma,
                item.aluno?.sala,
                item.responsavel?.nome_completo,
                item.responsavel?.cpf,
                item.observacoes,
                item.mensagem_sala,
                item.mensagem_recepcao,
            ]);

            downloadCSV(buildCSV([
                'Solicitado em',
                'Notificado em',
                'Liberado em',
                'Confirmado em',
                'Espera (min)',
                'Status',
                'Tipo',
                'Matricula',
                'Aluno',
                'Turma',
                'Sala',
                'Responsavel',
                'CPF responsavel (mascarado)',
                'Observacoes',
                'Mensagem sala',
                'Mensagem recepcao',
            ], rows), `retiradas_${pickupDateFrom}_${pickupDateTo}`);
            addExport(`retiradas_${pickupDateFrom}_${pickupDateTo}.csv`, 'Retiradas', payload);
            notifySuccess('Retiradas', payload);
        } catch (error) {
            toast.error('Erro na exportacao', friendlyError(error));
        } finally {
            setLoadingPickups(false);
        }
    }, [addExport, escolaId, ensureCanExport, notifySuccess, pickupDateFrom, pickupDateTo, toast]);

    const exportAuditLogs = useCallback(async () => {
        if (!ensureCanExport()) return;

        setLoadingAudit(true);
        try {
            const { data, error } = await supabase.rpc('sisra_admin_export_audit_logs', {
                p_escola_id: escolaId,
                p_limit: 100000,
            });

            if (error) throw error;

            const payload = (data || {}) as ExportResponse<AuditExportRow>;
            const records = Array.isArray(payload.records) ? payload.records : [];
            const rows = records.map(log => [
                formatDateTime(log.criado_em),
                log.acao,
                log.tabela_afetada,
                log.registro_id,
                log.usuario_id,
                log.usuario_nome,
                log.usuario_email,
                log.ip_address,
                log.user_agent,
                log.detalhes == null ? '' : JSON.stringify(log.detalhes),
            ]);

            downloadCSV(buildCSV([
                'Data/Hora',
                'Acao',
                'Tabela',
                'Registro ID',
                'Usuario ID',
                'Usuario',
                'Email',
                'IP',
                'User Agent',
                'Detalhes',
            ], rows), 'logs_auditoria');
            addExport('logs_auditoria.csv', 'Auditoria', payload);
            notifySuccess('Auditoria', payload);
        } catch (error) {
            toast.error('Erro na exportacao', friendlyError(error));
        } finally {
            setLoadingAudit(false);
        }
    }, [addExport, escolaId, ensureCanExport, notifySuccess, toast]);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
                <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between gap-4 px-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-700 text-white shadow-sm">
                            <Download className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-sm font-black leading-none text-slate-950">Exportar dados</h1>
                            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                Relatorios CSV com escopo por escola
                            </p>
                        </div>
                    </div>

                    <div className="hidden items-center gap-3 text-xs font-bold text-slate-600 sm:flex">
                        <Clock className="h-4 w-4 text-slate-400" />
                        <span>{now}</span>
                        <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[10px] uppercase tracking-widest">
                            {role || 'Usuario'}
                        </span>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-screen-2xl px-6 py-8">
                <NavigationControls />

                <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-sky-700">
                                <Lock className="h-4 w-4" />
                                Exportacao protegida
                            </div>
                            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                                Centro de exportacao operacional
                            </h2>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                                Os arquivos sao gerados por funcoes seguras no banco, sempre filtrados pela escola do
                                administrador. Cada exportacao fica registrada na auditoria do sistema.
                            </p>
                        </div>

                        {!isAdmin && (
                            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                                Esta area exige perfil ADMIN para gerar arquivos.
                            </div>
                        )}
                    </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-3">
                    <ExportCard
                        icon={Users}
                        title="Alunos cadastrados"
                        description="Matricula, nome, turma, sala e status ativo."
                        meta="Limite seguro: 50.000 registros"
                        accent="sky"
                        loading={loadingStudents}
                        disabled={!isAdmin || !escolaId}
                        onExport={exportStudents}
                    />

                    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-700 text-white">
                                <History className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-950">Historico de retiradas</h3>
                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                    Eventos do periodo, responsavel e CPF mascarado quando existir.
                                </p>
                            </div>
                        </div>

                        <div className="mb-4 grid grid-cols-2 gap-3">
                            <label className="block">
                                <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">De</span>
                                <input
                                    type="date"
                                    value={pickupDateFrom}
                                    onChange={event => setPickupDateFrom(event.target.value)}
                                    className="h-10 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Ate</span>
                                <input
                                    type="date"
                                    value={pickupDateTo}
                                    onChange={event => setPickupDateTo(event.target.value)}
                                    className="h-10 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                                />
                            </label>
                        </div>

                        <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs font-semibold leading-5 text-emerald-900">
                            <Calendar className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>Limite seguro: 50.000 registros por arquivo.</span>
                        </div>

                        <ExportButton
                            loading={loadingPickups}
                            disabled={!isAdmin || !escolaId}
                            onClick={exportPickups}
                            className="bg-emerald-700 hover:bg-emerald-800 focus:ring-emerald-200"
                        />
                    </div>

                    <ExportCard
                        icon={Shield}
                        title="Logs de auditoria"
                        description="Acoes, origem, usuario, IP, navegador e detalhes tecnicos."
                        meta="Limite seguro: 100.000 eventos"
                        accent="slate"
                        loading={loadingAudit}
                        disabled={!isAdmin || !escolaId}
                        onExport={exportAuditLogs}
                    />
                </section>

                <section className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <FileText className="h-5 w-5 text-slate-500" />
                                <h3 className="text-sm font-black text-slate-950">Exportacoes desta sessao</h3>
                            </div>
                            {exports.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setExports([])}
                                    className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                                >
                                    Limpar
                                </button>
                            )}
                        </div>

                        {exports.length === 0 ? (
                            <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center">
                                <Database className="h-8 w-8 text-slate-300" />
                                <p className="mt-3 text-sm font-bold text-slate-500">Nenhum arquivo gerado nesta sessao.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[720px] text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                            <th className="py-3 pr-4">Arquivo</th>
                                            <th className="py-3 pr-4">Tipo</th>
                                            <th className="py-3 pr-4">Linhas</th>
                                            <th className="py-3 pr-4">Data</th>
                                            <th className="py-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {exports.map(item => (
                                            <tr key={item.id} className="border-b border-slate-100 last:border-0">
                                                <td className="py-3 pr-4 font-bold text-slate-900">{item.name}</td>
                                                <td className="py-3 pr-4 text-slate-600">{item.type}</td>
                                                <td className="py-3 pr-4 text-slate-600">
                                                    {item.rows.toLocaleString('pt-BR')}
                                                    {item.truncated && ` de ${item.total.toLocaleString('pt-BR')}`}
                                                </td>
                                                <td className="py-3 pr-4 text-slate-600">{item.date}</td>
                                                <td className="py-3">
                                                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                                                        item.truncated
                                                            ? 'bg-amber-100 text-amber-800'
                                                            : 'bg-emerald-100 text-emerald-800'
                                                    }`}>
                                                        {item.truncated ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                                                        {item.truncated ? 'Limitado' : 'Completo'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <aside className="space-y-4">
                        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="mb-3 flex items-center gap-2">
                                <Shield className="h-5 w-5 text-sky-700" />
                                <h3 className="text-sm font-black text-slate-950">Validacoes ativas</h3>
                            </div>
                            <ul className="space-y-3 text-sm text-slate-600">
                                <li className="flex gap-2">
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                    <span>Escopo por escola aplicado no banco antes de gerar o CSV.</span>
                                </li>
                                <li className="flex gap-2">
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                    <span>CPF de responsavel exportado somente em formato mascarado.</span>
                                </li>
                                <li className="flex gap-2">
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                    <span>Registro de auditoria criado pelo proprio banco a cada exportacao.</span>
                                </li>
                            </ul>
                        </div>

                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
                            <div className="mb-3 flex items-center gap-2">
                                <Info className="h-5 w-5 text-amber-700" />
                                <h3 className="text-sm font-black text-amber-950">Retencao de dados</h3>
                            </div>
                            <p className="text-sm leading-6 text-amber-900">
                                A limpeza destrutiva foi desativada nesta tela para preservar historico operacional,
                                auditoria e rastreabilidade. Qualquer politica de expurgo deve ser feita por rotina
                                revisada, com backup, janela de retencao aprovada e trilha de conformidade.
                            </p>
                        </div>
                    </aside>
                </section>
            </main>
        </div>
    );
}

type ExportCardProps = {
    icon: typeof Users;
    title: string;
    description: string;
    meta: string;
    accent: 'sky' | 'slate';
    loading: boolean;
    disabled: boolean;
    onExport: () => void;
};

function ExportCard({ icon: Icon, title, description, meta, accent, loading, disabled, onExport }: ExportCardProps) {
    const accentClass = accent === 'sky'
        ? 'bg-sky-700 hover:bg-sky-800 focus:ring-sky-200'
        : 'bg-slate-800 hover:bg-slate-900 focus:ring-slate-200';

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-white ${accent === 'sky' ? 'bg-sky-700' : 'bg-slate-800'}`}>
                    <Icon className="h-5 w-5" />
                </div>
                <div>
                    <h3 className="text-sm font-black text-slate-950">{title}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
                </div>
            </div>

            <div className="mb-4 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-semibold leading-5 text-slate-700">
                <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{meta}</span>
            </div>

            <ExportButton loading={loading} disabled={disabled} onClick={onExport} className={accentClass} />
        </div>
    );
}

type ExportButtonProps = {
    loading: boolean;
    disabled: boolean;
    onClick: () => void;
    className: string;
};

function ExportButton({ loading, disabled, onClick, className }: ExportButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled || loading}
            className={`flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-black text-white shadow-sm outline-none transition focus:ring-4 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none ${className}`}
        >
            {loading ? (
                <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando CSV...
                </>
            ) : (
                <>
                    <Download className="h-4 w-4" />
                    Exportar CSV
                </>
            )}
        </button>
    );
}
