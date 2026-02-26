import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface InactivityTimerProps {
    timeoutMs?: number;
    redirectTo?: string;
    onTimeout?: () => void;
}

/**
 * Detecta inatividade do usuário (sem toque/click/movimento) e executa
 * callback ou redireciona após o timeout. Deve ser montado nas páginas do totem.
 */
export function useInactivityTimer({
    timeoutMs = 30000,
    redirectTo = '/totem',
    onTimeout,
}: InactivityTimerProps = {}) {
    const navigate = useNavigate();
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const resetTimer = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            if (onTimeout) onTimeout();
            else navigate(redirectTo);
        }, timeoutMs);
    }, [timeoutMs, redirectTo, onTimeout, navigate]);

    useEffect(() => {
        const events = ['touchstart', 'touchmove', 'mousedown', 'mousemove', 'keydown', 'scroll'];
        events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
        resetTimer();
        return () => {
            events.forEach(e => window.removeEventListener(e, resetTimer));
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [resetTimer]);
}
