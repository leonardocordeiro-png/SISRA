import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { logAudit } from '../../lib/audit';
import { useToast } from '../../components/ui/Toast';
import {
    Calendar, CheckCircle2, Users, AlertTriangle, MessageSquare,
    ArrowRight, Sparkles, ShieldCheck, Download, Star,
    ArrowLeft, Loader2, Clock,
} from 'lucide-react';

type DaySummary = {
    totalPickups: number;
    pendingStudents: number;
    safetyIncidents: number;
    messagesCount: number;
    avgResponseMin: number;
};

export default function EndOfDaySummary() {
    const { user, role, escolaId: ctxEscolaId } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();

    const [summary, setSummary] = useState<DaySummary>({
        totalPickups: 0,
        pendingStudents: 0,
        safetyIncidents: 0,
        messagesCount: 0,
        avgResponseMin: 0,
    });
    const [loading, setLoading] = useState(true);
    const [signed, setSigned] = useState(false);
    const [signing, setSigning] = useState(false);

    const [escolaId, setEscolaId] = useState<string | null>(ctxEscolaId ?? null);
    const [salaAtribuida, setSalaAtribuida] = useState<string | null>(null);
    const [turmaAtribuida, setTurmaAtribuida] = useState<string | null>(null);

    // Resolve profile data
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

    const fetchStats = useCallback(async () => {
        if (!escolaId) return;
        setLoading(true);
        try {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            // Build base query for today
            const baseQuery = () => supabase
                .from('solicitacoes_retirada')
                .select('id, status, tipo_solicitacao, horario_solicitacao, horario_liberacao, mensagem_sala')
                .eq('escola_id', escolaId)
                .gte('horario_solicitacao', todayStart.toISOString());

            // Optionally scope to teacher's class
            const applyClassFilter = (q: ReturnType<typeof baseQuery>) => {
                if (role !== 'ADMIN' && role !== 'COORDENADOR') {
                    if (salaAtribuida) return q.eq('alunos.sala', salaAtribuida);
                    if (turmaAtribuida) return q.eq('alunos.turma', turmaAtribuida);
                }
                return q;
            };

            const { data: todayData, error } = await applyClassFilter(baseQuery());
            if (error) throw error;

            const rows = todayData || [];

            // Completed (released or confirmed or concluded)
            const released = rows.filter(r => ['LIBERADO', 'CONFIRMADO', 'CONCLUIDO'].includes(r.status));

            // Still pending right now (active statuses with no confirmation)
            const pending = rows.filter(r => ['SOLICITADO', 'NOTIFICADO', 'AGUARDANDO'].includes(r.status));

            // Safety incidents = EMERGENCIA tipo
            const incidents = rows.filter(r => r.tipo_solicitacao === 'EMERGENCIA');

            // Teacher messages sent
            const withMsg = rows.filter(r => r.mensagem_sala && r.mensagem_sala.trim() !== '');

            // Average response time (horario_liberacao - horario_solicitacao) for released
            const withTimes = released.filter(r => r.horario_liberacao);
            const avgMin = withTimes.length > 0
                ? withTimes.reduce((acc, r) =>
                    acc + (new Date(r.horario_liberacao!).getTime() - new Date(r.horario_solicitacao).getTime()) / 60000, 0
                  ) / withTimes.length
                : 0;

            setSummary({
                totalPickups:    released.length,
                pendingStudents: pending.length,
                safetyIncidents: incidents.length,
                messagesCount:   withMsg.length,
                avgResponseMin:  avgMin,
            });
        } catch (err: any) {
            toast.error('Erro ao carregar resumo', err.message);
        } finally {
            setLoading(false);
        }
    }, [escolaId, role, salaAtribuida, turmaAtribuida]);

    useEffect(() => {
        if (escolaId) fetchStats();
    }, [escolaId, fetchStats]);

    const turmaLabel = salaAtribuida ?? turmaAtribuida
        ?? ((role === 'ADMIN' || role === 'COORDENADOR') ? 'Todas as Turmas' : '—');

    const handleSign = async () => {
        if (!user || !escolaId) {
            toast.error('Erro', 'Usuário ou escola não identificados.');
            return;
        }
        setSigning(true);
        try {
            await logAudit('ASSINATURA_DIARIA', 'resumo_dia', undefined, {
                turma: turmaLabel,
                data: new Date().toISOString().slice(0, 10),
                total_pickups: summary.totalPickups,
                pendentes: summary.pendingStudents,
                incidentes: summary.safetyIncidents,
                mensagens_sala: summary.messagesCount,
                tempo_medio_min: summary.avgResponseMin.toFixed(1),
            }, user.id, escolaId);
            setSigned(true);
            toast.success('Relatório assinado', 'Assinatura digital registrada com sucesso.');
        } catch (err: any) {
            toast.error('Erro ao assinar', err.message);
        } finally {
            setSigning(false);
        }
    };

    const downloadSummary = () => {
        const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        const lines = [
            '=================================================',
            '     RESUMO DO EXPEDIENTE DIÁRIO — La Salle',
            '=================================================',
            '',
            `Data........: ${today}`,
            `Turma.......: ${turmaLabel}`,
            `Gerado em...: ${new Date().toLocaleString('pt-BR')}`,
            '',
            '----- ESTATÍSTICAS --------------------------------',
            `Saídas Realizadas..........: ${summary.totalPickups}`,
            `Aguardando Coleta (agora)..: ${summary.pendingStudents}`,
            `Emergências Registradas....: ${summary.safetyIncidents}`,
            `Mensagens Enviadas p/ Sala.: ${summary.messagesCount}`,
            `Tempo Médio de Resposta....: ${summary.avgResponseMin.toFixed(1)} min`,
            '-------------------------------------------------',
            '',
            signed
                ? `✓ Assinatura digital registrada em ${new Date().toLocaleString('pt-BR')}`
                : '⚠ Relatório pendente de assinatura.',
            '',
            '=================================================',
        ].join('\n');

        const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `resumo_dia_${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Baixado', 'Resumo do dia exportado.');
    };

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'radial-gradient(circle at 75% 10%, #121A2B, #0A0F1F 70%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Montserrat', system-ui, sans-serif",
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                    <Loader2 size={32} style={{ color: '#38D9A9', animation: 'spin 1s linear infinite' }} />
                    <p style={{ color: '#8C98A6', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em' }}>
                        Gerando Relatório Diário...
                    </p>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans selection:bg-emerald-500/30 pb-20">
            {/* Header */}
            <div className="bg-slate-900 text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 p-20 opacity-10">
                    <Calendar className="w-64 h-64" />
                </div>
                <div className="max-w-6xl mx-auto px-6 py-12 relative z-10">
                    {/* Back navigation */}
                    <div className="flex items-center gap-3 mb-6">
                        <button
                            onClick={() => navigate(-1)}
                            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
                        >
                            <ArrowLeft className="w-4 h-4" /> Voltar
                        </button>
                        <button
                            onClick={() => navigate('/sala/dashboard')}
                            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
                        >
                            Dashboard
                        </button>
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                        <span className="px-3 py-1 bg-emerald-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest">Relatório Final</span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter leading-none mb-6">
                        Resumo do <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400 italic">Expediente Diário.</span>
                    </h1>
                    <div className="flex flex-wrap items-center gap-8">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                                <Calendar className="w-6 h-6 text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-emerald-400/60 font-black text-[10px] tracking-widest uppercase">Data</p>
                                <p className="font-bold text-lg">{new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                                <Users className="w-6 h-6 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-blue-400/60 font-black text-[10px] tracking-widest uppercase">Turma</p>
                                <p className="font-bold text-lg italic">{turmaLabel}</p>
                            </div>
                        </div>
                        {summary.avgResponseMin > 0 && (
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                                    <Clock className="w-6 h-6 text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-amber-400/60 font-black text-[10px] tracking-widest uppercase">Tempo Médio</p>
                                    <p className="font-bold text-lg">{summary.avgResponseMin.toFixed(1)} min</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <main className="max-w-6xl mx-auto px-6 -mt-10 relative z-20">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    {[
                        { label: 'Saídas Realizadas',    value: summary.totalPickups,    icon: CheckCircle2,    color: 'text-emerald-500', bg: 'bg-emerald-50' },
                        { label: 'Aguardando Coleta',    value: summary.pendingStudents, icon: Users,           color: 'text-purple-500',  bg: 'bg-purple-50'  },
                        { label: 'Emergências Hoje',     value: summary.safetyIncidents, icon: AlertTriangle,   color: 'text-rose-500',    bg: 'bg-rose-50'    },
                        { label: 'Mensagens p/ Recepção',value: summary.messagesCount,   icon: MessageSquare,   color: 'text-blue-500',    bg: 'bg-blue-50'    },
                    ].map((stat, i) => (
                        <div key={i} className="bg-white rounded-[32px] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 transition-all hover:-translate-y-1">
                            <div className={`w-12 h-12 ${stat.bg} rounded-2xl flex items-center justify-center mb-6`}>
                                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                            </div>
                            <p className="text-slate-400 font-black text-[10px] tracking-widest uppercase mb-1">{stat.label}</p>
                            <p className="text-3xl font-black text-slate-900 tracking-tight leading-none italic">{stat.value}</p>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Summary Insights */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-[40px] p-10 shadow-xl shadow-slate-200/50 border border-slate-100">
                            <div className="flex items-center justify-between mb-10">
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3 italic uppercase">
                                    <Sparkles className="w-6 h-6 text-emerald-500" />
                                    Resumo do Dia
                                </h3>
                                <button onClick={downloadSummary} className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl transition-all" title="Baixar resumo">
                                    <Download className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="flex gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                    <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                                        <CheckCircle2 className="w-7 h-7 text-white" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-slate-900 mb-1">Saídas Processadas</h4>
                                        <p className="text-sm text-slate-500 leading-relaxed">
                                            {summary.totalPickups > 0
                                                ? `${summary.totalPickups} aluno${summary.totalPickups > 1 ? 's foram liberados' : ' foi liberado'} hoje.`
                                                    + (summary.pendingStudents > 0 ? ` Ainda há ${summary.pendingStudents} aguardando coleta.` : ' Todos foram retirados.')
                                                : 'Nenhuma saída processada ainda hoje.'
                                            }
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${summary.safetyIncidents > 0 ? 'bg-rose-500 shadow-rose-500/20' : 'bg-blue-500 shadow-blue-500/20'}`}>
                                        <ShieldCheck className="w-7 h-7 text-white" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-slate-900 mb-1">Segurança</h4>
                                        <p className="text-sm text-slate-500 leading-relaxed">
                                            {summary.safetyIncidents === 0
                                                ? 'Nenhuma emergência registrada hoje. Dia seguro!'
                                                : `${summary.safetyIncidents} ocorrência${summary.safetyIncidents > 1 ? 's' : ''} de emergência registrada${summary.safetyIncidents > 1 ? 's' : ''} hoje.`
                                            }
                                            {summary.messagesCount > 0 && ` ${summary.messagesCount} mensagem${summary.messagesCount > 1 ? 'ns' : ''} enviada${summary.messagesCount > 1 ? 's' : ''} para a recepção.`}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Signature Card */}
                    <div className="lg:col-span-1">
                        <div className={`rounded-[40px] p-8 transition-all duration-500 ${
                            signed
                                ? 'bg-emerald-500 text-white shadow-2xl shadow-emerald-500/30'
                                : 'bg-white shadow-xl shadow-slate-200/50 border border-slate-100'
                        }`}>
                            {signed ? (
                                <div className="text-center py-10 animate-in fade-in zoom-in">
                                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <CheckCircle2 className="w-12 h-12 text-white" />
                                    </div>
                                    <h3 className="text-2xl font-black mb-2 italic">Expediente Encerrado</h3>
                                    <p className="opacity-80 font-medium mb-8">Assinatura registrada. Bom descanso!</p>
                                    <button
                                        onClick={() => setSigned(false)}
                                        className="w-full py-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl font-black text-[10px] tracking-widest uppercase transition-all"
                                    >
                                        Reabrir Relatório
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-6">
                                        <Star className="w-8 h-8 text-slate-900" />
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 mb-2 italic uppercase">Finalizar Dia</h3>
                                    <p className="text-slate-500 text-sm font-medium mb-8">
                                        Ao assinar, você confirma que todos os alunos foram entregues. A assinatura é registrada no banco de dados com timestamp.
                                    </p>
                                    <button
                                        onClick={handleSign}
                                        disabled={signing}
                                        className="w-full py-5 bg-slate-900 hover:bg-black text-white font-black rounded-3xl transition-all shadow-xl shadow-slate-950/20 flex items-center justify-center gap-3 uppercase text-xs tracking-[0.2em] disabled:opacity-50"
                                    >
                                        {signing
                                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Registrando...</>
                                            : <><span>Assinar Relatório</span><ArrowRight className="w-4 h-4" /></>
                                        }
                                    </button>
                                    <p className="mt-6 text-center text-slate-400 text-[10px] uppercase font-black tracking-widest leading-relaxed">
                                        Assinatura registrada em<br />logs de auditoria do sistema.
                                    </p>
                                </>
                            )}
                        </div>

                        {/* Quick Actions */}
                        <div className="mt-6 grid grid-cols-2 gap-4">
                            <button
                                onClick={() => navigate('/sala/historico')}
                                className="flex flex-col items-center justify-center py-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:bg-slate-50 transition-all"
                            >
                                <Users className="w-5 h-5 text-slate-400 mb-2" />
                                <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Ver Log</span>
                            </button>
                            <button
                                onClick={downloadSummary}
                                className="flex flex-col items-center justify-center py-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:bg-slate-50 transition-all"
                            >
                                <Download className="w-5 h-5 text-slate-400 mb-2" />
                                <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Baixar</span>
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
