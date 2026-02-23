import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X, Copy, ExternalLink } from 'lucide-react';

// ═══════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastAction {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
}

interface ToastItem {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
    actions?: ToastAction[];
}

interface ToastContextType {
    toast: {
        success: (title: string, message?: string, options?: { duration?: number; actions?: ToastAction[] }) => void;
        error: (title: string, message?: string, options?: { duration?: number; actions?: ToastAction[] }) => void;
        info: (title: string, message?: string, options?: { duration?: number; actions?: ToastAction[] }) => void;
        warning: (title: string, message?: string, options?: { duration?: number; actions?: ToastAction[] }) => void;
    };
}

// ═══════════════════════════════════════════════════
// CONTEXTO
// ═══════════════════════════════════════════════════

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast deve ser usado dentro de um ToastProvider');
    }
    return context.toast;
}

// ═══════════════════════════════════════════════════
// COMPONENTE INDIVIDUAL DO TOAST
// ═══════════════════════════════════════════════════

const toastConfig: Record<ToastType, {
    icon: typeof CheckCircle2;
    bg: string;
    border: string;
    iconColor: string;
    titleColor: string;
    progressColor: string;
}> = {
    success: {
        icon: CheckCircle2,
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        iconColor: 'text-emerald-500',
        titleColor: 'text-emerald-900',
        progressColor: 'bg-emerald-400',
    },
    error: {
        icon: AlertCircle,
        bg: 'bg-red-50',
        border: 'border-red-200',
        iconColor: 'text-red-500',
        titleColor: 'text-red-900',
        progressColor: 'bg-red-400',
    },
    info: {
        icon: Info,
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        iconColor: 'text-blue-500',
        titleColor: 'text-blue-900',
        progressColor: 'bg-blue-400',
    },
    warning: {
        icon: AlertTriangle,
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        iconColor: 'text-amber-500',
        titleColor: 'text-amber-900',
        progressColor: 'bg-amber-400',
    },
};

function ToastNotification({
    item,
    onDismiss,
}: {
    item: ToastItem;
    onDismiss: (id: string) => void;
}) {
    const [isExiting, setIsExiting] = useState(false);
    const [progress, setProgress] = useState(100);
    const config = toastConfig[item.type];
    const Icon = config.icon;
    const duration = item.duration ?? (item.type === 'error' ? 6000 : 4000);

    const handleDismiss = useCallback(() => {
        setIsExiting(true);
        setTimeout(() => onDismiss(item.id), 300);
    }, [item.id, onDismiss]);

    useEffect(() => {
        if (duration <= 0) return;

        const startTime = Date.now();
        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
            setProgress(remaining);

            if (remaining <= 0) {
                clearInterval(interval);
                handleDismiss();
            }
        }, 50);

        return () => clearInterval(interval);
    }, [duration, handleDismiss]);

    return (
        <div
            className={`
                w-full max-w-md pointer-events-auto
                ${isExiting ? 'animate-toast-out' : 'animate-toast-in'}
            `}
        >
            <div
                className={`
                    relative overflow-hidden rounded-2xl border shadow-2xl shadow-slate-900/10
                    ${config.bg} ${config.border}
                    backdrop-blur-xl
                `}
            >
                <div className="p-4 flex gap-3">
                    {/* Ícone */}
                    <div className={`flex-shrink-0 mt-0.5 ${config.iconColor}`}>
                        <Icon className="w-5 h-5" />
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${config.titleColor}`}>
                            {item.title}
                        </p>
                        {item.message && (
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed whitespace-pre-line">
                                {item.message}
                            </p>
                        )}

                        {/* Ações */}
                        {item.actions && item.actions.length > 0 && (
                            <div className="flex gap-2 mt-3">
                                {item.actions.map((action, i) => (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            action.onClick();
                                            handleDismiss();
                                        }}
                                        className={`
                                            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                            text-xs font-bold transition-all active:scale-95
                                            ${i === 0
                                                ? 'bg-white shadow-sm border border-slate-200 text-slate-700 hover:bg-slate-50'
                                                : 'text-slate-500 hover:text-slate-700'
                                            }
                                        `}
                                    >
                                        {action.icon}
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Botão fechar */}
                    <button
                        onClick={handleDismiss}
                        className="flex-shrink-0 p-1 rounded-lg hover:bg-black/5 transition-colors"
                    >
                        <X className="w-4 h-4 text-slate-400" />
                    </button>
                </div>

                {/* Barra de progresso */}
                {duration > 0 && (
                    <div className="h-0.5 bg-black/5">
                        <div
                            className={`h-full ${config.progressColor} transition-all duration-100 ease-linear`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const addToast = useCallback((type: ToastType, title: string, message?: string, options?: { duration?: number; actions?: ToastAction[] }) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setToasts(prev => [...prev, { id, type, title, message, ...options }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const toast = {
        success: (title: string, message?: string, options?: { duration?: number; actions?: ToastAction[] }) =>
            addToast('success', title, message, options),
        error: (title: string, message?: string, options?: { duration?: number; actions?: ToastAction[] }) =>
            addToast('error', title, message, options),
        info: (title: string, message?: string, options?: { duration?: number; actions?: ToastAction[] }) =>
            addToast('info', title, message, options),
        warning: (title: string, message?: string, options?: { duration?: number; actions?: ToastAction[] }) =>
            addToast('warning', title, message, options),
    };

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}

            {/* Container dos toasts */}
            <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none max-w-md w-full">
                {toasts.map(item => (
                    <ToastNotification
                        key={item.id}
                        item={item}
                        onDismiss={removeToast}
                    />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

// Exportar ícones úteis para actions
export { Copy, ExternalLink };
