import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle2, Loader2, Download, CalendarDays, ListChecks } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/audit';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../ui/Toast';

type BulkBirthdateModalProps = {
    escolaId: string;
    onClose: () => void;
    onSuccess: () => void;
};

type StudentRow = {
    id: string;
    nome_completo: string;
    matricula: string | null;
    turma: string | null;
    data_nascimento: string | null;
};

type PreviewRow = {
    matricula: string;
    dateRaw: string;
    dateIso: string | null;
    studentId: string | null;
    nome: string | null;
};

/**
 * Converte datas em DD/MM/AAAA, DD-MM-AAAA, AAAA-MM-DD (ou com 2 dígitos de ano)
 * para o formato ISO 'YYYY-MM-DD'. Retorna null se não reconhecer.
 */
function parseDateToIso(raw: string): string | null {
    const v = (raw || '').trim();
    if (!v) return null;

    // Já ISO: YYYY-MM-DD
    let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) {
        const [, y, mo, d] = m;
        return buildIso(+y, +mo, +d);
    }
    // DD/MM/AAAA ou DD-MM-AAAA (aceita ano com 2 ou 4 dígitos)
    m = v.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
    if (m) {
        let [, d, mo, y] = m;
        let year = +y;
        if (year < 100) year += year > 30 ? 1900 : 2000; // 25 -> 2025, 98 -> 1998
        return buildIso(year, +mo, +d);
    }
    return null;
}

function buildIso(y: number, mo: number, d: number): string | null {
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    const date = new Date(Date.UTC(y, mo - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${y}-${pad(mo)}-${pad(d)}`;
}

export default function BulkBirthdateModal({ escolaId, onClose, onSuccess }: BulkBirthdateModalProps) {
    const { user } = useAuth();
    const userId = user?.id;
    const toast = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [mode, setMode] = useState<'faltantes' | 'planilha'>('faltantes');
    const [students, setStudents] = useState<StudentRow[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(true);
    const [edits, setEdits] = useState<Record<string, string>>({});
    const [pastedData, setPastedData] = useState('');
    const [fileName, setFileName] = useState<string | null>(null);
    const [preview, setPreview] = useState<PreviewRow[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchStudents();
    }, [escolaId]);

    const fetchStudents = async () => {
        setLoadingStudents(true);
        try {
            const { data, error } = await supabase
                .from('alunos')
                .select('id, nome_completo, matricula, turma, data_nascimento')
                .eq('escola_id', escolaId)
                .order('nome_completo');
            if (error) throw error;
            setStudents((data as StudentRow[]) || []);
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar alunos');
        } finally {
            setLoadingStudents(false);
        }
    };

    const missing = useMemo(() => students.filter(s => !s.data_nascimento), [students]);
    const matriculaIndex = useMemo(() => {
        const map = new Map<string, StudentRow>();
        for (const s of students) {
            if (s.matricula) map.set(s.matricula.trim(), s);
        }
        return map;
    }, [students]);

    // ── Modo Planilha ────────────────────────────────────────────────────────
    const parseSheet = (text: string): PreviewRow[] => {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) throw new Error('Nenhuma linha encontrada.');

        // Detecta e ignora cabeçalho (se a 1ª linha não tiver uma data válida)
        const firstCols = lines[0].split(/[;,\t]/);
        const headerLikely = firstCols.length >= 2 && parseDateToIso(firstCols[1]) === null && parseDateToIso(firstCols[0]) === null;
        const rows = headerLikely ? lines.slice(1) : lines;

        const out: PreviewRow[] = rows.map(line => {
            const cols = line.split(/[;,\t]/).map(c => c.trim());
            const matricula = (cols[0] || '').trim();
            const dateRaw = (cols[1] || '').trim();
            const dateIso = parseDateToIso(dateRaw);
            const student = matriculaIndex.get(matricula) || null;
            return {
                matricula,
                dateRaw,
                dateIso,
                studentId: student?.id || null,
                nome: student?.nome_completo || null,
            };
        }).filter(r => r.matricula);

        if (out.length === 0) throw new Error('Nenhuma linha válida. Use o formato: matrícula ; data de nascimento.');
        return out;
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        setError(null);

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const buffer = event.target?.result as ArrayBuffer;
                const bytes = new Uint8Array(buffer);
                const hasUtf8Bom = bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF;
                const text = new TextDecoder(hasUtf8Bom ? 'utf-8' : 'windows-1252').decode(buffer);
                setPreview(parseSheet(text));
            } catch (err: any) {
                setError(err.message);
                setPreview([]);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handlePasteProcess = () => {
        try {
            setError(null);
            setPreview(parseSheet(pastedData));
        } catch (err: any) {
            setError(err.message);
            setPreview([]);
        }
    };

    const downloadTemplate = () => {
        const csv = '﻿Matricula;DataNascimento\n2024001;15/03/2016\n2024002;2017-08-22';
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'modelo_datas_nascimento.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // ── Persistência (compartilhada) ─────────────────────────────────────────
    const applyUpdates = async (updates: { id: string; dateIso: string }[]) => {
        let ok = 0;
        // Atualiza em lotes para não saturar a conexão.
        const chunkSize = 20;
        for (let i = 0; i < updates.length; i += chunkSize) {
            const chunk = updates.slice(i, i + chunkSize);
            const results = await Promise.all(chunk.map(u =>
                supabase
                    .from('alunos')
                    .update({ data_nascimento: u.dateIso })
                    .eq('id', u.id)
                    .eq('escola_id', escolaId)
                    .then(r => !r.error)
            ));
            ok += results.filter(Boolean).length;
        }
        return ok;
    };

    const handleSaveFaltantes = async () => {
        const updates = Object.entries(edits)
            .map(([id, raw]) => ({ id, dateIso: raw }))
            .filter(u => u.dateIso); // inputs type=date já entregam ISO
        if (updates.length === 0) {
            toast.warning('Nada para salvar', 'Preencha ao menos uma data de nascimento.');
            return;
        }
        setSaving(true);
        try {
            const ok = await applyUpdates(updates);
            await logAudit('EDICAO_ESTUDANTE', 'alunos', undefined, {
                operacao: 'PREENCHIMENTO_DATA_NASCIMENTO',
                origem: 'faltantes',
                total: updates.length,
                atualizados: ok,
            }, userId || undefined, escolaId);
            toast.success('Datas salvas', `${ok} aluno(s) atualizado(s).`);
            onSuccess();
            onClose();
        } catch (err: any) {
            toast.error('Erro ao salvar', err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleImportPlanilha = async () => {
        const updates = preview
            .filter(r => r.studentId && r.dateIso)
            .map(r => ({ id: r.studentId!, dateIso: r.dateIso! }));
        if (updates.length === 0) {
            toast.warning('Nada para importar', 'Nenhuma linha com matrícula encontrada e data válida.');
            return;
        }
        setSaving(true);
        try {
            const ok = await applyUpdates(updates);
            await logAudit('EDICAO_ESTUDANTE', 'alunos', undefined, {
                operacao: 'PREENCHIMENTO_DATA_NASCIMENTO',
                origem: 'planilha',
                total: updates.length,
                atualizados: ok,
            }, userId || undefined, escolaId);
            toast.success('Importação concluída', `${ok} aluno(s) atualizado(s).`);
            onSuccess();
            onClose();
        } catch (err: any) {
            toast.error('Erro ao importar', err.message);
        } finally {
            setSaving(false);
        }
    };

    const matchedCount = preview.filter(r => r.studentId && r.dateIso).length;
    const unmatchedCount = preview.length - matchedCount;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Datas de Nascimento</h2>
                        <p className="text-sm text-slate-500 font-medium">
                            Preencha em massa para liberar o auto-cadastro de responsáveis
                            {!loadingStudents && (
                                <> · <strong className={missing.length ? 'text-amber-600' : 'text-emerald-600'}>
                                    {missing.length}
                                </strong> sem data de nascimento</>
                            )}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Mode selector */}
                <div className="px-8 pt-6">
                    <div className="flex gap-4">
                        <button
                            onClick={() => setMode('faltantes')}
                            className={`flex-1 p-4 rounded-2xl border-2 transition-all flex items-center gap-3 font-bold uppercase tracking-wider text-xs ${mode === 'faltantes' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                        >
                            <ListChecks className="w-5 h-5" /> Preencher Faltantes ({missing.length})
                        </button>
                        <button
                            onClick={() => setMode('planilha')}
                            className={`flex-1 p-4 rounded-2xl border-2 transition-all flex items-center gap-3 font-bold uppercase tracking-wider text-xs ${mode === 'planilha' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                        >
                            <Upload className="w-5 h-5" /> Importar Planilha
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                    {loadingStudents ? (
                        <div className="py-16 flex flex-col items-center gap-3 text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin" />
                            <span className="text-xs font-bold uppercase tracking-widest">Carregando alunos...</span>
                        </div>
                    ) : mode === 'faltantes' ? (
                        missing.length === 0 ? (
                            <div className="py-16 text-center">
                                <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle2 className="w-8 h-8" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900">Tudo certo!</h3>
                                <p className="text-slate-500">Todos os alunos têm data de nascimento cadastrada.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <CalendarDays className="w-4 h-4" /> Informe a data de nascimento de cada aluno
                                </p>
                                {missing.map(s => (
                                    <div key={s.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-slate-900 truncate">{s.nome_completo}</p>
                                            <p className="text-xs text-slate-400 font-medium">
                                                Matrícula {s.matricula || '—'}{s.turma ? ` · ${s.turma}` : ''}
                                            </p>
                                        </div>
                                        <input
                                            type="date"
                                            value={edits[s.id] || ''}
                                            onChange={e => setEdits(prev => ({ ...prev, [s.id]: e.target.value }))}
                                            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-blue-500 outline-none transition-all font-bold text-slate-800 text-sm"
                                        />
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        <>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-slate-200 rounded-3xl p-10 flex flex-col items-center justify-center gap-3 hover:border-blue-400 transition-colors cursor-pointer group"
                            >
                                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv,.txt" className="hidden" />
                                <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Upload className="w-7 h-7" />
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-slate-700">{fileName || 'Selecione um arquivo CSV'}</p>
                                    <p className="text-sm text-slate-400">Colunas: <strong>Matrícula ; Data de Nascimento</strong> (DD/MM/AAAA ou AAAA-MM-DD)</p>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); downloadTemplate(); }}
                                    className="mt-2 flex items-center gap-2 text-xs font-black text-blue-600 hover:underline uppercase tracking-widest"
                                >
                                    <Download className="w-4 h-4" /> Baixar Modelo
                                </button>
                            </div>

                            <div className="mt-6">
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <FileText className="w-4 h-4" /> ou cole os dados
                                </p>
                                <textarea
                                    value={pastedData}
                                    onChange={(e) => setPastedData(e.target.value)}
                                    className="w-full h-28 bg-slate-50 border border-slate-200 rounded-2xl p-4 font-mono text-sm outline-none focus:border-blue-500 transition-all"
                                    placeholder={'2024001;15/03/2016\n2024002;2017-08-22'}
                                />
                                <button
                                    onClick={handlePasteProcess}
                                    disabled={!pastedData}
                                    className="mt-2 w-full py-3 bg-slate-900 text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-slate-800 transition-all disabled:opacity-50"
                                >
                                    Processar Texto
                                </button>
                            </div>

                            {preview.length > 0 && (
                                <div className="mt-8 space-y-3">
                                    <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest">
                                        <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {matchedCount} prontos</span>
                                        {unmatchedCount > 0 && (
                                            <span className="text-amber-600 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {unmatchedCount} com problema</span>
                                        )}
                                    </div>
                                    <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
                                        <table className="w-full text-left text-xs text-slate-600">
                                            <thead className="bg-white border-b border-slate-200">
                                                <tr>
                                                    <th className="px-4 py-2 font-bold uppercase">Matrícula</th>
                                                    <th className="px-4 py-2 font-bold uppercase">Aluno</th>
                                                    <th className="px-4 py-2 font-bold uppercase">Nascimento</th>
                                                    <th className="px-4 py-2 font-bold uppercase">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {preview.slice(0, 8).map((r, i) => (
                                                    <tr key={i}>
                                                        <td className="px-4 py-2 font-mono">{r.matricula}</td>
                                                        <td className="px-4 py-2 font-medium text-slate-900 truncate max-w-[160px]">{r.nome || '—'}</td>
                                                        <td className="px-4 py-2">{r.dateIso || <span className="text-amber-600">{r.dateRaw || '—'}</span>}</td>
                                                        <td className="px-4 py-2">
                                                            {r.studentId && r.dateIso ? (
                                                                <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">OK</span>
                                                            ) : !r.studentId ? (
                                                                <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">Matrícula não encontrada</span>
                                                            ) : (
                                                                <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">Data inválida</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {preview.length > 8 && (
                                            <div className="p-2 text-center bg-white text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                                + {preview.length - 8} linhas...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {error && (
                        <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}
                </div>

                <div className="p-8 border-t border-slate-100 flex gap-4 bg-slate-50/50">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 bg-white border border-slate-200 rounded-2xl font-bold uppercase tracking-widest text-xs text-slate-500 hover:bg-slate-100 transition-all"
                    >
                        Fechar
                    </button>
                    {mode === 'faltantes' ? (
                        <button
                            onClick={handleSaveFaltantes}
                            disabled={saving || missing.length === 0}
                            className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Datas Preenchidas'}
                        </button>
                    ) : (
                        <button
                            onClick={handleImportPlanilha}
                            disabled={saving || matchedCount === 0}
                            className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : `Atualizar ${matchedCount} Aluno(s)`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
