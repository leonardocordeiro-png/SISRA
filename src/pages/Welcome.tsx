import { Link } from 'react-router-dom';
import { School, User, GraduationCap, Shield, Activity, ChevronRight, Globe } from 'lucide-react';

export default function Welcome() {
    return (
        <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 md:p-12 w-full max-w-full overflow-x-hidden relative selection:bg-emerald-500/30">
            {/* Ultra-Premium Ambient HUD Background */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-emerald-500/[0.03] blur-[120px] rounded-full animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-500/[0.03] blur-[120px] rounded-full animate-pulse-slow" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
                <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent top-1/4 animate-scan opacity-20" />
            </div>

            <div className="w-full max-w-5xl relative z-10 space-y-12 md:space-y-20 animate-in fade-in zoom-in-95 duration-1000">
                {/* Tactical Header */}
                <div className="space-y-8">
                    <div className="flex justify-center">
                        <div className="relative group">
                            <div className="absolute -inset-6 bg-emerald-500/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000 animate-pulse"></div>
                            <div className="relative bg-[#020617]/80 p-6 rounded-[2.5rem] border border-white/10 shadow-2xl backdrop-blur-3xl group-hover:border-emerald-500/40 transition-all duration-700">
                                <School className="w-16 h-16 md:w-20 md:h-20 text-emerald-500 group-hover:scale-110 transition-transform duration-700" />
                                <div className="absolute -top-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full border-4 border-[#020617] flex items-center justify-center shadow-lg">
                                    <Activity className="w-4 h-4 text-[#020617] animate-pulse" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 text-center">
                        <div className="flex items-center justify-center gap-3 mb-2 animate-in slide-in-from-bottom-4 duration-700">
                            <div className="h-px w-8 bg-emerald-500/30" />
                            <span className="text-emerald-500 font-black tracking-[0.4em] text-[10px] uppercase">Terminal de Acesso ao Sistema</span>
                            <div className="h-px w-8 bg-emerald-500/30" />
                        </div>
                        <h1 className="text-4xl md:text-7xl font-black text-white tracking-tighter italic uppercase leading-none">
                            La Salle, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-blue-400 to-violet-400 animate-shimmer bg-[length:200%_auto]">Cheguei!</span>
                        </h1>
                        <p className="text-lg md:text-2xl text-slate-400 max-w-2xl mx-auto font-medium tracking-tight leading-relaxed">
                            Sistema Inteligente de Segurança e Retirada de Alunos.
                            <br className="hidden md:block" />
                            <span className="text-slate-600 font-bold uppercase text-[10px] tracking-[0.2em] mt-4 block italic">Selecione o módulo operacional para iniciar a sequência</span>
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 w-full">
                    {/* Reception */}
                    <Link to="/recepcao/login" className="relative group/card h-full">
                        <div className="absolute -inset-0.5 bg-gradient-to-b from-emerald-500/20 to-transparent rounded-[2.5rem] opacity-0 group-hover/card:opacity-100 transition duration-700 blur"></div>
                        <div className="relative bg-white/[0.02] p-8 md:p-10 rounded-[2.5rem] border border-white/5 backdrop-blur-3xl hover:bg-white/[0.04] hover:border-emerald-500/30 transition-all duration-700 h-full flex flex-col items-center text-center shadow-2xl group/btn active:scale-95">
                            <div className="w-16 h-16 md:w-20 md:h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mb-8 border border-emerald-500/20 group-hover/card:scale-110 group-hover/card:border-emerald-500/40 transition-all duration-700 shadow-2xl shadow-emerald-500/10 overflow-hidden relative">
                                <User className="w-8 h-8 md:w-10 md:h-10 text-emerald-500 relative z-10" />
                                <div className="absolute inset-0 bg-emerald-500/5 group-hover/card:animate-scan"></div>
                            </div>
                            <h2 className="text-2xl font-black text-white mb-3 italic tracking-tighter uppercase">Recepção</h2>
                            <p className="text-slate-500 text-sm font-bold leading-relaxed uppercase tracking-tight mb-8">Controle tático de entrada e saída de ativos.</p>
                            <div className="mt-auto w-full pt-6 border-t border-white/5 flex items-center justify-between group-hover/card:border-emerald-500/20 transition-colors">
                                <span className="text-[10px] font-black text-emerald-500/60 tracking-[0.2em] uppercase">Iniciar Missão</span>
                                <ChevronRight className="w-5 h-5 text-emerald-500 group-hover/card:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    </Link>

                    {/* Classroom (SCT) */}
                    <Link to="/sala/login" className="relative group/card h-full">
                        <div className="absolute -inset-0.5 bg-gradient-to-b from-blue-500/20 to-transparent rounded-[2.5rem] opacity-0 group-hover/card:opacity-100 transition duration-700 blur"></div>
                        <div className="relative bg-white/[0.02] p-8 md:p-10 rounded-[2.5rem] border border-white/5 backdrop-blur-3xl hover:bg-white/[0.04] hover:border-blue-500/30 transition-all duration-700 h-full flex flex-col items-center text-center shadow-2xl group/btn active:scale-95">
                            <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center mb-8 border border-blue-500/20 group-hover/card:scale-110 group-hover/card:border-blue-500/40 transition-all duration-700 shadow-2xl shadow-blue-500/10 overflow-hidden relative">
                                <GraduationCap className="w-8 h-8 md:w-10 md:h-10 text-blue-500 relative z-10" />
                                <div className="absolute inset-0 bg-blue-500/5 group-hover/card:animate-scan"></div>
                            </div>
                            <h2 className="text-2xl font-black text-white mb-3 italic tracking-tighter uppercase">SCT</h2>
                            <p className="text-slate-500 text-sm font-bold leading-relaxed uppercase tracking-tight mb-8">Gestão operacional de sala e liberação.</p>
                            <div className="mt-auto w-full pt-6 border-t border-white/5 flex items-center justify-between group-hover/card:border-blue-500/20 transition-colors">
                                <span className="text-[10px] font-black text-blue-500/60 tracking-[0.2em] uppercase">Portal de Acesso</span>
                                <ChevronRight className="w-5 h-5 text-blue-500 group-hover/card:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    </Link>

                    {/* Admin */}
                    <Link to="/admin/login" className="relative group/card h-full md:col-span-1">
                        <div className="absolute -inset-0.5 bg-gradient-to-b from-slate-500/20 to-transparent rounded-[2.5rem] opacity-0 group-hover/card:opacity-100 transition duration-700 blur"></div>
                        <div className="relative bg-white/[0.02] p-8 md:p-10 rounded-[2.5rem] border border-white/5 backdrop-blur-3xl hover:bg-white/[0.04] hover:border-slate-500/30 transition-all duration-700 h-full flex flex-col items-center text-center shadow-2xl group/btn active:scale-95">
                            <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-500/10 rounded-3xl flex items-center justify-center mb-8 border border-white/10 group-hover/card:scale-110 group-hover/card:border-white/20 transition-all duration-700 shadow-2xl shadow-slate-500/10 overflow-hidden relative">
                                <Shield className="w-8 h-8 md:w-10 md:h-10 text-slate-400 relative z-10" />
                                <div className="absolute inset-0 bg-white/5 group-hover/card:animate-scan"></div>
                            </div>
                            <h2 className="text-2xl font-black text-white mb-3 italic tracking-tighter uppercase">Admin</h2>
                            <p className="text-slate-500 text-sm font-bold leading-relaxed uppercase tracking-tight mb-8">Configurações globais e telemetria de dados.</p>
                            <div className="mt-auto w-full pt-6 border-t border-white/5 flex items-center justify-between group-hover/card:border-white/10 transition-colors">
                                <span className="text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase">Central de Controle</span>
                                <ChevronRight className="w-5 h-5 text-slate-500 group-hover/card:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    </Link>
                </div>

                {/* Tactical Footer Overlay */}
                <div className="pt-12 flex flex-col md:flex-row items-center justify-between gap-6 border-t border-white/5">
                    <div className="flex items-center gap-4 bg-white/[0.02] border border-white/10 px-6 py-3 rounded-2xl backdrop-blur-md">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Operational Status: <span className="text-emerald-500">Nominal</span></span>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Sequência Global</span>
                            <span className="text-xs font-bold text-slate-400">v{__APP_VERSION__} // ESTÁVEL</span>
                        </div>
                        <div className="w-12 h-12 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center group hover:bg-emerald-500/10 transition-all cursor-crosshair">
                            <Globe className="w-5 h-5 text-slate-600 group-hover:text-emerald-500 transition-colors" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
