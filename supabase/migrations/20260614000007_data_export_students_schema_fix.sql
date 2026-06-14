-- =============================================================================
-- SISRA - Data export students schema fix
-- =============================================================================
-- The remote alunos table does not have soft-delete metadata. Replaces the
-- students export RPC so it scopes by school and active status without relying
-- on a non-existent excluido_em column.
-- =============================================================================

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

REVOKE ALL ON FUNCTION public.sisra_admin_export_students(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sisra_admin_export_students(uuid, integer) TO authenticated;
