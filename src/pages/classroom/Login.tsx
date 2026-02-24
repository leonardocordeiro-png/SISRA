import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { School, Loader2, Eye, EyeOff, ChevronRight } from 'lucide-react';

export default function ClassroomLogin() {
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
                    .select('tipo_usuario, turma_atribuida')
                    .eq('id', data.user.id)
                    .single();

                if (userError) throw userError;

                if (userData.tipo_usuario !== 'SCT' && userData.tipo_usuario !== 'ADMIN') {
                    await supabase.auth.signOut();
                    throw new Error('Acesso restrito para SCTs.');
                }

                navigate('/sala/dashboard');
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao acessar sala');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 sm:p-8 overflow-hidden relative font-sans">
            {/* Ambient Background with Neon Accents */}
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/10 rounded-full blur-[180px] animate-pulse-slow"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-500/10 rounded-full blur-[180px] animate-pulse-slow delay-1000"></div>

            <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 bg-slate-950/40 backdrop-blur-3xl rounded-[2.5rem] md:rounded-[4rem] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.6)] overflow-hidden relative z-10 ring-1 ring-white/5">

                {/* Left Side: Brand/Visual (40%) */}
                <div className="hidden lg:flex lg:col-span-5 flex-col justify-between p-16 bg-gradient-to-br from-emerald-600 to-emerald-950 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-20 pointer-events-none">
                        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <path d="M0 100 C 20 0 80 0 100 100 Z" fill="rgba(255,255,255,0.1)" />
                        </svg>
                    </div>

                    <div className="relative z-10">
                        <div className="w-20 h-20 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl flex items-center justify-center mb-10 shadow-2xl">
                            <School className="w-10 h-10 text-white" />
                        </div>
                        <h2 className="text-7xl font-black text-white italic tracking-tighter leading-[0.9] mb-8 uppercase">
                            SALA DE <br /> AULA
                        </h2>
                        <div className="w-24 h-2 bg-white/40 rounded-full"></div>
                    </div>

                    <div className="relative z-10">
                        <p className="text-emerald-100 font-medium text-xl leading-relaxed italic opacity-80 border-l-4 border-white/20 pl-6">
                            Gestão em tempo real <br /> para o sucesso do aluno.
                        </p>
                    </div>
                </div>

                {/* Right Side: Form (60%) */}
                <div className="lg:col-span-7 p-8 sm:p-20 flex flex-col justify-center bg-[#050a18]/60 backdrop-blur-md">
                    <div className="mb-12 text-center lg:text-left">
                        <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
                            <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">Portal Administrativo</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter mb-4 uppercase leading-none">Portal do Professor</h1>
                        <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[11px]">Ambiente de Gestão de Sala</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-8">
                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-emerald-500/70 uppercase tracking-[0.25em] ml-2">E-mail da Sala</label>
                            <div className="relative group">
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-8 py-5 rounded-3xl bg-white/[0.03] border-2 border-white/5 text-white placeholder-slate-700 focus:border-emerald-500/50 focus:bg-white/[0.05] focus:ring-0 outline-none transition-all text-lg md:text-xl font-medium shadow-2xl"
                                    placeholder="sala@escola.com"
                                />
                                <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/0 to-transparent group-focus-within:via-emerald-500/50 transition-all duration-700"></div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-emerald-500/70 uppercase tracking-[0.25em] ml-2">Senha Digital</label>
                            <div className="relative group">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-8 py-5 rounded-3xl bg-white/[0.03] border-2 border-white/5 text-white placeholder-slate-700 focus:border-emerald-500/50 focus:bg-white/[0.05] focus:ring-0 outline-none transition-all text-lg md:text-xl font-medium pr-16 shadow-2xl tracking-widest"
                                    placeholder="••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-600 hover:text-emerald-400 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-8 h-8" /> : <Eye className="w-8 h-8" />}
                                </button>
                                <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/0 to-transparent group-focus-within:via-emerald-500/50 transition-all duration-700"></div>
                            </div>
                        </div>

                        {error && (
                            <div className="p-6 bg-red-500/10 text-red-400 font-bold text-sm rounded-[2rem] border border-red-500/20 flex items-center gap-4 animate-shake backdrop-blur-xl">
                                <div className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-6 md:py-7 rounded-3xl transition-all transform hover:scale-[1.01] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-4 text-xl md:text-2xl uppercase tracking-[0.2em] shadow-[0_10px_40px_rgba(16,185,129,0.3)] group relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                            {loading ? (
                                <Loader2 className="w-8 h-8 animate-spin" />
                            ) : (
                                <>
                                    <span>Conectar Terminal</span>
                                    <ChevronRight className="w-6 h-6 md:w-8 md:h-8 group-hover:translate-x-2 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-16 text-center opacity-30 hover:opacity-100 transition-opacity duration-500">
                        <p className="text-slate-500 font-bold text-[11px] uppercase tracking-[0.4em]">
                            Intelligent School Ecosystem • La Salle, Cheguei!
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
