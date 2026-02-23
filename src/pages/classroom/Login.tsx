import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { School, Loader2, Eye, EyeOff } from 'lucide-react';

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
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 sm:p-12 overflow-hidden relative font-sans">
            {/* Background Decorative Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse delay-700"></div>

            <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 bg-slate-900/50 backdrop-blur-3xl rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden relative z-10">
                {/* Left Side: Brand/Visual */}
                <div className="hidden lg:flex flex-col justify-between p-16 bg-gradient-to-br from-emerald-600 to-emerald-900 relative">
                    <div className="absolute inset-0 opacity-20 pointer-events-none">
                        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <path d="M0 100 C 20 0 50 0 100 100 Z" fill="white" />
                        </svg>
                    </div>

                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-8 border border-white/30">
                            <School className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-6xl font-black text-white italic tracking-tighter leading-none mb-6">
                            SALA DE <br /> AULA
                        </h2>
                        <div className="w-20 h-2 bg-white/30 rounded-full"></div>
                    </div>

                    <div className="relative z-10">
                        <p className="text-emerald-100 font-bold text-lg leading-tight opacity-80 italic">
                            "Conectando SCTs e alunos <br /> para uma retirada segura."
                        </p>
                    </div>
                </div>

                {/* Right Side: Form */}
                <div className="p-10 sm:p-16 flex flex-col justify-center">
                    <div className="mb-10 text-center lg:text-left">
                        <h1 className="text-4xl font-black text-white italic tracking-tighter mb-2 uppercase">Acesso Tablet</h1>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Identifique sua sala para iniciar</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] ml-2">E-mail da Sala</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-8 py-5 rounded-3xl bg-slate-800/50 border-2 border-white/5 text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-0 outline-none transition-all text-xl font-medium shadow-inner"
                                placeholder="sala@escola.com"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] ml-2">Senha Digital</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-8 py-5 rounded-3xl bg-slate-800/50 border-2 border-white/5 text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-0 outline-none transition-all text-xl font-medium pr-16 shadow-inner tracking-widest"
                                    placeholder="••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 hover:text-emerald-500 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-7 h-7" /> : <Eye className="w-7 h-7" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="p-5 bg-red-500/10 text-red-400 font-bold text-sm rounded-3xl border border-red-500/20 flex items-center gap-3 animate-shake">
                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-6 rounded-3xl transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-4 text-xl uppercase tracking-widest shadow-2xl shadow-emerald-500/20 group"
                        >
                            {loading ? (
                                <Loader2 className="w-8 h-8 animate-spin" />
                            ) : (
                                <>
                                    Conectar Terminal
                                    <School className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-12 text-center">
                        <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest">
                            Sistema de Retirada Inteligente • La Salle, Cheguei!
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
