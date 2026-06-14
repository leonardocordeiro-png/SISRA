-- =============================================================================
-- SISRA - Exit rooms management hardening
-- =============================================================================
-- Makes /admin/salas operate through admin-only RPCs, keeps archived rooms for
-- audit/history, prevents cross-school writes and preserves linked classrooms.
-- =============================================================================

ALTER TABLE public.salas ADD COLUMN IF NOT EXISTS atualizado_em timestamptz;
ALTER TABLE public.salas ADD COLUMN IF NOT EXISTS excluido_em timestamptz;

UPDATE public.salas SET ativa = coalesce(ativa, true);
ALTER TABLE public.salas ALTER COLUMN ativa SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_salas_escola_ativas
  ON public.salas (escola_id, ativa)
  WHERE excluido_em IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_salas_escola_nome_ativo_unico
  ON public.salas (escola_id, lower(btrim(nome)))
  WHERE excluido_em IS NULL;

CREATE OR REPLACE FUNCTION public.sisra_touch_salas_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sisra_touch_salas_atualizado_em ON public.salas;
CREATE TRIGGER trg_sisra_touch_salas_atualizado_em
  BEFORE UPDATE ON public.salas
  FOR EACH ROW
  EXECUTE FUNCTION public.sisra_touch_salas_atualizado_em();

CREATE OR REPLACE FUNCTION public.sisra_exit_room_json(p_sala public.salas)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', p_sala.id,
    'nome', coalesce(p_sala.nome, ''),
    'descricao', p_sala.descricao,
    'ativa', coalesce(p_sala.ativa, true),
    'criado_em', p_sala.criado_em,
    'atualizado_em', p_sala.atualizado_em,
    'turmas_count', (
      SELECT count(*)::integer
      FROM public.turmas t
      WHERE t.escola_id = p_sala.escola_id
        AND t.sala_id = p_sala.id
        AND t.excluido_em IS NULL
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.sisra_list_admin_exit_rooms(p_escola_id uuid)
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

  SELECT coalesce(jsonb_agg(public.sisra_exit_room_json(s) ORDER BY lower(coalesce(s.nome, ''))), '[]'::jsonb)
  INTO result
  FROM public.salas s
  WHERE s.escola_id = p_escola_id
    AND s.excluido_em IS NULL;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_save_admin_exit_room(
  p_escola_id uuid,
  p_id uuid,
  p_nome text,
  p_descricao text,
  p_ativa boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_nome text := btrim(coalesce(p_nome, ''));
  clean_descricao text := nullif(btrim(coalesce(p_descricao, '')), '');
  saved public.salas;
BEGIN
  IF NOT public.sisra_is_school_admin(p_escola_id) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  IF clean_nome = '' OR char_length(clean_nome) > 120 THEN
    RAISE EXCEPTION 'NOME_SALA_INVALIDO';
  END IF;

  IF clean_descricao IS NOT NULL AND char_length(clean_descricao) > 500 THEN
    RAISE EXCEPTION 'DESCRICAO_MUITO_LONGA';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.salas s
    WHERE s.escola_id = p_escola_id
      AND s.excluido_em IS NULL
      AND lower(btrim(s.nome)) = lower(clean_nome)
      AND (p_id IS NULL OR s.id <> p_id)
  ) THEN
    RAISE EXCEPTION 'SALA_DUPLICADA';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.salas (escola_id, nome, descricao, ativa)
    VALUES (p_escola_id, clean_nome, clean_descricao, coalesce(p_ativa, true))
    RETURNING * INTO saved;
  ELSE
    UPDATE public.salas
    SET nome = clean_nome,
        descricao = clean_descricao,
        ativa = coalesce(p_ativa, true)
    WHERE id = p_id
      AND escola_id = p_escola_id
      AND excluido_em IS NULL
    RETURNING * INTO saved;

    IF saved.id IS NULL THEN
      RAISE EXCEPTION 'SALA_NAO_ENCONTRADA';
    END IF;
  END IF;

  INSERT INTO public.logs_auditoria (
    acao, tabela_afetada, registro_id, usuario_id, escola_id, detalhes
  )
  VALUES (
    'ALTERACAO_CONFIGURACAO',
    'salas',
    saved.id,
    auth.uid(),
    p_escola_id,
    jsonb_build_object(
      'acao', CASE WHEN p_id IS NULL THEN 'CRIACAO_SALA_SAIDA' ELSE 'EDICAO_SALA_SAIDA' END,
      'nome', saved.nome,
      'ativa', saved.ativa,
      'origem', 'ADMIN_SALAS_RPC'
    )
  );

  RETURN public.sisra_exit_room_json(saved);
END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_set_admin_exit_room_status(
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
  saved public.salas;
BEGIN
  IF NOT public.sisra_is_school_admin(p_escola_id) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  UPDATE public.salas
  SET ativa = coalesce(p_ativa, false)
  WHERE id = p_id
    AND escola_id = p_escola_id
    AND excluido_em IS NULL
  RETURNING * INTO saved;

  IF saved.id IS NULL THEN
    RAISE EXCEPTION 'SALA_NAO_ENCONTRADA';
  END IF;

  INSERT INTO public.logs_auditoria (
    acao, tabela_afetada, registro_id, usuario_id, escola_id, detalhes
  )
  VALUES (
    'ALTERACAO_CONFIGURACAO',
    'salas',
    saved.id,
    auth.uid(),
    p_escola_id,
    jsonb_build_object(
      'acao', CASE WHEN saved.ativa THEN 'ATIVACAO_SALA_SAIDA' ELSE 'DESATIVACAO_SALA_SAIDA' END,
      'nome', saved.nome,
      'origem', 'ADMIN_SALAS_RPC'
    )
  );

  RETURN public.sisra_exit_room_json(saved);
END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_archive_admin_exit_room(
  p_escola_id uuid,
  p_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.salas;
  linked_classrooms integer;
BEGIN
  IF NOT public.sisra_is_school_admin(p_escola_id) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  SELECT *
  INTO target
  FROM public.salas s
  WHERE s.id = p_id
    AND s.escola_id = p_escola_id
    AND s.excluido_em IS NULL;

  IF target.id IS NULL THEN
    RAISE EXCEPTION 'SALA_NAO_ENCONTRADA';
  END IF;

  SELECT count(*)::integer
  INTO linked_classrooms
  FROM public.turmas t
  WHERE t.escola_id = p_escola_id
    AND t.sala_id = target.id
    AND t.excluido_em IS NULL;

  IF linked_classrooms > 0 THEN
    RAISE EXCEPTION 'SALA_COM_TURMAS_VINCULADAS';
  END IF;

  UPDATE public.salas
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
    'salas',
    target.id,
    auth.uid(),
    p_escola_id,
    jsonb_build_object(
      'acao', 'ARQUIVAMENTO_SALA_SAIDA',
      'nome', target.nome,
      'origem', 'ADMIN_SALAS_RPC'
    )
  );

  RETURN jsonb_build_object('archived', true, 'id', target.id);
END;
$$;

DROP POLICY IF EXISTS "salas_auth_escola" ON public.salas;
DROP POLICY IF EXISTS "salas_select_escola" ON public.salas;
CREATE POLICY "salas_select_escola"
  ON public.salas
  FOR SELECT
  TO authenticated
  USING (
    escola_id = public.get_user_escola_id()
    AND excluido_em IS NULL
  );

DROP POLICY IF EXISTS "salas_admin_insert" ON public.salas;
CREATE POLICY "salas_admin_insert"
  ON public.salas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    escola_id = public.get_user_escola_id()
    AND public.get_user_tipo_usuario() = 'ADMIN'
  );

DROP POLICY IF EXISTS "salas_admin_update" ON public.salas;
CREATE POLICY "salas_admin_update"
  ON public.salas
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

DROP POLICY IF EXISTS "salas_admin_delete" ON public.salas;

REVOKE ALL ON FUNCTION public.sisra_touch_salas_atualizado_em() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sisra_exit_room_json(public.salas) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sisra_list_admin_exit_rooms(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sisra_save_admin_exit_room(uuid, uuid, text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sisra_set_admin_exit_room_status(uuid, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sisra_archive_admin_exit_room(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.sisra_list_admin_exit_rooms(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_save_admin_exit_room(uuid, uuid, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_set_admin_exit_room_status(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_archive_admin_exit_room(uuid, uuid) TO authenticated;
