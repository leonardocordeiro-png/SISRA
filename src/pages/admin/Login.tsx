import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Loader2, Eye, EyeOff, Settings } from 'lucide-react';

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
                // Verify role
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
        <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 w-full max-w-full overflow-x-hidden">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 md:p-8 space-y-6 md:space-y-8 border-t-4 border-slate-800">
                <div className="text-center">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-white">
                        <GraduationCap className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">Portal Administrativo</h1>
                    <p className="text-slate-500 mt-2">Gerenciamento do Sistema La Salle, Cheguei!</p>

                    <button
                        onClick={() => navigate('/admin/setup')}
                        className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest group"
                    >
                        <Settings className="w-3 h-3 group-hover:rotate-90 transition-transform" />
                        Configurar Sistema (Setup)
                    </button>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Email Administrativo</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none transition-all"
                            placeholder="admin@escola.com"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Senha</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 outline-none transition-all pr-12"
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Acessando Painel...
                            </>
                        ) : (
                            'Entrar no Painel'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
