-- Migration: Expand tipo_solicitacao CHECK constraint
-- to allow 'RECEPCAO' and 'EMERGENCIA' in addition to 'ROTINA'
--
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query)

-- Step 1: Drop the existing restrictive constraint
ALTER TABLE solicitacoes_retirada
    DROP CONSTRAINT IF EXISTS solicitacoes_retirada_tipo_solicitacao_check;

-- Step 2: Re-add constraint with expanded valid values
ALTER TABLE solicitacoes_retirada
    ADD CONSTRAINT solicitacoes_retirada_tipo_solicitacao_check
    CHECK (tipo_solicitacao IN ('ROTINA', 'EMERGENCIA', 'RECEPCAO'));
