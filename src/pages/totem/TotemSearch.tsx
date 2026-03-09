import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User as UserIcon, Search as SearchIcon, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useInactivityTimer } from '../../components/totem/InactivityTimer';
import TotemNumericPad from '../../components/totem/TotemNumericPad';
import type { Student } from '../../types';

export default function TotemSearch() {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Student[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
    const [identifiedGuardian, setIdentifiedGuardian] = useState<any>(null);
    useInactivityTimer({ timeoutMs: 60000, redirectTo: '/totem' });

    // Load initial selection if returning from confirmation
    useEffect(() => {
        const state = window.history.state?.usr;
        if (state?.selectedStudents) {
            setSelectedStudents(state.selectedStudents);
        }
    }, []);

    // Search with debounce
    useEffect(() => {
        const trimmedQuery = query.trim();
        const cleanCpf = trimmedQuery.replace(/\D/g, '');

        // Security: only search by full CPF (11 digits)
        if (cleanCpf.length !== 11) { setResults([]); return; }

        // Build both CPF formats to handle inconsistent storage
        const formattedCpf = cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

        const t = setTimeout(async () => {
            setLoading(true);
            try {
                let allResults: Student[] = [];

                // Search by Guardian CPF — try both formatted and unformatted
                const { data: guardians } = await supabase
                    .from('responsaveis')
                    .select('*')
                    .or(`cpf.eq.${cleanCpf},cpf.eq.${formattedCpf}`);

                if (guardians && guardians.length > 0) {
                    const guardianIds = guardians.map((g: any) => g.id);

                    // Query both link tables for redundancy across ALL guardian IDs
                    const [authsRes, junctionRes] = await Promise.all([
                        supabase.from('autorizacoes').select('aluno_id').in('responsavel_id', guardianIds).eq('ativa', true),
                        supabase.from('alunos_responsaveis').select('aluno_id').in('responsavel_id', guardianIds)
                    ]);

                    const studentIds = new Set([
                        ...(authsRes.data?.map((a: any) => a.aluno_id) || []),
                        ...(junctionRes.data?.map((j: any) => j.aluno_id) || [])
                    ]);

                    if (studentIds.size > 0) {
                        const { data: cpfStudents } = await supabase
                            .from('alunos')
                            .select('*')
                            .in('id', Array.from(studentIds));

                        if (cpfStudents) {
                            allResults = cpfStudents;
                            // Auto-select all students found by CPF
                            setSelectedStudents(cpfStudents);
                            setIdentifiedGuardian(guardians[0]);
                        }
                    }
                } else {
                    setIdentifiedGuardian(null);
                }

                setResults(allResults);
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setLoading(false);
            }
        }, 300);
        return () => clearTimeout(t);
    }, [query]);

    const toggleStudent = (student: Student) => {
        if (selectedStudents.find(s => s.id === student.id)) {
            setSelectedStudents(prev => prev.filter(s => s.id !== student.id));
        } else {
            setSelectedStudents(prev => [...prev, student]);
        }
    };

    const handleNext = () => {
        if (selectedStudents.length === 0) return;
        navigate('/totem/confirmacao', {
            state: {
                students: selectedStudents,
                mode: 'search',
                guardian: identifiedGuardian
            }
        });
    };

    return (
        <div className="w-screen h-screen bg-[#020617] text-white overflow-hidden relative flex flex-col">
            {/* Ambient */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-15%] left-[-5%] w-[55%] h-[70%] bg-emerald-500/[0.05] blur-[140px] rounded-full" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:48px_48px]" />
            </div>

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between px-12 py-5 border-b border-white/5">
                <button
                    onClick={() => navigate('/totem/identificar')}
                    className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] transition-all active:scale-95 text-slate-400 hover:text-white"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span className="text-sm font-black uppercase tracking-widest">Voltar</span>
                </button>
                <div className="text-center">
                    <h1 className="text-2xl font-black italic tracking-tighter text-white uppercase flex items-center gap-3">
                        <div className="w-1.5 h-7 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.6)]" />
                        Buscar Estudantes
                    </h1>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
                        Digite o CPF do responsável para localizar os alunos
                    </p>
                </div>
                <div className="w-32 flex justify-end">
                    {selectedStudents.length > 0 && (
                        <div className="bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl font-black text-xs animate-bounce">
                            {selectedStudents.length} SELECIONADO{selectedStudents.length > 1 ? 'S' : ''}
                        </div>
                    )}
                </div>
            </div>

            {/* Main: LEFT keyboard | RIGHT results */}
            <div className="relative z-10 flex-1 flex flex-row gap-0 overflow-hidden">

                {/* Left: search input + keyboard */}
                <form
                    className="flex flex-col w-[45%] min-w-[500px] flex-shrink-0 px-8 py-8 border-r border-white/5 gap-6"
                    autoComplete="off"
                    onSubmit={e => e.preventDefault()}
                >
                    {/* Display */}
                    <div className="bg-white/[0.04] border-2 border-white/10 rounded-3xl px-8 py-5 flex items-center gap-4 min-h-[80px]">
                        <SearchIcon className="w-7 h-7 text-emerald-500 shrink-0" />
                        <span className={`text-xl font-black tracking-tight text-white flex-1 line-clamp-2 ${!query && 'opacity-30'}`}>
                            {query || 'Digite os 11 números do CPF...'}
                        </span>
                        {loading && <Loader2 className="w-6 h-6 text-emerald-500 animate-spin shrink-0" />}
                    </div>

                    {/* Keyboard */}
                    <TotemNumericPad
                        value={query}
                        onChange={setQuery}
                        maxLength={11}
                    />
                </form>

                {/* Right: results */}
                <div className="flex-1 flex flex-col px-10 py-8 gap-4 overflow-y-auto pb-60">
                    {results.length === 0 && query.trim().length < 2 && selectedStudents.length === 0 && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
                            <div className="w-24 h-24 bg-white/[0.04] border border-white/10 rounded-[2rem] flex items-center justify-center">
                                <UserIcon className="w-12 h-12 text-slate-700" />
                            </div>
                            <div>
                                <p className="text-white/30 text-lg font-black uppercase italic tracking-tight">Digite para buscar</p>
                                <p className="text-slate-700 text-xs font-bold uppercase tracking-widest mt-2">
                                    Insira os 11 dígitos do CPF
                                </p>
                            </div>
                        </div>
                    )}

                    {results.length === 0 && query.trim().length >= 2 && !loading && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
                            <p className="text-white/40 text-xl font-black uppercase italic">Nenhum aluno encontrado</p>
                        </div>
                    )}

                    <div className="flex flex-col gap-3">
                        {results.map(student => {
                            const isSelected = selectedStudents.some(s => s.id === student.id);
                            return (
                                <button
                                    key={student.id}
                                    onClick={() => toggleStudent(student)}
                                    className={`w-full flex items-center gap-5 p-5 rounded-[1.5rem] border-2 transition-all duration-200 active:scale-98 group text-left
                                        ${isSelected
                                            ? 'bg-emerald-500/10 border-emerald-500'
                                            : 'bg-white/[0.04] border-white/5 hover:bg-white/[0.08] hover:border-white/20'
                                        }`}
                                >
                                    <div className={`w-16 h-16 rounded-2xl overflow-hidden border-2 shrink-0 transition-all ${isSelected ? 'border-emerald-500' : 'border-white/10'}`}>
                                        {student.foto_url
                                            ? <img src={student.foto_url} alt="" className="w-full h-full object-cover" />
                                            : <div className="w-full h-full bg-slate-800 flex items-center justify-center"><UserIcon className="w-8 h-8 text-slate-600" /></div>
                                        }
                                    </div>
                                    <div className="flex-1">
                                        <p className={`text-xl font-black uppercase italic tracking-tight transition-colors ${isSelected ? 'text-emerald-400' : 'text-white'}`}>
                                            {student.nome_completo}
                                        </p>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-xs font-black text-emerald-500/70 uppercase tracking-widest">{student.turma}</span>
                                        </div>
                                    </div>
                                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-emerald-500 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'border-white/10'}`}>
                                        {isSelected && <ChevronRight className="w-5 h-5 text-slate-950" />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Fixed Action Button - Positioned to the right to avoid keypad overlap */}
                {selectedStudents.length > 0 && (
                    <div className="fixed bottom-12 right-12 z-50 pointer-events-none">
                        <button
                            onClick={handleNext}
                            className="pointer-events-auto px-12 py-8 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-[2.5rem] font-black text-3xl uppercase tracking-widest transition-all active:scale-95 shadow-[0_30px_60px_rgba(16,185,129,0.4)] flex items-center gap-6 border-4 border-[#020617]"
                        >
                            <SearchIcon className="w-10 h-10" /> CHAMAR AGORA ({selectedStudents.length}) <ChevronRight className="w-10 h-10" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
