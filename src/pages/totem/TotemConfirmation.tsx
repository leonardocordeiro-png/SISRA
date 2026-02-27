import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2, Bell, User as UserIcon, ArrowLeft, Loader2, Users, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Student, Guardian } from '../../types';

interface LocationState {
    students: Student[];
    guardian?: Guardian | null;
    mode: 'search' | 'code' | 'qr';
}

type Step = 'confirm' | 'sending' | 'success' | 'error';

export default function TotemConfirmation() {
    const navigate = useNavigate();
    const location = useLocation();
    const state = location.state as LocationState | null;

    const [step, setStep] = useState<Step>('confirm');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [countdown, setCountdown] = useState(8);
    const [errorMsg, setErrorMsg] = useState('');

    const students: Student[] = state?.students || [];
    const guardian: Guardian | null = state?.guardian || null;

    // Pre-select all students
    useEffect(() => {
        setSelectedIds(new Set(students.map(s => s.id)));
    }, []);

    // Auto-redirect countdown on success
    useEffect(() => {
        if (step !== 'success') return;
        const t = setInterval(() => setCountdown(v => v - 1), 1000);
        return () => clearInterval(t);
    }, [step]);

    useEffect(() => {
        if (countdown <= 0 && step === 'success') navigate('/totem');
    }, [countdown, step, navigate]);

    const handleConfirm = async () => {
        if (selectedIds.size === 0) return;
        setStep('sending');

        try {
            const requests = Array.from(selectedIds).map(id => ({
                escola_id: students[0]?.escola_id || null,
                aluno_id: id,
                responsavel_id: guardian?.id || null,
                recepcionista_id: null,
                status: 'SOLICITADO',
                tipo_solicitacao: 'TOTEM',
            }));

            const { error } = await supabase.from('solicitacoes_retirada').insert(requests);
            if (error) throw error;

            setStep('success');
        } catch (e: any) {
            setErrorMsg(e.message || 'Erro desconhecido. Tente novamente ou chame a recepção.');
            setStep('error');
        }
    };

    const toggle = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    if (!state?.students?.length) {
        return (
            <div className="w-screen h-screen bg-[#020617] flex items-center justify-center">
                <div className="text-center space-y-4">
                    <p className="text-white/40 text-xl font-black uppercase">Nenhum dado recebido.</p>
                    <button onClick={() => navigate('/totem')} className="px-6 py-3 bg-emerald-500 text-slate-950 rounded-2xl font-black text-sm uppercase">
                        Voltar ao Início
                    </button>
                </div>
            </div>
        );
    }

    // ── SUCCESS SCREEN ────────────────────────────────────────────────
    if (step === 'success') {
        return (
            <div
                className="w-screen h-screen bg-[#020617] flex flex-col items-center justify-center gap-8 relative overflow-hidden"
            >
                <div className="fixed inset-0 z-0 pointer-events-none">
                    <div className="absolute inset-0 bg-emerald-500/[0.04] animate-pulse" />
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:48px_48px]" />
                </div>

                <div className="relative z-10 flex flex-col items-center gap-8 text-center">
                    {/* Giant success icon */}
                    <div className="relative">
                        <div className="absolute -inset-12 bg-emerald-500/20 blur-3xl rounded-full animate-pulse" />
                        <div className="relative w-40 h-40 bg-emerald-500 rounded-[3rem] flex items-center justify-center shadow-[0_0_80px_rgba(16,185,129,0.5)]">
                            <CheckCircle2 className="w-20 h-20 text-slate-950" />
                        </div>
                    </div>

                    <div>
                        <h1 className="text-6xl font-black italic tracking-tighter text-white uppercase leading-none mb-4">
                            Solicitação <span className="text-emerald-500">Enviada!</span>
                        </h1>
                        <p className="text-slate-400 text-xl font-medium">
                            Aguarde na recepção — a equipe foi notificada.
                        </p>
                    </div>

                    {/* Students called */}
                    <div className="flex gap-4 flex-wrap justify-center">
                        {students.filter(s => selectedIds.has(s.id)).map(s => (
                            <div key={s.id} className="flex items-center gap-3 px-5 py-3 bg-white/[0.06] border border-white/10 rounded-2xl">
                                <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 shrink-0">
                                    {s.foto_url
                                        ? <img src={s.foto_url} alt="" className="w-full h-full object-cover" />
                                        : <div className="w-full h-full bg-slate-800 flex items-center justify-center"><UserIcon className="w-5 h-5 text-slate-600" /></div>
                                    }
                                </div>
                                <div className="text-left">
                                    <p className="text-sm font-black text-white uppercase italic">{s.nome_completo}</p>
                                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{s.turma}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Countdown */}
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                                style={{ width: `${(countdown / 8) * 100}%` }}
                            />
                        </div>
                        <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">
                            Voltando ao início em {countdown}s...
                        </p>
                    </div>

                    <button
                        onClick={() => navigate('/totem')}
                        className="flex items-center gap-2 px-8 py-4 bg-white/[0.06] border border-white/10 rounded-2xl text-white font-black text-sm uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95"
                    >
                        <RotateCcw className="w-4 h-4" /> Ir ao Início Agora
                    </button>
                </div>
            </div>
        );
    }

    // ── ERROR SCREEN ─────────────────────────────────────────────────
    if (step === 'error') {
        return (
            <div
                className="w-screen h-screen bg-[#020617] flex flex-col items-center justify-center gap-8 text-center"
            >
                <div className="w-28 h-28 bg-rose-500/10 border-2 border-rose-500/30 rounded-[2.5rem] flex items-center justify-center">
                    <Bell className="w-14 h-14 text-rose-400" />
                </div>
                <div>
                    <h2 className="text-4xl font-black italic text-white uppercase mb-3">Ocorreu um Erro</h2>
                    <p className="text-slate-400 text-base max-w-md">{errorMsg}</p>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => setStep('confirm')} className="px-8 py-4 bg-white/[0.06] border border-white/10 rounded-2xl text-white font-black text-sm uppercase tracking-widest hover:bg-white/10 transition-all">
                        Tentar Novamente
                    </button>
                    <button onClick={() => navigate('/totem')} className="px-8 py-4 bg-rose-500/20 border border-rose-500/30 rounded-2xl text-rose-400 font-black text-sm uppercase tracking-widest hover:bg-rose-500/30 transition-all">
                        Voltar ao Início
                    </button>
                </div>
            </div>
        );
    }

    // ── CONFIRM SCREEN ────────────────────────────────────────────────
    return (
        <div className="w-screen h-screen bg-[#020617] text-white overflow-hidden relative flex flex-col">
            {/* Ambient */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-15%] left-[-5%] w-[55%] h-[70%] bg-emerald-500/[0.04] blur-[140px] rounded-full" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:48px_48px]" />
            </div>

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between px-12 py-5 border-b border-white/5">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] transition-all active:scale-95 text-slate-400 hover:text-white"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span className="text-sm font-black uppercase tracking-widest">Voltar</span>
                </button>
                <div className="text-center">
                    <h1 className="text-2xl font-black italic tracking-tighter text-white uppercase flex items-center gap-3">
                        <div className="w-1.5 h-7 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.6)]" />
                        Confirmar Chegada
                    </h1>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
                        Revise e confirme os alunos a serem chamados
                    </p>
                </div>
                <div className="w-32" />
            </div>

            {/* Main: LEFT guardian | RIGHT students + confirm */}
            <div className="relative z-10 flex-1 flex flex-row gap-0 overflow-hidden">

                {/* Left: guardian info */}
                <div className="w-[380px] flex-shrink-0 flex flex-col px-12 py-10 border-r border-white/5 gap-8 justify-center">
                    <div className="text-center space-y-2">
                        <p className="text-xs font-black text-slate-600 uppercase tracking-widest">Responsável Identificado</p>
                        <div className="relative mx-auto w-32 h-32 rounded-[2.5rem] overflow-hidden border-4 border-emerald-500/30 shadow-2xl">
                            {guardian?.foto_url
                                ? <img src={guardian.foto_url} alt="" className="w-full h-full object-cover" />
                                : <div className="w-full h-full bg-slate-800 flex items-center justify-center"><UserIcon className="w-16 h-16 text-slate-700" /></div>
                            }
                            <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-[2.5rem]" />
                        </div>
                        <p className="text-2xl font-black italic text-white uppercase tracking-tight">
                            {guardian?.nome_completo || 'Responsável'}
                        </p>
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-xs font-black text-emerald-500 uppercase tracking-widest">Identidade Verificada</span>
                        </div>
                    </div>

                    <div className="h-px bg-white/5" />

                    <div className="flex items-center gap-3 text-slate-500">
                        <Users className="w-5 h-5" />
                        <span className="text-sm font-bold uppercase tracking-widest">
                            {students.length} aluno{students.length !== 1 ? 's' : ''} vinculado{students.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                </div>

                {/* Right: students list + confirm button */}
                <div className="flex-1 flex flex-col px-10 py-8 gap-6">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">
                            Selecione os alunos para chamar:
                        </p>
                        {students.length > 1 && (
                            <button
                                onClick={() => setSelectedIds(selectedIds.size === students.length
                                    ? new Set()
                                    : new Set(students.map(s => s.id))
                                )}
                                className="text-xs font-black text-emerald-500/60 uppercase tracking-widest hover:text-emerald-500 transition-colors"
                            >
                                {selectedIds.size === students.length ? 'Desmarcar todos' : 'Selecionar todos'}
                            </button>
                        )}
                    </div>

                    {/* Student cards */}
                    <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
                        {students.map(student => {
                            const isSelected = selectedIds.has(student.id);
                            return (
                                <button
                                    key={student.id}
                                    onClick={() => toggle(student.id)}
                                    className={`flex items-center gap-5 p-6 rounded-[1.5rem] border-2 transition-all duration-300 active:scale-[0.98] text-left w-full
                                        ${isSelected
                                            ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_10px_30px_rgba(16,185,129,0.15)]'
                                            : 'bg-white/[0.04] border-white/10 hover:border-white/20'
                                        }`}
                                >
                                    <div className={`w-20 h-20 rounded-2xl overflow-hidden border-2 shrink-0 transition-all ${isSelected ? 'border-emerald-400' : 'border-white/10'}`}>
                                        {student.foto_url
                                            ? <img src={student.foto_url} alt="" className="w-full h-full object-cover" />
                                            : <div className="w-full h-full bg-slate-800 flex items-center justify-center"><UserIcon className="w-10 h-10 text-slate-700" /></div>
                                        }
                                    </div>
                                    <div className="flex-1">
                                        <p className={`text-2xl font-black italic tracking-tight uppercase leading-none mb-2 ${isSelected ? 'text-white' : 'text-white/70'}`}>
                                            {student.nome_completo}
                                        </p>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-black text-emerald-500 uppercase tracking-widest">{student.turma}</span>
                                            <div className="w-1 h-1 bg-white/20 rounded-full" />
                                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">SALA {student.sala}</span>
                                        </div>
                                    </div>
                                    <div className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center shrink-0 transition-all duration-300 ${isSelected ? 'bg-emerald-500 border-emerald-400 text-slate-950' : 'border-white/10 text-transparent'}`}>
                                        <CheckCircle2 className="w-6 h-6" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Confirm button */}
                    <button
                        onClick={handleConfirm}
                        disabled={selectedIds.size === 0 || step === 'sending'}
                        className="w-full py-6 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed text-slate-950 rounded-[1.5rem] font-black text-xl uppercase tracking-[0.3em] transition-all active:scale-95 shadow-[0_15px_40px_rgba(16,185,129,0.3)] flex items-center justify-center gap-4"
                    >
                        {step === 'sending'
                            ? <><Loader2 className="w-7 h-7 animate-spin" /> Enviando solicitação...</>
                            : <><Bell className="w-7 h-7" /> Confirmar Chegada — Chamar {selectedIds.size} Aluno{selectedIds.size !== 1 ? 's' : ''}</>
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}
