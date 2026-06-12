-- =============================================================================
-- SISRA - System settings hardening and operational controls
-- =============================================================================
-- Makes /admin/configuracoes backed by explicit schema + admin-only RPCs and
-- applies the critical flags to public pickup creation.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'escolas'
  ) THEN
    ALTER TABLE public.escolas ADD COLUMN IF NOT EXISTS website text;
    ALTER TABLE public.escolas ADD COLUMN IF NOT EXISTS endereco text;
    ALTER TABLE public.escolas ADD COLUMN IF NOT EXISTS logo_url text;
    ALTER TABLE public.escolas ADD COLUMN IF NOT EXISTS config_seguranca jsonb;
    ALTER TABLE public.escolas ADD COLUMN IF NOT EXISTS config_notificacoes jsonb;
    ALTER TABLE public.escolas ADD COLUMN IF NOT EXISTS config_academica jsonb;
    ALTER TABLE public.escolas ADD COLUMN IF NOT EXISTS config_infraestrutura jsonb;

    UPDATE public.escolas
    SET
      config_seguranca = coalesce(config_seguranca, '{}'::jsonb),
      config_notificacoes = coalesce(config_notificacoes, '{}'::jsonb),
      config_academica = coalesce(config_academica, '{}'::jsonb),
      config_infraestrutura = coalesce(config_infraestrutura, '{}'::jsonb);

    ALTER TABLE public.escolas ALTER COLUMN config_seguranca SET DEFAULT '{}'::jsonb;
    ALTER TABLE public.escolas ALTER COLUMN config_notificacoes SET DEFAULT '{}'::jsonb;
    ALTER TABLE public.escolas ALTER COLUMN config_academica SET DEFAULT '{}'::jsonb;
    ALTER TABLE public.escolas ALTER COLUMN config_infraestrutura SET DEFAULT '{}'::jsonb;
    ALTER TABLE public.escolas ALTER COLUMN config_seguranca SET NOT NULL;
    ALTER TABLE public.escolas ALTER COLUMN config_notificacoes SET NOT NULL;
    ALTER TABLE public.escolas ALTER COLUMN config_academica SET NOT NULL;
    ALTER TABLE public.escolas ALTER COLUMN config_infraestrutura SET NOT NULL;

    ALTER TABLE public.escolas ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "escolas_auth_select_own" ON public.escolas;
    CREATE POLICY "escolas_auth_select_own"
      ON public.escolas
      FOR SELECT
      TO authenticated
      USING (id = public.get_user_escola_id());

    DROP POLICY IF EXISTS "escolas_admin_update_own" ON public.escolas;
    CREATE POLICY "escolas_admin_update_own"
      ON public.escolas
      FOR UPDATE
      TO authenticated
      USING (
        id = public.get_user_escola_id()
        AND public.get_user_tipo_usuario() = 'ADMIN'
      )
      WITH CHECK (
        id = public.get_user_escola_id()
        AND public.get_user_tipo_usuario() = 'ADMIN'
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sisra_default_system_settings()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'security', jsonb_build_object(
      'twoFactor', true,
      'autoLogout', true,
      'ipWhitelist', false,
      'idEncryption', true,
      'emergencyStop', false
    ),
    'notifications', jsonb_build_object(
      'emailAlerts', true,
      'pushNotifications', true,
      'smsEmergencies', false
    ),
    'academic', jsonb_build_object(
      'allowLatePickup', true,
      'strictSchedule', false
    ),
    'infrastructure', jsonb_build_object(
      'dynamicIp', true,
      'maintenanceMode', false
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.sisra_is_school_admin(p_escola_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND p_escola_id IS NOT NULL
    AND public.get_user_escola_id() = p_escola_id
    AND public.get_user_tipo_usuario() = 'ADMIN';
$$;

CREATE OR REPLACE FUNCTION public.sisra_get_system_settings(p_escola_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  defaults jsonb := public.sisra_default_system_settings();
  payload jsonb;
BEGIN
  IF NOT public.sisra_is_school_admin(p_escola_id) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  SELECT jsonb_build_object(
    'id', e.id,
    'nome', coalesce(e.nome, ''),
    'website', coalesce(e.website, ''),
    'endereco', coalesce(e.endereco, ''),
    'logo_url', coalesce(e.logo_url, ''),
    'security', (defaults->'security') || coalesce(e.config_seguranca, '{}'::jsonb),
    'notifications', (defaults->'notifications') || coalesce(e.config_notificacoes, '{}'::jsonb),
    'academic', (defaults->'academic') || coalesce(e.config_academica, '{}'::jsonb),
    'infrastructure', (defaults->'infrastructure') || coalesce(e.config_infraestrutura, '{}'::jsonb)
  )
  INTO payload
  FROM public.escolas e
  WHERE e.id = p_escola_id;

  IF payload IS NULL THEN
    RAISE EXCEPTION 'ESCOLA_NAO_ENCONTRADA';
  END IF;

  RETURN payload;
END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_update_system_settings(
  p_escola_id uuid,
  p_nome text,
  p_website text,
  p_endereco text,
  p_logo_url text,
  p_security jsonb,
  p_notifications jsonb,
  p_academic jsonb,
  p_infrastructure jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  defaults jsonb := public.sisra_default_system_settings();
  clean_website text := nullif(trim(coalesce(p_website, '')), '');
BEGIN
  IF NOT public.sisra_is_school_admin(p_escola_id) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  IF clean_website IS NOT NULL AND clean_website !~* '^https?://[[:alnum:]][^[:space:]]*$' THEN
    RAISE EXCEPTION 'WEBSITE_INVALIDO';
  END IF;

  IF p_logo_url IS NOT NULL AND length(p_logo_url) > 3000000 THEN
    RAISE EXCEPTION 'LOGO_MUITO_GRANDE';
  END IF;

  UPDATE public.escolas
  SET
    nome = nullif(trim(coalesce(p_nome, '')), ''),
    website = clean_website,
    endereco = nullif(trim(coalesce(p_endereco, '')), ''),
    logo_url = nullif(p_logo_url, ''),
    config_seguranca = (defaults->'security') || coalesce(p_security, '{}'::jsonb),
    config_notificacoes = (defaults->'notifications') || coalesce(p_notifications, '{}'::jsonb),
    config_academica = (defaults->'academic') || coalesce(p_academic, '{}'::jsonb),
    config_infraestrutura = (defaults->'infrastructure') || coalesce(p_infrastructure, '{}'::jsonb)
  WHERE id = p_escola_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ESCOLA_NAO_ENCONTRADA';
  END IF;

  INSERT INTO public.logs_auditoria (
    acao,
    tabela_afetada,
    registro_id,
    detalhes,
    usuario_id,
    escola_id,
    criado_em
  )
  VALUES (
    'ALTERACAO_CONFIGURACAO',
    'escolas',
    p_escola_id,
    jsonb_build_object(
      'origem', 'ADMIN_CONFIGURACOES',
      'security', (defaults->'security') || coalesce(p_security, '{}'::jsonb),
      'notifications', (defaults->'notifications') || coalesce(p_notifications, '{}'::jsonb),
      'academic', (defaults->'academic') || coalesce(p_academic, '{}'::jsonb),
      'infrastructure', (defaults->'infrastructure') || coalesce(p_infrastructure, '{}'::jsonb)
    ),
    auth.uid(),
    p_escola_id,
    now()
  )
  ON CONFLICT DO NOTHING;

  RETURN public.sisra_get_system_settings(p_escola_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_reset_system_settings(p_escola_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  defaults jsonb := public.sisra_default_system_settings();
BEGIN
  IF NOT public.sisra_is_school_admin(p_escola_id) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  UPDATE public.escolas
  SET
    website = NULL,
    endereco = NULL,
    logo_url = NULL,
    config_seguranca = defaults->'security',
    config_notificacoes = defaults->'notifications',
    config_academica = defaults->'academic',
    config_infraestrutura = defaults->'infrastructure'
  WHERE id = p_escola_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ESCOLA_NAO_ENCONTRADA';
  END IF;

  INSERT INTO public.logs_auditoria (
    acao,
    tabela_afetada,
    registro_id,
    detalhes,
    usuario_id,
    escola_id,
    criado_em
  )
  VALUES (
    'ALTERACAO_CONFIGURACAO',
    'escolas',
    p_escola_id,
    jsonb_build_object('origem', 'RESET_CONFIGURACOES_SISTEMA'),
    auth.uid(),
    p_escola_id,
    now()
  )
  ON CONFLICT DO NOTHING;

  RETURN public.sisra_get_system_settings(p_escola_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_set_emergency_stop(
  p_escola_id uuid,
  p_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  defaults jsonb := public.sisra_default_system_settings();
  security_config jsonb;
BEGIN
  IF NOT public.sisra_is_school_admin(p_escola_id) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  SELECT (defaults->'security') || coalesce(config_seguranca, '{}'::jsonb)
  INTO security_config
  FROM public.escolas
  WHERE id = p_escola_id;

  IF security_config IS NULL THEN
    RAISE EXCEPTION 'ESCOLA_NAO_ENCONTRADA';
  END IF;

  UPDATE public.escolas
  SET config_seguranca = security_config || jsonb_build_object('emergencyStop', coalesce(p_enabled, false))
  WHERE id = p_escola_id;

  INSERT INTO public.logs_auditoria (
    acao,
    tabela_afetada,
    registro_id,
    detalhes,
    usuario_id,
    escola_id,
    criado_em
  )
  VALUES (
    'ALTERACAO_CONFIGURACAO',
    'escolas',
    p_escola_id,
    jsonb_build_object(
      'origem', 'PARADA_EMERGENCIA',
      'emergencyStop', coalesce(p_enabled, false)
    ),
    auth.uid(),
    p_escola_id,
    now()
  )
  ON CONFLICT DO NOTHING;

  RETURN public.sisra_get_system_settings(p_escola_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_public_access_block_reason(
  p_escola_id uuid,
  p_include_emergency boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg_security jsonb;
  cfg_infrastructure jsonb;
BEGIN
  IF p_escola_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT coalesce(config_seguranca, '{}'::jsonb),
         coalesce(config_infraestrutura, '{}'::jsonb)
  INTO cfg_security, cfg_infrastructure
  FROM public.escolas
  WHERE id = p_escola_id;

  IF cfg_infrastructure->>'maintenanceMode' = 'true' THEN
    RETURN 'PORTAL_EM_MANUTENCAO';
  END IF;

  IF p_include_emergency AND cfg_security->>'emergencyStop' = 'true' THEN
    RETURN 'PARADA_EMERGENCIA_ATIVA';
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_get_public_school_profile(
  p_escola_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', e.id,
    'nome', coalesce(e.nome, 'Colégio'),
    'latitude', e.latitude,
    'longitude', e.longitude,
    'maintenanceMode', coalesce(e.config_infraestrutura->>'maintenanceMode', 'false') = 'true'
  )
  INTO profile
  FROM public.escolas e
  WHERE p_escola_id IS NULL OR e.id = p_escola_id
  ORDER BY e.nome
  LIMIT 1;

  RETURN coalesce(profile, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_system_healthcheck()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.escolas LIMIT 1);
$$;

CREATE OR REPLACE FUNCTION public.sisra_enforce_pickup_operational_flags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emergency_enabled boolean := false;
BEGIN
  SELECT coalesce(e.config_seguranca->>'emergencyStop', 'false') = 'true'
  INTO emergency_enabled
  FROM public.escolas e
  WHERE e.id = NEW.escola_id;

  IF emergency_enabled THEN
    RAISE EXCEPTION 'PARADA_EMERGENCIA_ATIVA';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sisra_enforce_pickup_operational_flags ON public.solicitacoes_retirada;
CREATE TRIGGER trg_sisra_enforce_pickup_operational_flags
  BEFORE INSERT ON public.solicitacoes_retirada
  FOR EACH ROW
  EXECUTE FUNCTION public.sisra_enforce_pickup_operational_flags();

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

CREATE OR REPLACE FUNCTION public.sisra_lookup_guardian_by_cpf(
  p_cpf text,
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
  clean_cpf text := public.sisra_normalize_cpf(p_cpf);
BEGIN
  IF public.sisra_public_access_block_reason(p_escola_id, false) IS NOT NULL THEN
    RAISE EXCEPTION '%', public.sisra_public_access_block_reason(p_escola_id, false);
  END IF;

  IF length(clean_cpf) <> 11 THEN
    RETURN jsonb_build_object('guardian', NULL, 'students', '[]'::jsonb);
  END IF;

  SELECT r.id INTO responsavel_id
  FROM public.responsaveis r
  WHERE public.sisra_normalize_cpf(r.cpf) = clean_cpf
  LIMIT 1;

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
  target_escola_id uuid;
  block_reason text;
BEGIN
  SELECT a.escola_id
  INTO target_escola_id
  FROM public.alunos a
  WHERE a.id = ANY(p_aluno_ids)
    AND (
      EXISTS (
        SELECT 1 FROM public.alunos_responsaveis ar
        WHERE ar.aluno_id = a.id
          AND ar.responsavel_id = p_responsavel_id
      )
      OR EXISTS (
        SELECT 1 FROM public.autorizacoes au
        WHERE au.aluno_id = a.id
          AND au.responsavel_id = p_responsavel_id
          AND coalesce(au.ativa, true) = true
      )
    )
  LIMIT 1;

  block_reason := public.sisra_public_access_block_reason(target_escola_id, true);
  IF block_reason IS NOT NULL THEN
    RAISE EXCEPTION '%', block_reason;
  END IF;

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

REVOKE ALL ON FUNCTION public.sisra_is_school_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sisra_get_system_settings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_update_system_settings(uuid, text, text, text, text, jsonb, jsonb, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_reset_system_settings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_set_emergency_stop(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_get_public_school_profile(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_system_healthcheck() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_lookup_guardian_by_cpf(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_create_pickup_requests(uuid, uuid[], text, boolean) TO anon, authenticated;
