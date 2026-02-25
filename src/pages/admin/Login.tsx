import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Shield, Loader2, Eye, EyeOff, Lock, Mail, Activity, ChevronRight, AlertCircle } from 'lucide-react';

export default function AdminLogin() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            if (data.user) {
                const { data: userData, error: userError } = await supabase
                    .from('usuarios')
                    .select('tipo_usuario')
                    .eq('id', data.user.id)
                    .single();

                if (userError) throw userError;

                if (userData.tipo_usuario !== 'ADMIN') {
                    await supabase.auth.signOut();
                    throw new Error('Acesso exclusivo para administradores.');
                }

                navigate('/admin/dashboard');
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao realizar login admin');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 w-full max-w-full overflow-x-hidden relative selection:bg-slate-500/30">
            {/* Ambient HUD Layer */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[70%] h-[70%] bg-slate-500/[0.03] blur-[120px] rounded-full animate-pulse-slow" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/[0.03] blur-[120px] rounded-full animate-pulse-slow" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
            </div>

            <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-1000">
                {/* Tactical Manifest Header */}
                <div className="text-center mb-12 space-y-4">
                    <div className="relative inline-block group">
                        <div className="absolute -inset-4 bg-slate-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 animate-pulse"></div>
                        <div className="relative w-20 h-20 bg-[#020617] rounded-3xl border border-white/10 flex items-center justify-center shadow-2xl backdrop-blur-xl group-hover:border-slate-500/40 transition-all duration-500">
                            <Shield className="w-10 h-10 text-slate-400 group-hover:scale-110 transition-transform duration-500" />
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-slate-500 rounded-lg border-4 border-[#020617] flex items-center justify-center">
                                <Activity className="w-3 h-3 text-[#020617] animate-pulse" />
                            </div>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">Manifesto de Comando</h1>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center justify-center gap-2">
                            <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-pulse"></span>
                            Portal Administrativo Seguro
                        </p>
                    </div>
                </div>

                {/* Glassmorphism Command Card */}
                <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 md:p-10 backdrop-blur-3xl shadow-2xl relative overflow-hidden group/card shadow-slate-900/50">
                    <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-slate-500/20 to-transparent top-0 animate-scan opacity-30" />

                    <form onSubmit={handleLogin} className="space-y-8 relative z-10">
                        <div className="space-y-6">
                            {/* Email Field */}
                            <div className="space-y-2 group/input">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                                    <Mail className="w-3 h-3" />
                                    Identidade de Acesso
                                </label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-[#020617]/50 border border-white/5 rounded-2xl px-6 py-4 text-white font-mono placeholder:text-slate-700 focus:outline-none focus:border-slate-500/50 focus:ring-4 focus:ring-slate-500/10 transition-all duration-500"
                                        placeholder="admin@lasalle.org.br"
                                    />
                                </div>
                            </div>

                            {/* Password Field */}
                            <div className="space-y-2 group/input">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                                    <Lock className="w-3 h-3" />
                                    Senha de Segurança
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-[#020617]/50 border border-white/5 rounded-2xl px-6 py-4 text-white font-mono placeholder:text-slate-700 focus:outline-none focus:border-slate-500/50 focus:ring-4 focus:ring-slate-500/10 transition-all duration-500"
                                        placeholder="••••••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-xs font-bold flex items-start gap-4 animate-in slide-in-from-top-2">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <span className="uppercase tracking-tight leading-relaxed">{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full relative group/btn overflow-hidden rounded-[2rem] py-5 px-8 bg-white/5 border border-white/10 hover:border-slate-500/50 transition-all duration-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group/submit"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-slate-500/0 via-slate-500/20 to-slate-500/0 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-1000" />

                            <div className="relative z-10 flex items-center justify-center gap-4">
                                {loading ? (
                                    <>
                                        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                                        <span className="text-sm font-black text-white uppercase italic tracking-[0.3em]">Autenticando...</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-sm font-black text-white uppercase italic tracking-[0.3em]">Iniciar Acesso</span>
                                        <ChevronRight className="w-5 h-5 text-slate-400 group-hover/submit:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </div>
                        </button>
                    </form>
                </div>

                {/* Manifest Footer */}
                <div className="mt-12 pt-8 border-t border-white/5 flex items-center justify-between opacity-50">
                    <div className="space-y-1">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block">Protocolo de Acesso</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">v{__APP_VERSION__} // CRIPTOGRAFADO</span>
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block">Nó do Sistema</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">SISRA.ADM.NODE_07</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
