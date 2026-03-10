import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/audit';
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
    User as UserIcon,
    Activity,
    ChevronRight,
    Users,
    Maximize2
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
    const [isPhotoZoomed, setIsPhotoZoomed] = useState(false);

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
            const cleanQuery = query.replace(/\D/g, '');
            const isCpfLookup = cleanQuery.length === 11;

            if (query.length < 3 && !isCpfLookup) { setResults([]); return; }
            setLoading(true);

            try {
                // If it looks like a CPF, try identifying guardian first
                if (isCpfLookup) {
                    const { data: guardians } = await supabase
                        .from('responsaveis')
                        .select('id, nome_completo, foto_url')
                        .eq('cpf', cleanQuery);

                    if (guardians && guardians.length > 0) {
                        const guardianIds = guardians.map((g: any) => g.id);
                        await resolveByMultipleIds(guardianIds, guardians[0].nome_completo, guardians[0]);
                        setLoading(false);
                        return;
                    }
                }

                // Regular search logic
                // Sanitize: escape special ilike characters to prevent injection
                const safeQuery = query.trim().replace(/[%_\\]/g, '\\$&').slice(0, 100);
                const { data: directStudents } = await supabase
                    .from('alunos').select('*').ilike('nome_completo', `%${safeQuery}%`).limit(5);

                const { data: auths } = await supabase
                    .from('autorizacoes')
                    .select('alunos:aluno_id (*)')
                    .or(`nome_completo.ilike.%${safeQuery}%,cpf.ilike.%${safeQuery}%`, { foreignTable: 'responsaveis' })
                    .eq('ativa', true).limit(10);

                let combined: Student[] = directStudents || [];
                auths?.forEach((a: any) => {
                    const student = Array.isArray(a.alunos) ? a.alunos[0] : a.alunos;
                    if (student && !combined.some(s => s.id === student.id)) combined.push(student);
                });

                setResults(combined.slice(0, 8));
            } catch (err) {
                console.error('Search error:', err);
            } finally {
                setLoading(false);
            }
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
            const requests = studentIds.map(id => {
                // Security check for related students
                if (relatedStudents.length > 0 && !relatedStudents.some(s => s.id === id)) {
                    throw new Error('Falha de segurança: Tentativa de retirar aluno não vinculado ao grupo.');
                }

                return {
                    escola_id: userProfile?.escola_id || 'e6328325-1845-420a-b333-87a747953259',
                    aluno_id: id,
                    responsavel_id: selectedGuardianId || null,
                    recepcionista_id: user.id,
                    status: 'SOLICITADO',
                    tipo_solicitacao: 'RECEPCAO',
                    // Guardian is physically present at reception — mark as arrived immediately
                    status_geofence: 'CHEGOU'
                };
            });

            const { error } = await supabase
                .from('solicitacoes_retirada')
                .insert(requests);

            if (error) throw error;

            // Log individual audit events for each student requested (consistent with Totem)
            const selectedGuardianLocal = guardians.find(g => g.id === selectedGuardianId);
            const guardianName = selectedGuardianLocal?.nome_completo;

            for (const id of studentIds) {
                const student = relatedStudents.find(s => s.id === id) || (selectedStudent?.id === id ? selectedStudent : null);
                await logAudit('SOLICITACAO_RETIRADA', 'solicitacoes_retirada', undefined, {
                    aluno_nome: student?.nome_completo,
                    aluno_id: id,
                    responsavel_nome: guardianName,
                    responsavel_id: selectedGuardianId,
                    tipo: 'RECEPCAO'
                }, undefined, userProfile?.escola_id || undefined);
            }

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

    // New robust logic: resolve students linked to MULTIPLE responsavel IDs (e.g. same CPF duplicate records)
    const resolveByMultipleIds = async (responsavelIds: string[], guardianName?: string, primaryGuardian?: any) => {
        // Step 1: collect aluno_ids from both link tables for ALL responsavel IDs
        const [authsRes, junctionRes] = await Promise.all([
            supabase.from('autorizacoes').select('aluno_id').in('responsavel_id', responsavelIds).eq('ativa', true),
            supabase.from('alunos_responsaveis').select('aluno_id').in('responsavel_id', responsavelIds)
        ]);

        const alunoIds = new Set<string>([
            ...(authsRes.data?.map((a: any) => a.aluno_id) || []),
            ...(junctionRes.data?.map((j: any) => j.aluno_id) || [])
        ]);

        if (alunoIds.size === 0) throw new Error('Nenhum aluno vinculado a este responsável.');

        // Step 2: fetch full student records
        const { data: alunosData } = await supabase
            .from('alunos')
            .select('*')
            .in('id', Array.from(alunoIds));

        if (!alunosData || alunosData.length === 0) throw new Error('Nenhum aluno vinculado.');

        // Fetch primary guardian info if not provided
        let guard = primaryGuardian;
        if (!guard) {
            const { data } = await supabase
                .from('responsaveis')
                .select('id, nome_completo, foto_url')
                .eq('id', responsavelIds[0])
                .single();
            guard = data;
        }

        if (guard) {
            setGuardians([{
                id: guard.id,
                nome_completo: guard.nome_completo,
                foto_url: guard.foto_url,
                parentesco: 'Responsável'
            }]);
        }

        setSelectedGuardianId(guard?.id || responsavelIds[0]);
        setRelatedStudents(alunosData);
        setSelectedStudentIds(new Set(alunosData.map(s => s.id)));
        setResults([]);
        setQuery('');

        if (guardianName || guard?.nome_completo) {
            toast.success('Responsável identificado', guardianName || guard?.nome_completo);
        }
    };

    // Keep compatibility for single ID calls (Code, QR, etc.)
    const resolveByResponsavelId = async (responsavelId: string, guardianName?: string) => {
        // Fetch guardian to check for same-CPF duplicates
        const { data: guardian } = await supabase
            .from('responsaveis')
            .select('id, cpf, nome_completo, foto_url')
            .eq('id', responsavelId)
            .single();

        let responsavelIds = [responsavelId];
        if (guardian?.cpf) {
            const cleanCpf = guardian.cpf.replace(/\D/g, '');
            const { data: sames } = await supabase
                .from('responsaveis')
                .select('id')
                .eq('cpf', cleanCpf);
            if (sames) responsavelIds = [...new Set([responsavelId, ...sames.map((s: any) => s.id)])];
        }

        await resolveByMultipleIds(responsavelIds, guardianName || guardian?.nome_completo, guardian);
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
        <div className="min-h-screen bg-[#020617] text-slate-200 flex flex-col font-sans selection:bg-emerald-500/30 overflow-hidden relative">
            {/* Ultra-Premium Ambient Background */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/5 blur-[120px] rounded-full animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 blur-[120px] rounded-full animate-pulse-slow" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] pointer-events-none" />

                {/* HUD Grid Overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
            </div>

            {/* Header */}
            <header className="px-6 md:px-10 py-5 border-b border-white/10 flex flex-col md:flex-row items-center justify-between sticky top-0 bg-[#020617]/80 backdrop-blur-3xl z-[60] no-print gap-6 shadow-2xl">
                <div className="flex items-center gap-6">
                    <NavigationControls />
                    <div className="h-10 w-px bg-white/10 hidden md:block" />
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl md:text-2xl font-black tracking-tighter text-white italic">RECEPÇÃO <span className="text-emerald-500">SISRA</span></h1>
                            <div className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[8px] font-black text-emerald-500 tracking-tighter uppercase">V{__APP_VERSION__}</div>
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                            Hub de Identificação
                        </p>
                    </div>
                </div>

                {/* Advanced Monitoring HUD */}
                <div className="hidden lg:flex items-center gap-8 bg-white/[0.03] border border-white/10 px-8 py-3 rounded-2xl backdrop-blur-md">
                    <div className="flex flex-col items-center">
                        <span className="text-[9px] font-black text-emerald-500/60 uppercase tracking-widest mb-1">Carga da Fila</span>
                        <div className="flex items-center gap-2">
                            <div className="flex gap-0.5">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className={`w-1.5 h-3 rounded-full ${i <= 2 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-white/10'}`}></div>
                                ))}
                            </div>
                            <span className="text-xs font-black text-white italic">NORMAL</span>
                        </div>
                    </div>
                    <div className="w-px h-8 bg-white/10" />
                    <div className="flex flex-col items-center">
                        <span className="text-[9px] font-black text-blue-500/60 uppercase tracking-widest mb-1">Saúde do Sistema</span>
                        <div className="flex items-center gap-2">
                            <Activity className="w-3 h-3 text-blue-400" />
                            <span className="text-xs font-black text-white italic">NOMINAL</span>
                        </div>
                    </div>
                    <div className="w-px h-8 bg-white/10" />
                    <div className="flex flex-col items-center text-right">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Usuário Ativo</span>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-white uppercase italic">{userProfile?.nome_completo?.split(' ')[0] || 'Operador'}</span>
                            <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                                <UserIcon className="w-3 h-3 text-emerald-500" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                        onClick={() => setIsCodeModalOpen(true)}
                        className="flex-1 md:flex-none bg-violet-600 hover:bg-violet-500 text-white h-12 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 font-black text-xs uppercase tracking-widest shadow-[0_10px_30px_rgba(124,58,237,0.3)] group"
                    >
                        <Hash className="w-5 h-5 group-hover:rotate-12 transition-transform" /> CÓDIGO
                    </button>
                    <button
                        onClick={() => setIsScannerOpen(true)}
                        className="flex-1 md:flex-none bg-emerald-500 hover:bg-emerald-400 text-[#020617] h-12 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 font-black text-xs uppercase tracking-widest shadow-[0_10px_30px_rgba(16,185,129,0.3)] group"
                    >
                        <QrCode className="w-5 h-5 group-hover:scale-110 transition-transform" /> ESCANEAR QR
                    </button>
                    <div className="w-px h-8 bg-white/10 mx-1 hidden md:block" />
                    <button onClick={handleLogout} className="p-3 bg-white/5 hover:bg-rose-500/20 text-white hover:text-rose-500 rounded-2xl transition-all border border-white/5 hover:border-rose-500/30 flex-none group">
                        <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    </button>
                </div>
            </header>

            <main className="flex-1 p-6 md:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative z-10 overflow-y-auto custom-scrollbar">
                {/* Search Column */}
                <div className="lg:col-span-8 space-y-8 h-full">
                    <section className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-3xl shadow-2xl relative overflow-hidden group/card">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover/card:bg-emerald-500/10 transition-colors"></div>

                        <div className="flex flex-col gap-8 relative z-10">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <h2 className="text-xl font-black italic tracking-tighter text-white uppercase flex items-center gap-3">
                                        <div className="w-1.5 h-6 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                                        Pesquisar Estudante
                                    </h2>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-5">Busca inteligente por Nome, RA ou Turma</p>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Busca Ativa</span>
                                </div>
                            </div>

                            <div className="relative group/input">
                                <div className="absolute inset-0 bg-emerald-500/5 blur-2xl rounded-3xl opacity-0 group-focus-within/input:opacity-100 transition-opacity"></div>
                                <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-500 group-focus-within/input:text-emerald-500 transition-all scale-100 group-focus-within/input:scale-110" />
                                <input
                                    type="text"
                                    placeholder="Digite CPF, nome, RA ou turma..."
                                    className="w-full bg-[#020617]/50 border-2 border-white/5 rounded-[1.5rem] py-6 pl-16 pr-8 text-xl font-bold text-white focus:border-emerald-500/50 focus:ring-0 transition-all placeholder:text-slate-600 backdrop-blur-xl"
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                />
                                {loading && (
                                    <div className="absolute right-6 top-1/2 -translate-y-1/2">
                                        <div className="animate-spin w-6 h-6 border-3 border-emerald-500 border-t-transparent rounded-full" />
                                    </div>
                                )}
                            </div>

                            {/* Dropdown Results */}
                            {results.length > 0 && !selectedStudent && (
                                <div className="bg-[#020617]/90 border border-white/10 rounded-[1.5rem] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.5)] mt-2 animate-in fade-in slide-in-from-top-4 duration-300">
                                    {results.map(student => (
                                        <button
                                            key={student.id}
                                            onClick={() => handleSelectStudent(student)}
                                            className="w-full text-left p-5 hover:bg-emerald-500/10 flex items-center gap-6 border-b border-white/5 last:border-0 transition-all group"
                                        >
                                            <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-white/10 group-hover:border-emerald-500/50 transition-all shadow-lg">
                                                {student.foto_url ? (
                                                    <img src={student.foto_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-slate-800">
                                                        <UserIcon className="w-8 h-8 text-slate-600" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-lg font-black text-white uppercase italic tracking-tight group-hover:text-emerald-400 transition-colors leading-none mb-1">{student.nome_completo}</p>
                                                <div className="flex items-center gap-3">
                                                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{student.turma}</p>
                                                    <div className="w-1 h-1 bg-white/20 rounded-full"></div>
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">SALA {student.sala}</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-slate-700 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Student Spotlight / Multi-Student View */}
                    <div className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] overflow-hidden backdrop-blur-3xl shadow-2xl relative group/spotlight">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.02] to-transparent pointer-events-none"></div>

                        {(selectedStudent || relatedStudents.length > 0) ? (
                            <div className="animate-in fade-in zoom-in-95 duration-700 relative z-10">
                                <div className="p-8 md:p-12 flex flex-col gap-10">
                                    {/* Header Info */}
                                    <div className="flex flex-col md:flex-row gap-10 items-center md:items-start text-center md:text-left">
                                        <div className="relative group shrink-0">
                                            {/* Advanced Photo Ring */}
                                            <div className="absolute -inset-4 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                                            <div className="relative w-44 h-44 rounded-[2.5rem] overflow-hidden border-4 border-white/10 group-hover:border-emerald-500/50 transition-all duration-500 shadow-2xl bg-[#020617]">
                                                {relatedStudents.length > 0 ? (
                                                    selectedGuardian?.foto_url ? (
                                                        <div className="relative w-full h-full group/photo">
                                                            <img src={selectedGuardian.foto_url} alt="" className="w-full h-full object-cover" />
                                                            <button
                                                                onClick={() => setIsPhotoZoomed(true)}
                                                                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity"
                                                            >
                                                                <Maximize2 className="w-8 h-8 text-white" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center">
                                                            <Users className="w-16 h-16 text-white/50" />
                                                        </div>
                                                    )
                                                ) : selectedStudent?.foto_url ? (
                                                    <div className="relative w-full h-full group/photo">
                                                        <img src={selectedStudent.foto_url} alt="" className="w-full h-full object-cover" />
                                                        <button
                                                            onClick={() => setIsPhotoZoomed(true)}
                                                            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity"
                                                        >
                                                            <Maximize2 className="w-8 h-8 text-white" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-slate-900">
                                                        <UserIcon className="w-20 h-20 text-slate-700" />
                                                    </div>
                                                )}

                                                {/* Scanning Line Effect */}
                                                <div className="absolute inset-x-0 h-1 bg-emerald-500/40 blur-sm animate-scan pointer-events-none"></div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setSelectedStudent(null);
                                                    setRelatedStudents([]);
                                                    setSelectedGuardianId(null);
                                                    setSelectedStudentIds(new Set());
                                                }}
                                                className="absolute -top-3 -right-3 w-12 h-12 bg-rose-500/90 text-white rounded-2xl flex items-center justify-center shadow-2xl hover:bg-rose-600 transition-all active:scale-90 z-20 backdrop-blur-lg border border-white/10"
                                            >
                                                <X className="w-6 h-6" />
                                            </button>
                                        </div>

                                        <div className="flex-1 space-y-5 pt-2">
                                            {relatedStudents.length > 0 ? (
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-center md:justify-start gap-3">
                                                        <span className="px-4 py-1.5 bg-indigo-500/10 text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-indigo-500/30 backdrop-blur-md">Vínculo Familiar Detectado</span>
                                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                                                            <div className="w-1 h-1 bg-indigo-500 rounded-full animate-pulse"></div>
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{relatedStudents.length} Estudantes</span>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <h2 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter leading-[0.9] uppercase">
                                                            {selectedGuardian ? (
                                                                <>
                                                                    {selectedGuardian.nome_completo.split(' ')[0]} <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">{selectedGuardian.nome_completo.split(' ').slice(1).join(' ')}</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    Grupo <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">Familiar</span>
                                                                </>
                                                            )}
                                                        </h2>
                                                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest pl-1">
                                                            {selectedGuardian ? 'Responsável Autorizado identificado' : 'Selecione os membros para liberação imediata.'}
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : selectedStudent && (
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-center md:justify-start gap-4">
                                                        <span className="px-4 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-emerald-500/30 backdrop-blur-md">Aluno Identificado</span>
                                                        <div className="w-px h-4 bg-white/10"></div>
                                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                                                            <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></div>
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">RA: {selectedStudent.matricula || '---'}</span>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <h2 className="text-5xl md:text-6xl font-black text-white italic tracking-tighter leading-none uppercase">{selectedStudent.nome_completo}</h2>
                                                        <div className="flex items-center justify-center md:justify-start gap-3 text-emerald-500 font-black uppercase tracking-[0.3em] text-xs pl-1">
                                                            <span>{selectedStudent.turma}</span>
                                                            <div className="w-1.5 h-1.5 bg-white/20 rounded-full"></div>
                                                            <span>SALA {selectedStudent.sala}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Interaction Area */}
                                    <div className="space-y-8">
                                        {relatedStudents.length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[320px] overflow-y-auto pr-3 custom-scrollbar">
                                                {relatedStudents.map(student => {
                                                    const isSelected = selectedStudentIds.has(student.id);
                                                    return (
                                                        <button
                                                            key={student.id}
                                                            onClick={() => toggleStudentSelection(student.id)}
                                                            className={`flex items-center gap-5 p-5 rounded-[1.5rem] border-2 transition-all duration-500 text-left group/btn relative overflow-hidden ${isSelected
                                                                ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_15px_30px_rgba(16,185,129,0.2)] scale-[1.02] z-10'
                                                                : 'bg-[#020617]/40 border-white/5 hover:border-white/20 hover:bg-[#020617]/60'
                                                                }`}
                                                        >
                                                            <div className={`w-14 h-14 rounded-2xl overflow-hidden border-2 shrink-0 transition-all duration-500 ${isSelected ? 'border-emerald-400 rotate-3' : 'border-white/10'}`}>
                                                                {student.foto_url ? (
                                                                    <img src={student.foto_url} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-700">
                                                                        <UserIcon className="w-7 h-7" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className={`font-black uppercase text-sm truncate tracking-tight mb-1 transition-colors ${isSelected ? 'text-white' : 'text-white/70'}`}>
                                                                    {student.nome_completo}
                                                                </p>
                                                                <div className="flex items-center gap-2">
                                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">
                                                                        {student.turma}
                                                                    </p>
                                                                    <div className="w-1 h-1 bg-white/10 rounded-full"></div>
                                                                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">SALA {student.sala}</p>
                                                                </div>
                                                            </div>
                                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border-2 transition-all duration-500 ${isSelected ? 'bg-emerald-500 border-emerald-400 text-slate-950 scale-110' : 'border-white/10 text-transparent'}`}>
                                                                <CheckCircle2 className="w-5 h-5 shadow-2xl" />
                                                            </div>

                                                            {/* Selected Gradient Overlay */}
                                                            {isSelected && <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent pointer-events-none animate-shimmer"></div>}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ) : selectedStudent && (
                                            <div className="space-y-6">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 flex items-center gap-3">
                                                        <Activity className="w-3.5 h-3.5 text-emerald-500" /> Responsáveis Autorizados
                                                    </h3>
                                                    <div className="h-px flex-1 bg-white/5 ml-4"></div>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    {guardians.map(guardian => {
                                                        const isSelected = guardian.id === selectedGuardianId;
                                                        return (
                                                            <button
                                                                key={guardian.id}
                                                                onClick={() => setSelectedGuardianId(isSelected ? null : guardian.id)}
                                                                className={`flex items-center gap-5 p-5 rounded-[1.5rem] border-2 transition-all duration-500 text-left w-full group/guard relative overflow-hidden backdrop-blur-xl ${isSelected
                                                                    ? 'bg-indigo-500/10 border-indigo-500 shadow-[0_15px_30px_rgba(99,102,241,0.2)] scale-[1.02] z-10'
                                                                    : 'bg-[#020617]/40 border-white/5 hover:border-white/20 hover:bg-[#020617]/60'
                                                                    }`}
                                                            >
                                                                <div className={`w-14 h-14 rounded-2xl overflow-hidden border-2 shrink-0 transition-all duration-500 ${isSelected ? 'border-indigo-400 -rotate-3' : 'border-white/10'}`}>
                                                                    {guardian.foto_url ? (
                                                                        <img src={guardian.foto_url} alt="" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center bg-slate-900 border border-white/5">
                                                                            <UserIcon className="w-7 h-7 text-slate-700" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 overflow-hidden">
                                                                    <p className={`font-black uppercase text-sm truncate tracking-tight mb-1 transition-colors ${isSelected ? 'text-white' : 'text-white/70'}`}>
                                                                        {guardian.nome_completo}
                                                                    </p>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${isSelected ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400' : 'bg-white/5 border-white/10 text-slate-500'}`}>
                                                                            {guardian.parentesco || 'AUTORIZADO'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border-2 transition-all duration-500 ${isSelected ? 'bg-indigo-500 border-indigo-400 text-white scale-110' : 'border-white/10 text-transparent'}`}>
                                                                    <CheckCircle2 className="w-5 h-5 shadow-2xl" />
                                                                </div>

                                                                {/* Selected Shimmer */}
                                                                {isSelected && <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-transparent pointer-events-none animate-shimmer"></div>}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Status Feedback / Multi-Student Info */}
                                    <div className="relative">
                                        {relatedStudents.length > 0 ? (
                                            <div className={`flex items-center gap-4 px-6 py-4 rounded-[1.2rem] border-2 transition-all duration-500 backdrop-blur-2xl ${selectedStudentIds.size > 0
                                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_10px_20px_rgba(16,185,129,0.1)]'
                                                : 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-[0_10px_20px_rgba(244,63,94,0.1)]'}`}>
                                                {selectedStudentIds.size > 0 ? (
                                                    <>
                                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/40">
                                                            <CheckCircle2 className="w-6 h-6 animate-pulse" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-sm font-black italic uppercase tracking-tight">Pronto para a chamada</p>
                                                            <p className="text-[10px] font-bold text-emerald-500/60 uppercase tracking-widest">{selectedStudentIds.size} {selectedStudentIds.size === 1 ? 'estudante selecionado' : 'estudantes selecionados'}</p>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center border border-rose-500/40">
                                                            <AlertCircle className="w-6 h-6 animate-pulse" />
                                                        </div>
                                                        <p className="text-sm font-black italic uppercase tracking-tight">Selecione ao menos um aluno para prosseguir</p>
                                                    </>
                                                )}
                                            </div>
                                        ) : selectedStudent && (
                                            <div className={`flex items-center gap-4 px-6 py-4 rounded-[1.2rem] border-2 transition-all duration-500 backdrop-blur-2xl ${selectedGuardianId
                                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_10px_20px_rgba(16,185,129,0.1)]'
                                                : 'bg-amber-500/10 border-amber-500/30 text-amber-500 shadow-[0_10px_20px_rgba(245,158,11,0.1)]'}`}>
                                                {selectedGuardianId ? (
                                                    <>
                                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/40">
                                                            <CheckCircle2 className="w-6 h-6" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-sm font-black italic uppercase tracking-tight">Responsável Validado</p>
                                                            <p className="text-[10px] font-bold text-white uppercase tracking-widest">{selectedGuardian?.nome_completo}</p>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/40">
                                                            <UserIcon className="w-6 h-6 animate-pulse" />
                                                        </div>
                                                        <p className="text-sm font-black italic uppercase tracking-tight">Selecione o responsável presente na recepção</p>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Call Button Area */}
                                <div className="p-8 md:p-10 bg-[#020617]/60 border-t border-white/10 backdrop-blur-3xl overflow-hidden relative">
                                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"></div>
                                    <button
                                        onClick={handleCallStudents}
                                        disabled={sending || (relatedStudents.length > 0 ? selectedStudentIds.size === 0 : !selectedGuardianId)}
                                        className="w-full group relative py-8 bg-emerald-500 text-[#020617] rounded-[1.5rem] font-black text-base uppercase tracking-[0.5em] transition-all duration-500 hover:scale-[1.01] active:scale-95 disabled:opacity-30 overflow-hidden shadow-[0_20px_40px_rgba(16,185,129,0.3)] flex items-center justify-center gap-6"
                                    >
                                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                                        {sending ? (
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 h-6 border-3 border-[#020617] border-t-transparent rounded-full animate-spin" />
                                                <span className="animate-pulse">PROCESSANDO...</span>
                                            </div>
                                        ) : (
                                            <>
                                                <Bell className="w-8 h-8 group-hover:rotate-12 transition-transform duration-500" />
                                                <span className="relative z-10">{relatedStudents.length > 0 ? (selectedStudentIds.size > 1 ? `CHAMAR ${selectedStudentIds.size} ALUNOS` : 'CHAMAR SELECIONADO') : 'CHAMAR AGORA'}</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-24 text-center relative overflow-hidden h-full min-h-[500px]">
                                {/* Decorative Orbitals (Empty State) */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-white/5 rounded-full animate-[spin_60s_linear_infinite]" />
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-white/[0.03] rounded-full animate-[spin_40s_linear_infinite_reverse]" />

                                <div className="relative mx-auto w-40 h-40 group mb-10">
                                    <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-3xl animate-pulse"></div>
                                    <div className="relative w-full h-full bg-[#020617] border-4 border-white/10 rounded-[2.5rem] flex flex-col items-center justify-center backdrop-blur-3xl shadow-2xl overflow-hidden ring-px ring-white/5 group-hover:border-emerald-500/30 transition-all duration-700">
                                        <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/5 to-transparent"></div>
                                        <UserIcon className="w-16 h-16 text-slate-700 group-hover:text-emerald-500 transition-all duration-700 group-hover:scale-110" />

                                        {/* Scanning Line */}
                                        <div className="absolute inset-x-0 h-4 bg-emerald-500/20 blur-xl animate-scan" />
                                    </div>
                                </div>

                                <div className="relative space-y-4 max-w-sm">
                                    <h3 className="text-4xl font-black italic tracking-tighter text-white uppercase leading-none">
                                        Identificação <br />
                                        <span className="text-emerald-500">Pendente</span>
                                    </h3>
                                    <div className="h-px w-20 bg-emerald-500/30 mx-auto"></div>
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em] leading-relaxed">
                                        Aguardando leitura de QR ou busca para vincular responsável e alunos. Seus portais estão sincronizados.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Queue */}
                <div className="lg:col-span-4 sticky top-32">
                    <WithdrawalQueue />
                </div>
            </main>

            <QRScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScan={handleQRScan} />
            {isCodeModalOpen && <CodeModal onConfirm={handleCodeLookup} onClose={() => setIsCodeModalOpen(false)} />}

            {/* Photo Zoom Modal */}
            {isPhotoZoomed && (selectedStudent?.foto_url || selectedGuardian?.foto_url) && (
                <div
                    className="fixed inset-0 z-[100] bg-[#020617]/95 backdrop-blur-2xl flex items-center justify-center p-6 animate-in fade-in duration-300"
                    onClick={() => setIsPhotoZoomed(false)}
                >
                    <div className="relative max-w-4xl w-full aspect-square rounded-[3rem] overflow-hidden border-8 border-white/10 shadow-[0_0_100px_rgba(16,185,129,0.2)]">
                        <img
                            src={(relatedStudents.length > 0 ? selectedGuardian?.foto_url : selectedStudent?.foto_url) || undefined}
                            alt=""
                            className="w-full h-full object-cover"
                        />
                        <button
                            onClick={() => setIsPhotoZoomed(false)}
                            className="absolute top-8 right-8 w-16 h-16 bg-white/10 hover:bg-rose-500 text-white rounded-3xl flex items-center justify-center backdrop-blur-xl border border-white/20 transition-all active:scale-90"
                        >
                            <X className="w-8 h-8" />
                        </button>
                        <div className="absolute bottom-10 left-10 right-10 flex items-center justify-between">
                            <div className="bg-black/40 backdrop-blur-xl px-8 py-4 rounded-2xl border border-white/10">
                                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] mb-1">Identificação SISRA</p>
                                <p className="text-2xl font-black text-white italic uppercase tracking-tighter">
                                    {relatedStudents.length > 0 ? selectedGuardian?.nome_completo : selectedStudent?.nome_completo}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
