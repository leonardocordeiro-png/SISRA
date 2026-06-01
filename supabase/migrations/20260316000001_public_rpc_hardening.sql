-- =============================================================================
-- SISRA - Public RPC hardening
-- =============================================================================
-- Goal:
--   Keep public parent/totem flows working without broad anon table access.
--   Public callers can execute narrowly scoped SECURITY DEFINER functions, while
--   direct anon SELECT/INSERT/UPDATE policies on sensitive tables are removed.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sisra_normalize_cpf(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(coalesce(value, ''), '\D', '', 'g');
$$;

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
BEGIN
  SELECT jsonb_build_object(
    'id', r.id,
    'nome_completo', r.nome_completo,
    'foto_url', r.foto_url,
    'parentesco', r.parentesco
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

CREATE OR REPLACE FUNCTION public.sisra_lookup_guardian_by_code(
  p_code text,
  p_escola_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  responsavel_id uuid;
BEGIN
  SELECT r.id
  INTO responsavel_id
  FROM public.responsaveis r
  WHERE upper(trim(r.codigo_acesso)) = upper(trim(p_code))
  LIMIT 1;

  IF responsavel_id IS NULL THEN
    RETURN jsonb_build_object('guardian', NULL, 'students', '[]'::jsonb);
  END IF;

  RETURN public.sisra_guardian_student_payload(responsavel_id, p_escola_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_lookup_guardian_by_cpf_and_code(
  p_cpf text,
  p_code text,
  p_escola_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  responsavel_id uuid;
BEGIN
  SELECT r.id
  INTO responsavel_id
  FROM public.responsaveis r
  WHERE public.sisra_normalize_cpf(r.cpf) = public.sisra_normalize_cpf(p_cpf)
    AND upper(trim(r.codigo_acesso)) = upper(trim(p_code))
  LIMIT 1;

  IF responsavel_id IS NULL THEN
    RETURN jsonb_build_object('guardian', NULL, 'students', '[]'::jsonb);
  END IF;

  RETURN public.sisra_guardian_student_payload(responsavel_id, p_escola_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_lookup_guardian_by_qr(
  p_qr text,
  p_escola_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  responsavel_id uuid;
  candidate text;
BEGIN
  SELECT c.responsavel_id
  INTO responsavel_id
  FROM public.parent_qr_cards c
  WHERE c.qr_code = p_qr
    AND coalesce(c.active, true) = true
    AND (c.expires_at IS NULL OR c.expires_at > now())
  LIMIT 1;

  IF responsavel_id IS NULL AND p_qr LIKE 'LaSalleCheguei-%' THEN
    candidate := regexp_replace(p_qr, '^LaSalleCheguei-(.*)-[^-]+$', '\1');
    IF candidate ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      responsavel_id := candidate::uuid;
    END IF;
  END IF;

  IF responsavel_id IS NULL AND p_qr ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    responsavel_id := p_qr::uuid;
  END IF;

  IF responsavel_id IS NULL THEN
    RETURN jsonb_build_object('guardian', NULL, 'students', '[]'::jsonb);
  END IF;

  RETURN public.sisra_guardian_student_payload(responsavel_id, p_escola_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_create_pickup_requests(
  p_responsavel_id uuid,
  p_aluno_ids uuid[],
  p_origem text DEFAULT 'PUBLIC',
  p_mark_arrived boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_start timestamptz := date_trunc('day', now());
  inserted_count integer := 0;
  skipped_count integer := 0;
BEGIN
  WITH requested AS (
    SELECT DISTINCT unnest(p_aluno_ids) AS aluno_id
  ),
  allowed AS (
    SELECT r.aluno_id, a.escola_id
    FROM requested r
    JOIN public.alunos a ON a.id = r.aluno_id
    WHERE EXISTS (
      SELECT 1 FROM public.alunos_responsaveis ar
      WHERE ar.aluno_id = r.aluno_id
        AND ar.responsavel_id = p_responsavel_id
    )
    OR EXISTS (
      SELECT 1 FROM public.autorizacoes au
      WHERE au.aluno_id = r.aluno_id
        AND au.responsavel_id = p_responsavel_id
        AND coalesce(au.ativa, true) = true
    )
  ),
  not_existing AS (
    SELECT a.*
    FROM allowed a
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.solicitacoes_retirada sr
      WHERE sr.aluno_id = a.aluno_id
        AND sr.status <> 'CANCELADO'
        AND sr.horario_confirmacao IS NULL
        AND sr.horario_solicitacao >= today_start
    )
  ),
  inserted AS (
    INSERT INTO public.solicitacoes_retirada (
      escola_id,
      aluno_id,
      responsavel_id,
      recepcionista_id,
      status,
      tipo_solicitacao,
      status_geofence
    )
    SELECT
      escola_id,
      aluno_id,
      p_responsavel_id,
      NULL,
      'SOLICITADO',
      'ROTINA',
      CASE WHEN p_mark_arrived THEN 'CHEGOU' ELSE NULL END
    FROM not_existing
    RETURNING id
  )
  SELECT count(*) INTO inserted_count FROM inserted;

  SELECT greatest(count(*) - inserted_count, 0)
  INTO skipped_count
  FROM (
    SELECT DISTINCT unnest(p_aluno_ids) AS aluno_id
  ) requested
  WHERE EXISTS (
    SELECT 1 FROM public.alunos_responsaveis ar
    WHERE ar.aluno_id = requested.aluno_id
      AND ar.responsavel_id = p_responsavel_id
  )
  OR EXISTS (
    SELECT 1 FROM public.autorizacoes au
    WHERE au.aluno_id = requested.aluno_id
      AND au.responsavel_id = p_responsavel_id
      AND coalesce(au.ativa, true) = true
  );

  INSERT INTO public.logs_auditoria (
    acao,
    tabela_afetada,
    detalhes,
    escola_id,
    criado_em
  )
  SELECT
    'SOLICITACAO_RETIRADA',
    'solicitacoes_retirada',
    jsonb_build_object(
      'responsavel_id', p_responsavel_id,
      'aluno_ids', p_aluno_ids,
      'origem', p_origem,
      'inseridos', inserted_count,
      'ignorados', skipped_count
    ),
    a.escola_id,
    now()
  FROM public.alunos a
  WHERE a.id = ANY(p_aluno_ids)
  LIMIT 1
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('inserted', inserted_count, 'skipped', skipped_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_get_pickup_status(
  p_responsavel_id uuid,
  p_aluno_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed boolean;
  student jsonb;
  pickup jsonb;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.alunos_responsaveis ar
    WHERE ar.aluno_id = p_aluno_id
      AND ar.responsavel_id = p_responsavel_id
  ) OR EXISTS (
    SELECT 1 FROM public.autorizacoes au
    WHERE au.aluno_id = p_aluno_id
      AND au.responsavel_id = p_responsavel_id
      AND coalesce(au.ativa, true) = true
  )
  INTO allowed;

  IF NOT allowed THEN
    RETURN jsonb_build_object('allowed', false, 'student', NULL, 'pickup', NULL);
  END IF;

  SELECT jsonb_build_object(
    'id', a.id,
    'nome_completo', a.nome_completo,
    'foto_url', a.foto_url,
    'turma', a.turma,
    'escola_id', a.escola_id
  )
  INTO student
  FROM public.alunos a
  WHERE a.id = p_aluno_id;

  SELECT to_jsonb(sr)
  INTO pickup
  FROM (
    SELECT id, status, mensagem_sala, mensagem_recepcao, horario_solicitacao
    FROM public.solicitacoes_retirada
    WHERE aluno_id = p_aluno_id
      AND status <> 'CANCELADO'
      AND horario_confirmacao IS NULL
      AND horario_solicitacao >= date_trunc('day', now())
    ORDER BY horario_solicitacao DESC
    LIMIT 1
  ) sr;

  RETURN jsonb_build_object('allowed', true, 'student', student, 'pickup', pickup);
END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_mark_guardian_arrived(
  p_responsavel_id uuid,
  p_pickup_id uuid DEFAULT NULL
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
  UPDATE public.solicitacoes_retirada sr
  SET status_geofence = 'CHEGOU',
      distancia_estimada_metros = 0
  WHERE (p_pickup_id IS NULL OR sr.id = p_pickup_id)
    AND sr.responsavel_id = p_responsavel_id
    AND sr.status IN ('SOLICITADO', 'AGUARDANDO', 'LIBERADO')
    AND sr.horario_solicitacao >= date_trunc('day', now());

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN jsonb_build_object('updated', updated_count);
END;
$$;

REVOKE ALL ON FUNCTION public.sisra_guardian_student_payload(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sisra_lookup_guardian_by_code(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_lookup_guardian_by_cpf_and_code(text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_lookup_guardian_by_qr(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_create_pickup_requests(uuid, uuid[], text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_get_pickup_status(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_mark_guardian_arrived(uuid, uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "alunos_anon_by_id" ON public.alunos;
DROP POLICY IF EXISTS "solicitacoes_anon_read" ON public.solicitacoes_retirada;
DROP POLICY IF EXISTS "solicitacoes_anon_insert" ON public.solicitacoes_retirada;
DROP POLICY IF EXISTS "solicitacoes_anon_update" ON public.solicitacoes_retirada;
DROP POLICY IF EXISTS "autorizacoes_anon_read" ON public.autorizacoes;
DROP POLICY IF EXISTS "responsaveis_anon_read" ON public.responsaveis;
DROP POLICY IF EXISTS "ar_anon_read" ON public.alunos_responsaveis;

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'turmas') THEN
    EXECUTE 'DROP POLICY IF EXISTS "turmas_anon_read" ON public.turmas';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_log') THEN
    EXECUTE 'DROP POLICY IF EXISTS "audit_anon_insert" ON public.audit_log';
  END IF;
END $$;

