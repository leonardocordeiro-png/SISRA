-- =============================================================================
-- SISRA - CPF lookup RPC for totem + escola_id fix in guardian list RPC
-- =============================================================================
-- Fixes:
--   1. TotemSearch.tsx used direct anon table queries (broken after 20260316)
--      → New sisra_lookup_guardian_by_cpf SECURITY DEFINER RPC
--   2. sisra_get_students_guardians declared p_escola_id but never used it
--      → Rewrite to filter filtered_ids by escola before returning guardians
-- =============================================================================

-- ── 1. New RPC: guardian + authorized students lookup by CPF ──────────────────
CREATE OR REPLACE FUNCTION public.sisra_lookup_guardian_by_cpf(
  p_cpf        text,
  p_escola_id  uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  responsavel_id uuid;
  clean_cpf      text := public.sisra_normalize_cpf(p_cpf);
BEGIN
  IF length(clean_cpf) <> 11 THEN
    RETURN jsonb_build_object('guardian', NULL, 'students', '[]'::jsonb);
  END IF;

  SELECT r.id INTO responsavel_id
  FROM public.responsaveis r
  WHERE r.cpf = clean_cpf
  LIMIT 1;

  IF responsavel_id IS NULL THEN
    RETURN jsonb_build_object('guardian', NULL, 'students', '[]'::jsonb);
  END IF;

  RETURN public.sisra_guardian_student_payload(responsavel_id, p_escola_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sisra_lookup_guardian_by_cpf(text, uuid) TO anon, authenticated;


-- ── 2. Patch sisra_get_students_guardians to actually honour p_escola_id ───────
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
  -- Filter input IDs to only those belonging to the specified school
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
    'parentesco',    r.parentesco
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
