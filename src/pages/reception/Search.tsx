import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import NavigationControls from '../../components/NavigationControls';
import WithdrawalQueue from '../../components/reception/WithdrawalQueue';
import QRScannerModal from '../../components/reception/QRScannerModal';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/ui/Toast';
import type { Student, Guardian } from '../../types';
import {
    Search as SearchIcon,
    QrCode,
    CheckCircle2,
    LogOut,
    AlertCircle,
    Hash,
    X,
    Bell,
    User as UserIcon
} from 'lucide-react';


// ─── Code Entry Modal ────────────────────────────────────────────────────────

function CodeModal({ onConfirm, onClose }: {
    onConfirm: (code: string) => void;
    onClose: () => void;
}) {
    const [code, setCode] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (code.trim().length >= 4) onConfirm(code.trim().toUpperCase());
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#1e293b] rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-white/10 animate-in fade-in zoom-in-90 duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Hash className="w-6 h-6 text-white" />
                            <div>
                                <p className="text-white font-black text-base tracking-tight">Código de Acesso</p>
                                <p className="text-violet-200 text-[11px] font-medium">Exclusivo por responsável</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition-all">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <p className="text-slate-400 text-sm text-center leading-relaxed">
                        Digite o código único do responsável.<br />
                        Este código consta no cartão QR impresso.
                    </p>

                    <input
                        ref={inputRef}
                        type="text"
                        value={code}
                        onChange={e => setCode(e.target.value.replace(/\s/g, '').toUpperCase())}
                        placeholder="Ex: ABC123"
                        maxLength={8}
                        className="w-full bg-slate-900 border-2 border-white/10 rounded-2xl py-4 text-center text-2xl font-black text-white tracking-[0.4em] focus:border-violet-500 outline-none transition-all placeholder:text-slate-600 placeholder:tracking-normal uppercase"
                    />

                    <div className="grid grid-cols-2 gap-3">
                        <button type="button" onClick={onClose}
                            className="py-3 bg-white/5 hover:bg-white/10 text-slate-400 rounded-2xl font-bold text-sm transition-all">
                            Cancelar
                        </button>
                        <button type="submit" disabled={code.length < 4}
                            className="py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-2xl font-black text-sm transition-all active:scale-95">
                            Verificar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ReceptionSearch() {
    const toast = useToast();
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Student[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [relatedStudents, setRelatedStudents] = useState<Student[]>([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    const [guardians, setGuardians] = useState<Guardian[]>([]);
    const [selectedGuardianId, setSelectedGuardianId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);

    // Fetch user profile
    useEffect(() => {
        if (user) {
            supabase.from('usuarios').select('*').eq('id', user.id).single()
                .then(({ data }) => { if (data) setUserProfile(data); });
        }
    }, [user]);

    // Search students
    useEffect(() => {
        const searchStudents = async () => {
            if (query.length < 3) { setResults([]); return; }
            setLoading(true);

            const { data: directStudents } = await supabase
                .from('alunos').select('*').ilike('nome_completo', `%${query}%`).limit(5);

            const { data: auths } = await supabase
                .from('autorizacoes')
                .select('alunos:aluno_id (*)')
                .or(`nome_completo.ilike.%${query}%,cpf.ilike.%${query}%`, { foreignTable: 'responsaveis' })
                .eq('ativa', true).limit(10);

            let combined: Student[] = directStudents || [];
            auths?.forEach((a: any) => {
                const student = Array.isArray(a.alunos) ? a.alunos[0] : a.alunos;
                if (student && !combined.some(s => s.id === student.id)) combined.push(student);
            });

            setResults(combined.slice(0, 8));
            setLoading(false);
        };

        const t = setTimeout(searchStudents, 300);
        return () => clearTimeout(t);
    }, [query]);

    // Fetch guardians when student selected
    useEffect(() => {
        if (!selectedStudent || relatedStudents.length > 0) {
            if (!selectedStudent) setGuardians([]);
            return;
        }

        supabase
            .from('autorizacoes')
            .select(`tipo_autorizacao, parentesco, responsaveis(id, nome_completo, foto_url, codigo_acesso)`)
            .eq('aluno_id', selectedStudent.id)
            .eq('ativa', true)
            .then(({ data, error }) => {
                if (!error && data) {
                    setGuardians(data.map((item: { responsaveis: any; parentesco: string | null; tipo_autorizacao: string }) => ({
                        ...item.responsaveis,
                        parentesco: item.parentesco || item.tipo_autorizacao
                    })));
                }
            });
    }, [selectedStudent, relatedStudents]);

    const handleCallStudents = async () => {
        const studentIds = relatedStudents.length > 0
            ? Array.from(selectedStudentIds)
            : (selectedStudent ? [selectedStudent.id] : []);

        if (studentIds.length === 0 || !user) return;

        setSending(true);
        try {
            const requests = studentIds.map(id => ({
                escola_id: userProfile?.escola_id || 'e6328325-1845-420a-b333-87a747953259',
                aluno_id: id,
                responsavel_id: selectedGuardianId || null,
                recepcionista_id: user.id,
                status: 'SOLICITADO',
                tipo_solicitacao: 'ROTINA'
            }));

            const { error } = await supabase
                .from('solicitacoes_retirada')
                .insert(requests);

            if (error) throw error;

            const selectedGuardianLocal = guardians.find(g => g.id === selectedGuardianId);
            const guardianName = selectedGuardianLocal?.nome_completo;
            toast.success(
                studentIds.length === 1 ? 'Aluno chamado!' : `${studentIds.length} alunos chamados!`,
                guardianName ? `Responsável: ${guardianName}` : 'Notificação enviada às salas.'
            );

            // Reset state
            setQuery('');
            setSelectedStudent(null);
            setRelatedStudents([]);
            setSelectedStudentIds(new Set());
            setResults([]);
            setSelectedGuardianId(null);
        } catch (error) {
            console.error('Error calling students:', error);
            toast.error('Erro ao chamar alunos', 'Tente novamente.');
        } finally {
            setSending(false);
        }
    };

    const handleLogout = async () => { await signOut(); navigate('/login'); };

    // QR Scan handler
    const handleQRScan = async (qrData: string) => {
        setIsScannerOpen(false);
        setLoading(true);
        try {
            let responsavelId = '';
            const { data: cardData } = await supabase
                .from('parent_qr_cards').select('responsavel_id')
                .eq('qr_code', qrData).eq('active', true).maybeSingle();

            if (cardData?.responsavel_id) {
                responsavelId = cardData.responsavel_id;
            } else if (qrData.startsWith('LaSalleCheguei-')) {
                const parts = qrData.split('-');
                const uuidCandidate = parts.slice(1, -1).join('-');
                if (uuidCandidate.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))
                    responsavelId = uuidCandidate;
            }
            if (!responsavelId && qrData.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))
                responsavelId = qrData;
            if (!responsavelId) throw new Error('QR Code não reconhecido.');

            await resolveByResponsavelId(responsavelId);
        } catch (err: any) {
            toast.error('Erro no QR Code', err.message);
        } finally {
            setLoading(false);
        }
    };

    // Code lookup handler
    const handleCodeLookup = async (code: string) => {
        setIsCodeModalOpen(false);
        setLoading(true);
        try {
            const { data: resp, error } = await supabase
                .from('responsaveis').select('id, nome_completo')
                .eq('codigo_acesso', code.toUpperCase()).maybeSingle();

            if (error || !resp) throw new Error('Código não encontrado. Verifique e tente novamente.');
            await resolveByResponsavelId(resp.id, resp.nome_completo);
        } catch (err: any) {
            toast.error('Código inválido', err.message);
        } finally {
            setLoading(false);
        }
    };

    // Shared logic: resolve students linked to a responsavel_id
    const resolveByResponsavelId = async (responsavelId: string, guardianName?: string) => {
        const { data: auths, error } = await supabase
            .from('autorizacoes').select('alunos:aluno_id (*)')
            .eq('responsavel_id', responsavelId).eq('ativa', true);

        if (error) throw error;
        if (!auths || auths.length === 0) throw new Error('Nenhum aluno vinculado a este responsável.');

        const foundStudents = auths.map((a: any) => Array.isArray(a.alunos) ? a.alunos[0] : a.alunos).filter((s): s is Student => s !== null);

        // Fetch guardian info for the list
        const { data: guard } = await supabase
            .from('responsaveis')
            .select('id, nome_completo, foto_url')
            .eq('id', responsavelId)
            .single();

        if (guard) {
            setGuardians([{
                id: guard.id,
                nome_completo: guard.nome_completo,
                foto_url: guard.foto_url,
                parentesco: 'Responsável'
            }]);
        }

        setSelectedGuardianId(responsavelId);
        setRelatedStudents(foundStudents);
        setSelectedStudentIds(new Set(foundStudents.map(s => s.id)));
        setResults([]);
        setQuery('');

        if (guardianName || guard?.nome_completo) {
            toast.success('Responsável identificado', guardianName || guard?.nome_completo);
        }
    };

    const handleSelectStudent = (student: Student) => {
        setSelectedStudent(student);
        setRelatedStudents([]); // Reset related if manual search pick
        setQuery('');
        setResults([]);
        setSelectedGuardianId(null);
    };

    const toggleStudentSelection = (id: string) => {
        setSelectedStudentIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectedGuardian = guardians.find(g => g.id === selectedGuardianId);

    return (
        <div className="min-h-screen bg-[#0f172a] text-slate-200 flex flex-col font-sans selection:bg-emerald-500/30">
            {/* Header */}
            <header className="bg-white/5 border-b border-white/5 px-8 py-6 flex items-center justify-between sticky top-0 z-50 backdrop-blur-xl">
                <div className="flex items-center gap-8">
                    <NavigationControls />
                    <div className="flex flex-col">
                        <h1 className="text-2xl font-black tracking-tighter text-white">RECEPÇÃO SISRA</h1>
                        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Painel de Identificação e Controle</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* CÓDIGO button */}
                    <button
                        onClick={() => setIsCodeModalOpen(true)}
                        className="bg-violet-600 hover:bg-violet-500 text-white h-12 px-6 rounded-2xl flex items-center gap-3 transition-all active:scale-95 font-black text-xs uppercase tracking-widest shadow-lg shadow-violet-500/20"
                    >
                        <Hash className="w-5 h-5" /> CÓDIGO
                    </button>
                    {/* QR Scan button */}
                    <button
                        onClick={() => setIsScannerOpen(true)}
                        className="bg-emerald-500 hover:bg-emerald-400 text-[#0f172a] h-12 px-6 rounded-2xl flex items-center gap-3 transition-all active:scale-95 font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20"
                    >
                        <QrCode className="w-5 h-5" /> ESCANEAR QR
                    </button>
                    <div className="w-px h-8 bg-white/10 mx-1" />
                    <button onClick={handleLogout} className="p-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl transition-all border border-white/5">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </header>

            <main className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Search Column */}
                <div className="lg:col-span-8 space-y-8">
                    <section className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-xl">
                        <div className="flex flex-col gap-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-black italic tracking-tighter text-slate-300 uppercase">Pesquisar Estudante</h2>
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            </div>

                            <div className="relative group">
                                <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Digite nome, RA ou turma..."
                                    className="w-full bg-slate-900/50 border-2 border-white/5 rounded-3xl py-6 pl-16 pr-8 text-xl font-bold focus:border-emerald-500/50 focus:ring-0 transition-all placeholder:text-slate-600"
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                />
                                {loading && (
                                    <div className="absolute right-6 top-1/2 -translate-y-1/2">
                                        <div className="animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full" />
                                    </div>
                                )}
                            </div>

                            {/* Dropdown Results */}
                            {results.length > 0 && !selectedStudent && (
                                <div className="bg-slate-900/90 border border-white/10 rounded-3xl overflow-hidden shadow-2xl mt-2">
                                    {results.map(student => (
                                        <button
                                            key={student.id}
                                            onClick={() => handleSelectStudent(student)}
                                            className="w-full text-left p-6 hover:bg-emerald-500/10 flex items-center gap-6 border-b border-white/5 last:border-0 transition-colors group"
                                        >
                                            <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white/10 group-hover:border-emerald-500/50 transition-all">
                                                {student.foto_url ? (
                                                    <img src={student.foto_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-slate-800">
                                                        <UserIcon className="w-6 h-6 text-slate-600" />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-lg font-black text-white uppercase italic tracking-tight">{student.nome_completo}</p>
                                                <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest">{student.turma} • SALA {student.sala}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Student Spotlight / Multi-Student View */}
                    <div className="bg-white/5 border border-white/10 rounded-[3rem] overflow-hidden">
                        {(selectedStudent || relatedStudents.length > 0) ? (
                            <div className="animate-in fade-in zoom-in-95 duration-500">
                                <div className="p-8 lg:p-10 flex flex-col gap-8">
                                    {/* Header Info */}
                                    <div className="flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">
                                        <div className="relative group shrink-0">
                                            <div className="w-40 h-40 rounded-[2.5rem] overflow-hidden border-4 border-white/10 group-hover:border-emerald-500/50 transition-all shadow-2xl">
                                                {relatedStudents.length > 0 ? (
                                                    <div className="w-full h-full bg-indigo-600 flex items-center justify-center">
                                                        <SearchIcon className="w-12 h-12 text-white/50" />
                                                    </div>
                                                ) : selectedStudent?.foto_url ? (
                                                    <img src={selectedStudent.foto_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-slate-800">
                                                        <UserIcon className="w-16 h-16 text-slate-700" />
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setSelectedStudent(null);
                                                    setRelatedStudents([]);
                                                    setSelectedGuardianId(null);
                                                    setSelectedStudentIds(new Set());
                                                }}
                                                className="absolute -top-3 -right-3 w-10 h-10 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-xl hover:bg-rose-600 transition-all active:scale-90 z-20"
                                            >
                                                <X className="w-6 h-6" />
                                            </button>
                                        </div>

                                        <div className="flex-1 space-y-4">
                                            {relatedStudents.length > 0 ? (
                                                <div>
                                                    <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                                                        <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-500/30">Vínculo Familiar Detectado</span>
                                                        <span className="px-3 py-1 bg-white/5 text-slate-400 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest">{relatedStudents.length} Estudantes</span>
                                                    </div>
                                                    <h2 className="text-4xl font-black text-white italic tracking-tighter leading-tight">
                                                        Solicitação Multi-Estudante
                                                    </h2>
                                                    <p className="text-slate-400 text-sm font-medium mt-1">Selecione os alunos que serão retirados agora.</p>
                                                </div>
                                            ) : selectedStudent && (
                                                <div>
                                                    <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                                                        <span className="px-3 py-1 bg-emerald-500/20 text-emerald-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/30">Aluno Identificado</span>
                                                    </div>
                                                    <h2 className="text-5xl font-black text-white italic tracking-tighter leading-none mb-1">{selectedStudent.nome_completo}</h2>
                                                    <p className="text-emerald-500 text-sm font-black uppercase tracking-widest">{selectedStudent.turma} • SALA {selectedStudent.sala}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Student List (if related) or Single View (if one) */}
                                    <div className="space-y-4">
                                        {relatedStudents.length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                                {relatedStudents.map(student => {
                                                    const isSelected = selectedStudentIds.has(student.id);
                                                    return (
                                                        <button
                                                            key={student.id}
                                                            onClick={() => toggleStudentSelection(student.id)}
                                                            className={`flex items-center gap-4 p-4 rounded-3xl border-2 transition-all text-left group relative overflow-hidden ${isSelected
                                                                ? 'bg-emerald-500/10 border-emerald-500/50 shadow-lg shadow-emerald-500/5'
                                                                : 'bg-white/5 border-white/5 hover:border-white/10'
                                                                }`}
                                                        >
                                                            <div className={`w-12 h-12 rounded-2xl overflow-hidden border-2 shrink-0 transition-all ${isSelected ? 'border-emerald-500' : 'border-white/10'}`}>
                                                                {student.foto_url ? (
                                                                    <img src={student.foto_url} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-600">
                                                                        <UserIcon className="w-6 h-6" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className={`font-black uppercase text-xs truncate leading-none mb-1 ${isSelected ? 'text-emerald-400' : 'text-white/80'}`}>
                                                                    {student.nome_completo}
                                                                </p>
                                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">
                                                                    {student.turma} • <span className="text-emerald-600 font-black">SALA {student.sala}</span>
                                                                </p>
                                                            </div>
                                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 transition-all ${isSelected ? 'bg-emerald-500 border-emerald-500 text-slate-950' : 'border-white/20 text-transparent'}`}>
                                                                <CheckCircle2 className="w-4 h-4" />
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ) : selectedStudent && (
                                            <div className="space-y-6">
                                                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-2">
                                                    <UserIcon className="w-3 h-3" /> Responsáveis Autorizados
                                                </h3>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {guardians.map(guardian => {
                                                        const isSelected = guardian.id === selectedGuardianId;
                                                        return (
                                                            <button
                                                                key={guardian.id}
                                                                onClick={() => setSelectedGuardianId(isSelected ? null : guardian.id)}
                                                                className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left w-full group ${isSelected
                                                                    ? 'bg-emerald-500/15 border-emerald-500 shadow-lg shadow-emerald-500/10'
                                                                    : 'bg-white/5 border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/5'
                                                                    }`}
                                                            >
                                                                <div className={`w-12 h-12 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${isSelected ? 'border-emerald-500' : 'border-white/10'}`}>
                                                                    {guardian.foto_url ? (
                                                                        <img src={guardian.foto_url} alt="" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center bg-slate-800">
                                                                            <UserIcon className="w-6 h-6 text-slate-600" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 overflow-hidden">
                                                                    <p className={`font-bold uppercase text-xs truncate leading-none mb-1 transition-colors ${isSelected ? 'text-emerald-400' : 'text-white'}`}>
                                                                        {guardian.nome_completo}
                                                                    </p>
                                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{guardian.parentesco || 'Autorizado'}</p>
                                                                </div>
                                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-emerald-500 text-white' : 'bg-white/5 text-transparent'}`}>
                                                                    <CheckCircle2 className="w-4 h-4" />
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Warnings / Selection Info */}
                                    <div className="pt-2">
                                        {relatedStudents.length > 0 ? (
                                            <div className={`flex items-center gap-2 px-5 py-3 rounded-2xl border transition-all ${selectedStudentIds.size > 0 ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                                                {selectedStudentIds.size > 0 ? (
                                                    <>
                                                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                                                        <p className="text-xs font-bold font-mono tracking-tight">Pronto para chamar {selectedStudentIds.size} {selectedStudentIds.size === 1 ? 'estudante' : 'estudantes'}.</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                                        <p className="text-xs font-bold uppercase tracking-widest">Nenhum aluno selecionado.</p>
                                                    </>
                                                )}
                                            </div>
                                        ) : selectedStudent && (
                                            <>
                                                {selectedGuardianId ? (
                                                    <div className="flex items-center gap-2 px-5 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                                        <p className="text-xs font-bold text-emerald-400">Responsável identificado: <span className="text-white">{selectedGuardian?.nome_completo}</span></p>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 px-5 py-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                                                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                                                        <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">Selecione o responsável que está retirando.</p>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Call Button Area */}
                                <div className="p-8 bg-slate-900 border-t border-white/5 flex items-center justify-center">
                                    <button
                                        onClick={handleCallStudents}
                                        disabled={sending || (relatedStudents.length > 0 ? selectedStudentIds.size === 0 : !selectedGuardianId)}
                                        className="w-full group relative py-6 bg-emerald-500 text-slate-950 rounded-full font-black text-sm uppercase tracking-[0.4em] transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 overflow-hidden shadow-2xl flex items-center justify-center gap-4"
                                    >
                                        {sending ? (
                                            <div className="w-6 h-6 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <Bell className="w-6 h-6" />
                                                <span>{relatedStudents.length > 0 ? (selectedStudentIds.size > 1 ? `CHAMAR ${selectedStudentIds.size} ALUNOS` : 'CHAMAR SELECIONADO') : 'CHAMAR AGORA'}</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-20 text-center opacity-30 grayscale">
                                <div className="w-20 h-20 border-2 border-dashed border-slate-600 rounded-3xl flex items-center justify-center mb-6">
                                    <UserIcon className="w-10 h-10 text-slate-500" />
                                </div>
                                <h3 className="text-xl font-black italic tracking-widest text-slate-400 uppercase">IDENTIFICAÇÃO PENDENTE</h3>
                                <p className="text-xs font-bold mt-4 leading-relaxed max-w-xs">
                                    Aguardando leitura de QR ou busca para vincular responsável e alunos.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Queue */}
                <div className="lg:col-span-4 h-[calc(100vh-12rem)] sticky top-32">
                    <WithdrawalQueue />
                </div>
            </main>

            <QRScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScan={handleQRScan} />
            {isCodeModalOpen && <CodeModal onConfirm={handleCodeLookup} onClose={() => setIsCodeModalOpen(false)} />}
        </div>
    );
}
