-- =============================================================================
-- SISRA - Fix "column responsaveis.parentesco does not exist" in payload RPCs
-- =============================================================================
-- Three guardian-payload RPCs still selected r.parentesco from public.responsaveis,
-- which has no parentesco column. Any call raised
-- "column responsaveis.parentesco does not exist", surfacing in the UI as
-- "Erro ao buscar responsaveis / Verifique sua permissão" (admin QR cards) and
-- breaking reception/totem guardian lookups.
--
-- Parentesco is a per-link attribute on public.autorizacoes, so each payload now
-- derives a representative parentesco from autorizacoes (preferring active links).
-- =============================================================================

-- 1. sisra_guardian_student_payload (reception/portal guardian lookup)
CREATE OR REPLACE FUNCTION public.sisra_guardian_student_payload(
  p_responsavel_id uuid,
  p_escola_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  guardian jsonb;
  students jsonb;
  block_reason text;
BEGIN
  block_reason := public.sisra_public_access_block_reason(p_escola_id, false);
  IF block_reason IS NOT NULL THEN
    RAISE EXCEPTION '%', block_reason;
  END IF;

  SELECT jsonb_build_object(
    'id', r.id,
    'nome_completo', r.nome_completo,
    'foto_url', r.foto_url,
    'parentesco', (
      SELECT au.parentesco
      FROM public.autorizacoes au
      WHERE au.responsavel_id = r.id
        AND nullif(btrim(coalesce(au.parentesco, '')), '') IS NOT NULL
      ORDER BY coalesce(au.ativa, true) DESC
      LIMIT 1
    )
  )
  INTO guardian
  FROM public.responsaveis r
  WHERE r.id = p_responsavel_id;

  IF guardian IS NULL THEN
    RETURN jsonb_build_object('guardian', NULL, 'students', '[]'::jsonb);
  END IF;

  SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object(
    'id', a.id,
    'nome_completo', a.nome_completo,
    'turma', a.turma,
    'sala', a.sala,
    'foto_url', a.foto_url,
    'escola_id', a.escola_id
  )), '[]'::jsonb)
  INTO students
  FROM public.alunos a
  WHERE (p_escola_id IS NULL OR a.escola_id = p_escola_id)
    AND (
      EXISTS (
        SELECT 1
        FROM public.alunos_responsaveis ar
        WHERE ar.aluno_id = a.id
          AND ar.responsavel_id = p_responsavel_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.autorizacoes au
        WHERE au.aluno_id = a.id
          AND au.responsavel_id = p_responsavel_id
          AND coalesce(au.ativa, true) = true
      )
    );

  RETURN jsonb_build_object('guardian', guardian, 'students', students);
END;
$$;

-- 2. sisra_get_students_guardians (totem: guardians for selected students)
CREATE OR REPLACE FUNCTION public.sisra_get_students_guardians(
  p_aluno_ids  uuid[],
  p_escola_id  uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  filtered_ids uuid[];
  guardians    jsonb;
BEGIN
  IF p_escola_id IS NOT NULL THEN
    SELECT array_agg(a.id)
    INTO filtered_ids
    FROM public.alunos a
    WHERE a.id = ANY(p_aluno_ids)
      AND a.escola_id = p_escola_id;
  ELSE
    filtered_ids := p_aluno_ids;
  END IF;

  IF filtered_ids IS NULL OR array_length(filtered_ids, 1) = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object(
    'id',            r.id,
    'nome_completo', r.nome_completo,
    'foto_url',      r.foto_url,
    'parentesco',    (
      SELECT au.parentesco
      FROM public.autorizacoes au
      WHERE au.responsavel_id = r.id
        AND au.aluno_id = ANY(filtered_ids)
        AND nullif(btrim(coalesce(au.parentesco, '')), '') IS NOT NULL
      ORDER BY coalesce(au.ativa, true) DESC
      LIMIT 1
    )
  )), '[]'::jsonb)
  INTO guardians
  FROM public.responsaveis r
  WHERE (
    EXISTS (
      SELECT 1 FROM public.alunos_responsaveis ar
      WHERE ar.aluno_id = ANY(filtered_ids)
        AND ar.responsavel_id = r.id
    )
    OR EXISTS (
      SELECT 1 FROM public.autorizacoes au
      WHERE au.aluno_id = ANY(filtered_ids)
        AND au.responsavel_id = r.id
        AND coalesce(au.ativa, true) = true
    )
  );

  RETURN guardians;
END;
$$;

-- 3. sisra_admin_qr_guardian_payload (admin QR card generation/search)
CREATE OR REPLACE FUNCTION public.sisra_admin_qr_guardian_payload(
  p_escola_id uuid,
  p_responsavel_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', r.id,
    'nome_completo', r.nome_completo,
    'cpf', r.cpf,
    'telefone', r.telefone,
    'foto_url', r.foto_url,
    'parentesco', (
      SELECT au.parentesco
      FROM public.autorizacoes au
      WHERE au.responsavel_id = r.id
        AND nullif(btrim(coalesce(au.parentesco, '')), '') IS NOT NULL
      ORDER BY coalesce(au.ativa, true) DESC
      LIMIT 1
    ),
    'codigo_acesso', r.codigo_acesso,
    'qr_code', c.qr_code,
    'expires_at', c.expires_at,
    'alunos_count', coalesce(linked.alunos_count, 0),
    'aluno_nomes', coalesce(linked.aluno_nomes, '[]'::jsonb)
  )
  INTO payload
  FROM public.responsaveis r
  LEFT JOIN LATERAL (
    SELECT c.qr_code, c.expires_at
    FROM public.parent_qr_cards c
    WHERE c.responsavel_id = r.id
      AND coalesce(c.active, true) = true
      AND (c.expires_at IS NULL OR c.expires_at > now())
    ORDER BY c.created_at DESC
    LIMIT 1
  ) c ON true
  LEFT JOIN LATERAL (
    SELECT
      count(*)::integer AS alunos_count,
      coalesce(jsonb_agg(ls.nome_completo ORDER BY ls.nome_completo), '[]'::jsonb) AS aluno_nomes
    FROM (
      SELECT DISTINCT a.id, a.nome_completo
      FROM public.alunos a
      WHERE a.escola_id = p_escola_id
        AND (
          EXISTS (
            SELECT 1
            FROM public.alunos_responsaveis ar
            WHERE ar.aluno_id = a.id
              AND ar.responsavel_id = r.id
          )
          OR EXISTS (
            SELECT 1
            FROM public.autorizacoes au
            WHERE au.aluno_id = a.id
              AND au.responsavel_id = r.id
              AND coalesce(au.ativa, true) = true
          )
        )
    ) ls
  ) linked ON true
  WHERE r.id = p_responsavel_id
    AND public.sisra_admin_qr_guardian_has_student(p_escola_id, r.id);

  RETURN payload;
END;
$$;
