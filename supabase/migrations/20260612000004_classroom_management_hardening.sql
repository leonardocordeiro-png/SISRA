-- =============================================================================
-- SISRA - Classroom management hardening
-- =============================================================================
-- Secures /admin/turmas with admin-only RPC writes, soft archival, audit logs
-- and stricter RLS policies.
-- =============================================================================

ALTER TABLE public.turmas ADD COLUMN IF NOT EXISTS ativa boolean DEFAULT true;
ALTER TABLE public.turmas ADD COLUMN IF NOT EXISTS descricao text;
ALTER TABLE public.turmas ADD COLUMN IF NOT EXISTS criado_em timestamptz DEFAULT now();
ALTER TABLE public.turmas ADD COLUMN IF NOT EXISTS atualizado_em timestamptz;
ALTER TABLE public.turmas ADD COLUMN IF NOT EXISTS excluido_em timestamptz;

UPDATE public.turmas SET ativa = coalesce(ativa, true);
ALTER TABLE public.turmas ALTER COLUMN ativa SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_turmas_escola_ativas
  ON public.turmas (escola_id, ativa)
  WHERE excluido_em IS NULL;

CREATE OR REPLACE FUNCTION public.sisra_touch_turmas_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sisra_touch_turmas_atualizado_em ON public.turmas;
CREATE TRIGGER trg_sisra_touch_turmas_atualizado_em
  BEFORE UPDATE ON public.turmas
  FOR EACH ROW
  EXECUTE FUNCTION public.sisra_touch_turmas_atualizado_em();

CREATE OR REPLACE FUNCTION public.sisra_classroom_json(p_turma public.turmas)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', p_turma.id,
    'nome', coalesce(p_turma.nome, ''),
    'descricao', coalesce(p_turma.descricao, ''),
    'ativa', coalesce(p_turma.ativa, true),
    'sala_id', p_turma.sala_id,
    'criado_em', p_turma.criado_em,
    'atualizado_em', p_turma.atualizado_em,
    'sala', (
      SELECT CASE
        WHEN s.id IS NULL THEN NULL
        ELSE jsonb_build_object('id', s.id, 'nome', s.nome)
      END
      FROM public.salas s
      WHERE s.id = p_turma.sala_id
    ),
    'alunos_count', (
      SELECT count(*)::integer
      FROM public.alunos a
      WHERE a.escola_id = p_turma.escola_id
        AND a.turma = p_turma.nome
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.sisra_list_admin_classrooms(p_escola_id uuid)
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

  SELECT coalesce(jsonb_agg(public.sisra_classroom_json(t) ORDER BY lower(coalesce(t.nome, ''))), '[]'::jsonb)
  INTO result
  FROM public.turmas t
  WHERE t.escola_id = p_escola_id
    AND t.excluido_em IS NULL;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_list_admin_classroom_rooms(p_escola_id uuid)
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
    jsonb_build_object('id', s.id, 'nome', s.nome)
    ORDER BY lower(s.nome)
  ), '[]'::jsonb)
  INTO result
  FROM public.salas s
  WHERE s.escola_id = p_escola_id
    AND coalesce(s.ativa, true) = true;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_save_admin_classroom(
  p_escola_id uuid,
  p_id uuid,
  p_nome text,
  p_descricao text,
  p_ativa boolean,
  p_sala_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_nome text := btrim(coalesce(p_nome, ''));
  clean_descricao text := nullif(btrim(coalesce(p_descricao, '')), '');
  saved public.turmas;
BEGIN
  IF NOT public.sisra_is_school_admin(p_escola_id) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  IF clean_nome = '' OR char_length(clean_nome) > 180 THEN
    RAISE EXCEPTION 'NOME_TURMA_INVALIDO';
  END IF;

  IF clean_descricao IS NOT NULL AND char_length(clean_descricao) > 500 THEN
    RAISE EXCEPTION 'DESCRICAO_MUITO_LONGA';
  END IF;

  IF p_sala_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.salas s
    WHERE s.id = p_sala_id
      AND s.escola_id = p_escola_id
      AND coalesce(s.ativa, true) = true
  ) THEN
    RAISE EXCEPTION 'SALA_INVALIDA';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.turmas t
    WHERE t.escola_id = p_escola_id
      AND t.excluido_em IS NULL
      AND lower(t.nome) = lower(clean_nome)
      AND (p_id IS NULL OR t.id <> p_id)
  ) THEN
    RAISE EXCEPTION 'TURMA_DUPLICADA';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.turmas (escola_id, nome, descricao, ativa, sala_id)
    VALUES (p_escola_id, clean_nome, clean_descricao, coalesce(p_ativa, true), p_sala_id)
    RETURNING * INTO saved;
  ELSE
    UPDATE public.turmas
    SET nome = clean_nome,
        descricao = clean_descricao,
        ativa = coalesce(p_ativa, true),
        sala_id = p_sala_id
    WHERE id = p_id
      AND escola_id = p_escola_id
      AND excluido_em IS NULL
    RETURNING * INTO saved;

    IF saved.id IS NULL THEN
      RAISE EXCEPTION 'TURMA_NAO_ENCONTRADA';
    END IF;
  END IF;

  INSERT INTO public.logs_auditoria (
    acao, tabela_afetada, registro_id, usuario_id, escola_id, detalhes
  )
  VALUES (
    'ALTERACAO_CONFIGURACAO',
    'turmas',
    saved.id,
    auth.uid(),
    p_escola_id,
    jsonb_build_object(
      'acao', CASE WHEN p_id IS NULL THEN 'CRIACAO_TURMA' ELSE 'EDICAO_TURMA' END,
      'nome', saved.nome,
      'ativa', saved.ativa,
      'sala_id', saved.sala_id,
      'origem', 'ADMIN_TURMAS_RPC'
    )
  );

  RETURN public.sisra_classroom_json(saved);
END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_set_admin_classroom_status(
  p_escola_id uuid,
  p_id uuid,
  p_ativa boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  saved public.turmas;
BEGIN
  IF NOT public.sisra_is_school_admin(p_escola_id) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  UPDATE public.turmas
  SET ativa = coalesce(p_ativa, false)
  WHERE id = p_id
    AND escola_id = p_escola_id
    AND excluido_em IS NULL
  RETURNING * INTO saved;

  IF saved.id IS NULL THEN
    RAISE EXCEPTION 'TURMA_NAO_ENCONTRADA';
  END IF;

  INSERT INTO public.logs_auditoria (
    acao, tabela_afetada, registro_id, usuario_id, escola_id, detalhes
  )
  VALUES (
    'ALTERACAO_CONFIGURACAO',
    'turmas',
    saved.id,
    auth.uid(),
    p_escola_id,
    jsonb_build_object(
      'acao', CASE WHEN saved.ativa THEN 'ATIVACAO_TURMA' ELSE 'DESATIVACAO_TURMA' END,
      'nome', saved.nome,
      'origem', 'ADMIN_TURMAS_RPC'
    )
  );

  RETURN public.sisra_classroom_json(saved);
END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_archive_admin_classroom(
  p_escola_id uuid,
  p_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.turmas;
  active_students integer;
BEGIN
  IF NOT public.sisra_is_school_admin(p_escola_id) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  SELECT *
  INTO target
  FROM public.turmas
  WHERE id = p_id
    AND escola_id = p_escola_id
    AND excluido_em IS NULL;

  IF target.id IS NULL THEN
    RAISE EXCEPTION 'TURMA_NAO_ENCONTRADA';
  END IF;

  SELECT count(*)::integer
  INTO active_students
  FROM public.alunos a
  WHERE a.escola_id = p_escola_id
    AND a.turma = target.nome;

  IF active_students > 0 THEN
    RAISE EXCEPTION 'TURMA_COM_ALUNOS_ATIVOS';
  END IF;

  UPDATE public.turmas
  SET ativa = false,
      excluido_em = now()
  WHERE id = p_id
    AND escola_id = p_escola_id
  RETURNING * INTO target;

  INSERT INTO public.logs_auditoria (
    acao, tabela_afetada, registro_id, usuario_id, escola_id, detalhes
  )
  VALUES (
    'ALTERACAO_CONFIGURACAO',
    'turmas',
    target.id,
    auth.uid(),
    p_escola_id,
    jsonb_build_object(
      'acao', 'ARQUIVAMENTO_TURMA',
      'nome', target.nome,
      'origem', 'ADMIN_TURMAS_RPC'
    )
  );

  RETURN jsonb_build_object('archived', true, 'id', target.id);
END;
$$;

DROP POLICY IF EXISTS "turmas_auth_escola" ON public.turmas;
DROP POLICY IF EXISTS "turmas_select_escola" ON public.turmas;
CREATE POLICY "turmas_select_escola"
  ON public.turmas
  FOR SELECT
  TO authenticated
  USING (
    escola_id = public.get_user_escola_id()
    AND excluido_em IS NULL
  );

DROP POLICY IF EXISTS "turmas_admin_insert" ON public.turmas;
CREATE POLICY "turmas_admin_insert"
  ON public.turmas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    escola_id = public.get_user_escola_id()
    AND public.get_user_tipo_usuario() = 'ADMIN'
  );

DROP POLICY IF EXISTS "turmas_admin_update" ON public.turmas;
CREATE POLICY "turmas_admin_update"
  ON public.turmas
  FOR UPDATE
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

DROP POLICY IF EXISTS "turmas_admin_delete" ON public.turmas;
CREATE POLICY "turmas_admin_delete"
  ON public.turmas
  FOR DELETE
  TO authenticated
  USING (
    escola_id = public.get_user_escola_id()
    AND public.get_user_tipo_usuario() = 'ADMIN'
  );

REVOKE ALL ON FUNCTION public.sisra_classroom_json(public.turmas) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sisra_list_admin_classrooms(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sisra_list_admin_classroom_rooms(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sisra_save_admin_classroom(uuid, uuid, text, text, boolean, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sisra_set_admin_classroom_status(uuid, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sisra_archive_admin_classroom(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.sisra_list_admin_classrooms(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_list_admin_classroom_rooms(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_save_admin_classroom(uuid, uuid, text, text, boolean, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_set_admin_classroom_status(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_archive_admin_classroom(uuid, uuid) TO authenticated;
