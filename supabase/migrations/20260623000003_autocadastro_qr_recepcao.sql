-- =============================================================================
-- SISRA - Auto-cadastro de responsáveis via QR único na recepção
-- =============================================================================
-- Permite que um responsável escaneie UM QR por escola (codifica só escola_id),
-- identifique o aluno por MATRÍCULA + DATA DE NASCIMENTO (2º fator) e crie o
-- vínculo imediatamente, sem token por aluno e sem CPF previamente cadastrado.
--
-- Segurança:
--  - 2º fator (data de nascimento) que só a família conhece.
--  - Throttling por (escola_id, matrícula) via logs_auditoria contra brute force.
--  - Revalidação server-side no register (cliente nunca decide o aluno_id).
--  - Vínculo sempre SECUNDARIO; parentesco só em autorizacoes (não em responsaveis).
--  - Auditoria com metodo = 'AUTOCADASTRO_QR'.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: mascara o nome do aluno para confirmação sem expor dados.
-- "João Pedro Silva" -> "João S."
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sisra_mask_name(p_nome text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN nullif(trim(coalesce(p_nome, '')), '') IS NULL THEN ''
    WHEN array_length(string_to_array(trim(p_nome), ' '), 1) = 1
      THEN initcap(split_part(trim(p_nome), ' ', 1))
    ELSE initcap(split_part(trim(p_nome), ' ', 1)) || ' '
         || upper(left(split_part(trim(p_nome), ' ',
              array_length(string_to_array(trim(p_nome), ' '), 1)), 1)) || '.'
  END;
$$;

-- ---------------------------------------------------------------------------
-- Helper: quantas tentativas falhas recentes para (escola, matrícula).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sisra_autocadastro_fail_count(
  p_escola_id uuid,
  p_matricula text
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.logs_auditoria
  WHERE acao = 'AUTOCADASTRO_FALHA'
    AND escola_id = p_escola_id
    AND detalhes->>'matricula' = p_matricula
    AND criado_em > now() - interval '15 minutes';
$$;

-- ---------------------------------------------------------------------------
-- 1. Identificar aluno por matrícula + data de nascimento.
--    Retorna apenas confirmação mascarada (nome + turma). Nunca expõe a lista.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sisra_autocadastro_identificar_aluno(
  p_escola_id uuid,
  p_matricula text,
  p_data_nascimento date
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_matricula text := nullif(trim(coalesce(p_matricula, '')), '');
  aluno_row record;
BEGIN
  IF p_escola_id IS NULL OR v_matricula IS NULL OR p_data_nascimento IS NULL THEN
    RETURN jsonb_build_object('student', NULL, 'error', 'DADOS_INCOMPLETOS');
  END IF;

  IF public.sisra_autocadastro_fail_count(p_escola_id, v_matricula) >= 5 THEN
    RETURN jsonb_build_object('student', NULL, 'error', 'BLOQUEADO');
  END IF;

  SELECT a.id, a.nome_completo, a.turma, a.data_nascimento, a.ativo
  INTO aluno_row
  FROM public.alunos a
  WHERE a.escola_id = p_escola_id
    AND a.matricula = v_matricula
  LIMIT 1;

  IF aluno_row.id IS NULL THEN
    INSERT INTO public.logs_auditoria (acao, tabela_afetada, detalhes, escola_id, criado_em)
    VALUES ('AUTOCADASTRO_FALHA', 'alunos',
            jsonb_build_object('matricula', v_matricula, 'escola_id', p_escola_id, 'motivo', 'NAO_ENCONTRADO'),
            p_escola_id, now());
    RETURN jsonb_build_object('student', NULL);
  END IF;

  IF aluno_row.data_nascimento IS NULL THEN
    -- Cadastro do aluno sem data de nascimento: não dá para usar o 2º fator.
    RETURN jsonb_build_object('student', NULL, 'error', 'CADASTRO_INCOMPLETO');
  END IF;

  IF aluno_row.data_nascimento <> p_data_nascimento OR coalesce(aluno_row.ativo, true) = false THEN
    INSERT INTO public.logs_auditoria (acao, tabela_afetada, detalhes, escola_id, criado_em)
    VALUES ('AUTOCADASTRO_FALHA', 'alunos',
            jsonb_build_object('matricula', v_matricula, 'escola_id', p_escola_id, 'motivo', 'NASCIMENTO_INVALIDO'),
            p_escola_id, now());
    RETURN jsonb_build_object('student', NULL);
  END IF;

  RETURN jsonb_build_object('student', jsonb_build_object(
    'nome_mascarado', public.sisra_mask_name(aluno_row.nome_completo),
    'turma', aluno_row.turma
  ));
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. (Opcional) Pré-preencher responsável já existente pelo CPF.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sisra_autocadastro_guardian_by_cpf(
  p_escola_id uuid,
  p_cpf text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  guardian jsonb;
  clean_cpf text := public.sisra_normalize_cpf(p_cpf);
BEGIN
  IF p_escola_id IS NULL OR length(clean_cpf) <> 11 THEN
    RETURN jsonb_build_object('guardian', NULL);
  END IF;

  SELECT jsonb_build_object(
    'id', r.id,
    'nome_completo', r.nome_completo,
    'cpf', r.cpf,
    'telefone', r.telefone,
    'foto_url', r.foto_url,
    'codigo_acesso', r.codigo_acesso
  )
  INTO guardian
  FROM public.responsaveis r
  WHERE public.sisra_normalize_cpf(r.cpf) = clean_cpf
  LIMIT 1;

  RETURN jsonb_build_object('guardian', guardian);
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Registrar responsável + vínculo (revalida 2º fator no servidor).
--    Espelha sisra_register_guardian_by_token, porém sem token e resolvendo o
--    aluno por matrícula+nascimento.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sisra_autocadastro_register_guardian(
  p_escola_id uuid,
  p_matricula text,
  p_data_nascimento date,
  p_nome text,
  p_cpf text,
  p_telefone text,
  p_parentesco text,
  p_foto_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_matricula text := nullif(trim(coalesce(p_matricula, '')), '');
  clean_cpf text := public.sisra_normalize_cpf(p_cpf);
  aluno_row record;
  guardian_row public.responsaveis%ROWTYPE;
  access_code text;
  qr_row record;
  qr_value text;
  qr_expires_at timestamptz;
BEGIN
  IF p_escola_id IS NULL OR v_matricula IS NULL OR p_data_nascimento IS NULL THEN
    RAISE EXCEPTION 'Dados de identificação do aluno incompletos.';
  END IF;

  IF length(clean_cpf) <> 11 THEN
    RAISE EXCEPTION 'CPF inválido.';
  END IF;

  IF public.sisra_autocadastro_fail_count(p_escola_id, v_matricula) >= 5 THEN
    RAISE EXCEPTION 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  END IF;

  -- Revalida matrícula + data de nascimento (server-side).
  SELECT a.id, a.escola_id
  INTO aluno_row
  FROM public.alunos a
  WHERE a.escola_id = p_escola_id
    AND a.matricula = v_matricula
    AND a.data_nascimento = p_data_nascimento
    AND coalesce(a.ativo, true) = true
  LIMIT 1;

  IF aluno_row.id IS NULL THEN
    INSERT INTO public.logs_auditoria (acao, tabela_afetada, detalhes, escola_id, criado_em)
    VALUES ('AUTOCADASTRO_FALHA', 'alunos',
            jsonb_build_object('matricula', v_matricula, 'escola_id', p_escola_id, 'motivo', 'REGISTER_INVALIDO'),
            p_escola_id, now());
    RAISE EXCEPTION 'Não foi possível validar o aluno. Verifique a matrícula e a data de nascimento.';
  END IF;

  -- Responsável: reusa se já existe (dedup por CPF normalizado), senão cria.
  SELECT *
  INTO guardian_row
  FROM public.responsaveis r
  WHERE public.sisra_normalize_cpf(r.cpf) = clean_cpf
  LIMIT 1;

  IF guardian_row.id IS NULL THEN
    access_code := public.sisra_generate_access_code();

    INSERT INTO public.responsaveis (
      nome_completo, cpf, telefone, foto_url, codigo_acesso
    )
    VALUES (
      trim(p_nome),
      clean_cpf,
      nullif(trim(coalesce(p_telefone, '')), ''),
      nullif(p_foto_url, ''),
      access_code
    )
    RETURNING * INTO guardian_row;
  ELSE
    access_code := coalesce(guardian_row.codigo_acesso, public.sisra_generate_access_code());

    UPDATE public.responsaveis
    SET nome_completo = trim(p_nome),
        cpf = clean_cpf,
        telefone = nullif(trim(coalesce(p_telefone, '')), ''),
        foto_url = coalesce(nullif(p_foto_url, ''), foto_url),
        codigo_acesso = access_code
    WHERE id = guardian_row.id
    RETURNING * INTO guardian_row;
  END IF;

  -- Vínculo de autorização (SECUNDARIO) com parentesco no link.
  INSERT INTO public.autorizacoes (
    aluno_id, responsavel_id, tipo_autorizacao, parentesco, ativa
  )
  SELECT aluno_row.id, guardian_row.id, 'SECUNDARIO',
         coalesce(nullif(trim(p_parentesco), ''), 'Outro'), true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.autorizacoes au
    WHERE au.aluno_id = aluno_row.id
      AND au.responsavel_id = guardian_row.id
  );

  INSERT INTO public.alunos_responsaveis (aluno_id, responsavel_id)
  SELECT aluno_row.id, guardian_row.id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.alunos_responsaveis ar
    WHERE ar.aluno_id = aluno_row.id
      AND ar.responsavel_id = guardian_row.id
  );

  -- QR card (reusa ativo/não expirado, senão cria com 12 meses).
  SELECT *
  INTO qr_row
  FROM public.parent_qr_cards c
  WHERE c.responsavel_id = guardian_row.id
    AND coalesce(c.active, true) = true
    AND (c.expires_at IS NULL OR c.expires_at > now())
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF qr_row.id IS NOT NULL THEN
    qr_value := qr_row.qr_code;
    qr_expires_at := qr_row.expires_at;
  ELSE
    qr_value := 'SISRA-' || gen_random_uuid()::text || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);
    qr_expires_at := now() + interval '12 months';

    INSERT INTO public.parent_qr_cards (responsavel_id, qr_code, expires_at, active)
    VALUES (guardian_row.id, qr_value, qr_expires_at, true);
  END IF;

  INSERT INTO public.logs_auditoria (
    acao, tabela_afetada, registro_id, detalhes, escola_id, criado_em
  )
  VALUES (
    'CADASTRO_RESPONSAVEL',
    'responsaveis',
    guardian_row.id,
    jsonb_build_object(
      'aluno_id', aluno_row.id,
      'parentesco', p_parentesco,
      'metodo', 'AUTOCADASTRO_QR'
    ),
    p_escola_id,
    now()
  );

  RETURN jsonb_build_object(
    'guardian', jsonb_build_object(
      'id', guardian_row.id,
      'nome_completo', guardian_row.nome_completo,
      'cpf', guardian_row.cpf,
      'telefone', guardian_row.telefone,
      'foto_url', guardian_row.foto_url,
      'codigo_acesso', guardian_row.codigo_acesso,
      'qr_code', qr_value,
      'expires_at', qr_expires_at
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sisra_autocadastro_identificar_aluno(uuid, text, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_autocadastro_guardian_by_cpf(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_autocadastro_register_guardian(uuid, text, date, text, text, text, text, text) TO anon, authenticated;
