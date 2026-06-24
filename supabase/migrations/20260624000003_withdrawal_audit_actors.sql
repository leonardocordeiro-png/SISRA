-- =============================================================================
-- SISRA - Withdrawal audit actors
-- =============================================================================
-- Surfaces, in /admin/auditoria-seguranca → "Retiradas", the full chain of who
-- handled each student withdrawal:
--   1. Responsável que retirou        (já registrado em SOLICITACAO_RETIRADA)
--   2. Quem liberou o aluno em sala    (novo: LIBERACAO_SALA)
--   3. Quem liberou na recepção        (novo: operador em CONFIRMACAO_ENTREGA)
--
-- Persists the classroom releaser on the request row so reception delivery and
-- reporting can reference it, and adds the LIBERACAO_SALA action to the
-- "Retiradas" audit tab.
-- =============================================================================

-- 1) Persist the classroom releaser on the request row (id + denormalized name).
ALTER TABLE public.solicitacoes_retirada
  ADD COLUMN IF NOT EXISTS liberado_sala_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS liberado_sala_por_nome text;

COMMENT ON COLUMN public.solicitacoes_retirada.liberado_sala_por
  IS 'Usuário (sala/professor) que liberou o aluno da sala.';
COMMENT ON COLUMN public.solicitacoes_retirada.liberado_sala_por_nome
  IS 'Nome denormalizado de quem liberou o aluno da sala (para auditoria/relatórios).';

-- 2) Include the new LIBERACAO_SALA action in the "Retiradas" (withdrawals) tab.
--    Recreated verbatim with LIBERACAO_SALA added so the audit page filters and
--    tab counts cover the classroom-release event.
CREATE OR REPLACE FUNCTION public.sisra_security_audit_actions_for_tab(p_tab text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(coalesce(p_tab, 'all'))
    WHEN 'auth' THEN ARRAY[
      'LOGIN_SUCESSO', 'LOGIN_FALHA', 'SISTEMA_LOGIN', 'SISTEMA_LOGOUT', 'ACESSO_NEGADO'
    ]::text[]
    WHEN 'data' THEN ARRAY[
      'CADASTRO_ESTUDANTE', 'EDICAO_ESTUDANTE', 'EXCLUSAO_ESTUDANTE',
      'EXCLUSAO_ESTUDANTE_MASSA', 'EXCLUSAO_USUARIO', 'CADASTRO_RESPONSAVEL',
      'REMANEJAMENTO_TURMA', 'LIMPEZA_REGISTROS', 'GERACAO_LINK_ACESSO',
      'EXPORTACAO_DADOS', 'ANALISE', 'MANIPULACAO_DADOS', 'IMPORTACAO_FOTOS_LOTE'
    ]::text[]
    WHEN 'withdrawals' THEN ARRAY[
      'SOLICITACAO_RETIRADA', 'LIBERACAO_SALA', 'CONFIRMACAO_ENTREGA'
    ]::text[]
    WHEN 'qr' THEN ARRAY[
      'GERACAO_CARTAO_QR', 'GERACAO_RELATORIO'
    ]::text[]
    WHEN 'system' THEN ARRAY[
      'ALTERACAO_CONFIGURACAO', 'MANUTENCAO', 'MANIPULACAO_DADOS', 'ASSINATURA_DIARIA'
    ]::text[]
    WHEN 'alerts' THEN ARRAY[
      'LOGIN_FALHA', 'ACESSO_NEGADO', 'EXCLUSAO_ESTUDANTE_MASSA', 'LIMPEZA_REGISTROS'
    ]::text[]
    ELSE ARRAY[]::text[]
  END;
$$;
