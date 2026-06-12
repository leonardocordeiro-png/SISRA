-- =============================================================================
-- SISRA - Admin QR card hardening
-- =============================================================================
-- Makes /admin/cartoes-qr operate through school-scoped RPCs. The page now only
-- sees guardians linked to students in the admin's school, which prevents loose
-- responsaveis rows from being counted as usable QR-card records.
-- =============================================================================

ALTER TABLE public.parent_qr_cards ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.sisra_admin_qr_guardian_has_student(
  p_escola_id uuid,
  p_responsavel_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_escola_id IS NOT NULL
    AND p_responsavel_id IS NOT NULL
    AND public.get_user_escola_id() = p_escola_id
    AND (
      EXISTS (
        SELECT 1
        FROM public.alunos_responsaveis ar
        JOIN public.alunos a ON a.id = ar.aluno_id
        WHERE ar.responsavel_id = p_responsavel_id
          AND a.escola_id = p_escola_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.autorizacoes au
        JOIN public.alunos a ON a.id = au.aluno_id
        WHERE au.responsavel_id = p_responsavel_id
          AND a.escola_id = p_escola_id
          AND coalesce(au.ativa, true) = true
      )
    );
$$;

DROP POLICY IF EXISTS "parent_qr_cards_auth_select_via_escola" ON public.parent_qr_cards;
CREATE POLICY "parent_qr_cards_auth_select_via_escola"
  ON public.parent_qr_cards
  FOR SELECT
  TO authenticated
  USING (
    public.sisra_admin_qr_guardian_has_student(
      public.get_user_escola_id(),
      parent_qr_cards.responsavel_id
    )
  );

DROP POLICY IF EXISTS "parent_qr_cards_admin_write_via_escola" ON public.parent_qr_cards;
CREATE POLICY "parent_qr_cards_admin_write_via_escola"
  ON public.parent_qr_cards
  FOR ALL
  TO authenticated
  USING (
    public.get_user_tipo_usuario() = 'ADMIN'
    AND public.sisra_admin_qr_guardian_has_student(
      public.get_user_escola_id(),
      parent_qr_cards.responsavel_id
    )
  )
  WITH CHECK (
    public.get_user_tipo_usuario() = 'ADMIN'
    AND public.sisra_admin_qr_guardian_has_student(
      public.get_user_escola_id(),
      parent_qr_cards.responsavel_id
    )
  );

CREATE INDEX IF NOT EXISTS idx_parent_qr_cards_responsavel_active_created
  ON public.parent_qr_cards (responsavel_id, active, created_at DESC);

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
    'parentesco', r.parentesco,
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

CREATE OR REPLACE FUNCTION public.sisra_search_admin_qr_guardians(
  p_escola_id uuid,
  p_search text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  term text := trim(coalesce(p_search, ''));
  clean_cpf text := public.sisra_normalize_cpf(p_search);
  results jsonb;
BEGIN
  IF NOT public.sisra_is_school_admin(p_escola_id) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  IF length(term) < 2 AND length(clean_cpf) < 3 THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT coalesce(jsonb_agg(item ORDER BY item->>'nome_completo'), '[]'::jsonb)
  INTO results
  FROM (
    SELECT public.sisra_admin_qr_guardian_payload(p_escola_id, r.id) AS item
    FROM public.responsaveis r
    WHERE public.sisra_admin_qr_guardian_has_student(p_escola_id, r.id)
      AND (
        lower(r.nome_completo) LIKE ('%' || lower(term) || '%')
        OR (
          length(clean_cpf) >= 3
          AND public.sisra_normalize_cpf(r.cpf) LIKE ('%' || clean_cpf || '%')
        )
      )
    ORDER BY r.nome_completo
    LIMIT 20
  ) ranked
  WHERE item IS NOT NULL;

  RETURN coalesce(results, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_issue_admin_qr_card(
  p_escola_id uuid,
  p_responsavel_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  guardian_row public.responsaveis%ROWTYPE;
  card_row public.parent_qr_cards%ROWTYPE;
  reusable_qr text;
  new_expires_at timestamptz := now() + interval '12 months';
BEGIN
  IF NOT public.sisra_is_school_admin(p_escola_id) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  IF NOT public.sisra_admin_qr_guardian_has_student(p_escola_id, p_responsavel_id) THEN
    RAISE EXCEPTION 'RESPONSAVEL_SEM_VINCULO';
  END IF;

  SELECT *
  INTO guardian_row
  FROM public.responsaveis r
  WHERE r.id = p_responsavel_id;

  IF guardian_row.id IS NULL THEN
    RAISE EXCEPTION 'RESPONSAVEL_NAO_ENCONTRADO';
  END IF;

  IF nullif(trim(coalesce(guardian_row.codigo_acesso, '')), '') IS NULL THEN
    UPDATE public.responsaveis
    SET codigo_acesso = public.sisra_generate_access_code()
    WHERE id = guardian_row.id
    RETURNING * INTO guardian_row;
  END IF;

  UPDATE public.parent_qr_cards
  SET active = false
  WHERE responsavel_id = guardian_row.id
    AND coalesce(active, true) = true
    AND expires_at IS NOT NULL
    AND expires_at <= now();

  SELECT *
  INTO card_row
  FROM public.parent_qr_cards c
  WHERE c.responsavel_id = guardian_row.id
    AND coalesce(c.active, true) = true
    AND (c.expires_at IS NULL OR c.expires_at > now())
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF card_row.id IS NULL THEN
    SELECT c.qr_code
    INTO reusable_qr
    FROM public.parent_qr_cards c
    WHERE c.responsavel_id = guardian_row.id
    ORDER BY c.created_at DESC
    LIMIT 1;

    INSERT INTO public.parent_qr_cards (
      responsavel_id,
      qr_code,
      expires_at,
      active
    )
    VALUES (
      guardian_row.id,
      coalesce(
        reusable_qr,
        'LaSalleCheguei-' || guardian_row.id::text || '-' || replace(gen_random_uuid()::text, '-', '')
      ),
      new_expires_at,
      true
    )
    RETURNING * INTO card_row;
  END IF;

  INSERT INTO public.logs_auditoria (
    acao,
    tabela_afetada,
    registro_id,
    detalhes,
    escola_id,
    criado_em
  )
  VALUES (
    'GERACAO_CARTAO_QR',
    'parent_qr_cards',
    card_row.id,
    jsonb_build_object(
      'responsavel_id', guardian_row.id,
      'responsavel_nome', guardian_row.nome_completo,
      'qr_code', card_row.qr_code,
      'origem', 'admin_cartoes_qr'
    ),
    p_escola_id,
    now()
  );

  RETURN jsonb_build_object(
    'guardian',
    public.sisra_admin_qr_guardian_payload(p_escola_id, guardian_row.id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_update_admin_qr_validity(
  p_escola_id uuid,
  p_responsavel_id uuid,
  p_expires_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  card_id uuid;
BEGIN
  IF NOT public.sisra_is_school_admin(p_escola_id) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  IF NOT public.sisra_admin_qr_guardian_has_student(p_escola_id, p_responsavel_id) THEN
    RAISE EXCEPTION 'RESPONSAVEL_SEM_VINCULO';
  END IF;

  IF p_expires_at IS NULL
    OR p_expires_at < date_trunc('day', now())
    OR p_expires_at > now() + interval '5 years' THEN
    RAISE EXCEPTION 'VALIDADE_INVALIDA';
  END IF;

  SELECT c.id
  INTO card_id
  FROM public.parent_qr_cards c
  WHERE c.responsavel_id = p_responsavel_id
    AND coalesce(c.active, true) = true
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF card_id IS NULL THEN
    RAISE EXCEPTION 'CARTAO_NAO_ENCONTRADO';
  END IF;

  UPDATE public.parent_qr_cards
  SET expires_at = p_expires_at,
      active = true
  WHERE id = card_id;

  INSERT INTO public.logs_auditoria (
    acao,
    tabela_afetada,
    registro_id,
    detalhes,
    escola_id,
    criado_em
  )
  VALUES (
    'GERACAO_CARTAO_QR',
    'parent_qr_cards',
    card_id,
    jsonb_build_object(
      'responsavel_id', p_responsavel_id,
      'nova_validade', p_expires_at,
      'acao', 'ATUALIZACAO_VALIDADE'
    ),
    p_escola_id,
    now()
  );

  RETURN jsonb_build_object(
    'guardian',
    public.sisra_admin_qr_guardian_payload(p_escola_id, p_responsavel_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_update_admin_guardian_photo(
  p_escola_id uuid,
  p_responsavel_id uuid,
  p_foto_url text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_url text := nullif(trim(coalesce(p_foto_url, '')), '');
BEGIN
  IF NOT public.sisra_is_school_admin(p_escola_id) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  IF NOT public.sisra_admin_qr_guardian_has_student(p_escola_id, p_responsavel_id) THEN
    RAISE EXCEPTION 'RESPONSAVEL_SEM_VINCULO';
  END IF;

  IF safe_url IS NULL
    OR length(safe_url) > 2048
    OR safe_url !~* '^https?://' THEN
    RAISE EXCEPTION 'URL_FOTO_INVALIDA';
  END IF;

  UPDATE public.responsaveis
  SET foto_url = safe_url
  WHERE id = p_responsavel_id;

  INSERT INTO public.logs_auditoria (
    acao,
    tabela_afetada,
    registro_id,
    detalhes,
    escola_id,
    criado_em
  )
  VALUES (
    'EDICAO_ESTUDANTE',
    'responsaveis',
    p_responsavel_id,
    jsonb_build_object(
      'acao', 'ATUALIZACAO_FOTO_RESPONSAVEL',
      'foto_url', safe_url
    ),
    p_escola_id,
    now()
  );

  RETURN jsonb_build_object(
    'guardian',
    public.sisra_admin_qr_guardian_payload(p_escola_id, p_responsavel_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sisra_admin_qr_guardian_has_student(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sisra_admin_qr_guardian_payload(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sisra_search_admin_qr_guardians(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sisra_issue_admin_qr_card(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sisra_update_admin_qr_validity(uuid, uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sisra_update_admin_guardian_photo(uuid, uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.sisra_admin_qr_guardian_has_student(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_search_admin_qr_guardians(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_issue_admin_qr_card(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_update_admin_qr_validity(uuid, uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_update_admin_guardian_photo(uuid, uuid, text) TO authenticated;
