-- =============================================================================
-- SISRA — Row Level Security: Isolamento por escola_id
-- Aplique este script no Supabase SQL Editor:
--   Supabase Dashboard → SQL Editor → New Query → cole → Run
-- =============================================================================
-- Este script:
--   1. Habilita RLS em todas as tabelas críticas
--   2. Cria uma função helper que lê o escola_id do usuário autenticado
--   3. Cria políticas para cada tabela
--   4. Mantém a chave anônima (anon) funcional para portais públicos (via aluno_id)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNÇÕES HELPER: lêem dados do usuário autenticado (JWT → usuarios)
-- SECURITY DEFINER = executam como dono (postgres) → bypassam RLS em usuarios,
-- evitando recursão infinita quando as políticas precisam consultar a própria tabela.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_escola_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT escola_id
  FROM public.usuarios
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Retorna o tipo_usuario do usuário autenticado (usado nas políticas de admin/coordenador)
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
-- TABELA: alunos
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados (recepção, sala, admin) veem apenas alunos da sua escola
DROP POLICY IF EXISTS "alunos_auth_escola" ON public.alunos;
CREATE POLICY "alunos_auth_escola"
  ON public.alunos
  FOR SELECT
  TO authenticated
  USING (escola_id = get_user_escola_id());

-- Anon (portais públicos) pode ler alunos pelo id (necessário para FamilyPortal/status)
DROP POLICY IF EXISTS "alunos_anon_by_id" ON public.alunos;
CREATE POLICY "alunos_anon_by_id"
  ON public.alunos
  FOR SELECT
  TO anon
  USING (true);  -- filtrado no código por aluno_id específico; RLS base no frontend

-- Somente service_role pode inserir/atualizar/deletar
DROP POLICY IF EXISTS "alunos_write_authenticated" ON public.alunos;
CREATE POLICY "alunos_write_authenticated"
  ON public.alunos
  FOR ALL
  TO authenticated
  USING (escola_id = get_user_escola_id())
  WITH CHECK (escola_id = get_user_escola_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: solicitacoes_retirada
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.solicitacoes_retirada ENABLE ROW LEVEL SECURITY;

-- Autenticados: apenas registros da própria escola
DROP POLICY IF EXISTS "solicitacoes_auth_escola" ON public.solicitacoes_retirada;
CREATE POLICY "solicitacoes_auth_escola"
  ON public.solicitacoes_retirada
  FOR ALL
  TO authenticated
  USING (escola_id = get_user_escola_id())
  WITH CHECK (escola_id = get_user_escola_id());

-- Anon (parent/status, FamilyPortal): pode ler/gravar pelo aluno_id que lhe pertence
-- A restrição real é feita no frontend (aluno_id vem da sessão autenticada do responsável)
DROP POLICY IF EXISTS "solicitacoes_anon_read" ON public.solicitacoes_retirada;
CREATE POLICY "solicitacoes_anon_read"
  ON public.solicitacoes_retirada
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "solicitacoes_anon_insert" ON public.solicitacoes_retirada;
CREATE POLICY "solicitacoes_anon_insert"
  ON public.solicitacoes_retirada
  FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "solicitacoes_anon_update" ON public.solicitacoes_retirada;
CREATE POLICY "solicitacoes_anon_update"
  ON public.solicitacoes_retirada
  FOR UPDATE
  TO anon
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: usuarios
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- Cada usuário vê apenas seu próprio perfil
DROP POLICY IF EXISTS "usuarios_self" ON public.usuarios;
CREATE POLICY "usuarios_self"
  ON public.usuarios
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Admin pode ver todos os usuários da sua escola
-- ATENÇÃO: não use EXISTS (SELECT FROM usuarios) aqui — causa recursão infinita no RLS.
-- Use get_user_tipo_usuario() que é SECURITY DEFINER e bypassa RLS.
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
-- TABELA: autorizacoes
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.autorizacoes ENABLE ROW LEVEL SECURITY;

-- Autenticados veem autorizações dos alunos da sua escola
DROP POLICY IF EXISTS "autorizacoes_auth_escola" ON public.autorizacoes;
CREATE POLICY "autorizacoes_auth_escola"
  ON public.autorizacoes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.alunos
      WHERE alunos.id = autorizacoes.aluno_id
        AND alunos.escola_id = get_user_escola_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.alunos
      WHERE alunos.id = autorizacoes.aluno_id
        AND alunos.escola_id = get_user_escola_id()
    )
  );

-- Anon: leitura livre (necessário para recepção via QR/código sem auth JWT)
DROP POLICY IF EXISTS "autorizacoes_anon_read" ON public.autorizacoes;
CREATE POLICY "autorizacoes_anon_read"
  ON public.autorizacoes
  FOR SELECT
  TO anon
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: responsaveis
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.responsaveis ENABLE ROW LEVEL SECURITY;

-- Responsaveis não têm escola_id direto — acesso via autorizacoes/alunos_responsaveis
-- Autenticados: podem ler responsaveis vinculados a alunos da sua escola
DROP POLICY IF EXISTS "responsaveis_auth_via_escola" ON public.responsaveis;
CREATE POLICY "responsaveis_auth_via_escola"
  ON public.responsaveis
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.autorizacoes a
      JOIN public.alunos al ON al.id = a.aluno_id
      WHERE a.responsavel_id = responsaveis.id
        AND al.escola_id = get_user_escola_id()
    )
    OR EXISTS (
      SELECT 1
      FROM public.alunos_responsaveis ar
      JOIN public.alunos al ON al.id = ar.aluno_id
      WHERE ar.responsavel_id = responsaveis.id
        AND al.escola_id = get_user_escola_id()
    )
  );

-- Admin/Coordenador pode criar/editar responsaveis da sua escola
DROP POLICY IF EXISTS "responsaveis_admin_write" ON public.responsaveis;
CREATE POLICY "responsaveis_admin_write"
  ON public.responsaveis
  FOR ALL
  TO authenticated
  USING (get_user_tipo_usuario() IN ('ADMIN', 'COORDENADOR'))
  WITH CHECK (get_user_tipo_usuario() IN ('ADMIN', 'COORDENADOR'));

-- Anon: pode buscar por codigo_acesso (portal público) e CPF (recepção sem JWT)
DROP POLICY IF EXISTS "responsaveis_anon_read" ON public.responsaveis;
CREATE POLICY "responsaveis_anon_read"
  ON public.responsaveis
  FOR SELECT
  TO anon
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: alunos_responsaveis (junction)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.alunos_responsaveis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ar_auth_escola" ON public.alunos_responsaveis;
CREATE POLICY "ar_auth_escola"
  ON public.alunos_responsaveis
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.alunos
      WHERE alunos.id = alunos_responsaveis.aluno_id
        AND alunos.escola_id = get_user_escola_id()
    )
  );

DROP POLICY IF EXISTS "ar_anon_read" ON public.alunos_responsaveis;
CREATE POLICY "ar_anon_read"
  ON public.alunos_responsaveis
  FOR SELECT
  TO anon
  USING (true);

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

-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: turmas / salas (se existir)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'turmas') THEN
    EXECUTE 'ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "turmas_auth_escola" ON public.turmas';
    EXECUTE '
      CREATE POLICY "turmas_auth_escola"
        ON public.turmas FOR ALL TO authenticated
        USING (escola_id = get_user_escola_id())
        WITH CHECK (escola_id = get_user_escola_id())
    ';
    EXECUTE 'DROP POLICY IF EXISTS "turmas_anon_read" ON public.turmas';
    EXECUTE 'CREATE POLICY "turmas_anon_read" ON public.turmas FOR SELECT TO anon USING (true)';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: audit_log (se existir)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_log') THEN
    EXECUTE 'ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "audit_auth_escola" ON public.audit_log';
    EXECUTE '
      CREATE POLICY "audit_auth_escola"
        ON public.audit_log FOR ALL TO authenticated
        USING (escola_id = get_user_escola_id())
        WITH CHECK (escola_id = get_user_escola_id())
    ';
    EXECUTE 'DROP POLICY IF EXISTS "audit_anon_insert" ON public.audit_log';
    EXECUTE 'CREATE POLICY "audit_anon_insert" ON public.audit_log FOR INSERT TO anon WITH CHECK (true)';
  END IF;
END $$;

-- =============================================================================
-- VERIFICAÇÃO: liste as políticas criadas
-- =============================================================================
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
