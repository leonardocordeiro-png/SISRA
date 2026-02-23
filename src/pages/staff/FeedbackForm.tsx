import { useState } from 'react';
import NavigationControls from '../../components/NavigationControls';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { MessageSquare, Send, CheckCircle } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

type FeedbackCategory = 'bug' | 'feature' | 'improvement' | 'other';

export default function StaffFeedbackForm() {
    const { user } = useAuth();
    const toast = useToast();
    const [category, setCategory] = useState<FeedbackCategory>('improvement');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            // Get user's school
            const { data: userData } = await supabase
                .from('usuarios')
                .select('escola_id')
                .eq('id', user?.id)
                .single();

            await supabase.from('staff_feedback').insert({
                user_id: user?.id,
                escola_id: userData?.escola_id,
                category,
                message,
                status: 'pending'
            });

            setSubmitted(true);
            setMessage('');
            setTimeout(() => setSubmitted(false), 3000);
        } catch (err) {
            console.error('Error submitting feedback:', err);
            toast.error('Erro ao enviar feedback', 'Tente novamente mais tarde.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-3xl mx-auto">
                <div className="mb-6">
                    <NavigationControls />
                    <div className="flex items-center gap-3 mb-2">
                        <MessageSquare className="w-8 h-8 text-emerald-600" />
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900">Feedback & Sugestões</h1>
                            <p className="text-slate-600">Ajude-nos a melhorar o La Salle, Cheguei!</p>
                        </div>
                    </div>
                </div>

                {submitted ? (
                    <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                        <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Obrigado!</h2>
                        <p className="text-slate-600">
                            Seu feedback foi enviado e será analisado pela equipe de desenvolvimento.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-8 space-y-6">
                        {/* Category */}
                        <div>
                            <label className="block text-sm font-bold text-slate-900 mb-3">
                                Categoria
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setCategory('bug')}
                                    className={`p-4 rounded-lg border-2 transition-all ${category === 'bug'
                                        ? 'bg-red-600 text-white border-transparent'
                                        : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                                        }`}
                                >
                                    <p className="font-bold text-sm">🐛 Reportar Bug</p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setCategory('feature')}
                                    className={`p-4 rounded-lg border-2 transition-all ${category === 'feature'
                                        ? 'bg-blue-600 text-white border-transparent'
                                        : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                                        }`}
                                >
                                    <p className="font-bold text-sm">✨ Nova Funcionalidade</p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setCategory('improvement')}
                                    className={`p-4 rounded-lg border-2 transition-all ${category === 'improvement'
                                        ? 'bg-emerald-600 text-white border-transparent'
                                        : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                                        }`}
                                >
                                    <p className="font-bold text-sm">💡 Melhoria</p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setCategory('other')}
                                    className={`p-4 rounded-lg border-2 transition-all ${category === 'other'
                                        ? 'bg-purple-600 text-white border-transparent'
                                        : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                                        }`}
                                >
                                    <p className="font-bold text-sm">📝 Outro</p>
                                </button>
                            </div>
                        </div>

                        {/* Message */}
                        <div>
                            <label className="block text-sm font-bold text-slate-900 mb-2">
                                Descreva seu feedback
                            </label>
                            <textarea
                                required
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Seja o mais detalhado possível para nos ajudar a entender melhor..."
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 min-h-[200px] resize-none"
                            />
                            <p className="text-xs text-slate-500 mt-2">
                                Mínimo 20 caracteres • {message.length}/1000
                            </p>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={submitting || message.length < 20}
                            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-all"
                        >
                            <Send className="w-5 h-5" />
                            {submitting ? 'Enviando...' : 'Enviar Feedback'}
                        </button>
                    </form>
                )}

                {/* Tips */}
                <div className="mt-6 bg-blue-50 rounded-xl p-6">
                    <h3 className="text-sm font-bold text-blue-900 mb-3">💬 Dicas para um bom feedback:</h3>
                    <ul className="text-sm text-blue-800 space-y-2">
                        <li>• <strong>Reportando bugs:</strong> Descreva quando ocorre, o que você esperava, e o que aconteceu</li>
                        <li>• <strong>Sugerindo features:</strong> Explique o problema que a funcionalidade resolveria</li>
                        <li>• <strong>Melhorias:</strong> Seja específico sobre o que poderia ser melhor e como</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
