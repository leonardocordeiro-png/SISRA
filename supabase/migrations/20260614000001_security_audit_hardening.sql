-- =============================================================================
-- SISRA - Security audit log hardening and admin RPCs
-- =============================================================================
-- Centralizes /admin/auditoria-seguranca reads behind admin-only, school-scoped
-- RPCs. This keeps tab counts, search, pagination and CSV export consistent and
-- prevents school admins from seeing unrelated NULL-school audit rows.
-- =============================================================================

ALTER TABLE public.logs_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logs_auditoria_read_escola" ON public.logs_auditoria;
CREATE POLICY "logs_auditoria_read_escola"
  ON public.logs_auditoria
  FOR SELECT
  TO authenticated
  USING (
    escola_id = public.get_user_escola_id()
    OR (
      escola_id IS NULL
      AND usuario_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.usuarios u
        WHERE u.id = logs_auditoria.usuario_id
          AND u.escola_id = public.get_user_escola_id()
      )
    )
  );

DROP POLICY IF EXISTS "logs_auditoria_insert_any" ON public.logs_auditoria;
CREATE POLICY "logs_auditoria_insert_authenticated_scoped"
  ON public.logs_auditoria
  FOR INSERT
  TO authenticated
  WITH CHECK (
    escola_id IS NULL
    OR escola_id = public.get_user_escola_id()
  );

CREATE POLICY "logs_auditoria_insert_anon_unscoped"
  ON public.logs_auditoria
  FOR INSERT
  TO anon
  WITH CHECK (
    escola_id IS NULL
    AND usuario_id IS NULL
  );

DROP POLICY IF EXISTS "logs_auditoria_admin_delete" ON public.logs_auditoria;
CREATE POLICY "logs_auditoria_admin_delete"
  ON public.logs_auditoria
  FOR DELETE
  TO authenticated
  USING (
    escola_id = public.get_user_escola_id()
    AND public.get_user_tipo_usuario() = 'ADMIN'
  );

CREATE INDEX IF NOT EXISTS idx_logs_auditoria_escola_criado
  ON public.logs_auditoria (escola_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_logs_auditoria_usuario_criado
  ON public.logs_auditoria (usuario_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_logs_auditoria_acao_criado
  ON public.logs_auditoria (acao, criado_em DESC);

CREATE OR REPLACE FUNCTION public.sisra_security_audit_actions_for_tab(p_tab text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(coalesce(p_tab, 'all'))
    WHEN 'auth' THEN ARRAY[
      'LOGIN_SUCESSO', 'LOGIN_FALHA', 'SISTEMA_LOGIN', 'SISTEMA_LOGOUT', 'ACESSO_NEGADO'
    ]::text[]
    WHEN 'data' THEN ARRAY[
      'CADASTRO_ESTUDANTE', 'EDICAO_ESTUDANTE', 'EXCLUSAO_ESTUDANTE',
      'EXCLUSAO_ESTUDANTE_MASSA', 'EXCLUSAO_USUARIO', 'CADASTRO_RESPONSAVEL',
      'REMANEJAMENTO_TURMA', 'LIMPEZA_REGISTROS', 'GERACAO_LINK_ACESSO',
      'EXPORTACAO_DADOS', 'ANALISE', 'MANIPULACAO_DADOS', 'IMPORTACAO_FOTOS_LOTE'
    ]::text[]
    WHEN 'withdrawals' THEN ARRAY[
      'SOLICITACAO_RETIRADA', 'CONFIRMACAO_ENTREGA'
    ]::text[]
    WHEN 'qr' THEN ARRAY[
      'GERACAO_CARTAO_QR', 'GERACAO_RELATORIO'
    ]::text[]
    WHEN 'system' THEN ARRAY[
      'ALTERACAO_CONFIGURACAO', 'MANUTENCAO', 'MANIPULACAO_DADOS', 'ASSINATURA_DIARIA'
    ]::text[]
    WHEN 'alerts' THEN ARRAY[
      'LOGIN_FALHA', 'ACESSO_NEGADO', 'EXCLUSAO_ESTUDANTE_MASSA', 'LIMPEZA_REGISTROS'
    ]::text[]
    ELSE ARRAY[]::text[]
  END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_get_security_audit_logs(
  p_escola_id uuid,
  p_tab text DEFAULT 'all',
  p_search text DEFAULT '',
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tab_actions text[] := public.sisra_security_audit_actions_for_tab(p_tab);
  safe_limit integer := least(greatest(coalesce(p_limit, 20), 1), 5000);
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
  raw_search text := left(trim(coalesce(p_search, '')), 120);
  search_like text;
  logs_payload jsonb := '[]'::jsonb;
  counts_payload jsonb := '{}'::jsonb;
  total_count integer := 0;
BEGIN
  IF NOT public.sisra_is_school_admin(p_escola_id) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  IF raw_search <> '' THEN
    search_like := '%' ||
      replace(replace(replace(lower(raw_search), '\', '\\'), '%', '\%'), '_', '\_') ||
      '%';
  END IF;

  WITH scoped AS (
    SELECT
      l.id,
      l.usuario_id,
      l.acao,
      l.detalhes,
      l.tabela_afetada,
      l.registro_id,
      l.ip_address,
      l.user_agent,
      l.criado_em,
      l.escola_id,
      u.nome AS usuario_nome,
      u.email AS usuario_email
    FROM public.logs_auditoria l
    LEFT JOIN public.usuarios u
      ON u.id = l.usuario_id
      AND u.escola_id = p_escola_id
    WHERE (
        l.escola_id = p_escola_id
        OR (
          l.escola_id IS NULL
          AND l.usuario_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.usuarios ux
            WHERE ux.id = l.usuario_id
              AND ux.escola_id = p_escola_id
          )
        )
      )
      AND (cardinality(tab_actions) = 0 OR l.acao = ANY(tab_actions))
      AND (p_date_from IS NULL OR l.criado_em >= p_date_from)
      AND (p_date_to IS NULL OR l.criado_em <= p_date_to)
      AND (
        search_like IS NULL
        OR lower(coalesce(l.acao, '')) LIKE search_like ESCAPE '\'
        OR lower(coalesce(l.tabela_afetada, '')) LIKE search_like ESCAPE '\'
        OR lower(coalesce(l.ip_address::text, '')) LIKE search_like ESCAPE '\'
        OR lower(coalesce(l.detalhes::text, '')) LIKE search_like ESCAPE '\'
        OR lower(coalesce(u.nome, '')) LIKE search_like ESCAPE '\'
        OR lower(coalesce(u.email, '')) LIKE search_like ESCAPE '\'
      )
  )
  SELECT count(*)::integer
  INTO total_count
  FROM scoped;

  WITH scoped AS (
    SELECT
      l.id,
      l.usuario_id,
      l.acao,
      l.detalhes,
      l.tabela_afetada,
      l.registro_id,
      l.ip_address,
      l.user_agent,
      l.criado_em,
      l.escola_id,
      u.nome AS usuario_nome,
      u.email AS usuario_email
    FROM public.logs_auditoria l
    LEFT JOIN public.usuarios u
      ON u.id = l.usuario_id
      AND u.escola_id = p_escola_id
    WHERE (
        l.escola_id = p_escola_id
        OR (
          l.escola_id IS NULL
          AND l.usuario_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.usuarios ux
            WHERE ux.id = l.usuario_id
              AND ux.escola_id = p_escola_id
          )
        )
      )
      AND (cardinality(tab_actions) = 0 OR l.acao = ANY(tab_actions))
      AND (p_date_from IS NULL OR l.criado_em >= p_date_from)
      AND (p_date_to IS NULL OR l.criado_em <= p_date_to)
      AND (
        search_like IS NULL
        OR lower(coalesce(l.acao, '')) LIKE search_like ESCAPE '\'
        OR lower(coalesce(l.tabela_afetada, '')) LIKE search_like ESCAPE '\'
        OR lower(coalesce(l.ip_address::text, '')) LIKE search_like ESCAPE '\'
        OR lower(coalesce(l.detalhes::text, '')) LIKE search_like ESCAPE '\'
        OR lower(coalesce(u.nome, '')) LIKE search_like ESCAPE '\'
        OR lower(coalesce(u.email, '')) LIKE search_like ESCAPE '\'
      )
  )
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'usuario_id', s.usuario_id,
      'acao', s.acao,
      'detalhes', s.detalhes,
      'tabela_afetada', s.tabela_afetada,
      'registro_id', s.registro_id,
      'ip_address', s.ip_address,
      'user_agent', s.user_agent,
      'criado_em', s.criado_em,
      'escola_id', s.escola_id,
      'usuario', CASE
        WHEN s.usuario_nome IS NULL AND s.usuario_email IS NULL THEN NULL
        ELSE jsonb_build_object('nome', s.usuario_nome, 'email', s.usuario_email)
      END
    )
    ORDER BY s.criado_em DESC
  ), '[]'::jsonb)
  INTO logs_payload
  FROM (
    SELECT *
    FROM scoped
    ORDER BY criado_em DESC
    LIMIT safe_limit
    OFFSET safe_offset
  ) s;

  WITH tab_defs(tab_id, actions) AS (
    VALUES
      ('auth', public.sisra_security_audit_actions_for_tab('auth')),
      ('data', public.sisra_security_audit_actions_for_tab('data')),
      ('withdrawals', public.sisra_security_audit_actions_for_tab('withdrawals')),
      ('qr', public.sisra_security_audit_actions_for_tab('qr')),
      ('system', public.sisra_security_audit_actions_for_tab('system')),
      ('alerts', public.sisra_security_audit_actions_for_tab('alerts'))
  )
  SELECT coalesce(jsonb_object_agg(tab_id, count_value), '{}'::jsonb)
  INTO counts_payload
  FROM (
    SELECT
      td.tab_id,
      (
        SELECT count(*)::integer
        FROM public.logs_auditoria l
        LEFT JOIN public.usuarios u
          ON u.id = l.usuario_id
          AND u.escola_id = p_escola_id
        WHERE (
            l.escola_id = p_escola_id
            OR (
              l.escola_id IS NULL
              AND l.usuario_id IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM public.usuarios ux
                WHERE ux.id = l.usuario_id
                  AND ux.escola_id = p_escola_id
              )
            )
          )
          AND l.acao = ANY(td.actions)
          AND (p_date_from IS NULL OR l.criado_em >= p_date_from)
          AND (p_date_to IS NULL OR l.criado_em <= p_date_to)
          AND (
            search_like IS NULL
            OR lower(coalesce(l.acao, '')) LIKE search_like ESCAPE '\'
            OR lower(coalesce(l.tabela_afetada, '')) LIKE search_like ESCAPE '\'
            OR lower(coalesce(l.ip_address::text, '')) LIKE search_like ESCAPE '\'
            OR lower(coalesce(l.detalhes::text, '')) LIKE search_like ESCAPE '\'
            OR lower(coalesce(u.nome, '')) LIKE search_like ESCAPE '\'
            OR lower(coalesce(u.email, '')) LIKE search_like ESCAPE '\'
          )
      ) AS count_value
    FROM tab_defs td
  ) counted;

  RETURN jsonb_build_object(
    'logs', logs_payload,
    'total_count', total_count,
    'tab_counts', counts_payload,
    'limit', safe_limit,
    'offset', safe_offset
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sisra_security_audit_actions_for_tab(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sisra_get_security_audit_logs(uuid, text, text, timestamptz, timestamptz, integer, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.sisra_get_security_audit_logs(uuid, text, text, timestamptz, timestamptz, integer, integer) TO authenticated;
