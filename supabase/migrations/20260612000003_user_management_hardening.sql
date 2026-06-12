-- =============================================================================
-- SISRA - User management hardening
-- =============================================================================
-- Makes /admin/usuarios use admin-only read RPCs and preserves revoked users
-- for audit/history instead of hard-deleting profile rows.
-- =============================================================================

ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS ativo boolean DEFAULT true;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS criado_em timestamptz DEFAULT now();
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS excluido_em timestamptz;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS atualizado_em timestamptz;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS sala_atribuida text;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS turma_atribuida text;

UPDATE public.usuarios SET ativo = coalesce(ativo, true);
ALTER TABLE public.usuarios ALTER COLUMN ativo SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'usuarios_tipo_usuario_check'
      AND conrelid = 'public.usuarios'::regclass
  ) THEN
    ALTER TABLE public.usuarios
      ADD CONSTRAINT usuarios_tipo_usuario_check
      CHECK (tipo_usuario IN ('ADMIN', 'RECEPCIONISTA', 'SCT', 'COORDENADOR'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_usuarios_escola_ativos
  ON public.usuarios (escola_id, ativo)
  WHERE excluido_em IS NULL;

CREATE OR REPLACE FUNCTION public.sisra_touch_usuarios_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sisra_touch_usuarios_atualizado_em ON public.usuarios;
CREATE TRIGGER trg_sisra_touch_usuarios_atualizado_em
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.sisra_touch_usuarios_atualizado_em();

CREATE OR REPLACE FUNCTION public.sisra_list_admin_users(p_escola_id uuid)
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

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', u.id,
      'nome', coalesce(u.nome, ''),
      'email', coalesce(u.email, ''),
      'tipo_usuario', u.tipo_usuario,
      'turma_atribuida', u.turma_atribuida,
      'sala_atribuida', u.sala_atribuida,
      'ativo', coalesce(u.ativo, true),
      'criado_em', u.criado_em,
      'atualizado_em', u.atualizado_em
    )
    ORDER BY lower(coalesce(u.nome, '')), lower(coalesce(u.email, ''))
  ), '[]'::jsonb)
  INTO result
  FROM public.usuarios u
  WHERE u.escola_id = p_escola_id
    AND u.excluido_em IS NULL;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_list_active_exit_rooms(p_escola_id uuid)
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

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'salas'
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'nome', s.nome,
      'turmas', coalesce((
        SELECT jsonb_agg(jsonb_build_object('nome', t.nome) ORDER BY t.nome)
        FROM public.turmas t
        WHERE t.escola_id = p_escola_id
          AND t.sala_id = s.id
      ), '[]'::jsonb)
    )
    ORDER BY s.nome
  ), '[]'::jsonb)
  INTO result
  FROM public.salas s
  WHERE s.escola_id = p_escola_id
    AND coalesce(s.ativa, true) = true;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_count_active_school_admins(p_escola_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.usuarios
  WHERE escola_id = p_escola_id
    AND tipo_usuario = 'ADMIN'
    AND ativo = true
    AND excluido_em IS NULL;
$$;

DROP POLICY IF EXISTS "usuarios_self" ON public.usuarios;
CREATE POLICY "usuarios_self"
  ON public.usuarios
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "usuarios_admin_escola" ON public.usuarios;
CREATE POLICY "usuarios_admin_escola"
  ON public.usuarios
  FOR ALL
  TO authenticated
  USING (
    escola_id = public.get_user_escola_id()
    AND public.get_user_tipo_usuario() = 'ADMIN'
    AND excluido_em IS NULL
  )
  WITH CHECK (
    escola_id = public.get_user_escola_id()
    AND public.get_user_tipo_usuario() = 'ADMIN'
  );

GRANT EXECUTE ON FUNCTION public.sisra_list_admin_users(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_list_active_exit_rooms(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_count_active_school_admins(uuid) TO authenticated;
