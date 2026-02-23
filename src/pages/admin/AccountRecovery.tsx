import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Mail, ArrowLeft, CheckCircle, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import NavigationControls from '../../components/NavigationControls';

type RecoveryStep = 'email' | 'success';

export default function AccountRecoveryFlow() {
    const [step, setStep] = useState<RecoveryStep>('email');
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSendReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(
                email,
                { redirectTo: window.location.origin + '/reset-password' }
            );

            if (resetError) throw resetError;
            setStep('success');
        } catch (err: any) {
            setError(err.message || 'Erro ao enviar e-mail de recuperação');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <NavigationControls />
                {step === 'email' ? (
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        {/* Header */}
                        <div className="text-center mb-8">
                            <div className="inline-flex p-4 bg-emerald-100 rounded-full mb-4">
                                <Lock className="w-8 h-8 text-emerald-600" />
                            </div>
                            <h1 className="text-2xl font-bold text-slate-900 mb-2">Recuperar Acesso</h1>
                            <p className="text-slate-600">
                                Digite seu e-mail cadastrado para receber instruções de recuperação
                            </p>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSendReset} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    E-mail
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        placeholder="seu@email.com"
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
                            </button>
                        </form>

                        {/* Back Link */}
                        <Link
                            to="/admin/login"
                            className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-600 hover:text-emerald-600 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Voltar ao Login
                        </Link>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
                        <div className="inline-flex p-4 bg-emerald-100 rounded-full mb-6">
                            <CheckCircle className="w-12 h-12 text-emerald-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 mb-3">E-mail Enviado!</h1>
                        <p className="text-slate-600 mb-6">
                            Verifique sua caixa de entrada em <strong>{email}</strong> e siga as instruções para
                            redefinir sua senha.
                        </p>
                        <Link
                            to="/admin/login"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Voltar ao Login
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
