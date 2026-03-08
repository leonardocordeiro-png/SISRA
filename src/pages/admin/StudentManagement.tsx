import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Plus, Search, Trash2, Edit2, User, Upload, Share2, Filter, X, CheckCircle2, Circle, AlertCircle, Loader2, ChevronDown, ArrowLeftRight, AlertTriangle, GraduationCap, LayoutGrid } from 'lucide-react';
import { generateToken, getSalaBySerie } from '../../lib/utils';
import { logAudit } from '../../lib/audit';
import NavigationControls from '../../components/NavigationControls';
import BulkImportModal from '../../components/admin/BulkImportModal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';

import type { Student } from '../../types';



export default function StudentManagement() {
    const navigate = useNavigate();
    const { escolaId } = useAuth();
    const toast = useToast();
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [filterTurma, setFilterTurma] = useState<string>('TODAS');
    const [filterSala, setFilterSala] = useState<string>('TODAS');
    const [availableTurmas, setAvailableTurmas] = useState<string[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    // Purge state
    const [showPurgeModal, setShowPurgeModal] = useState(false);
    const [purgeConfirmText, setPurgeConfirmText] = useState('');
    const [isPurging, setIsPurging] = useState(false);

    // Transfer (remanejamento) state
    const [transferStudent, setTransferStudent] = useState<Student | null>(null);
    const [turmasDisponiveis, setTurmasDisponiveis] = useState<{ serie: string; secao: string }[]>([]);
    const [transferForm, setTransferForm] = useState({ serie: '', turma: '' });
    const [isTransferring, setIsTransferring] = useState(false);

    useEffect(() => {
        fetchStudents();
        fetchTurmas();
        fetchTurmasCompletas();
    }, []);

    const fetchTurmas = async () => {
        const { data, error } = await supabase
            .from('turmas')
            .select('nome')
            .eq('ativa', true)
            .order('nome');

        if (!error && data) {
            const unique = Array.from(new Set(data.map(d => d.nome))).filter(Boolean);
            setAvailableTurmas(unique);
        }
    };

    const fetchStudents = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('alunos')
            .select('*')
            .order('nome_completo');

        if (!error && data) {
            setStudents(data);
        }

        setLoading(false);
    };

    const fetchTurmasCompletas = async () => {
        try {
            const { data, error } = await supabase
                .from('turmas')
                .select('nome')
                .eq('ativa', true)
                .order('nome');

            if (error) throw error;

            if (data) {
                const parsed = data.map(t => {
                    const match = t.nome.match(/^(.*?) - (.*?) \((.*?)\)$/);
                    if (match) {
                        return { serie: `${match[1]} - ${match[2]}`, secao: match[3] };
                    }
                    return null;
                }).filter(Boolean) as { serie: string; secao: string }[];

                setTurmasDisponiveis(parsed);
            }
        } catch (err) {
            console.error('Erro ao buscar turmas:', err);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este aluno? Esta ação não pode ser desfeita e removerá todo o histórico.')) return;

        try {
            setIsDeleting(true);
            // Deep Delete Sequence
            await supabase.from('tokens_acesso').delete().eq('aluno_id', id);
            await supabase.from('autorizacoes').delete().eq('aluno_id', id);
            await supabase.from('alunos_responsaveis').delete().eq('aluno_id', id);
            await supabase.from('solicitacoes_retirada').delete().eq('aluno_id', id);
            const student = students.find(s => s.id === id);
            const { error } = await supabase.from('alunos').delete().eq('id', id);

            if (error) throw error;

            await logAudit('EXCLUSAO_ESTUDANTE', 'alunos', id, {
                nome: student?.nome_completo,
                matricula: student?.matricula,
                turma: student?.turma
            });

            setStudents(prev => prev.filter(s => s.id !== id));
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });

            toast.success('Aluno removido', 'O registro e todo o histórico foram excluídos permanentemente.');
        } catch (error: any) {
            console.error('Error deleting student:', error);
            toast.error('Erro ao excluir', error.message);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleBulkDelete = async () => {
        const count = selectedIds.size;
        if (count === 0) return;

        if (!confirm(`Deseja excluir permanentemente os ${count} alunos selecionados? Esta ação é irreversível e limpará todos os registros relacionados.`)) return;

        try {
            setIsDeleting(true);
            const idsToDelete = Array.from(selectedIds);

            await supabase.from('tokens_acesso').delete().in('aluno_id', idsToDelete);
            await supabase.from('autorizacoes').delete().in('aluno_id', idsToDelete);
            await supabase.from('alunos_responsaveis').delete().in('aluno_id', idsToDelete);
            await supabase.from('solicitacoes_retirada').delete().in('aluno_id', idsToDelete);
            const { error } = await supabase.from('alunos').delete().in('id', idsToDelete);

            if (error) throw error;

            await logAudit('EXCLUSAO_ESTUDANTE_MASSA', 'alunos', undefined, {
                quantidade: count,
                ids: idsToDelete
            });

            toast.success(`${count} alunos excluídos`, 'Os registros foram removidos com sucesso.');
            setSelectedIds(new Set());
            fetchStudents();
        } catch (error: any) {
            console.error('Error in bulk delete:', error);
            toast.error('Erro na exclusão em massa', error.message);
        } finally {
            setIsDeleting(false);
        }
    };

    // ─── PURGE ALL ────────────────────────────────────────────────────────────
    const handlePurgeAll = async () => {
        if (purgeConfirmText !== 'LIMPAR') return;

        try {
            setIsPurging(true);

            // 1. Collect all student ids
            const { data: allStudents } = await supabase.from('alunos').select('id');
            const allStudentIds = (allStudents || []).map(s => s.id);

            // 2. Collect all responsavel ids
            const { data: allResponsaveis } = await supabase.from('responsaveis').select('id');
            const allResponsavelIds = (allResponsaveis || []).map(r => r.id);

            // 3. Delete in FK-safe order
            if (allResponsavelIds.length > 0) {
                await supabase.from('parent_qr_cards').delete().in('responsavel_id', allResponsavelIds);
            }
            if (allStudentIds.length > 0) {
                await supabase.from('tokens_acesso').delete().in('aluno_id', allStudentIds);
                await supabase.from('autorizacoes').delete().in('aluno_id', allStudentIds);
                await supabase.from('alunos_responsaveis').delete().in('aluno_id', allStudentIds);
                await supabase.from('solicitacoes_retirada').delete().in('aluno_id', allStudentIds);
            }

            // 4. Delete main records
            const { error: eAlunos } = await supabase.from('alunos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (eAlunos) throw eAlunos;

            const { error: eResp } = await supabase.from('responsaveis').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (eResp) throw eResp;

            await logAudit('LIMPEZA_REGISTROS', undefined, undefined, {
                alunos_removidos: allStudentIds.length,
                responsaveis_removidos: allResponsavelIds.length
            });

            setStudents([]);
            setSelectedIds(new Set());
            setShowPurgeModal(false);
            setPurgeConfirmText('');
            toast.success('Cadastro limpo', 'Todos os alunos e responsáveis foram removidos permanentemente. O sistema está pronto para nova importação.');
        } catch (err: any) {
            console.error('Purge error:', err);
            toast.error('Erro ao limpar', err.message);
        } finally {
            setIsPurging(false);
        }
    };

    // ─── TRANSFER (REMANEJAMENTO) ─────────────────────────────────────────────
    const handleOpenTransfer = (student: Student) => {
        setTransferStudent(student);
        setTransferForm({ serie: '', turma: '' });
    };

    const handleTransfer = async () => {
        if (!transferStudent || !transferForm.serie || !transferForm.turma) return;

        setIsTransferring(true);
        try {
            // Build full turma string matching what StudentRegistration produces
            const novaTurma = `${transferForm.serie} (${transferForm.turma})`;
            const novaSala = getSalaBySerie(transferForm.serie, transferForm.turma);

            const { error } = await supabase
                .from('alunos')
                .update({ turma: novaTurma, sala: novaSala })
                .eq('id', transferStudent.id);

            if (error) throw error;

            await logAudit('REMANEJAMENTO_TURMA', 'alunos', transferStudent.id, {
                nome: transferStudent.nome_completo,
                turma_anterior: transferStudent.turma,
                turma_nova: novaTurma,
                sala_nova: novaSala
            });

            setStudents(prev =>
                prev.map(s => s.id === transferStudent.id ? { ...s, turma: novaTurma, sala: novaSala } : s)
            );
            toast.success('Aluno remanejado', `${transferStudent.nome_completo} foi movido para ${novaTurma}.`);
            setTransferStudent(null);
        } catch (err: any) {
            toast.error('Erro no remanejamento', err.message);
        } finally {
            setIsTransferring(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredStudents.length && filteredStudents.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredStudents.map(s => s.id)));
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleGenerateLink = async (studentId: string, studentName: string) => {
        try {
            const token = generateToken(8);
            const { error } = await supabase
                .from('tokens_acesso')
                .insert({
                    token: token,
                    aluno_id: studentId,
                    expira_em: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
                });

            if (error) throw error;

            await logAudit('GERACAO_LINK_ACESSO', 'tokens_acesso', undefined, {
                aluno_id: studentId,
                aluno_nome: studentName,
                token: token
            });

            const url = `${window.location.origin}/parent/cadastro/${token}`;
            await navigator.clipboard.writeText(url);
            toast.success(`Link Mágico gerado para ${studentName}!`, 'Link copiado para a área de transferência. Envie para o responsável via WhatsApp.');
        } catch (err: any) {
            console.error('Error generating magic link:', err);
            toast.error('Erro ao gerar link', err.message);
        }
    };

    const handleEditInWizard = async (student: Student) => {
        setLoading(true);
        try {
            // 1. Fetch authorized guardians
            const { data: auths, error: authError } = await supabase
                .from('autorizacoes')
                .select(`
                    id, 
                    parentesco,
                    responsaveis (*)
                `)
                .eq('aluno_id', student.id);

            if (authError) throw authError;

            const mappedGuardians = (auths || []).map((a: any) => {
                const r = Array.isArray(a.responsaveis) ? a.responsaveis[0] : a.responsaveis;
                return {
                    id: r?.id,
                    nome_completo: r?.nome_completo || '',
                    cpf: r?.cpf || '',
                    telefone: r?.telefone || '',
                    parentesco: a.parentesco || 'Responsável',
                    foto_url: r?.foto_url || ''
                };
            });

            // 2. Fetch full student details for observations and photo
            const { data: fullStudent, error: studentError } = await supabase
                .from('alunos')
                .select('*')
                .eq('id', student.id)
                .single();

            if (studentError) throw studentError;

            const fullTurma = fullStudent.turma || '';

            const tempStudentData = {
                nome_completo: fullStudent.nome_completo,
                data_nascimento: fullStudent.data_nascimento || '',
                matricula: fullStudent.matricula,
                fullTurma: fullTurma,
                serie: '',
                turma: '',
                sala: fullStudent.sala,
                photo: fullStudent.foto_url,
                observacoes_medicas: fullStudent.observacoes
            };

            sessionStorage.setItem('temp_student_data', JSON.stringify(tempStudentData));
            sessionStorage.setItem('temp_guardians_data', JSON.stringify(mappedGuardians));
            sessionStorage.setItem('edit_mode_student_id', student.id);

            navigate('/admin/alunos/novo');
        } catch (err) {
            console.error('Error loading student details:', err);
            toast.error('Erro ao carregar', 'Não foi possível carregar detalhes do aluno para edição.');
        } finally {
            setLoading(false);
        }
    };


    const filteredStudents = students.filter(s => {
        const matchesSearch = s.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.matricula?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTurma = filterTurma === 'TODAS' || s.turma === filterTurma;
        const matchesSala = filterSala === 'TODAS' || s.sala === filterSala;

        return matchesSearch && matchesTurma && matchesSala;
    });

    // Transfer modal derived values
    const seriesUnicas = Array.from(new Set(turmasDisponiveis.map(t => t.serie)));
    const secoesParaTransfer = transferForm.serie
        ? turmasDisponiveis.filter(t => t.serie === transferForm.serie).map(t => t.secao)
        : [];

    return (
        <div className="p-4 md:p-8">
            <NavigationControls />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-slate-900">Gerenciar Alunos</h1>
                    <p className="text-sm md:text-base text-slate-500">Cadastre e edite informações dos alunos</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto flex-wrap">
                    {/* Purge Button */}
                    <button
                        onClick={() => { setShowPurgeModal(true); setPurgeConfirmText(''); }}
                        className="flex-1 sm:flex-none bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-600 px-4 py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors text-sm"
                        title="Excluir todos os alunos e responsáveis permanentemente"
                    >
                        <AlertTriangle className="w-4 h-4" /> Limpar Cadastro
                    </button>
                    <button
                        onClick={() => setShowBulkModal(true)}
                        className="flex-1 sm:flex-none bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors"
                    >
                        <Upload className="w-5 h-5" /> Importar
                    </button>
                    <button
                        onClick={() => navigate('/admin/alunos/novo')}
                        className="flex-1 sm:flex-none bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors"
                    >
                        <Plus className="w-5 h-5" /> Novo Aluno
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-20">
                <div className="p-4 bg-white">
                    <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                        <div className="relative w-full lg:max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Nome ou Matrícula..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 outline-none transition-all placeholder:text-slate-400 font-medium"
                            />
                        </div>

                        <div className="flex items-center gap-2 w-full lg:w-auto">
                            {selectedIds.size > 0 && (
                                <button
                                    onClick={handleBulkDelete}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 transition-all animate-in zoom-in-95"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    <span>Excluir ({selectedIds.size})</span>
                                </button>
                            )}

                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${showFilters || filterTurma !== 'TODAS' || filterSala !== 'TODAS'
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/10'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                    }`}
                            >
                                <Filter className="w-4 h-4" />
                                <span>Filtros Avançados</span>
                                {(filterTurma !== 'TODAS' || filterSala !== 'TODAS') && (
                                    <span className="ml-1 w-5 h-5 bg-white text-slate-900 rounded-full flex items-center justify-center text-[10px]">
                                        {(filterTurma !== 'TODAS' ? 1 : 0) + (filterSala !== 'TODAS' ? 1 : 0)}
                                    </span>
                                )}
                            </button>

                            {(searchTerm || filterTurma !== 'TODAS' || filterSala !== 'TODAS') && (
                                <button
                                    onClick={() => {
                                        setSearchTerm('');
                                        setFilterTurma('TODAS');
                                        setFilterSala('TODAS');
                                    }}
                                    className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                    title="Limpar filtros"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {showFilters && (
                        <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-wrap gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Turma</label>
                                <div className="relative">
                                    <select
                                        value={filterTurma}
                                        onChange={(e) => setFilterTurma(e.target.value)}
                                        className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-slate-900/5 pr-10"
                                    >
                                        <option value="TODAS">Todas as Turmas</option>
                                        {availableTurmas.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Sala</label>
                                <div className="relative">
                                    <select
                                        value={filterSala}
                                        onChange={(e) => setFilterSala(e.target.value)}
                                        className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-slate-900/5 pr-10"
                                    >
                                        <option value="TODAS">Todas as Salas</option>
                                        <option value="Sala 101">Sala 101</option>
                                        <option value="Sala 102">Sala 102</option>
                                        <option value="Sala 103">Sala 103</option>
                                        <option value="Sala 104">Sala 104</option>
                                        <option value="Sala 109">Sala 109</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Table for Tablet and Desktop */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left font-sans text-sm text-slate-600">
                        <thead className="bg-slate-50/50 text-slate-400 font-bold border-b border-slate-200 uppercase text-[10px] tracking-widest">
                            <tr>
                                <th className="px-4 py-4 w-[50px] min-w-[50px] text-center">
                                    <button
                                        onClick={toggleSelectAll}
                                        className="mx-auto p-2 hover:bg-slate-200 rounded-lg transition-all flex items-center justify-center active:scale-90"
                                        title="Selecionar Todos"
                                    >
                                        {selectedIds.size === filteredStudents.length && filteredStudents.length > 0 ? (
                                            <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                                        ) : (
                                            <Circle className="w-5 h-5 text-slate-300 shrink-0" />
                                        )}
                                    </button>
                                </th>
                                <th className="px-6 py-4 text-left">Nome Completo</th>
                                <th className="py-4 text-center">Matrícula</th>
                                <th className="py-4 text-center">Turma</th>
                                <th className="py-4 text-center">Sala</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400 font-medium">Carregando alunos...</td>
                                </tr>
                            ) : filteredStudents.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400 font-medium">Nenhum aluno encontrado.</td>
                                </tr>
                            ) : (
                                filteredStudents.map((student) => {
                                    const isSelected = selectedIds.has(student.id);
                                    return (
                                        <tr key={student.id} className={`hover:bg-slate-50 transition-colors group ${isSelected ? 'bg-slate-50' : ''}`}>
                                            <td className={`px-4 py-4 w-[50px] min-w-[50px] text-center transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleSelect(student.id);
                                                    }}
                                                    className="relative z-10 mx-auto p-2 hover:bg-white rounded-lg transition-all flex items-center justify-center shadow-sm border border-transparent active:scale-75"
                                                >
                                                    {isSelected ? (
                                                        <CheckCircle2 className="w-6 h-6 text-blue-600 shrink-0" />
                                                    ) : (
                                                        <Circle className="w-6 h-6 text-slate-200 group-hover:text-slate-400 shrink-0" />
                                                    )}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-slate-900">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 border border-slate-200 group-hover:bg-white group-hover:scale-105 group-hover:shadow-md transition-all shrink-0">
                                                        <User className="w-5 h-5" />
                                                    </div>
                                                    <span className="truncate max-w-[200px] lg:max-w-xs">{student.nome_completo}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-tighter">
                                                    {student.matricula}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-[10px] font-black border border-emerald-100/50 uppercase tracking-tight">
                                                    {student.turma}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-center font-black text-slate-400 text-[10px]">
                                                {student.sala && (
                                                    <span className="border border-slate-200 px-2 py-1 rounded bg-white shadow-sm">
                                                        {student.sala}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                                    {/* Transfer button */}
                                                    <button
                                                        onClick={() => handleOpenTransfer(student)}
                                                        className="p-2.5 hover:bg-indigo-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-all active:scale-90"
                                                        title="Remanejamento de Turma"
                                                    >
                                                        <ArrowLeftRight className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleGenerateLink(student.id, student.nome_completo)}
                                                        className="p-2.5 hover:bg-blue-50 rounded-xl text-slate-400 hover:text-blue-600 transition-all active:scale-90"
                                                        title="WhatsApp Invite"
                                                    >
                                                        <Share2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleEditInWizard(student)}
                                                        className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-900 transition-all active:scale-90"
                                                        title="Editar"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(student.id)}
                                                        className="p-2.5 hover:bg-rose-50 rounded-xl text-slate-400 hover:text-rose-600 transition-all active:scale-90"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Card view for Mobile */}
                <div className="md:hidden divide-y divide-slate-100">
                    {loading ? (
                        <div className="p-8 text-center text-slate-400 font-medium flex flex-col items-center gap-4">
                            <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
                            <span>Carregando alunos...</span>
                        </div>
                    ) : filteredStudents.length === 0 ? (
                        <div className="p-12 text-center text-slate-400 font-medium">
                            <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-10" />
                            <p>Nenhum aluno encontrado.</p>
                        </div>
                    ) : (
                        filteredStudents.map((student) => {
                            const isSelected = selectedIds.has(student.id);
                            return (
                                <div key={student.id} className={`p-4 flex flex-col gap-4 hover:bg-slate-50/50 transition-colors ${isSelected ? 'bg-slate-50 shadow-inner' : ''}`}>
                                    <div className="flex items-start gap-4">
                                        <button
                                            onClick={() => toggleSelect(student.id)}
                                            className="mt-1 p-1 hover:bg-white rounded-lg transition-all active:scale-75 shrink-0"
                                        >
                                            {isSelected ? (
                                                <CheckCircle2 className="w-8 h-8 text-blue-600 shrink-0 animate-in zoom-in-50" />
                                            ) : (
                                                <Circle className="w-8 h-8 text-slate-200 shrink-0" />
                                            )}
                                        </button>
                                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500 shrink-0 shadow-sm border border-slate-200">
                                            <User className="w-6 h-6" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-slate-950 truncate pr-4 uppercase tracking-tighter">{student.nome_completo}</h3>
                                            <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-2">
                                                <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded tracking-tighter">{student.matricula}</span>
                                                <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                                <span className="font-black text-blue-600 uppercase">{student.sala}</span>
                                            </p>
                                            <div className="mt-2">
                                                <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md text-[9px] font-black border border-emerald-100 uppercase tracking-tighter">
                                                    {student.turma}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end pt-3 gap-2 border-t border-slate-100">
                                        <button
                                            onClick={() => handleOpenTransfer(student)}
                                            className="p-3 text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all"
                                            title="Remanejamento de Turma"
                                        >
                                            <ArrowLeftRight className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleGenerateLink(student.id, student.nome_completo)}
                                            className="p-3 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                        >
                                            <Share2 className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleEditInWizard(student)}
                                            className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
                                        >
                                            <Edit2 className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(student.id)}
                                            className="p-3 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Floating Bulk Action Bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-8 duration-500 w-full max-w-sm px-4">
                    <div className="bg-slate-900 text-white rounded-[2rem] p-4 shadow-3xl border border-white/10 flex items-center justify-between gap-4 backdrop-blur-xl">
                        <div className="flex items-center gap-4 pl-4">
                            <div className="flex flex-col">
                                <span className="text-xl font-black">{selectedIds.size}</span>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Selecionados</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setSelectedIds(new Set())}
                                className="px-4 py-3 hover:bg-white/5 rounded-2xl transition-all text-sm font-bold opacity-60 hover:opacity-100"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                disabled={isDeleting}
                                className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white px-6 py-3 rounded-2xl flex items-center gap-3 font-black text-sm transition-all shadow-xl shadow-rose-900/40 active:scale-95"
                            >
                                {isDeleting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                                <span>Excluir Tudo</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── PURGE MODAL ─────────────────────────────────────────── */}
            {showPurgeModal && (
                <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-14 h-14 bg-rose-100 rounded-2xl flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-7 h-7 text-rose-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900">Limpar Todo o Cadastro</h2>
                                <p className="text-sm text-rose-600 font-bold">Ação irreversível</p>
                            </div>
                        </div>

                        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-6 space-y-2 text-sm text-rose-700">
                            <p className="font-bold">Serão excluídos permanentemente:</p>
                            <ul className="list-disc list-inside space-y-1 font-medium opacity-80">
                                <li>Todos os alunos cadastrados</li>
                                <li>Todos os responsáveis e seus dados</li>
                                <li>Todas as autorizações e vínculos</li>
                                <li>Todos os tokens de acesso e QR cards</li>
                                <li>Todo o histórico de retiradas</li>
                            </ul>
                            <p className="font-bold mt-2">O sistema ficará limpo para nova importação em massa.</p>
                        </div>

                        <div className="mb-6">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                Digite <span className="text-rose-600">LIMPAR</span> para confirmar
                            </label>
                            <input
                                type="text"
                                value={purgeConfirmText}
                                onChange={e => setPurgeConfirmText(e.target.value)}
                                placeholder="LIMPAR"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-500/10 transition-all tracking-widest uppercase"
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowPurgeModal(false); setPurgeConfirmText(''); }}
                                className="flex-1 py-3 rounded-2xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                                disabled={isPurging}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handlePurgeAll}
                                disabled={purgeConfirmText !== 'LIMPAR' || isPurging}
                                className="flex-1 py-3 rounded-2xl font-black text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20"
                            >
                                {isPurging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                Limpar Tudo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── TRANSFER MODAL ──────────────────────────────────────── */}
            {transferStudent && (
                <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center shrink-0">
                                <ArrowLeftRight className="w-7 h-7 text-indigo-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900">Remanejamento de Turma</h2>
                                <p className="text-sm text-indigo-600 font-bold truncate max-w-[220px]">{transferStudent.nome_completo}</p>
                            </div>
                            <button
                                onClick={() => setTransferStudent(null)}
                                className="ml-auto p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="mb-3 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-500">
                            Turma atual: <span className="text-emerald-600">{transferStudent.turma || '—'}</span>
                            {transferStudent.sala && <> · Sala: <span className="text-blue-600">{transferStudent.sala}</span></>}
                        </div>

                        <div className="space-y-4 mb-6 mt-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    Nova Série / Grau
                                </label>
                                <div className="relative">
                                    <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                                    <select
                                        value={transferForm.serie}
                                        onChange={e => setTransferForm({ serie: e.target.value, turma: '' })}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none"
                                    >
                                        <option value="">Selecione a série...</option>
                                        {seriesUnicas.map(s => <option key={s} value={s}>{s}</option>)}
                                        {seriesUnicas.length === 0 && <option disabled>Nenhuma série cadastrada</option>}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    Nova Turma / Seção
                                </label>
                                <div className="relative">
                                    <LayoutGrid className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                                    <select
                                        value={transferForm.turma}
                                        onChange={e => setTransferForm(prev => ({ ...prev, turma: e.target.value }))}
                                        disabled={!transferForm.serie}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none disabled:opacity-50"
                                    >
                                        <option value="">Selecione a turma...</option>
                                        {secoesParaTransfer.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setTransferStudent(null)}
                                className="flex-1 py-3 rounded-2xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                                disabled={isTransferring}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleTransfer}
                                disabled={!transferForm.serie || !transferForm.turma || isTransferring}
                                className="flex-1 py-3 rounded-2xl font-black text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                            >
                                {isTransferring ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showBulkModal && (
                <BulkImportModal
                    escolaId={escolaId || ''}
                    onClose={() => setShowBulkModal(false)}
                    onSuccess={() => {
                        fetchStudents();
                    }}
                />
            )}
        </div>
    );
}
