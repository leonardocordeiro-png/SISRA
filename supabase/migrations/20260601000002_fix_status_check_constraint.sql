-- Fix: the status check constraint on solicitacoes_retirada was missing 'CONCLUIDO'.
-- The app uses 'CONCLUIDO' as the final state when a pickup is finalized at reception
-- (WithdrawalQueue.tsx → finalizePickup), but the original constraint only allowed
-- the older set of values. Drop and recreate to include all values the app uses.

ALTER TABLE public.solicitacoes_retirada
    DROP CONSTRAINT IF EXISTS solicitacoes_retirada_status_check;

ALTER TABLE public.solicitacoes_retirada
    ADD CONSTRAINT solicitacoes_retirada_status_check
    CHECK (status IN (
        'SOLICITADO',
        'NOTIFICADO',
        'AGUARDANDO',
        'LIBERADO',
        'CONFIRMADO',
        'CONCLUIDO',
        'CANCELADO',
        'ENTREGUE'
    ));
