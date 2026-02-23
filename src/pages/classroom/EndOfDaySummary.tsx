import { useEffect, useState } from 'react';
import NavigationControls from '../../components/NavigationControls';
import {
    Calendar,
    CheckCircle2,
    Users,
    AlertTriangle,
    MessageSquare,
    ArrowRight,
    Sparkles,
    ShieldCheck,
    Smartphone,
    Download,
    Share2,
    Star
} from 'lucide-react';

type DaySummary = {
    totalPickups: number;
    pendingStudents: number;
    safetyIncidents: number;
    feedbackCount: number;
};

export default function EndOfDaySummary() {
    const [summary, setSummary] = useState<DaySummary>({
        totalPickups: 0,
        pendingStudents: 0,
        safetyIncidents: 0,
        feedbackCount: 0
    });
    const [loading, setLoading] = useState(true);
    const [signed, setSigned] = useState(false);

    useEffect(() => {
        fetchDayStats();
    }, []);

    const fetchDayStats = async () => {
        // Simulating data fetching for the demo/implementation
        // In a real scenario, we would query the database for the current date's stats
        setTimeout(() => {
            setSummary({
                totalPickups: 42,
                pendingStudents: 3,
                safetyIncidents: 0,
                feedbackCount: 5
            });
            setLoading(false);
        }, 1000);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Gerando Relatório Diário...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans selection:bg-emerald-500/30 pb-20">
            {/* Header Section */}
            <div className="bg-slate-900 text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 p-20 opacity-10">
                    <Calendar className="w-64 h-64" />
                </div>
                <div className="max-w-6xl mx-auto px-6 py-16 relative z-10">
                    <NavigationControls />
                    <div className="flex items-center gap-3 mb-6">
                        <span className="px-3 py-1 bg-emerald-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest">Relatório Final</span>
                        <div className="h-px w-20 bg-emerald-500/30" />
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black tracking-tighter leading-none mb-6">
                        Resumo do <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400 italic">Expediente Diário.</span>
                    </h1>
                    <div className="flex flex-wrap items-center gap-8">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                                <Calendar className="w-6 h-6 text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-emerald-400/60 font-black text-[10px] tracking-widest uppercase">Data Atual</p>
                                <p className="font-bold text-lg">{new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                                <Users className="w-6 h-6 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-blue-400/60 font-black text-[10px] tracking-widest uppercase">Turma</p>
                                <p className="font-bold text-lg italic">G5 - Integral Blue</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-6xl mx-auto px-6 -mt-10 relative z-20">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    {[
                        { label: 'Saídas Realizadas', value: summary.totalPickups, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                        { label: 'Aguardando Coleta', value: summary.pendingStudents, icon: Users, color: 'text-purple-500', bg: 'bg-purple-50' },
                        { label: 'Alertas Ativos', value: summary.safetyIncidents, icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-50' },
                        { label: 'Feedbacks Enviados', value: summary.feedbackCount, icon: MessageSquare, color: 'text-blue-500', bg: 'bg-blue-50' }
                    ].map((stat, i) => (
                        <div key={i} className="bg-white rounded-[32px] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 transition-all hover:-translate-y-1">
                            <div className={`w-12 h-12 ${stat.bg} rounded-2xl flex items-center justify-center mb-6`}>
                                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                            </div>
                            <p className="text-slate-400 font-black text-[10px] tracking-widest uppercase mb-1">{stat.label}</p>
                            <p className="text-3xl font-black text-slate-900 tracking-tight leading-none italic">{stat.value}</p>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Insights Card */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-[40px] p-10 shadow-xl shadow-slate-200/50 border border-slate-100">
                            <div className="flex items-center justify-between mb-10">
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3 italic uppercase">
                                    <Sparkles className="w-6 h-6 text-emerald-500" />
                                    Insights de Hoje
                                </h3>
                                <button className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl transition-all">
                                    <Download className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="flex gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                    <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                                        <Smartphone className="w-7 h-7 text-white" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-slate-900 mb-1">Pico de Coleta Digital</h4>
                                        <p className="text-sm text-slate-500 leading-relaxed">
                                            Hoje o horário de maior movimento foi às **17:45**. 92% das autorizações foram feitas via QR Code, aumentando a segurança.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                    <div className="w-14 h-14 bg-blue-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
                                        <ShieldCheck className="w-7 h-7 text-white" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-slate-900 mb-1">Protocolos de Segurança</h4>
                                        <p className="text-sm text-slate-500 leading-relaxed">
                                            O checklist de segurança foi assinado às **07:30**. Todos os itens obrigatórios foram validados com zero incidentes.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Final Signature Card */}
                    <div className="lg:col-span-1">
                        <div className={`rounded-[40px] p-8 transition-all duration-500 ${signed ? 'bg-emerald-500 text-white shadow-2xl shadow-emerald-500/30' : 'bg-white shadow-xl shadow-slate-200/50 border border-slate-100'
                            }`}>
                            {signed ? (
                                <div className="text-center py-10 animate-in fade-in zoom-in">
                                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <CheckCircle2 className="w-12 h-12 text-white" />
                                    </div>
                                    <h3 className="text-2xl font-black mb-2 italic">Expediente Encerrado</h3>
                                    <p className="opacity-80 font-medium mb-8">Bom descanso, professor! Seu relatório foi enviado com sucesso.</p>
                                    <button
                                        onClick={() => setSigned(false)}
                                        className="w-full py-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl font-black text-[10px] tracking-widest uppercase transition-all"
                                    >
                                        Reabrir Relatório
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-6">
                                        <Star className="w-8 h-8 text-slate-900" />
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 mb-2 italic uppercase">Finalizar Dia</h3>
                                    <p className="text-slate-500 text-sm font-medium mb-8">Ao assinar, você confirma que todos os alunos foram entregues aos responsáveis autorizados.</p>

                                    <button
                                        onClick={() => setSigned(true)}
                                        className="w-full py-5 bg-slate-900 hover:bg-black text-white font-black rounded-3xl transition-all shadow-xl shadow-slate-950/20 flex items-center justify-center gap-3 uppercase text-xs tracking-[0.2em]"
                                    >
                                        Assinar Relatório
                                        <ArrowRight className="w-4 h-4" />
                                    </button>

                                    <p className="mt-6 text-center text-slate-400 text-[10px] uppercase font-black tracking-widest leading-relaxed">
                                        Sua assinatura digital será <br /> registrada com timestamp.
                                    </p>
                                </>
                            )}
                        </div>

                        {/* Quick Actions */}
                        <div className="mt-6 grid grid-cols-2 gap-4">
                            <button className="flex flex-col items-center justify-center py-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:bg-slate-50 transition-all">
                                <Share2 className="w-5 h-5 text-slate-400 mb-2" />
                                <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Compartilhar</span>
                            </button>
                            <button className="flex flex-col items-center justify-center py-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:bg-slate-50 transition-all">
                                <Download className="w-5 h-5 text-slate-400 mb-2" />
                                <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Baixar PDF</span>
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
