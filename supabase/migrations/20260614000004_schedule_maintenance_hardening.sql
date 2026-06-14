-- =============================================================================
-- SISRA - Schedule maintenance hardening
-- =============================================================================
-- Moves /admin/manutencao/horarios to admin-only RPCs. The browser no longer
-- receives every student's security JSON, and mass updates run atomically in DB.
-- Also removes broad direct access policies on alunos that exposed student data.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sisra_schedule_period_from_turma(p_turma text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  WITH code AS (
    SELECT upper(coalesce(substring(coalesce(p_turma, '') FROM '\(([^)]*)\)\s*$'), '')) AS value
  )
  SELECT CASE
    WHEN value LIKE '%M' THEN 'manha'
    WHEN value LIKE '%T' THEN 'tarde'
    ELSE 'desconhecido'
  END
  FROM code;
$$;

CREATE OR REPLACE FUNCTION public.sisra_weekday_schedule(p_start text, p_end text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_array(
    jsonb_build_object('day', 'Segunda-feira', 'enabled', true, 'start', p_start, 'end', p_end),
    jsonb_build_object('day', 'Terca-feira', 'enabled', true, 'start', p_start, 'end', p_end),
    jsonb_build_object('day', 'Quarta-feira', 'enabled', true, 'start', p_start, 'end', p_end),
    jsonb_build_object('day', 'Quinta-feira', 'enabled', true, 'start', p_start, 'end', p_end),
    jsonb_build_object('day', 'Sexta-feira', 'enabled', true, 'start', p_start, 'end', p_end)
  );
$$;

CREATE OR REPLACE FUNCTION public.sisra_valid_hhmm(p_value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(p_value, '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';
$$;

CREATE OR REPLACE FUNCTION public.sisra_preview_admin_schedule_maintenance(p_escola_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.sisra_is_school_admin(p_escola_id) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  WITH classified AS (
    SELECT
      a.id,
      a.turma,
      public.sisra_schedule_period_from_turma(a.turma) AS period
    FROM public.alunos a
    WHERE a.escola_id = p_escola_id
  )
  SELECT jsonb_build_object(
    'total', count(*)::integer,
    'morning', count(*) FILTER (WHERE period = 'manha')::integer,
    'afternoon', count(*) FILTER (WHERE period = 'tarde')::integer,
    'unknown', count(*) FILTER (WHERE period = 'desconhecido')::integer,
    'unknown_examples', coalesce((
      SELECT jsonb_agg(item.turma)
      FROM (
        SELECT DISTINCT coalesce(c.turma, 'sem turma') AS turma
        FROM classified c
        WHERE c.period = 'desconhecido'
        ORDER BY coalesce(c.turma, 'sem turma')
        LIMIT 3
      ) item
    ), '[]'::jsonb)
  )
  INTO result
  FROM classified;

  RETURN coalesce(result, jsonb_build_object(
    'total', 0,
    'morning', 0,
    'afternoon', 0,
    'unknown', 0,
    'unknown_examples', '[]'::jsonb
  ));
END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_run_admin_schedule_maintenance(
  p_escola_id uuid,
  p_morning_start text,
  p_morning_end text,
  p_afternoon_start text,
  p_afternoon_end text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  updated_count integer := 0;
  skipped_count integer := 0;
  morning_count integer := 0;
  afternoon_count integer := 0;
BEGIN
  IF NOT public.sisra_is_school_admin(p_escola_id) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  IF NOT public.sisra_valid_hhmm(p_morning_start)
    OR NOT public.sisra_valid_hhmm(p_morning_end)
    OR NOT public.sisra_valid_hhmm(p_afternoon_start)
    OR NOT public.sisra_valid_hhmm(p_afternoon_end)
  THEN
    RAISE EXCEPTION 'HORARIO_INVALIDO';
  END IF;

  IF p_morning_start >= p_morning_end OR p_afternoon_start >= p_afternoon_end THEN
    RAISE EXCEPTION 'JANELA_HORARIO_INVALIDA';
  END IF;

  WITH classified AS (
    SELECT
      a.id,
      public.sisra_schedule_period_from_turma(a.turma) AS period
    FROM public.alunos a
    WHERE a.escola_id = p_escola_id
  ),
  target AS (
    SELECT *
    FROM classified
    WHERE period IN ('manha', 'tarde')
  ),
  updated AS (
    UPDATE public.alunos a
    SET config_seguranca = coalesce(a.config_seguranca, '{}'::jsonb) || jsonb_build_object(
      'schedule',
      CASE
        WHEN target.period = 'manha' THEN public.sisra_weekday_schedule(p_morning_start, p_morning_end)
        ELSE public.sisra_weekday_schedule(p_afternoon_start, p_afternoon_end)
      END
    )
    FROM target
    WHERE a.id = target.id
      AND a.escola_id = p_escola_id
    RETURNING target.period
  )
  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE period = 'manha')::integer,
    count(*) FILTER (WHERE period = 'tarde')::integer
  INTO updated_count, morning_count, afternoon_count
  FROM updated;

  SELECT count(*)::integer
  INTO skipped_count
  FROM public.alunos a
  WHERE a.escola_id = p_escola_id
    AND public.sisra_schedule_period_from_turma(a.turma) = 'desconhecido';

  INSERT INTO public.logs_auditoria (
    acao, tabela_afetada, registro_id, usuario_id, escola_id, detalhes
  )
  VALUES (
    'MANUTENCAO',
    'alunos',
    NULL,
    auth.uid(),
    p_escola_id,
    jsonb_build_object(
      'acao', 'ATUALIZACAO_MASSA_HORARIO',
      'total_atualizados', updated_count,
      'ignorados', skipped_count,
      'turmas_manha', morning_count,
      'turmas_tarde', afternoon_count,
      'horario_manha', p_morning_start || ' - ' || p_morning_end,
      'horario_tarde', p_afternoon_start || ' - ' || p_afternoon_end,
      'origem', 'ADMIN_HORARIOS_RPC'
    )
  );

  result := jsonb_build_object(
    'updated', updated_count,
    'skipped', skipped_count,
    'errors', 0,
    'morning', morning_count,
    'afternoon', afternoon_count
  );

  RETURN result;
END;
$$;

DROP POLICY IF EXISTS "Permitir leitura de alunos para pais anon" ON public.alunos;
DROP POLICY IF EXISTS "Recepcionistas e coordenadores editam alunos" ON public.alunos;
DROP POLICY IF EXISTS "Usuarios veem alunos da escola" ON public.alunos;
DROP POLICY IF EXISTS "alunos_anon_by_id" ON public.alunos;

DROP POLICY IF EXISTS "alunos_auth_escola" ON public.alunos;
CREATE POLICY "alunos_auth_escola"
  ON public.alunos
  FOR SELECT
  TO authenticated
  USING (escola_id = public.get_user_escola_id());

DROP POLICY IF EXISTS "alunos_write_authenticated" ON public.alunos;
DROP POLICY IF EXISTS "alunos_admin_write" ON public.alunos;
CREATE POLICY "alunos_admin_write"
  ON public.alunos
  FOR ALL
  TO authenticated
  USING (
    escola_id = public.get_user_escola_id()
    AND public.get_user_tipo_usuario() = 'ADMIN'
  )
  WITH CHECK (
    escola_id = public.get_user_escola_id()
    AND public.get_user_tipo_usuario() = 'ADMIN'
  );

REVOKE ALL ON FUNCTION public.sisra_schedule_period_from_turma(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sisra_weekday_schedule(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sisra_valid_hhmm(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sisra_preview_admin_schedule_maintenance(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sisra_run_admin_schedule_maintenance(uuid, text, text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.sisra_preview_admin_schedule_maintenance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_run_admin_schedule_maintenance(uuid, text, text, text, text) TO authenticated;
