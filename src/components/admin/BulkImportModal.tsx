import { useState, useRef } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle2, Loader2, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getSalaBySerie } from '../../lib/utils';

type BulkImportModalProps = {
    escolaId: string;
    onClose: () => void;
    onSuccess: () => void;
};

export default function BulkImportModal({ escolaId, onClose, onSuccess }: BulkImportModalProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importMode, setImportMode] = useState<'upload' | 'paste'>('upload');
    const [pastedData, setPastedData] = useState('');
    const [fileName, setFileName] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Fetch all turmas from DB so we can match properly
    const fetchTurmasFromDB = async (): Promise<{ nome: string; serie: string; secao: string }[]> => {
        const { data, error } = await supabase.from('turmas').select('nome').eq('ativa', true);
        if (error || !data) return [];
        return data.map(t => {
            const m = t.nome.match(/^(.*?) - (.*?) \((.*?)\)$/);
            if (m) return { nome: t.nome, serie: m[1], secao: m[3] };
            // Fallback: simple "serie (secao)" format
            const m2 = t.nome.match(/^(.*?) \((.*?)\)$/);
            if (m2) return { nome: t.nome, serie: m2[1], secao: m2[2] };
            return { nome: t.nome, serie: t.nome, secao: '' };
        });
    };

    const getShortSerie = (str: string): string => {
        const beforeDash = str.split(' - ')[0];
        const beforeParen = beforeDash.split('(')[0];
        return beforeParen.trim();
    };

    const parseCSV = (text: string, dbTurmas: { nome: string; serie: string; secao: string }[]) => {
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) throw new Error('O arquivo deve conter um cabeçalho e pelo menos uma linha de dados.');

        const headers = lines[0].split(/[;,\t]/).map(h =>
            h.trim().toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
        );
        const data = lines.slice(1).map(line => {
            const values = line.split(/[;,\t]/).map(v => v.trim());
            const obj: any = {};
            headers.forEach((header, i) => {
                if (header.includes('nome')) obj.nome_completo = values[i];
                if (header.includes('matr')) obj.matricula = values[i];
                if (header.includes('serie')) obj.serie = values[i];
                if (header.includes('turma') || header.includes('secao')) obj.turma_secao = values[i];
            });
            return obj;
        });

        // Validation and Sala + Turma assignment
        const normalize = (str: string) => str.trim().toLowerCase().replace(/\s+/g, ' ');
        const validated = data.map(item => {
            if (!item.nome_completo || !item.serie) return null;

            // Try to match the CSV serie against real turmas in the DB
            let turmaFormatada = item.serie; // fallback
            if (dbTurmas.length > 0) {
                const csvShortSerie = normalize(item.serie);
                const csvSecao = item.turma_secao || '';

                // Find a DB turma whose short serie prefix matches AND secao matches
                const matched = dbTurmas.find(t =>
                    normalize(getShortSerie(t.serie)) === csvShortSerie &&
                    normalize(t.secao) === normalize(csvSecao)
                ) || dbTurmas.find(t =>
                    // Fallback: full serie matches CSV serie
                    normalize(t.serie) === csvShortSerie &&
                    normalize(t.secao) === normalize(csvSecao)
                );

                if (matched) {
                    turmaFormatada = matched.nome;
                } else {
                    // No match found in turmas table — store in simple format
                    turmaFormatada = item.turma_secao
                        ? `${item.serie} (${item.turma_secao})`
                        : item.serie;
                }
            } else {
                // DB turmas not available — use old simple format
                turmaFormatada = item.turma_secao
                    ? `${item.serie} (${item.turma_secao})`
                    : item.serie;
            }

            return {
                nome_completo: item.nome_completo,
                matricula: item.matricula || `MAT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
                turma: turmaFormatada,
                serie_display: item.serie,
                secao_display: item.turma_secao || '',
                sala: getSalaBySerie(item.serie, item.turma_secao),
                escola_id: escolaId,
                ativo: true
            };
        }).filter(Boolean);

        if (validated.length === 0) throw new Error('Nenhum dado válido encontrado. Verifique se o cabeçalho contém "Nome" e "Série".');
        return validated;
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setError(null);

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const dbTurmas = await fetchTurmasFromDB();
                const parsed = parseCSV(text, dbTurmas);
                setPreview(parsed);
            } catch (err: any) {
                setError(err.message);
                setPreview([]);
            }
        };
        reader.readAsText(file);
    };

    const handlePasteProcess = async () => {
        try {
            setError(null);
            const dbTurmas = await fetchTurmasFromDB();
            const parsed = parseCSV(pastedData, dbTurmas);
            setPreview(parsed);
        } catch (err: any) {
            setError(err.message);
            setPreview([]);
        }
    };

    const handleImport = async () => {
        setLoading(true);
        setError(null);

        try {
            // Clean up display-only fields before insertion
            const dataToInsert = preview.map(({ serie_display, secao_display, ...rest }) => rest);

            const { error: insertError } = await supabase
                .from('alunos')
                .insert(dataToInsert);

            if (insertError) throw insertError;

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Erro ao importar alunos');
        } finally {
            setLoading(false);
        }
    };

    const downloadTemplate = () => {
        const csvContent = "\uFEFFNome;Matricula;Serie;Turma\nJoão Silva;2024001;1º Ano;111M\nMaria Oliveira;2024002;2º Ano;122T";
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "modelo_importacao_alunos.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Importação em Massa</h2>
                        <p className="text-sm text-slate-500 font-medium">Adicione múltiplos alunos de uma só vez</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                    {/* Mode Selector */}
                    <div className="flex gap-4 mb-8">
                        <button
                            onClick={() => { setImportMode('upload'); setPreview([]); }}
                            className={`flex-1 p-4 rounded-2xl border-2 transition-all flex items-center gap-3 font-bold uppercase tracking-wider text-xs ${importMode === 'upload' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                        >
                            <Upload className="w-5 h-5" /> Enviar Arquivo (CSV)
                        </button>
                        <button
                            onClick={() => { setImportMode('paste'); setPreview([]); }}
                            className={`flex-1 p-4 rounded-2xl border-2 transition-all flex items-center gap-3 font-bold uppercase tracking-wider text-xs ${importMode === 'paste' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                        >
                            <FileText className="w-5 h-5" /> Colar Dados (Texto)
                        </button>
                    </div>

                    {importMode === 'upload' ? (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-slate-200 rounded-3xl p-12 flex flex-col items-center justify-center gap-4 hover:border-blue-400 transition-colors cursor-pointer group"
                        >
                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv,.txt" className="hidden" />
                            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Upload className="w-8 h-8" />
                            </div>
                            <div className="text-center">
                                <p className="text-lg font-bold text-slate-700">{fileName || 'Clique para selecionar arquivo'}</p>
                                <p className="text-sm text-slate-400">Formato aceito: .CSV (separado por vírgula ou ponto e vírgula)</p>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); downloadTemplate(); }}
                                className="mt-4 flex items-center gap-2 text-xs font-black text-blue-600 hover:underline uppercase tracking-widest"
                            >
                                <Download className="w-4 h-4" /> Baixar Modelo Exemplo
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <textarea
                                value={pastedData}
                                onChange={(e) => setPastedData(e.target.value)}
                                className="w-full h-48 bg-slate-50 border border-slate-200 rounded-2xl p-6 font-mono text-sm outline-none focus:border-blue-500 transition-all"
                                placeholder={"Nome Completo, Matrícula, Série, Turma\nAna Souza, 1002, 3º Ano, B"}
                            />
                            <button
                                onClick={handlePasteProcess}
                                disabled={!pastedData}
                                className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-slate-800 transition-all disabled:opacity-50"
                            >
                                Processar Texto
                            </button>
                        </div>
                    )}

                    {error && (
                        <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600 animate-in fade-in slide-in-from-top-2">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    {preview.length > 0 && (
                        <div className="mt-10 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Pré-visualização ({preview.length} Alunos)
                                </h3>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
                                <table className="w-full text-left text-xs text-slate-600">
                                    <thead className="bg-white border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3 font-bold uppercase">Nome</th>
                                            <th className="px-4 py-3 font-bold uppercase">Série</th>
                                            <th className="px-4 py-3 font-bold uppercase">Seção</th>
                                            <th className="px-4 py-3 font-bold uppercase">Sala Auto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {preview.slice(0, 5).map((p, i) => (
                                            <tr key={i}>
                                                <td className="px-4 py-3 font-medium text-slate-900">{p.nome_completo}</td>
                                                <td className="px-4 py-3">{p.serie_display}</td>
                                                <td className="px-4 py-3">
                                                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                                                        {p.secao_display || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                                                        {p.sala || 'N/A'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {preview.length > 5 && (
                                    <div className="p-3 text-center bg-white text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                        + {preview.length - 5} outros alunos...
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-8 border-t border-slate-100 flex gap-4 bg-slate-50/50">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 bg-white border border-slate-200 rounded-2xl font-bold uppercase tracking-widest text-xs text-slate-500 hover:bg-slate-100 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={loading || preview.length === 0}
                        className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Importação'}
                    </button>
                </div>
            </div>
        </div>
    );
}
