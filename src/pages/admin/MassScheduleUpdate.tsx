import { useState, useEffect } from 'react';
import { Clock, Play, CheckCircle, AlertTriangle, Loader2, RefreshCw, Sun, Moon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import NavigationControls from '../../components/NavigationControls';
import { useToast } from '../../components/ui/Toast';
import { logAudit } from '../../lib/audit';

const DAYS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];

function buildSchedule(start: string, end: string) {
    return DAYS.map(day => ({ day, enabled: true, start, end }));
}

/** Extrai o código de seção do campo turma, ex: "1º Ano - EF I (111M)" → "111M" */
function getSectionCode(turma: string): string {
    const match = turma?.match(/\(([^)]+)\)\s*$/);
    return match ? match[1].trim() : '';
}

/** Determina o período pelo sufixo do código: M = Manhã, T = Tarde */
function getPeriod(turma: string): 'manha' | 'tarde' | 'desconhecido' {
    const code = getSectionCode(turma).toUpperCase();
    if (code.endsWith('M')) return 'manha';
    if (code.endsWith('T')) return 'tarde';
    return 'desconhecido';
}

interface Student {
    id: string;
    nome_completo: string;
    turma: string;
    config_seguranca: any;
    period: 'manha' | 'tarde' | 'desconhecido';
}

export default function MassScheduleUpdate() {
    const navigate = useNavigate();
    const toast = useToast();

    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [done, setDone] = useState(false);
    const [results, setResults] = useState<{ updated: number; skipped: number; errors: number } | null>(null);

    // Editable time windows
    const [morningStart, setMorningStart] = useState('11:50');
    const [morningEnd, setMorningEnd] = useState('13:20');
    const [afternoonStart, setAfternoonStart] = useState('17:50');
    const [afternoonEnd, setAfternoonEnd] = useState('19:00');

    const morningConflict = morningStart >= morningEnd;
    const afternoonConflict = afternoonStart >= afternoonEnd;
    const anyConflict = morningConflict || afternoonConflict;

    useEffect(() => {
        loadStudents();
    }, []);

    const loadStudents = async () => {
        setLoading(true);
        setDone(false);
        setResults(null);

        const { data, error } = await supabase
            .from('alunos')
            .select('id, nome_completo, turma, config_seguranca')
            .order('nome_completo');

        if (error) {
            toast.error('Erro ao carregar alunos', error.message);
        } else {
            const parsed = (data || []).map(s => ({
                ...s,
                period: getPeriod(s.turma || ''),
            }));
            setStudents(parsed);
        }

        setLoading(false);
    };

    const morning = students.filter(s => s.period === 'manha');
    const afternoon = students.filter(s => s.period === 'tarde');
    const unknown = students.filter(s => s.period === 'desconhecido');

    const handleRunUpdate = async () => {
        if (running || anyConflict) return;
        setRunning(true);

        let updated = 0;
        let errors = 0;

        const morningSchedule = buildSchedule(morningStart, morningEnd);
        const afternoonSchedule = buildSchedule(afternoonStart, afternoonEnd);

        const toUpdate = [
            ...morning.map(s => ({ ...s, newSchedule: morningSchedule })),
            ...afternoon.map(s => ({ ...s, newSchedule: afternoonSchedule })),
        ];

        for (const student of toUpdate) {
            const currentCfg = student.config_seguranca || {};
            const newCfg = { ...currentCfg, schedule: student.newSchedule };

            const { error } = await supabase
                .from('alunos')
                .update({ config_seguranca: newCfg })
                .eq('id', student.id);

            if (error) {
                console.error(`[MassSchedule] Erro ao atualizar ${student.nome_completo}:`, error);
                errors++;
            } else {
                updated++;
            }
        }

        await logAudit('MANUTENCAO', 'alunos', undefined, {
            acao: 'ATUALIZACAO_MASSA_HORARIO',
            total_atualizados: updated,
            erros: errors,
            turmas_manha: morning.length,
            turmas_tarde: afternoon.length,
            horario_manha: `${morningStart} – ${morningEnd}`,
            horario_tarde: `${afternoonStart} – ${afternoonEnd}`,
        });

        setResults({ updated, skipped: unknown.length, errors });
        setDone(true);
        setRunning(false);

        if (errors === 0) {
            toast.success('Atualização concluída', `${updated} alunos atualizados com sucesso.`);
        } else {
            toast.error('Atualização com erros', `${updated} atualizados, ${errors} com erro.`);
        }
    };

    return (
        <div className="bg-slate-50 min-h-screen text-slate-800 font-display">
            <div className="max-w-4xl mx-auto px-6 py-8">
                <NavigationControls />

                <div className="mb-10">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Manutenção — Horário de Retirada em Massa</h1>
                    <p className="text-slate-500">Define a janela semanal de retirada para todos os alunos com base no período (Manhã / Tarde). Edite os horários abaixo antes de executar.</p>
                </div>

                {/* Editable schedule cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* Morning */}
                    <div className={`bg-white rounded-3xl border p-6 shadow-sm transition-all ${morningConflict ? 'border-red-300' : 'border-slate-200'}`}>
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center">
                                <Sun className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900">Período da Manhã</h3>
                                <p className="text-xs text-slate-400">Turmas com código terminando em M</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Início</label>
                                <input
                                    type="time"
                                    value={morningStart}
                                    onChange={e => setMorningStart(e.target.value)}
                                    className={`w-full px-4 py-3 bg-amber-50 border rounded-xl text-sm font-bold outline-none focus:ring-2 transition-all ${morningConflict ? 'border-red-300 focus:ring-red-200' : 'border-amber-200 focus:ring-amber-200 focus:border-amber-400'}`}
                                />
                            </div>
                            <span className="text-slate-300 font-bold mt-5">–</span>
                            <div className="flex-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Fim</label>
                                <input
                                    type="time"
                                    value={morningEnd}
                                    onChange={e => setMorningEnd(e.target.value)}
                                    className={`w-full px-4 py-3 bg-amber-50 border rounded-xl text-sm font-bold outline-none focus:ring-2 transition-all ${morningConflict ? 'border-red-300 focus:ring-red-200' : 'border-amber-200 focus:ring-amber-200 focus:border-amber-400'}`}
                                />
                            </div>
                        </div>

                        {morningConflict && (
                            <p className="text-xs text-red-500 font-medium mt-2">⚠ O horário de Fim deve ser posterior ao Início.</p>
                        )}

                        <p className="text-sm font-semibold text-slate-500 mt-4 text-center">
                            {loading ? '...' : <>{morning.length} aluno{morning.length !== 1 ? 's' : ''}</>}
                        </p>
                    </div>

                    {/* Afternoon */}
                    <div className={`bg-white rounded-3xl border p-6 shadow-sm transition-all ${afternoonConflict ? 'border-red-300' : 'border-slate-200'}`}>
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center">
                                <Moon className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900">Período da Tarde</h3>
                                <p className="text-xs text-slate-400">Turmas com código terminando em T</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Início</label>
                                <input
                                    type="time"
                                    value={afternoonStart}
                                    onChange={e => setAfternoonStart(e.target.value)}
                                    className={`w-full px-4 py-3 bg-blue-50 border rounded-xl text-sm font-bold outline-none focus:ring-2 transition-all ${afternoonConflict ? 'border-red-300 focus:ring-red-200' : 'border-blue-200 focus:ring-blue-200 focus:border-blue-400'}`}
                                />
                            </div>
                            <span className="text-slate-300 font-bold mt-5">–</span>
                            <div className="flex-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Fim</label>
                                <input
                                    type="time"
                                    value={afternoonEnd}
                                    onChange={e => setAfternoonEnd(e.target.value)}
                                    className={`w-full px-4 py-3 bg-blue-50 border rounded-xl text-sm font-bold outline-none focus:ring-2 transition-all ${afternoonConflict ? 'border-red-300 focus:ring-red-200' : 'border-blue-200 focus:ring-blue-200 focus:border-blue-400'}`}
                                />
                            </div>
                        </div>

                        {afternoonConflict && (
                            <p className="text-xs text-red-500 font-medium mt-2">⚠ O horário de Fim deve ser posterior ao Início.</p>
                        )}

                        <p className="text-sm font-semibold text-slate-500 mt-4 text-center">
                            {loading ? '...' : <>{afternoon.length} aluno{afternoon.length !== 1 ? 's' : ''}</>}
                        </p>
                    </div>
                </div>

                {/* Summary */}
                {!loading && (
                    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm mb-8">
                        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-blue-500" />
                            Resumo da Atualização
                        </h3>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="bg-amber-50 rounded-2xl p-4">
                                <p className="text-2xl font-black text-amber-600">{morning.length}</p>
                                <p className="text-xs text-amber-500 font-semibold">Manhã</p>
                            </div>
                            <div className="bg-blue-50 rounded-2xl p-4">
                                <p className="text-2xl font-black text-blue-600">{afternoon.length}</p>
                                <p className="text-xs text-blue-500 font-semibold">Tarde</p>
                            </div>
                            <div className="bg-slate-100 rounded-2xl p-4">
                                <p className="text-2xl font-black text-slate-400">{unknown.length}</p>
                                <p className="text-xs text-slate-400 font-semibold">Não identificados</p>
                            </div>
                        </div>
                        {unknown.length > 0 && (
                            <div className="mt-4 flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-700">
                                    <strong>{unknown.length} aluno(s)</strong> com código de turma não reconhecido (sem sufixo M ou T) não serão atualizados.
                                    Exemplos: {unknown.slice(0, 3).map(s => s.turma || 'sem turma').join(', ')}.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Result */}
                {done && results && (
                    <div className={`rounded-3xl border p-6 mb-8 flex items-start gap-4 ${results.errors === 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                        <CheckCircle className={`w-6 h-6 shrink-0 mt-0.5 ${results.errors === 0 ? 'text-emerald-500' : 'text-red-500'}`} />
                        <div>
                            <h4 className={`font-bold mb-1 ${results.errors === 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                                {results.errors === 0 ? 'Atualização concluída com sucesso' : 'Atualização concluída com erros'}
                            </h4>
                            <p className="text-sm text-slate-600">
                                {results.updated} alunos atualizados · {results.skipped} ignorados (período desconhecido) · {results.errors} erros
                            </p>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-4 flex-wrap">
                    {!done ? (
                        <button
                            onClick={handleRunUpdate}
                            disabled={loading || running || anyConflict || (morning.length + afternoon.length === 0)}
                            className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center gap-3 hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {running ? (
                                <><Loader2 className="w-5 h-5 animate-spin" /> Atualizando...</>
                            ) : (
                                <><Play className="w-5 h-5" /> Executar Atualização em Massa</>
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={loadStudents}
                            className="px-8 py-4 bg-slate-200 text-slate-700 rounded-2xl font-bold flex items-center gap-3 hover:bg-slate-300 transition-all"
                        >
                            <RefreshCw className="w-4 h-4" /> Nova Atualização
                        </button>
                    )}
                    <button
                        onClick={() => navigate('/admin')}
                        className="px-8 py-4 text-slate-500 hover:text-slate-700 font-bold transition-colors"
                    >
                        Voltar ao Dashboard
                    </button>
                </div>

                <div className="mt-10 bg-slate-100 rounded-3xl p-6 flex gap-4 items-start">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-600 leading-relaxed">
                        Esta operação sobrescreve o horário semanal de <strong>todos</strong> os alunos com código de turma identificado (sufixo M ou T). As demais configurações de segurança (PIN, restrições de custódia, etc.) são preservadas. A ação é registrada no log de auditoria.
                    </p>
                </div>
            </div>
        </div>
    );
}
