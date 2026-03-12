import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/audit';
import { useAuth } from '../../context/AuthContext';
import { AlertTriangle, X, Bell } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

type AlertType = 'FIRE' | 'LOCKDOWN' | 'MEDICAL' | 'EVACUATE' | 'CUSTOM';

export default function EmergencyAlert() {
    const { user } = useAuth();
    const toast = useToast();
    const [showModal, setShowModal] = useState(false);
    const [alertType, setAlertType] = useState<AlertType>('CUSTOM');
    const [customMessage, setCustomMessage] = useState('');
    const [sending, setSending] = useState(false);

    const alertTemplates: Record<AlertType, { title: string; message: string; color: string }> = {
        FIRE: {
            title: '🔥 INCÊNDIO',
            message: 'Alarme de incêndio ativado. Proceda com evacuação imediata conforme protocolo.',
            color: 'bg-red-600'
        },
        LOCKDOWN: {
            title: '🔒 CONFINAMENTO',
            message: 'Ameaça identificada. Trancar portas, apagar luzes, permanecer em silêncio.',
            color: 'bg-slate-900'
        },
        MEDICAL: {
            title: '🚑 EMERGÊNCIA MÉDICA',
            message: 'Emergência médica em andamento. Equipe de primeiros socorros, favor se dirigir à recepção.',
            color: 'bg-amber-600'
        },
        EVACUATE: {
            title: '⚠️ EVACUAÇÃO',
            message: 'Evacuação geral da escola. Seguir para ponto de encontro conforme treinamento.',
            color: 'bg-orange-600'
        },
        CUSTOM: {
            title: '📢 ALERTA PERSONALIZADO',
            message: customMessage,
            color: 'bg-purple-600'
        }
    };

    const handleSendAlert = async () => {
        setSending(true);

        try {
            const alert = alertTemplates[alertType];

            // Get user's school
            const { data: userData } = await supabase
                .from('usuarios')
                .select('escola_id')
                .eq('id', user?.id)
                .single();

            // Create system announcement
            await supabase.from('system_announcements').insert({
                escola_id: userData?.escola_id,
                title: alert.title,
                content: alert.message,
                priority: 'urgent',
                created_by: user?.id
            });

            // Log audit trail
            await logAudit('MANUTENCAO', 'system_announcements', undefined, {
                tipo: 'EMERGENCY_ALERT',
                titulo: alert.title,
                message: `Alerta de emergência enviado: ${alert.title}`,
            }, user?.id, userData?.escola_id);

            // TODO: Send real-time notification via Supabase Realtime
            // This would trigger push notifications to all connected clients

            toast.success('Alerta enviado', 'Alerta de emergência enviado com sucesso!');
            setShowModal(false);
            setCustomMessage('');
        } catch (err) {
            console.error('Error sending alert:', err);
            toast.error('Erro ao enviar alerta', 'Tente novamente.');
        } finally {
            setSending(false);
        }
    };

    return (
        <>
            {/* Trigger Button */}
            <button
                onClick={() => setShowModal(true)}
                className="fixed bottom-6 right-6 p-4 bg-red-600 text-white rounded-full shadow-2xl hover:bg-red-700 transition-all hover:scale-110 z-50"
                title="Alerta de emergência"
            >
                <Bell className="w-6 h-6 animate-pulse" />
            </button>

            {/* Modal */}
            {showModal && (
                <>
                    <div className="fixed inset-0 bg-black/70 z-50" onClick={() => setShowModal(false)} />
                    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            {/* Header */}
                            <div className="bg-red-600 text-white p-6 flex items-center justify-between rounded-t-2xl">
                                <div className="flex items-center gap-3">
                                    <AlertTriangle className="w-8 h-8" />
                                    <div>
                                        <h2 className="text-2xl font-bold">Alerta de Emergência</h2>
                                        <p className="text-red-100 text-sm">Sistema de Notificação Emergencial</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="p-2 hover:bg-red-700 rounded-lg"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-6">
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                    <p className="text-sm text-amber-900 font-medium">
                                        ⚠️ Use apenas em situações de real emergência. Este alerta será enviado
                                        imediatamente para toda a equipe da escola.
                                    </p>
                                </div>

                                {/* Alert Types */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-900 mb-3">
                                        Tipo de Emergência
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {(Object.keys(alertTemplates) as AlertType[]).filter(key => key !== 'CUSTOM').map((key) => (
                                            <button
                                                key={key}
                                                onClick={() => setAlertType(key)}
                                                className={`p-4 rounded-lg border-2 transition-all ${alertType === key
                                                    ? `${alertTemplates[key].color} text-white border-transparent`
                                                    : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                                                    }`}
                                            >
                                                <p className="font-bold text-sm">{alertTemplates[key].title}</p>
                                            </button>
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => setAlertType('CUSTOM')}
                                        className={`w-full mt-3 p-4 rounded-lg border-2 transition-all ${alertType === 'CUSTOM'
                                            ? 'bg-purple-600 text-white border-transparent'
                                            : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                                            }`}
                                    >
                                        <p className="font-bold text-sm">📢 MENSAGEM PERSONALIZADA</p>
                                    </button>
                                </div>

                                {/* Message Preview */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-900 mb-2">
                                        Mensagem que será enviada
                                    </label>
                                    {alertType === 'CUSTOM' ? (
                                        <textarea
                                            value={customMessage}
                                            onChange={(e) => setCustomMessage(e.target.value)}
                                            placeholder="Digite sua mensagem de emergência..."
                                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 min-h-[100px]"
                                        />
                                    ) : (
                                        <div className="p-4 bg-slate-50 rounded-lg">
                                            <p className="text-slate-700">{alertTemplates[alertType].message}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="p-6 border-t flex gap-3">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-6 py-3 border border-slate-300 rounded-lg font-medium hover:bg-slate-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSendAlert}
                                    disabled={sending || (alertType === 'CUSTOM' && !customMessage.trim())}
                                    className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:opacity-50"
                                >
                                    {sending ? 'Enviando...' : 'ENVIAR ALERTA AGORA'}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
