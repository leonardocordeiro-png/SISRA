import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    CheckCircle2,
    ChevronRight,
    PlayCircle,
    BookOpen,
    Award,
    Sparkles,
    ArrowRight,
    Zap,
    LogOut,
    User as UserIcon,
    Shield
} from 'lucide-react';
import NavigationControls from '../../components/NavigationControls';

type OnboardingStep = {
    id: string;
    title: string;
    description: string;
    icon: any;
    completed: boolean;
};

type StaffOnboarding = {
    id: string;
    user_id: string;
    status: 'pending' | 'in_progress' | 'completed';
    progress: Record<string, boolean>;
    created_at: string;
};

export default function StaffOnboardingDashboard() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [onboarding, setOnboarding] = useState<StaffOnboarding | null>(null);
    const [loading, setLoading] = useState(true);

    const steps: OnboardingStep[] = [
        {
            id: 'profile_setup',
            title: 'Perfil Profissional',
            description: 'Complete suas informações pessoais e adicione uma foto de identificação.',
            icon: UserIcon,
            completed: onboarding?.progress?.profile_setup || false
        },
        {
            id: 'role_selection',
            title: 'Definição de Função',
            description: 'Entenda suas responsabilidades e permissões no sistema.',
            icon: Shield,
            completed: onboarding?.progress?.role_selection || false
        },
        {
            id: 'system_tour',
            title: 'Tour pelo Sistema',
            description: 'Conheça as principais funcionalidades e ferramentas de recepção.',
            icon: PlayCircle,
            completed: onboarding?.progress?.system_tour || false
        },
        {
            id: 'training_videos',
            title: 'Vídeos de Treinamento',
            description: 'Assista aos tutoriais obrigatórios sobre protocolos de segurança.',
            icon: BookOpen,
            completed: onboarding?.progress?.training_videos || false
        }
    ];

    useEffect(() => {
        fetchOnboarding();
    }, [user]);

    const fetchOnboarding = async () => {
        if (!user) return;

        try {
            const { data, error } = await supabase
                .from('staff_onboarding')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (!data) {
                const { data: newData } = await supabase
                    .from('staff_onboarding')
                    .insert({ user_id: user.id, status: 'in_progress', progress: {} })
                    .select()
                    .single();
                setOnboarding(newData);
            } else {
                setOnboarding(data);
            }
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const markStepComplete = async (stepId: string) => {
        if (!onboarding) return;

        const updatedProgress = { ...onboarding.progress, [stepId]: true };
        const allComplete = steps.every(step => updatedProgress[step.id] === true || stepId === step.id);

        const { error } = await supabase
            .from('staff_onboarding')
            .update({
                progress: updatedProgress,
                status: allComplete ? 'completed' : 'in_progress'
            })
            .eq('id', onboarding.id);

        if (!error) {
            fetchOnboarding();
        }
    };

    const progressPercentage = onboarding
        ? (Object.keys(onboarding.progress).length / steps.length) * 100
        : 0;

    const currentStepIndex = steps.findIndex(s => !s.completed);
    const currentStep = currentStepIndex !== -1 ? steps[currentStepIndex] : steps[steps.length - 1];

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Sparkles className="w-12 h-12 text-emerald-500 animate-pulse" />
                    <p className="text-slate-500 font-medium animate-pulse">Preparando seu ambiente...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white font-sans selection:bg-emerald-500/30">
            {/* Top Navigation / Progress */}
            <div className="border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <NavigationControls />
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                                <Zap className="w-6 h-6 text-white" />
                            </div>
                            <span className="font-black text-xl tracking-tighter uppercase italic text-slate-900">La Salle, Cheguei! <span className="text-emerald-500">Launch</span></span>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="hidden md:flex flex-col items-end">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Seu Progresso</span>
                            <span className="text-lg font-black text-slate-900 leading-none">{progressPercentage.toFixed(0)}%</span>
                        </div>
                        <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 transition-all duration-1000 ease-out"
                                style={{ width: `${progressPercentage}%` }}
                            />
                        </div>
                        <button
                            onClick={() => signOut()}
                            className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            <main className="max-w-6xl mx-auto px-6 py-12 lg:py-20">
                {onboarding?.status === 'completed' ? (
                    <div className="text-center py-20 animate-in fade-in zoom-in duration-700">
                        <div className="w-32 h-32 bg-emerald-500 rounded-[40px] flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-emerald-500/30 rotate-12">
                            <Award className="w-16 h-16 text-white -rotate-12" />
                        </div>
                        <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tighter mb-6">
                            Você está <span className="text-emerald-500 italic">Certificado!</span> 🎉
                        </h1>
                        <p className="text-slate-500 text-xl font-medium mb-12 max-w-xl mx-auto leading-relaxed">
                            Seu processo de integração foi concluído com sucesso. Agora você tem acesso total a todas as ferramentas do La Salle, Cheguei!.
                        </p>
                        <button
                            onClick={() => navigate('/admin/dashboard')}
                            className="px-12 py-5 bg-slate-900 hover:bg-black text-white font-black rounded-3xl transition-all shadow-2xl shadow-slate-900/20 uppercase text-xs tracking-[0.2em]"
                        >
                            Acessar Dashboard
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
                        {/* Left Column: Welcome & Current Task */}
                        <div className="lg:col-span-7">
                            <header className="mb-12">
                                <h2 className="text-emerald-500 font-black text-sm uppercase tracking-[0.3em] mb-4 italic">Seja Bem-vindo(a)</h2>
                                <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tighter leading-[0.9] mb-6">
                                    Vamos configurar seu <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-blue-600">Acesso Premium.</span>
                                </h1>
                                <p className="text-slate-500 text-xl font-medium leading-relaxed max-w-xl">
                                    O La Salle, Cheguei! é mais do que um sistema, é sua nova ferramenta de trabalho para garantir a segurança dos alunos.
                                </p>
                            </header>

                            {/* Current Active Step Hero */}
                            <div className="bg-[#0f172a] rounded-[40px] p-10 text-white relative overflow-hidden shadow-2xl shadow-emerald-500/20">
                                <div className="absolute top-0 right-0 p-12 opacity-10">
                                    <currentStep.icon className="w-48 h-48" />
                                </div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-6">
                                        <span className="px-3 py-1 bg-emerald-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest">Missão Atual</span>
                                        <div className="h-px w-20 bg-emerald-500/30" />
                                    </div>
                                    <h3 className="text-3xl font-black mb-4 uppercase italic">0{currentStepIndex + 1}. {currentStep.title}</h3>
                                    <p className="text-slate-400 text-lg mb-8 font-medium max-w-md">
                                        {currentStep.description}
                                    </p>
                                    <button
                                        onClick={() => markStepComplete(currentStep.id)}
                                        className="group flex items-center gap-4 bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-4 rounded-2xl font-black text-xs tracking-widest uppercase transition-all shadow-lg shadow-emerald-500/30"
                                    >
                                        Completar Missão
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Steps Timeline */}
                        <div className="lg:col-span-5">
                            <div className="bg-slate-50 rounded-[40px] p-8 border border-slate-100">
                                <h3 className="text-lg font-black text-slate-900 mb-8 uppercase italic flex items-center gap-2">
                                    <BookOpen className="w-5 h-5 text-emerald-500" />
                                    Roteiro de Integração
                                </h3>

                                <div className="space-y-4">
                                    {steps.map((step, index) => (
                                        <div
                                            key={index}
                                            className={`flex items-center gap-5 p-4 rounded-3xl border-2 transition-all ${currentStep.id === step.id
                                                ? 'bg-white border-emerald-500 shadow-md'
                                                : step.completed
                                                    ? 'bg-emerald-50/50 border-transparent opacity-70'
                                                    : 'bg-transparent border-transparent opacity-40 grayscale'
                                                }`}
                                        >
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${step.completed ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-200 text-slate-400 shadow-sm'
                                                }`}>
                                                {step.completed ? <CheckCircle2 className="w-6 h-6" /> : <step.icon className="w-5 h-5" />}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className={`font-bold text-sm ${currentStep.id === step.id ? 'text-slate-900' : 'text-slate-500'}`}>{step.title}</h4>
                                                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
                                                    {step.completed ? 'Concluído' : currentStep.id === step.id ? 'Em andamento' : 'Bloqueado'}
                                                </p>
                                            </div>
                                            {currentStep.id === step.id && <ChevronRight className="w-5 h-5 text-emerald-500" />}
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-8 pt-8 border-t border-slate-200/60">
                                    <div className="flex gap-4 items-start">
                                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                                            <Award className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <p className="text-xs text-slate-500 leading-relaxed">
                                            Complete todas as missões para liberar seu acesso total e receber seu selo de <span className="text-blue-600 font-bold italic">Operador Certificado</span>.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
