-- =============================================================================
-- SISRA - Public registration RPCs
-- =============================================================================
-- Keeps parent self-registration working after anon table access hardening.
-- Public callers can only act through a valid, unexpired registration token.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sisra_registration_student_by_token(
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  student jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', a.id,
    'nome_completo', a.nome_completo,
    'turma', a.turma,
    'sala', a.sala,
    'foto_url', a.foto_url,
    'escola_id', a.escola_id
  )
  INTO student
  FROM public.tokens_acesso t
  JOIN public.alunos a ON a.id = t.aluno_id
  WHERE t.token = trim(p_token)
    AND (t.expira_em IS NULL OR t.expira_em > now())
  LIMIT 1;

  RETURN jsonb_build_object('student', student);
END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_registration_guardian_by_cpf(
  p_token text,
  p_cpf text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  token_valid boolean;
  guardian jsonb;
  clean_cpf text := public.sisra_normalize_cpf(p_cpf);
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.tokens_acesso t
    WHERE t.token = trim(p_token)
      AND (t.expira_em IS NULL OR t.expira_em > now())
  )
  INTO token_valid;

  IF NOT token_valid OR length(clean_cpf) <> 11 THEN
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

CREATE OR REPLACE FUNCTION public.sisra_generate_access_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i integer;
  attempts integer := 0;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..8 LOOP
      candidate := candidate || substr(chars, 1 + floor(random() * length(chars))::integer, 1);
    END LOOP;

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.responsaveis r WHERE upper(r.codigo_acesso) = candidate
    );

    attempts := attempts + 1;
    IF attempts > 20 THEN
      candidate := upper(replace(gen_random_uuid()::text, '-', ''))::text;
      candidate := substr(candidate, 1, 8);
      EXIT;
    END IF;
  END LOOP;

  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.sisra_register_guardian_by_token(
  p_token text,
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
  token_row record;
  clean_cpf text := public.sisra_normalize_cpf(p_cpf);
  guardian_row public.responsaveis%ROWTYPE;
  access_code text;
  qr_row record;
  qr_value text;
  qr_expires_at timestamptz;
BEGIN
  SELECT t.token, t.aluno_id, a.escola_id, a.nome_completo AS aluno_nome
  INTO token_row
  FROM public.tokens_acesso t
  JOIN public.alunos a ON a.id = t.aluno_id
  WHERE t.token = trim(p_token)
    AND (t.expira_em IS NULL OR t.expira_em > now())
  LIMIT 1;

  IF token_row.token IS NULL THEN
    RAISE EXCEPTION 'Link de acesso inválido ou expirado.';
  END IF;

  IF length(clean_cpf) <> 11 THEN
    RAISE EXCEPTION 'CPF inválido.';
  END IF;

  SELECT *
  INTO guardian_row
  FROM public.responsaveis r
  WHERE public.sisra_normalize_cpf(r.cpf) = clean_cpf
  LIMIT 1;

  IF guardian_row.id IS NULL THEN
    access_code := public.sisra_generate_access_code();

    INSERT INTO public.responsaveis (
      nome_completo,
      cpf,
      telefone,
      foto_url,
      codigo_acesso,
      parentesco
    )
    VALUES (
      trim(p_nome),
      clean_cpf,
      nullif(trim(coalesce(p_telefone, '')), ''),
      nullif(p_foto_url, ''),
      access_code,
      nullif(trim(coalesce(p_parentesco, '')), '')
    )
    RETURNING * INTO guardian_row;
  ELSE
    access_code := coalesce(guardian_row.codigo_acesso, public.sisra_generate_access_code());

    UPDATE public.responsaveis
    SET nome_completo = trim(p_nome),
        telefone = nullif(trim(coalesce(p_telefone, '')), ''),
        foto_url = coalesce(nullif(p_foto_url, ''), foto_url),
        codigo_acesso = access_code,
        parentesco = coalesce(nullif(trim(coalesce(p_parentesco, '')), ''), parentesco)
    WHERE id = guardian_row.id
    RETURNING * INTO guardian_row;
  END IF;

  INSERT INTO public.autorizacoes (
    aluno_id,
    responsavel_id,
    tipo_autorizacao,
    parentesco,
    ativa
  )
  SELECT token_row.aluno_id, guardian_row.id, 'SECUNDARIO', coalesce(nullif(trim(p_parentesco), ''), 'Outro'), true
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.autorizacoes au
    WHERE au.aluno_id = token_row.aluno_id
      AND au.responsavel_id = guardian_row.id
  );

  INSERT INTO public.alunos_responsaveis (aluno_id, responsavel_id)
  SELECT token_row.aluno_id, guardian_row.id
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.alunos_responsaveis ar
    WHERE ar.aluno_id = token_row.aluno_id
      AND ar.responsavel_id = guardian_row.id
  );

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

    INSERT INTO public.parent_qr_cards (
      responsavel_id,
      qr_code,
      expires_at,
      active
    )
    VALUES (
      guardian_row.id,
      qr_value,
      qr_expires_at,
      true
    );
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
    'CADASTRO_RESPONSAVEL',
    'responsaveis',
    guardian_row.id,
    jsonb_build_object(
      'aluno_id', token_row.aluno_id,
      'parentesco', p_parentesco,
      'metodo', 'AUTO_CADASTRO'
    ),
    token_row.escola_id,
    now()
  );

  DELETE FROM public.tokens_acesso
  WHERE token = token_row.token;

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

CREATE OR REPLACE FUNCTION public.sisra_get_guardian_qr_card(
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
  qr_row record;
  qr_value text;
  qr_expires_at timestamptz;
BEGIN
  SELECT *
  INTO guardian_row
  FROM public.responsaveis r
  WHERE r.id = p_responsavel_id;

  IF guardian_row.id IS NULL THEN
    RETURN jsonb_build_object('guardian', NULL);
  END IF;

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

    INSERT INTO public.parent_qr_cards (
      responsavel_id,
      qr_code,
      expires_at,
      active
    )
    VALUES (
      guardian_row.id,
      qr_value,
      qr_expires_at,
      true
    );
  END IF;

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

GRANT EXECUTE ON FUNCTION public.sisra_registration_student_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_registration_guardian_by_cpf(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_register_guardian_by_token(text, text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_get_guardian_qr_card(uuid) TO anon, authenticated;
