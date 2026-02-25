import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Loader2, ChevronRight, AlertCircle } from 'lucide-react';

export default function ReceptionLogin() {
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
                // Verify role
                const { data: userData, error: userError } = await supabase
                    .from('usuarios')
                    .select('tipo_usuario')
                    .eq('id', data.user.id)
                    .single();

                if (userError) throw userError;

                if (userData.tipo_usuario !== 'RECEPCIONISTA' && userData.tipo_usuario !== 'ADMIN' && userData.tipo_usuario !== 'COORDENADOR') {
                    await supabase.auth.signOut();
                    throw new Error('Acesso não autorizado para este perfil.');
                }

                navigate('/recepcao/busca');
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao realizar login');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 sm:p-8 overflow-hidden relative font-sans">
            {/* Advanced Background with Animated Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[160px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[160px] animate-pulse delay-1000"></div>

            <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 bg-white/5 backdrop-blur-2xl rounded-[2.5rem] md:rounded-[4rem] shadow-[0_0_80px_rgba(0,0,0,0.4)] overflow-hidden relative z-10 border border-white/10 ring-1 ring-white/5">

                {/* Left Side: Brand/Visual (40%) */}
                <div className="hidden lg:flex lg:col-span-5 flex-col justify-between p-16 bg-gradient-to-br from-slate-950 via-[#0f172a] to-emerald-950 relative overflow-hidden">
                    {/* Decorative Geometric Overlay */}
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
                        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <defs>
                                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                                    <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5" />
                                </pattern>
                            </defs>
                            <rect width="100" height="100" fill="url(#grid)" />
                        </svg>
                    </div>

                    <div className="relative z-10">
                        <div className="w-20 h-20 bg-emerald-500/10 backdrop-blur-xl border border-emerald-500/20 rounded-3xl flex items-center justify-center mb-10 shadow-inner group">
                            <Lock className="w-10 h-10 text-emerald-400 group-hover:scale-110 transition-transform duration-500" />
                        </div>
                        <h2 className="text-7xl font-black text-white italic tracking-tighter leading-[0.9] mb-8 uppercase">
                            Terminal <br /> <span className="text-emerald-500">Recepção</span>
                        </h2>
                        <div className="flex gap-2">
                            <div className="w-12 h-1.5 bg-emerald-500 rounded-full"></div>
                            <div className="w-4 h-1.5 bg-emerald-500/30 rounded-full"></div>
                        </div>
                    </div>

                    <div className="relative z-10">
                        <p className="text-slate-400 font-medium text-xl leading-relaxed italic opacity-80 decoration-emerald-500/30 underline-offset-4 decoration-2">
                            Segurança inteligente para a rotina escolar de quem protege.
                        </p>
                    </div>
                </div>

                {/* Right Side: Form (60%) */}
                <div className="lg:col-span-7 p-8 sm:p-20 flex flex-col justify-center bg-[#050a18]/40 backdrop-blur-md">
                    <div className="mb-12 text-center lg:text-left">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></div>
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Sistema Ativo</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter mb-4 uppercase leading-none">Acesso Seguro</h1>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[11px] opacity-60">Autenticação de Operador</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-8">
                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.25em] ml-2 flex items-center gap-2">
                                <Mail className="w-3 h-3" />
                                E-mail Corporativo
                            </label>
                            <div className="relative group">
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-8 py-5 rounded-3xl bg-white/[0.03] border-2 border-white/5 text-white placeholder-slate-600 focus:border-emerald-500/50 focus:bg-white/[0.05] focus:ring-0 outline-none transition-all text-lg md:text-xl font-medium shadow-2xl"
                                    placeholder="recepcao@lasalle.org.br"
                                />
                                <div className="absolute bottom-0 left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/0 to-transparent group-focus-within:via-emerald-500/50 transition-all duration-700"></div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.25em] ml-2 flex items-center gap-2">
                                <Lock className="w-3 h-3" />
                                Senha de Acesso
                            </label>
                            <div className="relative group">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-8 py-5 rounded-3xl bg-white/[0.03] border-2 border-white/5 text-white placeholder-slate-600 focus:border-emerald-500/50 focus:bg-white/[0.05] focus:ring-0 outline-none transition-all text-lg md:text-xl font-medium tracking-widest shadow-2xl"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-500 hover:text-emerald-400 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-7 h-7" /> : <Eye className="w-7 h-7" />}
                                </button>
                                <div className="absolute bottom-0 left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/0 to-transparent group-focus-within:via-emerald-500/50 transition-all duration-700"></div>
                            </div>
                        </div>

                        {error && (
                            <div className="p-6 bg-red-500/10 text-red-400 font-bold text-sm rounded-[2rem] border border-red-500/20 flex items-center gap-4 animate-shake backdrop-blur-xl">
                                <AlertCircle className="w-6 h-6 shrink-0" />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-6 md:py-7 rounded-3xl transition-all transform hover:scale-[1.01] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-4 text-xl md:text-2xl uppercase tracking-[0.2em] shadow-[0_10px_40px_rgba(16,185,129,0.25)] group relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                            {loading ? (
                                <Loader2 className="w-8 h-8 animate-spin" />
                            ) : (
                                <>
                                    <span>Entrar no Terminal</span>
                                    <ChevronRight className="w-6 h-6 md:w-8 md:h-8 group-hover:translate-x-2 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-16 text-center lg:text-left flex flex-col sm:flex-row items-center justify-between gap-6 opacity-40 hover:opacity-100 transition-opacity duration-500">
                        <a href="#" className="text-[11px] font-black text-slate-500 hover:text-emerald-500 uppercase tracking-widest transition-colors">
                            Esqueceu sua senha?
                        </a>
                        <p className="text-slate-500 font-bold text-[11px] uppercase tracking-widest">
                            v{__APP_VERSION__} • La Salle, Cheguei!
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
