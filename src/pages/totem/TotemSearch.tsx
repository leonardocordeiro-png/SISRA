import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User as UserIcon, Search as SearchIcon, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useInactivityTimer } from '../../components/totem/InactivityTimer';
import TotemKeyboard from '../../components/totem/TotemKeyboard';
import type { Student } from '../../types';

export default function TotemSearch() {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Student[]>([]);
    const [loading, setLoading] = useState(false);
    useInactivityTimer({ timeoutMs: 45000, redirectTo: '/totem' });

    // Search with debounce
    useEffect(() => {
        if (query.trim().length < 3) { setResults([]); return; }
        const t = setTimeout(async () => {
            setLoading(true);
            const { data } = await supabase
                .from('alunos')
                .select('*')
                .ilike('nome_completo', `%${query.trim()}%`)
                .limit(6);
            setResults(data || []);
            setLoading(false);
        }, 300);
        return () => clearTimeout(t);
    }, [query]);

    const handleSelect = (student: Student) => {
        navigate('/totem/confirmacao', {
            state: { students: [student], mode: 'search' }
        });
    };

    return (
        <div
            className="w-screen h-screen bg-[#020617] text-white overflow-hidden relative flex flex-col"
            style={{ width: '1280px', minHeight: '1024px' }}
        >
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
                        Buscar por Nome
                    </h1>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
                        Digite o nome do aluno no teclado abaixo
                    </p>
                </div>
                <div className="w-32" />
            </div>

            {/* Main: LEFT keyboard | RIGHT results */}
            <div className="relative z-10 flex-1 flex flex-row gap-0 overflow-hidden">

                {/* Left: search input + keyboard */}
                <div className="flex flex-col w-[640px] flex-shrink-0 px-10 py-8 border-r border-white/5 gap-6">
                    {/* Display */}
                    <div className="bg-white/[0.04] border-2 border-white/10 rounded-3xl px-8 py-5 flex items-center gap-4 min-h-[80px]">
                        <SearchIcon className="w-7 h-7 text-emerald-500 shrink-0" />
                        <span className={`text-3xl font-black tracking-tight text-white flex-1 ${!query && 'opacity-30'}`}>
                            {query || 'Nome do aluno...'}
                        </span>
                        {loading && <Loader2 className="w-6 h-6 text-emerald-500 animate-spin shrink-0" />}
                    </div>

                    {/* Keyboard */}
                    <TotemKeyboard
                        value={query}
                        onChange={setQuery}
                        maxLength={50}
                    />
                </div>

                {/* Right: results */}
                <div className="flex-1 flex flex-col px-10 py-8 gap-4 overflow-y-auto">
                    {results.length === 0 && query.trim().length < 3 && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
                            <div className="w-24 h-24 bg-white/[0.04] border border-white/10 rounded-[2rem] flex items-center justify-center">
                                <UserIcon className="w-12 h-12 text-slate-700" />
                            </div>
                            <div>
                                <p className="text-white/30 text-lg font-black uppercase italic tracking-tight">Aguardando digitação</p>
                                <p className="text-slate-700 text-xs font-bold uppercase tracking-widest mt-2">
                                    Digite pelo menos 3 letras
                                </p>
                            </div>
                        </div>
                    )}

                    {results.length === 0 && query.trim().length >= 3 && !loading && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
                            <p className="text-white/40 text-xl font-black uppercase italic">Nenhum aluno encontrado</p>
                            <p className="text-slate-600 text-sm font-bold uppercase tracking-widest">Tente um nome diferente</p>
                        </div>
                    )}

                    {results.length > 0 && (
                        <>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-1.5 h-5 bg-emerald-500 rounded-full" />
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                    {results.length} aluno{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <div className="flex flex-col gap-3">
                                {results.map(student => (
                                    <button
                                        key={student.id}
                                        onClick={() => handleSelect(student)}
                                        className="w-full flex items-center gap-5 p-5 rounded-[1.5rem] bg-white/[0.04] border-2 border-white/5 hover:bg-emerald-500/[0.08] hover:border-emerald-500/40 transition-all duration-200 active:scale-98 group text-left"
                                    >
                                        <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white/10 group-hover:border-emerald-500/40 shrink-0 transition-all">
                                            {student.foto_url
                                                ? <img src={student.foto_url} alt="" className="w-full h-full object-cover" />
                                                : <div className="w-full h-full bg-slate-800 flex items-center justify-center"><UserIcon className="w-8 h-8 text-slate-600" /></div>
                                            }
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xl font-black text-white uppercase italic tracking-tight group-hover:text-emerald-400 transition-colors">
                                                {student.nome_completo}
                                            </p>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-xs font-black text-emerald-500 uppercase tracking-widest">{student.turma}</span>
                                                <div className="w-1 h-1 bg-white/20 rounded-full" />
                                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">SALA {student.sala}</span>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-6 h-6 text-slate-700 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all shrink-0" />
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
