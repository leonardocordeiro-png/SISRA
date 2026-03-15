-- =============================================================================
-- SISRA — Fix: infinite recursion in RLS policies for "usuarios"
-- Aplique no Supabase Dashboard → SQL Editor → New Query → cole → Run
-- =============================================================================
-- CAUSA: políticas que fazem EXISTS (SELECT FROM public.usuarios WHERE ...)
--        disparam RLS na própria tabela → recursão infinita.
-- SOLUÇÃO: nova função SECURITY DEFINER get_user_tipo_usuario() que bypassa RLS,
--          substituindo todos os subqueries inline em public.usuarios.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 1: nova função helper (SECURITY DEFINER → bypassa RLS)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_tipo_usuario()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT tipo_usuario
  FROM public.usuarios
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 2: corrigir política usuarios_admin_escola (era a origem da recursão)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "usuarios_admin_escola" ON public.usuarios;
CREATE POLICY "usuarios_admin_escola"
  ON public.usuarios
  FOR ALL
  TO authenticated
  USING (
    escola_id = get_user_escola_id()
    AND get_user_tipo_usuario() = 'ADMIN'
  )
  WITH CHECK (
    escola_id = get_user_escola_id()
    AND get_user_tipo_usuario() = 'ADMIN'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 3: corrigir política responsaveis_admin_write
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "responsaveis_admin_write" ON public.responsaveis;
CREATE POLICY "responsaveis_admin_write"
  ON public.responsaveis
  FOR ALL
  TO authenticated
  USING (get_user_tipo_usuario() IN ('ADMIN', 'COORDENADOR'))
  WITH CHECK (get_user_tipo_usuario() IN ('ADMIN', 'COORDENADOR'));

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 4: corrigir política ar_admin_write (alunos_responsaveis)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ar_admin_write" ON public.alunos_responsaveis;
CREATE POLICY "ar_admin_write"
  ON public.alunos_responsaveis
  FOR ALL
  TO authenticated
  USING (
    get_user_tipo_usuario() IN ('ADMIN', 'COORDENADOR')
    AND EXISTS (
      SELECT 1 FROM public.alunos
      WHERE alunos.id = alunos_responsaveis.aluno_id
        AND alunos.escola_id = get_user_escola_id()
    )
  )
  WITH CHECK (
    get_user_tipo_usuario() IN ('ADMIN', 'COORDENADOR')
    AND EXISTS (
      SELECT 1 FROM public.alunos
      WHERE alunos.id = alunos_responsaveis.aluno_id
        AND alunos.escola_id = get_user_escola_id()
    )
  );

-- =============================================================================
-- VERIFICAÇÃO: confirme que as políticas foram recriadas
-- =============================================================================
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('usuarios', 'responsaveis', 'alunos_responsaveis')
ORDER BY tablename, policyname;
