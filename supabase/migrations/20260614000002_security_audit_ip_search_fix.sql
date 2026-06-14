-- =============================================================================
-- SISRA - Fix security audit search over inet IP column
-- =============================================================================
-- The first security audit RPC used coalesce(l.ip_address, ''), which makes
-- Postgres try to cast the empty string to inet. Cast IPs to text before search.
-- =============================================================================

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

REVOKE ALL ON FUNCTION public.sisra_get_security_audit_logs(uuid, text, text, timestamptz, timestamptz, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sisra_get_security_audit_logs(uuid, text, text, timestamptz, timestamptz, integer, integer) TO authenticated;
