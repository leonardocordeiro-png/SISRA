import { useState, useRef, useCallback } from 'react';
import { X, ImagePlus, CheckCircle2, AlertCircle, Loader2, Upload, Info, Users, Camera } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fileToDataUrl } from '../../lib/imageUtils';
import { logAudit } from '../../lib/audit';

type PhotoEntry = {
    file: File;
    matricula: string;
    preview: string;
    studentId: string | null;
    studentName: string | null;
    status: 'pending' | 'processing' | 'success' | 'error' | 'not_found';
    error?: string;
};

type BulkPhotoImportModalProps = {
    onClose: () => void;
    onSuccess: () => void;
};

export default function BulkPhotoImportModal({ onClose, onSuccess }: BulkPhotoImportModalProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [entries, setEntries] = useState<PhotoEntry[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importDone, setImportDone] = useState(false);
    const [progress, setProgress] = useState(0);

    const extractMatricula = (filename: string): string => {
        return filename.replace(/\.[^.]+$/, '').trim();
    };

    const loadFiles = useCallback(async (files: FileList | File[]) => {
        const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i.test(f.name));
        if (imageFiles.length === 0) return;

        // Load student list to match
        const { data: students } = await supabase
            .from('alunos')
            .select('id, nome_completo, matricula');

        const studentMap = new Map<string, { id: string; nome_completo: string }>();
        (students || []).forEach(s => {
            if (s.matricula) {
                studentMap.set(s.matricula.trim().toLowerCase(), { id: s.id, nome_completo: s.nome_completo });
            }
        });

        const newEntries: PhotoEntry[] = await Promise.all(
            imageFiles.map(async (file) => {
                const matricula = extractMatricula(file.name);
                const match = studentMap.get(matricula.toLowerCase());
                let preview = '';
                try {
                    preview = URL.createObjectURL(file);
                } catch {
                    preview = '';
                }
                return {
                    file,
                    matricula,
                    preview,
                    studentId: match?.id ?? null,
                    studentName: match?.nome_completo ?? null,
                    status: match ? 'pending' : 'not_found',
                } as PhotoEntry;
            })
        );

        setEntries(newEntries);
        setImportDone(false);
        setProgress(0);
    }, []);

    const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) loadFiles(e.target.files);
        e.target.value = '';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) loadFiles(e.dataTransfer.files);
    };

    const handleImport = async () => {
        const toProcess = entries.filter(e => e.status === 'pending');
        if (toProcess.length === 0) return;

        setIsImporting(true);
        setProgress(0);

        const updated = [...entries];
        let done = 0;
        let successCount = 0;

        for (const entry of toProcess) {
            const idx = updated.findIndex(e => e.file === entry.file);
            updated[idx] = { ...updated[idx], status: 'processing' };
            setEntries([...updated]);

            try {
                const dataUrl = await fileToDataUrl(entry.file);
                const { error } = await supabase
                    .from('alunos')
                    .update({ foto_url: dataUrl })
                    .eq('id', entry.studentId!);

                if (error) throw error;

                updated[idx] = { ...updated[idx], status: 'success' };
                successCount++;
            } catch (err: any) {
                updated[idx] = { ...updated[idx], status: 'error', error: err.message };
            }

            done++;
            setProgress(Math.round((done / toProcess.length) * 100));
            setEntries([...updated]);
        }

        if (successCount > 0) {
            await logAudit('IMPORTACAO_FOTOS_LOTE', 'alunos', undefined, {
                total_enviadas: toProcess.length,
                sucesso: successCount,
                falhas: toProcess.length - successCount,
            });
            onSuccess();
        }

        setIsImporting(false);
        setImportDone(true);
    };

    const pendingCount = entries.filter(e => e.status === 'pending').length;
    const notFoundCount = entries.filter(e => e.status === 'not_found').length;
    const successCount = entries.filter(e => e.status === 'success').length;
    const errorCount = entries.filter(e => e.status === 'error').length;

    const statusIcon = (status: PhotoEntry['status']) => {
        if (status === 'success') return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
        if (status === 'error') return <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />;
        if (status === 'not_found') return <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />;
        if (status === 'processing') return <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />;
        return <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />;
    };

    const statusLabel = (entry: PhotoEntry) => {
        if (entry.status === 'success') return <span className="text-emerald-600 font-bold">Importado</span>;
        if (entry.status === 'error') return <span className="text-rose-600 font-bold" title={entry.error}>Erro</span>;
        if (entry.status === 'not_found') return <span className="text-amber-500 font-bold">Matrícula não encontrada</span>;
        if (entry.status === 'processing') return <span className="text-blue-600 font-bold">Processando...</span>;
        return <span className="text-slate-500">{entry.studentName}</span>;
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center gap-4 p-6 border-b border-slate-100 shrink-0">
                    <div className="w-12 h-12 bg-violet-100 rounded-2xl flex items-center justify-center shrink-0">
                        <Camera className="w-6 h-6 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-black text-slate-900">Importar Fotos em Lote</h2>
                        <p className="text-sm text-slate-500 font-medium">Nomeie cada arquivo com o número de matrícula do aluno</p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isImporting}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all disabled:opacity-40"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Instructions */}
                <div className="mx-6 mt-4 bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3 shrink-0">
                    <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-700">
                        <p className="font-bold mb-1">Como nomear os arquivos:</p>
                        <p className="font-medium opacity-80">Use o número de matrícula como nome do arquivo, sem espaços.</p>
                        <p className="font-mono text-xs mt-1 opacity-70">Exemplos: <span className="bg-blue-100 px-1 rounded">20240001.jpg</span> · <span className="bg-blue-100 px-1 rounded">20240002.png</span></p>
                    </div>
                </div>

                {/* Drop Zone */}
                {entries.length === 0 && (
                    <div
                        className={`mx-6 mt-4 border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-4 cursor-pointer transition-all ${isDragging ? 'border-violet-400 bg-violet-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${isDragging ? 'bg-violet-100' : 'bg-slate-100'}`}>
                            <ImagePlus className={`w-8 h-8 transition-colors ${isDragging ? 'text-violet-600' : 'text-slate-400'}`} />
                        </div>
                        <div className="text-center">
                            <p className="font-bold text-slate-700">Arraste as fotos aqui</p>
                            <p className="text-sm text-slate-400 font-medium mt-1">ou clique para selecionar arquivos</p>
                        </div>
                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">JPG · PNG · WEBP · HEIC</p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/*,.heic,.heif"
                            className="hidden"
                            onChange={handleFilePick}
                        />
                    </div>
                )}

                {/* File List */}
                {entries.length > 0 && (
                    <div className="flex flex-col flex-1 min-h-0 mx-6 mt-4">
                        {/* Stats row */}
                        <div className="flex items-center gap-3 mb-3 shrink-0 flex-wrap">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{entries.length} arquivos</span>
                            {pendingCount > 0 && <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">{pendingCount} prontos</span>}
                            {notFoundCount > 0 && <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{notFoundCount} não encontrados</span>}
                            {successCount > 0 && <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{successCount} importados</span>}
                            {errorCount > 0 && <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">{errorCount} com erro</span>}
                            {!isImporting && (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="ml-auto text-xs font-bold text-violet-600 hover:text-violet-700 flex items-center gap-1"
                                >
                                    <Upload className="w-3.5 h-3.5" /> Trocar arquivos
                                </button>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept="image/*,.heic,.heif"
                                className="hidden"
                                onChange={handleFilePick}
                            />
                        </div>

                        {/* Progress bar */}
                        {isImporting && (
                            <div className="mb-3 shrink-0">
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-violet-500 rounded-full transition-all duration-300"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <p className="text-xs text-slate-500 font-bold mt-1 text-right">{progress}%</p>
                            </div>
                        )}

                        {/* Table */}
                        <div className="overflow-y-auto flex-1 rounded-2xl border border-slate-100">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-14">Foto</th>
                                        <th className="px-3 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Matrícula</th>
                                        <th className="px-3 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Aluno</th>
                                        <th className="px-3 py-2.5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-10">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {entries.map((entry, i) => (
                                        <tr key={i} className={`${entry.status === 'not_found' ? 'bg-amber-50/50' : entry.status === 'success' ? 'bg-emerald-50/50' : entry.status === 'error' ? 'bg-rose-50/50' : ''}`}>
                                            <td className="px-3 py-2">
                                                <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                                                    {entry.preview && (
                                                        <img src={entry.preview} alt="" className="w-full h-full object-cover" />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2">
                                                <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                                    {entry.matricula}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-sm">
                                                {statusLabel(entry)}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                {statusIcon(entry.status)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 shrink-0 flex items-center gap-3">
                    {importDone ? (
                        <>
                            <div className="flex-1 flex items-center gap-2 text-sm font-bold text-emerald-700">
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                {successCount} foto{successCount !== 1 ? 's' : ''} importada{successCount !== 1 ? 's' : ''} com sucesso
                            </div>
                            <button
                                onClick={onClose}
                                className="px-6 py-2.5 rounded-2xl font-bold bg-slate-900 text-white hover:bg-slate-800 transition-all text-sm"
                            >
                                Concluir
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={onClose}
                                disabled={isImporting}
                                className="px-6 py-2.5 rounded-2xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all text-sm disabled:opacity-40"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={pendingCount === 0 || isImporting}
                                className="flex-1 py-2.5 rounded-2xl font-black text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20 text-sm"
                            >
                                {isImporting ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</>
                                ) : (
                                    <><Users className="w-4 h-4" /> Importar {pendingCount > 0 ? `${pendingCount} Foto${pendingCount !== 1 ? 's' : ''}` : 'Fotos'}</>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
