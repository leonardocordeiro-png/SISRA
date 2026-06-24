-- =============================================================================
-- SISRA - Atualização de validade dos cartões QR em lote
-- =============================================================================
-- Permite que o admin defina a mesma data de validade para TODOS os cartões QR
-- ativos dos responsáveis vinculados a alunos da sua escola, de uma só vez.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sisra_bulk_update_admin_qr_validity(
  p_escola_id uuid,
  p_expires_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  IF NOT public.sisra_is_school_admin(p_escola_id) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  IF p_expires_at IS NULL
    OR p_expires_at < date_trunc('day', now())
    OR p_expires_at > now() + interval '5 years' THEN
    RAISE EXCEPTION 'VALIDADE_INVALIDA';
  END IF;

  WITH school_guardians AS (
    SELECT DISTINCT ar.responsavel_id AS id
    FROM public.alunos_responsaveis ar
    JOIN public.alunos a ON a.id = ar.aluno_id
    WHERE a.escola_id = p_escola_id
    UNION
    SELECT DISTINCT au.responsavel_id AS id
    FROM public.autorizacoes au
    JOIN public.alunos a ON a.id = au.aluno_id
    WHERE a.escola_id = p_escola_id
      AND coalesce(au.ativa, true) = true
  ),
  upd AS (
    UPDATE public.parent_qr_cards c
    SET expires_at = p_expires_at,
        active = true
    WHERE coalesce(c.active, true) = true
      AND c.responsavel_id IN (SELECT id FROM school_guardians)
    RETURNING c.id
  )
  SELECT count(*)::integer INTO updated_count FROM upd;

  INSERT INTO public.logs_auditoria (
    acao,
    tabela_afetada,
    detalhes,
    escola_id,
    criado_em
  )
  VALUES (
    'GERACAO_CARTAO_QR',
    'parent_qr_cards',
    jsonb_build_object(
      'acao', 'ATUALIZACAO_VALIDADE_LOTE',
      'nova_validade', p_expires_at,
      'cartoes_atualizados', updated_count
    ),
    p_escola_id,
    now()
  );

  RETURN jsonb_build_object('updated', coalesce(updated_count, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.sisra_bulk_update_admin_qr_validity(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sisra_bulk_update_admin_qr_validity(uuid, timestamptz) TO authenticated;
