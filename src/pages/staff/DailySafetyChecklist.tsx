import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Shield, CheckCircle, Circle, AlertTriangle, Info, Send, Calendar as CalendarIcon, ClipboardCheck } from 'lucide-react';
import NavigationControls from '../../components/NavigationControls';

type ChecklistItem = {
    id: string;
    label: string;
    completed: boolean;
};

const DEFAULT_ITEMS: Omit<ChecklistItem, 'completed'>[] = [
    { id: 'fire_exits', label: 'Verificar saídas de emergência desobstruídas' },
    { id: 'first_aid', label: 'Conferir kit de primeiros socorros completo' },
    { id: 'emergency_contacts', label: 'Atualizar lista de contatos de emergência' },
    { id: 'equipment_check', label: 'Testar equipamentos de segurança (alarmes, extintores)' },
    { id: 'cleanliness', label: 'Verificar limpeza e higienização de áreas comuns' },
    { id: 'visitor_log', label: 'Preparar registro de visitantes do dia' },
    { id: 'student_attendance', label: 'Revisar lista de presença dos alunos' }
];

export default function DailySafetyChecklist() {
    const { user } = useAuth();
    const [items, setItems] = useState<ChecklistItem[]>(
        DEFAULT_ITEMS.map(item => ({ ...item, completed: false }))
    );
    const [checklistId, setChecklistId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [completed, setCompleted] = useState(false);

    useEffect(() => {
        loadTodayChecklist();
    }, [user]);

    const loadTodayChecklist = async () => {
        if (!user) return;
        setLoading(true);

        try {
            const { data: userData } = await supabase
                .from('usuarios')
                .select('escola_id')
                .eq('id', user.id)
                .single();

            const today = new Date().toISOString().split('T')[0];

            const { data: existing } = await supabase
                .from('safety_checklists')
                .select('*')
                .eq('escola_id', userData?.escola_id)
                .eq('user_id', user.id)
                .eq('checklist_date', today)
                .single();

            if (existing) {
                setChecklistId(existing.id);
                const savedItems = existing.items as ChecklistItem[];
                setItems(savedItems);
                setCompleted(!!existing.completed_at);
            }
        } catch (err) {
            console.error('Error loading checklist:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleItem = (id: string) => {
        if (completed) return;

        setItems(prev =>
            prev.map(item =>
                item.id === id ? { ...item, completed: !item.completed } : item
            )
        );
    };

    const handleSubmit = async () => {
        setSubmitting(true);

        try {
            const { data: userData } = await supabase
                .from('usuarios')
                .select('escola_id')
                .eq('id', user?.id)
                .single();

            const today = new Date().toISOString().split('T')[0];
            const allComplete = items.every(item => item.completed);

            const payload = {
                escola_id: userData?.escola_id,
                user_id: user?.id,
                checklist_date: today,
                items: items,
                completed_at: allComplete ? new Date().toISOString() : null
            };

            if (checklistId) {
                await supabase
                    .from('safety_checklists')
                    .update(payload)
                    .eq('id', checklistId);
            } else {
                const { data } = await supabase
                    .from('safety_checklists')
                    .insert(payload)
                    .select()
                    .single();

                setChecklistId(data?.id);
            }

            if (allComplete) {
                setCompleted(true);
            }
        } catch (err) {
            console.error('Error saving:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const completedCount = items.filter(i => i.completed).length;
    const progress = (completedCount / items.length) * 100;

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Shield className="w-12 h-12 text-emerald-600 animate-pulse" />
                    <p className="text-slate-500 font-medium">Validando protocolos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans selection:bg-emerald-500/30 pb-12">
            {/* Header / Banner */}
            <div className="bg-[#0f172a] text-white pt-12 pb-24 px-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                    <Shield className="w-48 h-48" />
                </div>
                <div className="max-w-4xl mx-auto relative cursor-default">
                    <NavigationControls />
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-emerald-500/20 border border-emerald-500/30 rounded-xl">
                                    <ClipboardCheck className="w-6 h-6 text-emerald-500" />
                                </div>
                                <span className="text-emerald-500 font-bold tracking-widest text-xs uppercase">Protocolo de Operação</span>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2">Checklist de <span className="text-emerald-400">Segurança</span></h1>
                            <p className="text-slate-400 font-medium flex items-center gap-2">
                                <CalendarIcon className="w-4 h-4" />
                                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                        </div>
                        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 p-6 rounded-3xl min-w-[200px]">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Conclusão</span>
                                <span className="text-lg font-black text-emerald-400">{progress.toFixed(0)}%</span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-2">
                                <div
                                    className="bg-emerald-500 h-2 rounded-full transition-all duration-700 ease-out"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 -mt-12 relative">
                {/* Information Alert */}
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 mb-8">
                    <div className="flex gap-6 items-start">
                        <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center shrink-0">
                            <Info className="w-7 h-7 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-1">Atenção Crítica</h3>
                            <p className="text-slate-600 text-sm leading-relaxed">
                                Este checklist é obrigatório e deve ser preenchido diariamente por toda a equipe de recepção e coordenação para garantir a integridade dos alunos e profissionais.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Checklist Grid */}
                <div className="space-y-4">
                    {items.map((item, index) => (
                        <button
                            key={item.id}
                            onClick={() => toggleItem(item.id)}
                            disabled={completed}
                            className={`group w-full flex items-center justify-between p-6 rounded-3xl border-2 transition-all duration-300 ${item.completed
                                ? 'bg-emerald-50 border-emerald-500/30'
                                : 'bg-white border-transparent hover:border-slate-200 shadow-sm hover:shadow-md'
                                } ${completed ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            <div className="flex items-center gap-6">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${item.completed ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                                    }`}>
                                    {item.completed ? <CheckCircle className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                                </div>
                                <div className="text-left">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">ITEM 0{index + 1}</span>
                                    <h4 className={`text-lg font-bold transition-colors ${item.completed ? 'text-emerald-900' : 'text-slate-700'}`}>
                                        {item.label}
                                    </h4>
                                </div>
                            </div>
                            <div className={`p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${item.completed ? 'text-emerald-500' : 'text-slate-300'}`}>
                                <Shield className="w-5 h-5" />
                            </div>
                        </button>
                    ))}
                </div>

                {/* Submit Section */}
                <div className="mt-12 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${completed ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                            {completed ? <CheckCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                        </div>
                        <div>
                            <p className="font-bold text-slate-900 uppercase text-xs tracking-widest">{completed ? 'VERIFICADO' : 'STATUS PENDENTE'}</p>
                            <p className="text-slate-500 text-sm">{completed ? 'Este protocolo já está completo para hoje.' : 'Ainda há itens pendentes de verificação.'}</p>
                        </div>
                    </div>

                    {!completed ? (
                        <button
                            onClick={handleSubmit}
                            disabled={submitting || progress < 100}
                            className="w-full md:w-auto px-10 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-500 text-white font-black rounded-2xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-3 uppercase text-xs tracking-widest"
                        >
                            {submitting ? 'PROCESSANDO...' : 'FINALIZAR PROTOCOLO'}
                            <Send className="w-4 h-4" />
                        </button>
                    ) : (
                        <div className="px-8 py-3 bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                            Finalizado: {new Date().toLocaleTimeString('pt-BR')}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
