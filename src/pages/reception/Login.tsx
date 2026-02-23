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

                if (userData.tipo_usuario !== 'RECEPCIONISTA' && userData.tipo_usuario !== 'ADMIN') {
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
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 sm:p-12 overflow-hidden relative font-sans">
            {/* Background Decorative Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/5 rounded-full blur-[120px]"></div>

            <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 bg-white rounded-[3rem] shadow-2xl overflow-hidden relative z-10 border border-slate-100">
                {/* Left Side: Brand/Visual */}
                <div className="hidden lg:flex flex-col justify-between p-16 bg-[#0f172a] relative">
                    <div className="absolute inset-0 opacity-10 pointer-events-none">
                        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <circle cx="50" cy="50" r="40" fill="white" />
                        </svg>
                    </div>

                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mb-8 shadow-xl shadow-emerald-500/20">
                            <Lock className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-6xl font-black text-white italic tracking-tighter leading-none mb-6 uppercase">
                            Terminal <br /> Recepção
                        </h2>
                        <div className="w-20 h-2 bg-emerald-500 rounded-full"></div>
                    </div>

                    <div className="relative z-10">
                        <p className="text-slate-400 font-bold text-lg leading-tight italic">
                            Controle total de fluxo para <br /> máxima segurança institucional.
                        </p>
                    </div>
                </div>

                {/* Right Side: Form */}
                <div className="p-10 sm:p-16 flex flex-col justify-center bg-white">
                    <div className="mb-10 text-center lg:text-left">
                        <h1 className="text-4xl font-black text-slate-900 italic tracking-tighter mb-2 uppercase">Acesso Seguro</h1>
                        <p className="text-emerald-600 font-black uppercase tracking-widest text-xs">Identifique-se para gerenciar retiradas</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">E-mail Corporativo</label>
                            <div className="relative group">
                                <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-16 pr-8 py-5 rounded-3xl bg-slate-50 border-2 border-slate-100 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-0 outline-none transition-all text-xl font-medium"
                                    placeholder="voce@escola.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Senha de Acesso</label>
                            <div className="relative group">
                                <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-16 pr-16 py-5 rounded-3xl bg-slate-50 border-2 border-slate-100 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-0 outline-none transition-all text-xl font-medium tracking-widest"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 hover:text-emerald-500 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-7 h-7" /> : <Eye className="w-7 h-7" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="p-5 bg-red-50 text-red-600 font-bold text-sm rounded-3xl border border-red-100 flex items-center gap-3 animate-shake">
                                <AlertCircle className="w-5 h-5" />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-6 rounded-3xl transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-4 text-xl uppercase tracking-widest shadow-2xl shadow-emerald-500/20 group"
                        >
                            {loading ? (
                                <Loader2 className="w-8 h-8 animate-spin" />
                            ) : (
                                <>
                                    Entrar no Terminal
                                    <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-12 text-center lg:text-left flex items-center justify-between">
                        <a href="#" className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 uppercase tracking-widest">
                            Esqueceu sua senha?
                        </a>
                        <p className="text-slate-300 font-bold text-[10px] uppercase tracking-widest">
                            v2.4.0 • La Salle, Cheguei!
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
