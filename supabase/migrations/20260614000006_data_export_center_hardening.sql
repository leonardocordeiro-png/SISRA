-- =============================================================================
-- SISRA - Data export center hardening
-- =============================================================================
-- Moves /admin/exportar-dados reads behind admin-only RPCs, scopes every export
-- by school, and records export activity from the database layer.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_alunos_escola_nome
  ON public.alunos (escola_id, nome_completo);

CREATE OR REPLACE FUNCTION public.sisra_admin_export_students(
  p_escola_id uuid,
  p_limit integer DEFAULT 50000
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_limit integer := least(greatest(coalesce(p_limit, 50000), 1), 50000);
  total_count integer := 0;
  items jsonb := '[]'::jsonb;
BEGIN
  IF p_escola_id IS NULL OR NOT public.sisra_is_school_admin(p_escola_id) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  SELECT count(*)::integer
  INTO total_count
  FROM public.alunos a
  WHERE a.escola_id = p_escola_id;

  WITH scoped AS (
    SELECT
      a.matricula,
      a.nome_completo,
      a.turma,
      a.sala,
      a.ativo
    FROM public.alunos a
    WHERE a.escola_id = p_escola_id
    ORDER BY a.nome_completo ASC NULLS LAST
    LIMIT safe_limit
  )
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'matricula', matricula,
      'nome_completo', nome_completo,
      'turma', turma,
      'sala', sala,
      'ativo', ativo
    )
    ORDER BY nome_completo ASC NULLS LAST
  ), '[]'::jsonb)
  INTO items
  FROM scoped;

  INSERT INTO public.logs_auditoria (
    acao,
    tabela_afetada,
    detalhes,
    usuario_id,
    escola_id,
    criado_em
  )
  VALUES (
    'EXPORTACAO_DADOS',
    'alunos',
    jsonb_build_object(
      'origem', 'ADMIN_EXPORTAR_DADOS',
      'registros_exportados', jsonb_array_length(items),
      'total_filtrado', total_count,
      'limite', safe_limit,
      'truncado', total_count > safe_limit
    ),
    auth.uid(),
    p_escola_id,
    now()
  )
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'records', items,
    'total_count', total_count,
    'returned_count', jsonb_array_length(items),
    'limit', safe_limit,
    'truncated', total_count > safe_limit
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_admin_export_pickups(
  p_escola_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer DEFAULT 50000
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_limit integer := least(greatest(coalesce(p_limit, 50000), 1), 50000);
  total_count integer := 0;
  items jsonb := '[]'::jsonb;
BEGIN
  IF p_escola_id IS NULL OR NOT public.sisra_is_school_admin(p_escola_id) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
    RAISE EXCEPTION 'PERIODO_INVALIDO';
  END IF;

  SELECT count(*)::integer
  INTO total_count
  FROM public.solicitacoes_retirada sr
  WHERE sr.escola_id = p_escola_id
    AND sr.horario_solicitacao >= p_from
    AND sr.horario_solicitacao <= p_to;

  WITH scoped AS (
    SELECT
      sr.status,
      sr.tipo_solicitacao,
      sr.horario_solicitacao,
      sr.horario_notificacao,
      sr.horario_confirmacao,
      sr.horario_liberacao,
      sr.tempo_espera_segundos,
      sr.observacoes,
      sr.mensagem_sala,
      sr.mensagem_recepcao,
      a.nome_completo AS aluno_nome,
      a.matricula AS aluno_matricula,
      a.turma AS aluno_turma,
      a.sala AS aluno_sala,
      r.nome_completo AS responsavel_nome,
      public.sisra_mask_cpf(r.cpf) AS responsavel_cpf
    FROM public.solicitacoes_retirada sr
    LEFT JOIN public.alunos a
      ON a.id = sr.aluno_id
      AND a.escola_id = p_escola_id
    LEFT JOIN public.responsaveis r
      ON r.id = sr.responsavel_id
    WHERE sr.escola_id = p_escola_id
      AND sr.horario_solicitacao >= p_from
      AND sr.horario_solicitacao <= p_to
    ORDER BY sr.horario_solicitacao DESC
    LIMIT safe_limit
  )
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'horario_solicitacao', horario_solicitacao,
      'horario_notificacao', horario_notificacao,
      'horario_liberacao', horario_liberacao,
      'horario_confirmacao', horario_confirmacao,
      'tempo_espera_segundos', tempo_espera_segundos,
      'status', status,
      'tipo_solicitacao', tipo_solicitacao,
      'aluno', jsonb_build_object(
        'matricula', aluno_matricula,
        'nome_completo', aluno_nome,
        'turma', aluno_turma,
        'sala', aluno_sala
      ),
      'responsavel', jsonb_build_object(
        'nome_completo', responsavel_nome,
        'cpf', responsavel_cpf
      ),
      'observacoes', observacoes,
      'mensagem_sala', mensagem_sala,
      'mensagem_recepcao', mensagem_recepcao
    )
    ORDER BY horario_solicitacao DESC
  ), '[]'::jsonb)
  INTO items
  FROM scoped;

  INSERT INTO public.logs_auditoria (
    acao,
    tabela_afetada,
    detalhes,
    usuario_id,
    escola_id,
    criado_em
  )
  VALUES (
    'EXPORTACAO_DADOS',
    'solicitacoes_retirada',
    jsonb_build_object(
      'origem', 'ADMIN_EXPORTAR_DADOS',
      'registros_exportados', jsonb_array_length(items),
      'total_filtrado', total_count,
      'limite', safe_limit,
      'truncado', total_count > safe_limit,
      'periodo', jsonb_build_object('de', p_from, 'ate', p_to)
    ),
    auth.uid(),
    p_escola_id,
    now()
  )
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'records', items,
    'total_count', total_count,
    'returned_count', jsonb_array_length(items),
    'limit', safe_limit,
    'truncated', total_count > safe_limit
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_admin_export_audit_logs(
  p_escola_id uuid,
  p_limit integer DEFAULT 100000
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_limit integer := least(greatest(coalesce(p_limit, 100000), 1), 100000);
  total_count integer := 0;
  items jsonb := '[]'::jsonb;
BEGIN
  IF p_escola_id IS NULL OR NOT public.sisra_is_school_admin(p_escola_id) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
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
    ORDER BY l.criado_em DESC
    LIMIT safe_limit
  )
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'criado_em', criado_em,
      'acao', acao,
      'tabela_afetada', tabela_afetada,
      'registro_id', registro_id,
      'usuario_id', usuario_id,
      'usuario_nome', usuario_nome,
      'usuario_email', usuario_email,
      'ip_address', ip_address::text,
      'user_agent', user_agent,
      'detalhes', detalhes
    )
    ORDER BY criado_em DESC
  ), '[]'::jsonb)
  INTO items
  FROM scoped;

  INSERT INTO public.logs_auditoria (
    acao,
    tabela_afetada,
    detalhes,
    usuario_id,
    escola_id,
    criado_em
  )
  VALUES (
    'EXPORTACAO_DADOS',
    'logs_auditoria',
    jsonb_build_object(
      'origem', 'ADMIN_EXPORTAR_DADOS',
      'registros_exportados', jsonb_array_length(items),
      'total_filtrado', total_count,
      'limite', safe_limit,
      'truncado', total_count > safe_limit
    ),
    auth.uid(),
    p_escola_id,
    now()
  )
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'records', items,
    'total_count', total_count,
    'returned_count', jsonb_array_length(items),
    'limit', safe_limit,
    'truncated', total_count > safe_limit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sisra_admin_export_students(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sisra_admin_export_pickups(uuid, timestamptz, timestamptz, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sisra_admin_export_audit_logs(uuid, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.sisra_admin_export_students(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_admin_export_pickups(uuid, timestamptz, timestamptz, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_admin_export_audit_logs(uuid, integer) TO authenticated;
