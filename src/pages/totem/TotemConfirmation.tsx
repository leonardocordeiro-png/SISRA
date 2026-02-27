import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2, Bell, User as UserIcon, ArrowLeft, Loader2, Users } from 'lucide-react';
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
    const [availableGuardians, setAvailableGuardians] = useState<Guardian[]>([]);
    const [selectedGuardian, setSelectedGuardian] = useState<Guardian | null>(null);
    const [loadingGuardians, setLoadingGuardians] = useState(false);
    const [countdown, setCountdown] = useState(8);
    const [errorMsg, setErrorMsg] = useState('');

    const students: Student[] = state?.students || [];

    // Pre-select all students and load guardians
    useEffect(() => {
        if (!students.length) return;
        setSelectedIds(new Set(students.map(s => s.id)));
        loadGuardians();
    }, [students]);

    const loadGuardians = async () => {
        setLoadingGuardians(true);
        try {
            // Get all unique guardian IDs authorized for these students
            const studentIds = students.map(s => s.id);
            if (studentIds.length > 0) {
                const { data: auths } = await supabase
                    .from('autorizacoes')
                    .select(`
                        responsavel_id,
                        responsaveis (
                            id,
                            nome_completo,
                            foto_url
                        )
                    `)
                    .in('aluno_id', studentIds)
                    .eq('ativa', true);

                if (auths) {
                    // Extract unique guardians from authorizations
                    const guardiansMap = new Map();
                    auths.forEach((a: any) => {
                        const r = Array.isArray(a.responsaveis) ? a.responsaveis[0] : a.responsaveis;
                        if (r && !guardiansMap.has(r.id)) {
                            guardiansMap.set(r.id, r);
                        }
                    });
                    setAvailableGuardians(Array.from(guardiansMap.values()));
                }
            }
        } catch (e) {
            console.error('Error loading guardians:', e);
        } finally {
            setLoadingGuardians(false);
        }
    };

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
        if (selectedIds.size === 0 || !selectedGuardian) return;
        setStep('sending');

        try {
            const requests = Array.from(selectedIds).map(id => {
                const studentExists = students.some(s => s.id === id);
                if (!studentExists) throw new Error('Falha de segurança: Tentativa de retirar aluno não reconhecido.');

                return {
                    escola_id: students[0]?.escola_id || null,
                    aluno_id: id,
                    responsavel_id: selectedGuardian.id,
                    recepcionista_id: null,
                    status: 'SOLICITADO',
                    tipo_solicitacao: 'ROTINA',
                    // Guardian is physically using the on-site totem — mark as arrived immediately
                    status_geofence: 'CHEGOU',
                };
            });

            const { error } = await supabase.from('solicitacoes_retirada').insert(requests);
            if (error) throw error;

            setStep('success');
        } catch (e: any) {
            setErrorMsg(e.message || 'Erro desconhecido. Tente novamente ou chame a recepção.');
            setStep('error');
        }
    };

    const toggleStudent = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleAddMore = () => {
        const mode = state?.mode || 'search';
        navigate(`/totem/${mode}`, { state: { selectedStudents: students } });
    };

    if (!state?.students?.length) {
        return (
            <div className="w-screen h-screen bg-[#020617] flex items-center justify-center">
                <div className="text-center space-y-4">
                    <p className="text-white/40 text-xl font-black uppercase tracking-widest italic">Nenhum dado recebido.</p>
                    <button onClick={() => navigate('/totem')} className="px-6 py-3 bg-emerald-500 text-slate-950 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95">
                        Voltar ao Início
                    </button>
                </div>
            </div>
        );
    }

    if (step === 'success') {
        return (
            <div className="w-screen h-screen bg-[#020617] flex flex-col items-center justify-center gap-8 relative overflow-hidden">
                {/* Ambient */}
                <div className="fixed inset-0 z-0 pointer-events-none">
                    <div className="absolute inset-0 bg-emerald-500/[0.04] animate-pulse" />
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:48px_48px]" />
                </div>

                <div className="relative z-10 flex flex-col items-center gap-8 text-center px-12">
                    <div className="relative">
                        <div className="absolute -inset-12 bg-emerald-500/20 blur-3xl rounded-full animate-pulse" />
                        <div className="relative w-40 h-40 bg-emerald-500 rounded-[3rem] flex items-center justify-center shadow-[0_0_80px_rgba(16,185,129,0.5)]">
                            <CheckCircle2 className="w-20 h-20 text-slate-950" />
                        </div>
                    </div>

                    <div>
                        <h1 className="text-6xl font-black italic tracking-tighter text-white uppercase leading-none mb-4">
                            Tudo <span className="text-emerald-500">Pronto!</span>
                        </h1>
                        <p className="text-slate-400 text-xl font-medium max-w-2xl">
                            {selectedGuardian?.nome_completo.split(' ')[0]}, aguarde na recepção. Os alunos já foram notificados!
                        </p>
                    </div>

                    <div className="flex gap-4 flex-wrap justify-center">
                        {students.filter(s => selectedIds.has(s.id)).map(s => (
                            <div key={s.id} className="flex items-center gap-3 px-5 py-3 bg-white/[0.04] border border-white/10 rounded-2xl">
                                <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 shrink-0">
                                    {s.foto_url ? <img src={s.foto_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-800 flex items-center justify-center"><UserIcon className="w-5 h-5 text-slate-600" /></div>}
                                </div>
                                <div className="text-left">
                                    <p className="text-sm font-black text-white uppercase italic tracking-tight">{s.nome_completo.split(' ')[0]}</p>
                                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{s.turma}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col items-center gap-3 mt-4">
                        <div className="w-64 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${(countdown / 8) * 100}%` }} />
                        </div>
                        <p className="text-slate-500 text-xs font-black uppercase tracking-[0.2em]">Retornando em {countdown}s...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (step === 'error') {
        return (
            <div className="w-screen h-screen bg-[#020617] flex flex-col items-center justify-center gap-8 text-center px-12">
                <div className="w-28 h-28 bg-rose-500/10 border-2 border-rose-500/30 rounded-[2.5rem] flex items-center justify-center">
                    <Bell className="w-14 h-14 text-rose-400" />
                </div>
                <div>
                    <h2 className="text-4xl font-black italic text-white uppercase mb-4 tracking-tighter">Ocorreu um Erro</h2>
                    <div className="bg-white/5 border border-white/10 p-6 rounded-3xl max-w-lg mx-auto backdrop-blur-md">
                        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-2 opacity-50 text-[10px]">Detalhes Técnicos</p>
                        <p className="text-slate-300 text-base leading-relaxed">{errorMsg}</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => setStep('confirm')} className="px-8 py-4 bg-white/[0.06] border border-white/10 rounded-2xl text-white font-black text-sm uppercase tracking-widest hover:bg-white/10 transition-all">Tentar Novamente</button>
                    <button onClick={() => navigate('/totem')} className="px-8 py-4 bg-rose-500/20 border border-rose-500/30 rounded-2xl text-rose-400 font-black text-sm uppercase tracking-widest hover:bg-rose-500/30 transition-all">Início</button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-screen h-screen bg-[#020617] text-white overflow-hidden relative flex flex-col">
            {/* Ambient */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-15%] left-[-5%] w-[55%] h-[70%] bg-emerald-500/[0.04] blur-[140px] rounded-full" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:48px_48px]" />
            </div>

            {/* Header */}
            <div className="relative z-20 flex items-center justify-between px-12 py-5 border-b border-white/5 bg-[#020617]/80 backdrop-blur-md">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] transition-all active:scale-95 text-slate-400 hover:text-white"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span className="text-xs font-black uppercase tracking-widest">Voltar</span>
                </button>
                <div className="text-center">
                    <h1 className="text-2xl font-black italic tracking-tighter text-white uppercase flex items-center gap-3">
                        <div className="w-1.5 h-7 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.6)]" />
                        Finalizar Chamada
                    </h1>
                </div>
                <button
                    onClick={handleAddMore}
                    className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all active:scale-95 shadow-lg"
                >
                    <Users className="w-5 h-5" />
                    <span className="text-xs font-black uppercase tracking-widest">+ Adicionar Alunos</span>
                </button>
            </div>

            <div className="relative z-10 flex-1 flex flex-row gap-0 overflow-hidden">
                {/* Left: Guardian Selection (IDENTIFY YOURSELF) */}
                <div className="w-[480px] flex-shrink-0 flex flex-col px-10 py-8 border-r border-white/5 gap-6 overflow-y-auto bg-black/20">
                    <div className="space-y-1">
                        <h2 className="text-xl font-black italic text-white uppercase tracking-tight">Quem está retirando?</h2>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Selecione você na lista abaixo</p>
                    </div>

                    {loadingGuardians ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-600">
                            <Loader2 className="w-10 h-10 animate-spin" />
                            <p className="text-[10px] font-black uppercase tracking-[0.3em]">Buscando autorizados...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            {availableGuardians.map(resp => (
                                <button
                                    key={resp.id}
                                    onClick={() => setSelectedGuardian(resp)}
                                    className={`relative flex flex-col items-center gap-3 p-4 rounded-3xl border-2 transition-all duration-300 group
                                        ${selectedGuardian?.id === resp.id
                                            ? 'bg-emerald-500 border-emerald-400 shadow-[0_15px_30px_rgba(16,185,129,0.2)]'
                                            : 'bg-white/[0.04] border-white/5 hover:bg-white/[0.08] hover:border-white/20'}`}
                                >
                                    <div className={`w-20 h-20 rounded-2xl overflow-hidden border-2 transition-all ${selectedGuardian?.id === resp.id ? 'border-white/40' : 'border-white/10 group-hover:border-white/30'}`}>
                                        {resp.foto_url ? <img src={resp.foto_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-800 flex items-center justify-center"><UserIcon className="w-8 h-8 text-slate-600" /></div>}
                                    </div>
                                    <p className={`text-[11px] font-black uppercase tracking-tight text-center leading-tight transition-colors ${selectedGuardian?.id === resp.id ? 'text-slate-900' : 'text-white/60 group-hover:text-white'}`}>
                                        {resp.nome_completo.split(' ')[0]} {resp.nome_completo.split(' ').slice(-1)}
                                    </p>
                                    {selectedGuardian?.id === resp.id && (
                                        <div className="absolute top-2 right-2 w-5 h-5 bg-slate-900 rounded-full flex items-center justify-center">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right: Selected Students Preview + Confirm */}
                <div className="flex-1 flex flex-col px-10 py-8 gap-6 overflow-hidden">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Estudantes Selecionados ({selectedIds.size})</p>
                    </div>

                    <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        {students.map(student => {
                            const isSelected = selectedIds.has(student.id);
                            return (
                                <button
                                    key={student.id}
                                    onClick={() => toggleStudent(student.id)}
                                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-200 group text-left
                                        ${isSelected
                                            ? 'bg-emerald-500/10 border-emerald-500/40'
                                            : 'bg-white/[0.02] border-white/5 opacity-40 hover:opacity-100 hover:border-white/10'}`}
                                >
                                    <div className={`w-14 h-14 rounded-xl overflow-hidden border transition-all ${isSelected ? 'border-emerald-500' : 'border-white/10'}`}>
                                        {student.foto_url ? <img src={student.foto_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-800 flex items-center justify-center"><UserIcon className="w-6 h-6 text-slate-700" /></div>}
                                    </div>
                                    <div className="flex-1">
                                        <p className={`text-lg font-black uppercase italic tracking-tight leading-tight transition-colors ${isSelected ? 'text-white' : 'text-slate-500'}`}>{student.nome_completo}</p>
                                        <span className="text-[10px] font-black text-emerald-500/60 uppercase tracking-widest">{student.turma}</span>
                                    </div>
                                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-white/10'}`}>
                                        {isSelected && <CheckCircle2 className="w-5 h-5 text-slate-950" />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-auto pt-6 border-t border-white/5 space-y-4">
                        {!selectedGuardian && (
                            <div className="animate-bounce flex items-center gap-3 px-6 py-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-500 justify-center">
                                <AlertCircle className="w-5 h-5" />
                                <span className="text-xs font-black uppercase tracking-widest">Identifique-se na lista à esquerda</span>
                            </div>
                        )}

                        <button
                            onClick={handleConfirm}
                            disabled={selectedIds.size === 0 || !selectedGuardian || step === 'sending'}
                            className="w-full py-5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed text-slate-950 rounded-3xl font-black text-xl uppercase tracking-[0.2em] transition-all active:scale-95 shadow-2xl flex items-center justify-center gap-3"
                        >
                            {step === 'sending' ? (
                                <><Loader2 className="w-6 h-6 animate-spin" /> Processando...</>
                            ) : (
                                <><Bell className="w-6 h-6" /> Chamar {selectedIds.size} Aluno{selectedIds.size !== 1 ? 's' : ''}</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

const AlertCircle = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
);
