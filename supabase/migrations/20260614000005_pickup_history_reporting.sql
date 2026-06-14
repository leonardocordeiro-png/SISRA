-- =============================================================================
-- SISRA - Pickup history reporting hardening
-- =============================================================================
-- Centralizes /admin/historico-retiradas reads behind an admin-only RPC.
-- The browser receives only report-ready fields and masked CPF values.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_solicitacoes_retirada_escola_horario
  ON public.solicitacoes_retirada (escola_id, horario_solicitacao DESC);

CREATE OR REPLACE FUNCTION public.sisra_mask_cpf(p_cpf text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_cpf IS NULL OR btrim(p_cpf) = '' THEN NULL
    WHEN regexp_replace(p_cpf, '\D', '', 'g') ~ '^\d{11}$'
      THEN substring(regexp_replace(p_cpf, '\D', '', 'g') from 1 for 3) || '.***.***-' ||
           substring(regexp_replace(p_cpf, '\D', '', 'g') from 10 for 2)
    ELSE '***.***.***-**'
  END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_admin_pickup_history(
  p_escola_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer DEFAULT 2000
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_limit integer := least(greatest(coalesce(p_limit, 2000), 1), 5000);
  total_count integer := 0;
  items jsonb := '[]'::jsonb;
BEGIN
  IF p_escola_id IS NULL OR NOT public.sisra_is_school_admin(p_escola_id) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
    RAISE EXCEPTION 'PERIODO_INVALIDO';
  END IF;

  SELECT count(*)::integer
  INTO total_count
  FROM public.solicitacoes_retirada sr
  WHERE sr.escola_id = p_escola_id
    AND sr.horario_solicitacao >= p_from
    AND sr.horario_solicitacao <= p_to;

  WITH scoped AS (
    SELECT
      sr.id,
      sr.status,
      sr.tipo_solicitacao,
      sr.horario_solicitacao,
      sr.horario_notificacao,
      sr.horario_confirmacao,
      sr.horario_liberacao,
      sr.tempo_espera_segundos,
      sr.observacoes,
      sr.mensagem_sala,
      sr.mensagem_recepcao,
      a.nome_completo AS aluno_nome,
      a.matricula AS aluno_matricula,
      a.turma AS aluno_turma,
      a.sala AS aluno_sala,
      r.nome_completo AS responsavel_nome,
      public.sisra_mask_cpf(r.cpf) AS responsavel_cpf
    FROM public.solicitacoes_retirada sr
    LEFT JOIN public.alunos a ON a.id = sr.aluno_id AND a.escola_id = p_escola_id
    LEFT JOIN public.responsaveis r ON r.id = sr.responsavel_id
    WHERE sr.escola_id = p_escola_id
      AND sr.horario_solicitacao >= p_from
      AND sr.horario_solicitacao <= p_to
    ORDER BY sr.horario_solicitacao DESC
    LIMIT safe_limit
  )
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'status', status,
      'tipo_solicitacao', tipo_solicitacao,
      'horario_solicitacao', horario_solicitacao,
      'horario_notificacao', horario_notificacao,
      'horario_confirmacao', horario_confirmacao,
      'horario_liberacao', horario_liberacao,
      'tempo_espera_segundos', tempo_espera_segundos,
      'observacoes', observacoes,
      'mensagem_sala', mensagem_sala,
      'mensagem_recepcao', mensagem_recepcao,
      'aluno', jsonb_build_object(
        'nome_completo', aluno_nome,
        'matricula', aluno_matricula,
        'turma', aluno_turma,
        'sala', aluno_sala
      ),
      'responsavel', jsonb_build_object(
        'nome_completo', responsavel_nome,
        'cpf', responsavel_cpf
      )
    )
    ORDER BY horario_solicitacao DESC
  ), '[]'::jsonb)
  INTO items
  FROM scoped;

  RETURN jsonb_build_object(
    'records', items,
    'total_count', total_count,
    'returned_count', jsonb_array_length(items),
    'limit', safe_limit,
    'truncated', total_count > safe_limit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sisra_mask_cpf(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sisra_admin_pickup_history(uuid, timestamptz, timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sisra_admin_pickup_history(uuid, timestamptz, timestamptz, integer) TO authenticated;
