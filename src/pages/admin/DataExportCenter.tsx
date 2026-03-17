import { useState, useCallback } from 'react';
import {
    Download, FileText, Users, Shield, Calendar, Clock,
    Trash2, AlertTriangle, X, MessageSquare, CheckCircle2,
    Loader2, History, RefreshCw, ChevronLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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

// ── Main Component ─────────────────────────────────────────────────────────────
export default function DataExportCenter() {
    const { role, user, escolaId } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();

    // ── Export history (session only) ──────────────────────────────────────────
    const [exports, setExports] = useState<ExportRecord[]>([]);
    const addExport = (name: string, type: string, rows: number) => {
        setExports(prev => [{
            id: Date.now(),
            name,
            type,
            rows,
            format: 'CSV' as const,
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

    const now = new Date().toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div style={{ background: '#f7f9fc', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>

            {/* ── Status Bar ── */}
            <div style={{
                background: '#ffffff',
                borderBottom: '1px solid #d1d9e6',
                padding: '0 24px',
                height: 56,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                zIndex: 30,
            }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#5c5c6c',
                        fontSize: 13,
                        fontWeight: 600,
                        padding: '6px 10px',
                        borderRadius: 8,
                        transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f0f2f5')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                    <ChevronLeft size={16} />
                    Voltar
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: 'linear-gradient(90deg, #6c5ce7 0%, #0984e3 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Download size={14} color="#fff" />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1e1e2e' }}>Centro de Exportação</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 12, color: '#5c5c6c' }}>{now}</span>
                    <div style={{
                        background: '#f0f2f5',
                        border: '1px solid #d1d9e6',
                        borderRadius: 20,
                        padding: '4px 12px',
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#5c5c6c',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                    }}>
                        {role ?? 'USUÁRIO'}
                    </div>
                </div>
            </div>

            {/* ── Main ── */}
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>

                {/* Page title */}
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1e1e2e', margin: 0 }}>Centro de Exportação de Dados</h1>
                    <p style={{ fontSize: 14, color: '#5c5c6c', marginTop: 8 }}>
                        Exporte dados do sistema em formato CSV e gerencie a manutenção do banco de dados.
                    </p>
                </div>

                {/* ── Action Grid: 3 export cards ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 32 }}>

                    {/* Card 1 — Alunos */}
                    <div style={{
                        background: '#ffffff',
                        border: '1px solid #d1d9e6',
                        borderRadius: 16,
                        overflow: 'hidden',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    }}>
                        <div style={{
                            background: 'linear-gradient(90deg, #6c5ce7 0%, #0984e3 100%)',
                            padding: '20px 24px 16px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: 6, display: 'flex' }}>
                                    <Users size={16} color="#fff" />
                                </div>
                                <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Alunos Cadastrados</span>
                            </div>
                            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, margin: 0 }}>
                                Lista completa — matrícula, turma e sala
                            </p>
                        </div>
                        <div style={{ padding: '16px 24px' }}>
                            <div style={{
                                background: '#f0f2f5',
                                borderRadius: 8,
                                padding: '10px 14px',
                                fontSize: 11,
                                color: '#5c5c6c',
                                marginBottom: 16,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                            }}>
                                <FileText size={12} />
                                <span><strong>Campos:</strong> Matrícula, Nome, Turma, Sala, Ativo</span>
                            </div>
                            <button
                                onClick={exportStudents}
                                disabled={loadingStudents}
                                style={{
                                    width: '100%',
                                    padding: '11px',
                                    background: loadingStudents ? '#d1d9e6' : 'linear-gradient(90deg, #6c5ce7 0%, #0984e3 100%)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 10,
                                    fontWeight: 700,
                                    fontSize: 13,
                                    cursor: loadingStudents ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    transition: 'opacity 0.15s',
                                }}
                            >
                                {loadingStudents
                                    ? <><Loader2 size={14} className="animate-spin" /> Gerando...</>
                                    : <><Download size={14} /> Exportar CSV</>}
                            </button>
                        </div>
                    </div>

                    {/* Card 2 — Retiradas */}
                    <div style={{
                        background: '#ffffff',
                        border: '1px solid #d1d9e6',
                        borderRadius: 16,
                        overflow: 'hidden',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    }}>
                        <div style={{
                            background: 'linear-gradient(90deg, #00b894 0%, #0984e3 100%)',
                            padding: '20px 24px 16px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: 6, display: 'flex' }}>
                                    <History size={16} color="#fff" />
                                </div>
                                <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Histórico de Retiradas</span>
                            </div>
                            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, margin: 0 }}>
                                Solicitações no período selecionado
                            </p>
                        </div>
                        <div style={{ padding: '16px 24px' }}>
                            <div style={{
                                display: 'flex',
                                gap: 12,
                                marginBottom: 12,
                            }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#5c5c6c', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>De</label>
                                    <input
                                        type="date"
                                        value={pickupDateFrom}
                                        onChange={e => setPickupDateFrom(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '8px 10px',
                                            border: '1px solid #d1d9e6',
                                            borderRadius: 8,
                                            fontSize: 12,
                                            color: '#1e1e2e',
                                            background: '#f7f9fc',
                                            boxSizing: 'border-box',
                                            outline: 'none',
                                        }}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#5c5c6c', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Até</label>
                                    <input
                                        type="date"
                                        value={pickupDateTo}
                                        onChange={e => setPickupDateTo(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '8px 10px',
                                            border: '1px solid #d1d9e6',
                                            borderRadius: 8,
                                            fontSize: 12,
                                            color: '#1e1e2e',
                                            background: '#f7f9fc',
                                            boxSizing: 'border-box',
                                            outline: 'none',
                                        }}
                                    />
                                </div>
                            </div>
                            <div style={{
                                background: '#f0f2f5',
                                borderRadius: 8,
                                padding: '10px 14px',
                                fontSize: 11,
                                color: '#5c5c6c',
                                marginBottom: 16,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                            }}>
                                <Calendar size={12} />
                                <span><strong>11 campos:</strong> Horários, Status, Tipo, Aluno, Responsável...</span>
                            </div>
                            <button
                                onClick={exportPickups}
                                disabled={loadingPickups}
                                style={{
                                    width: '100%',
                                    padding: '11px',
                                    background: loadingPickups ? '#d1d9e6' : 'linear-gradient(90deg, #00b894 0%, #0984e3 100%)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 10,
                                    fontWeight: 700,
                                    fontSize: 13,
                                    cursor: loadingPickups ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    transition: 'opacity 0.15s',
                                }}
                            >
                                {loadingPickups
                                    ? <><Loader2 size={14} className="animate-spin" /> Gerando...</>
                                    : <><Download size={14} /> Exportar CSV</>}
                            </button>
                        </div>
                    </div>

                    {/* Card 3 — Auditoria */}
                    <div style={{
                        background: '#ffffff',
                        border: '1px solid #d1d9e6',
                        borderRadius: 16,
                        overflow: 'hidden',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    }}>
                        <div style={{
                            background: 'linear-gradient(90deg, #6c5ce7 0%, #a29bfe 100%)',
                            padding: '20px 24px 16px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: 6, display: 'flex' }}>
                                    <Shield size={16} color="#fff" />
                                </div>
                                <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Logs de Auditoria</span>
                            </div>
                            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, margin: 0 }}>
                                Trilha completa de ações e segurança
                            </p>
                        </div>
                        <div style={{ padding: '16px 24px' }}>
                            <div style={{
                                background: '#f0f2f5',
                                borderRadius: 8,
                                padding: '10px 14px',
                                fontSize: 11,
                                color: '#5c5c6c',
                                marginBottom: 8,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                            }}>
                                <Shield size={12} />
                                <span><strong>Campos:</strong> Data/Hora, Ação, Tabela, IP, User Agent...</span>
                            </div>
                            <div style={{
                                background: '#fff8e1',
                                border: '1px solid #ffe082',
                                borderRadius: 8,
                                padding: '10px 14px',
                                fontSize: 11,
                                color: '#7b5e00',
                                marginBottom: 16,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                            }}>
                                <AlertTriangle size={12} />
                                <span>Exporta até <strong>100.000 eventos</strong> em ordem decrescente.</span>
                            </div>
                            <button
                                onClick={exportAuditLogs}
                                disabled={loadingAudit}
                                style={{
                                    width: '100%',
                                    padding: '11px',
                                    background: loadingAudit ? '#d1d9e6' : 'linear-gradient(90deg, #6c5ce7 0%, #a29bfe 100%)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 10,
                                    fontWeight: 700,
                                    fontSize: 13,
                                    cursor: loadingAudit ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    transition: 'opacity 0.15s',
                                }}
                            >
                                {loadingAudit
                                    ? <><Loader2 size={14} className="animate-spin" /> Gerando...</>
                                    : <><Download size={14} /> Exportar CSV</>}
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Summary panels: 2-column ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: role === 'ADMIN' ? 32 : 0 }}>

                    {/* Export history */}
                    <div style={{
                        background: '#ffffff',
                        border: '1px solid #d1d9e6',
                        borderRadius: 16,
                        padding: 24,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Clock size={16} color="#5c5c6c" />
                                <span style={{ fontWeight: 700, fontSize: 14, color: '#1e1e2e' }}>Exportações desta sessão</span>
                            </div>
                            {exports.length > 0 && (
                                <button
                                    onClick={() => setExports([])}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: '#5c5c6c',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                    }}
                                >
                                    Limpar
                                </button>
                            )}
                        </div>

                        {exports.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '24px 0', color: '#5c5c6c' }}>
                                <Clock size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
                                <p style={{ fontSize: 12, margin: 0 }}>Nenhuma exportação realizada ainda.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {exports.map(item => (
                                    <div key={item.id} style={{
                                        background: '#f7f9fc',
                                        border: '1px solid #d1d9e6',
                                        borderRadius: 10,
                                        padding: '12px 14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                    }}>
                                        <div style={{
                                            background: 'linear-gradient(90deg, #6c5ce7 0%, #0984e3 100%)',
                                            borderRadius: 8,
                                            padding: 6,
                                            display: 'flex',
                                            flexShrink: 0,
                                        }}>
                                            <FileText size={13} color="#fff" />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ fontSize: 12, fontWeight: 700, color: '#1e1e2e', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                                            <p style={{ fontSize: 10, color: '#5c5c6c', margin: '2px 0 0' }}>{item.date} · {item.rows.toLocaleString('pt-BR')} linhas</p>
                                        </div>
                                        <CheckCircle2 size={15} color="#00b894" style={{ flexShrink: 0 }} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Audit package CTA */}
                    <div style={{
                        background: 'linear-gradient(135deg, #6c5ce7 0%, #0984e3 100%)',
                        border: '1px solid #d1d9e6',
                        borderRadius: 16,
                        padding: 24,
                        boxShadow: '0 4px 20px rgba(108,92,231,0.25)',
                        position: 'relative',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                    }}>
                        <div style={{
                            position: 'absolute',
                            bottom: -20,
                            right: -20,
                            opacity: 0.1,
                        }}>
                            <Shield size={100} color="#fff" />
                        </div>
                        <div>
                            <h3 style={{ color: '#fff', fontWeight: 800, fontSize: 17, margin: '0 0 8px' }}>Pacote de Auditoria</h3>
                            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 1.5, margin: '0 0 24px' }}>
                                Baixe todos os logs de acesso e eventos de segurança para conformidade legal e análise forense.
                            </p>
                        </div>
                        <button
                            onClick={exportAuditLogs}
                            disabled={loadingAudit}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: '#ffffff',
                                color: '#6c5ce7',
                                border: 'none',
                                borderRadius: 10,
                                fontWeight: 700,
                                fontSize: 13,
                                cursor: loadingAudit ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                opacity: loadingAudit ? 0.7 : 1,
                            }}
                        >
                            {loadingAudit
                                ? <><Loader2 size={14} className="animate-spin" /> Gerando...</>
                                : <><Download size={14} /> Gerar Pacote de Auditoria</>}
                        </button>
                    </div>
                </div>

                {/* ── Footer: Manutenção (ADMIN ONLY) ── */}
                {role === 'ADMIN' && (
                    <div style={{
                        background: '#ffffff',
                        border: '1px solid #fecaca',
                        borderRadius: 16,
                        overflow: 'hidden',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    }}>
                        <div style={{
                            background: '#fff5f5',
                            borderBottom: '1px solid #fecaca',
                            padding: '16px 24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ background: '#d63031', borderRadius: 8, padding: 6, display: 'flex' }}>
                                    <Trash2 size={15} color="#fff" />
                                </div>
                                <div>
                                    <span style={{ fontWeight: 700, fontSize: 14, color: '#1e1e2e', display: 'block' }}>Manutenção do Banco de Dados</span>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: '#d63031', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Apenas Administradores</span>
                                </div>
                            </div>
                            <AlertTriangle size={18} color="#d63031" style={{ opacity: 0.7 }} />
                        </div>

                        <div style={{ padding: 24 }}>
                            <h4 style={{ fontWeight: 700, color: '#1e1e2e', margin: '0 0 6px', fontSize: 14 }}>Expurgar Solicitações Antigas</h4>
                            <p style={{ fontSize: 12, color: '#5c5c6c', lineHeight: 1.6, margin: '0 0 20px' }}>
                                Remove permanentemente registros de <strong>solicitações de retirada</strong> anteriores à data de corte.{' '}
                                <span style={{ color: '#d63031', fontWeight: 700 }}>Esta ação não pode ser desfeita.</span>{' '}
                                <span style={{ color: '#e17055', fontWeight: 600 }}>Os logs de auditoria NÃO são apagados</span> — são mantidos para conformidade legal.
                            </p>

                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#5c5c6c', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Data de Corte</label>
                                    <input
                                        type="date"
                                        value={cleanupDate}
                                        onChange={e => { setCleanupDate(e.target.value); setCleanupPreview(null); }}
                                        style={{
                                            padding: '9px 12px',
                                            border: '1px solid #d1d9e6',
                                            borderRadius: 8,
                                            fontSize: 12,
                                            color: '#1e1e2e',
                                            background: '#f7f9fc',
                                            outline: 'none',
                                        }}
                                    />
                                </div>
                                <button
                                    onClick={previewCleanup}
                                    disabled={previewing || cleaning}
                                    style={{
                                        padding: '9px 20px',
                                        background: 'none',
                                        border: '2px solid #d63031',
                                        color: '#d63031',
                                        borderRadius: 8,
                                        fontWeight: 700,
                                        fontSize: 12,
                                        cursor: (previewing || cleaning) ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        opacity: (previewing || cleaning) ? 0.5 : 1,
                                        transition: 'background 0.15s',
                                    }}
                                >
                                    {previewing
                                        ? <><Loader2 size={13} className="animate-spin" /> Verificando...</>
                                        : <><RefreshCw size={13} /> Verificar e Limpar</>}
                                </button>
                            </div>

                            <div style={{
                                marginTop: 16,
                                background: '#fff8e1',
                                border: '1px solid #ffe082',
                                borderRadius: 8,
                                padding: '10px 14px',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 8,
                            }}>
                                <Shield size={14} color="#7b5e00" style={{ flexShrink: 0, marginTop: 1 }} />
                                <p style={{ fontSize: 11, color: '#7b5e00', margin: 0, lineHeight: 1.5 }}>
                                    <strong>Auditoria Obrigatória:</strong> Todas as ações de limpeza são registradas permanentemente no log de conformidade, incluindo o ID do operador, a justificativa e a contagem de registros afetados.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Cleanup Confirmation Modal ── */}
            {showCleanupModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 50,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 16,
                    background: 'rgba(30,30,46,0.55)',
                    backdropFilter: 'blur(4px)',
                }}>
                    <div style={{
                        background: '#ffffff',
                        width: '100%',
                        maxWidth: 460,
                        borderRadius: 20,
                        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                        overflow: 'hidden',
                        border: '1px solid #d1d9e6',
                    }}>
                        {/* Modal header */}
                        <div style={{
                            padding: '20px 24px',
                            borderBottom: '1px solid #d1d9e6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ background: 'rgba(214,48,49,0.1)', borderRadius: 8, padding: 6, display: 'flex' }}>
                                    <AlertTriangle size={16} color="#d63031" />
                                </div>
                                <span style={{ fontWeight: 800, fontSize: 15, color: '#1e1e2e', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Confirmar Limpeza</span>
                            </div>
                            <button
                                onClick={() => { setShowCleanupModal(false); setCleanupPreview(null); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8 }}
                            >
                                <X size={18} color="#5c5c6c" />
                            </button>
                        </div>

                        {/* Modal body */}
                        <div style={{ padding: '24px' }}>
                            {cleanupPreview !== null && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: '#fff5f5',
                                    border: '1px solid #fecaca',
                                    borderRadius: 12,
                                    padding: '14px 18px',
                                    marginBottom: 16,
                                }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: '#d63031' }}>Solicitações a excluir</span>
                                    <span style={{ fontSize: 26, fontWeight: 900, color: '#d63031' }}>{cleanupPreview.requests.toLocaleString('pt-BR')}</span>
                                </div>
                            )}

                            <div style={{
                                background: '#fff5f5',
                                border: '1px solid #fecaca',
                                borderRadius: 10,
                                padding: '12px 16px',
                                marginBottom: 16,
                            }}>
                                <p style={{ fontSize: 12, color: '#d63031', margin: 0, lineHeight: 1.6, fontWeight: 500 }}>
                                    Serão removidas todas as solicitações anteriores a{' '}
                                    <strong>{new Date(cleanupDate + 'T12:00:00').toLocaleDateString('pt-BR')}</strong>.
                                    A exclusão é <strong>permanente</strong>. Os logs de auditoria são preservados.
                                </p>
                            </div>

                            <div>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: '#5c5c6c',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.08em',
                                    marginBottom: 8,
                                }}>
                                    <MessageSquare size={11} color="#6c5ce7" />
                                    Justificativa da Exclusão
                                </label>
                                <textarea
                                    value={justification}
                                    onChange={e => setJustification(e.target.value)}
                                    placeholder="Ex: Limpeza periódica para otimização do banco de dados..."
                                    style={{
                                        width: '100%',
                                        minHeight: 90,
                                        padding: '12px 14px',
                                        border: '1px solid #d1d9e6',
                                        borderRadius: 10,
                                        fontSize: 12,
                                        color: '#1e1e2e',
                                        background: '#f7f9fc',
                                        resize: 'vertical',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        fontFamily: 'inherit',
                                    }}
                                />
                            </div>
                        </div>

                        {/* Modal footer */}
                        <div style={{
                            padding: '16px 24px',
                            background: '#f7f9fc',
                            borderTop: '1px solid #d1d9e6',
                            display: 'flex',
                            gap: 10,
                        }}>
                            <button
                                onClick={() => { setShowCleanupModal(false); setCleanupPreview(null); }}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    background: 'none',
                                    border: '1px solid #d1d9e6',
                                    borderRadius: 8,
                                    fontWeight: 600,
                                    fontSize: 12,
                                    color: '#5c5c6c',
                                    cursor: 'pointer',
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCleanup}
                                disabled={cleaning || !justification.trim() || cleanupPreview?.requests === 0}
                                style={{
                                    flex: 2,
                                    padding: '10px',
                                    background: (cleaning || !justification.trim() || cleanupPreview?.requests === 0) ? '#d1d9e6' : '#d63031',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 8,
                                    fontWeight: 700,
                                    fontSize: 12,
                                    cursor: (cleaning || !justification.trim() || cleanupPreview?.requests === 0) ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                }}
                            >
                                {cleaning
                                    ? <><Loader2 size={13} className="animate-spin" /> Excluindo...</>
                                    : <><Trash2 size={13} /> Confirmar e Excluir {cleanupPreview?.requests ? `(${cleanupPreview.requests})` : ''}</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}