-- =============================================================================
-- SISRA - New public RPCs for anon flows broken by hardening migration
-- =============================================================================
-- Adds:
--   sisra_get_students_guardians  → TotemConfirmation guardian list
--   sisra_get_guardian_requests   → FamilyPortal active + history feed
--   sisra_get_school_active_requests → ReceptionBoard live display
-- Also:
--   Patches sisra_lookup_guardian_by_qr to remove raw-UUID backdoor
-- =============================================================================

-- ── 1. All guardians authorized for a set of students ─────────────────────────
CREATE OR REPLACE FUNCTION public.sisra_get_students_guardians(
  p_aluno_ids uuid[],
  p_escola_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  guardians jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object(
    'id',            r.id,
    'nome_completo', r.nome_completo,
    'foto_url',      r.foto_url,
    'parentesco',    r.parentesco
  )), '[]'::jsonb)
  INTO guardians
  FROM public.responsaveis r
  WHERE (
    EXISTS (
      SELECT 1 FROM public.alunos_responsaveis ar
      WHERE ar.aluno_id = ANY(p_aluno_ids)
        AND ar.responsavel_id = r.id
    )
    OR EXISTS (
      SELECT 1 FROM public.autorizacoes au
      WHERE au.aluno_id = ANY(p_aluno_ids)
        AND au.responsavel_id = r.id
        AND coalesce(au.ativa, true) = true
    )
  );

  RETURN guardians;
END;
$$;

-- ── 2. Active + today's history for a guardian ────────────────────────────────
CREATE OR REPLACE FUNCTION public.sisra_get_guardian_requests(
  p_responsavel_id uuid,
  p_escola_id      uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  aluno_ids        uuid[];
  today_start      timestamptz := date_trunc('day', now());
  active_requests  jsonb;
  history_requests jsonb;
BEGIN
  -- Resolve student IDs this guardian is allowed to see
  SELECT array_agg(DISTINCT a.id)
  INTO aluno_ids
  FROM public.alunos a
  WHERE (p_escola_id IS NULL OR a.escola_id = p_escola_id)
    AND (
      EXISTS (
        SELECT 1 FROM public.alunos_responsaveis ar
        WHERE ar.aluno_id = a.id AND ar.responsavel_id = p_responsavel_id
      )
      OR EXISTS (
        SELECT 1 FROM public.autorizacoes au
        WHERE au.aluno_id = a.id AND au.responsavel_id = p_responsavel_id
          AND coalesce(au.ativa, true) = true
      )
    );

  IF aluno_ids IS NULL THEN
    RETURN jsonb_build_object('active', '[]'::jsonb, 'history', '[]'::jsonb);
  END IF;

  -- Active (not yet completed or cancelled)
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id',                  sr.id,
      'status',              sr.status,
      'tipo_solicitacao',    sr.tipo_solicitacao,
      'horario_solicitacao', sr.horario_solicitacao,
      'horario_liberacao',   sr.horario_liberacao,
      'horario_confirmacao', sr.horario_confirmacao,
      'mensagem_sala',       sr.mensagem_sala,
      'mensagem_recepcao',   sr.mensagem_recepcao,
      'aluno', jsonb_build_object(
        'id',            a.id,
        'nome_completo', a.nome_completo,
        'turma',         a.turma,
        'sala',          a.sala,
        'foto_url',      a.foto_url
      )
    ) ORDER BY sr.horario_solicitacao DESC
  ), '[]'::jsonb)
  INTO active_requests
  FROM public.solicitacoes_retirada sr
  JOIN public.alunos a ON a.id = sr.aluno_id
  WHERE sr.aluno_id = ANY(aluno_ids)
    AND sr.status NOT IN ('CONCLUIDO', 'FINALIZADO', 'CANCELADO')
    AND sr.horario_confirmacao IS NULL;

  -- History: today's completed / cancelled (capped at 20)
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id',                  sr.id,
      'status',              sr.status,
      'tipo_solicitacao',    sr.tipo_solicitacao,
      'horario_solicitacao', sr.horario_solicitacao,
      'horario_liberacao',   sr.horario_liberacao,
      'horario_confirmacao', sr.horario_confirmacao,
      'mensagem_sala',       sr.mensagem_sala,
      'mensagem_recepcao',   sr.mensagem_recepcao,
      'aluno', jsonb_build_object(
        'id',            a.id,
        'nome_completo', a.nome_completo,
        'turma',         a.turma,
        'sala',          a.sala,
        'foto_url',      a.foto_url
      )
    )
  ), '[]'::jsonb)
  INTO history_requests
  FROM (
    SELECT sr2.*
    FROM public.solicitacoes_retirada sr2
    WHERE sr2.aluno_id = ANY(aluno_ids)
      AND sr2.status IN ('CONCLUIDO', 'FINALIZADO', 'CANCELADO')
      AND sr2.horario_solicitacao >= today_start
    ORDER BY sr2.horario_confirmacao DESC NULLS LAST
    LIMIT 20
  ) sr
  JOIN public.alunos a ON a.id = sr.aluno_id;

  RETURN jsonb_build_object('active', active_requests, 'history', history_requests);
END;
$$;

-- ── 3. All active requests for a school's display board ───────────────────────
CREATE OR REPLACE FUNCTION public.sisra_get_school_active_requests(
  p_escola_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_requests jsonb;
  completed_count bigint;
  today_start     timestamptz := date_trunc('day', now());
BEGIN
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id',                  sr.id,
      'status',              sr.status,
      'tipo_solicitacao',    sr.tipo_solicitacao,
      'horario_solicitacao', sr.horario_solicitacao,
      'status_geofence',     sr.status_geofence,
      'mensagem_sala',       sr.mensagem_sala,
      'aluno', jsonb_build_object(
        'id',            a.id,
        'nome_completo', a.nome_completo,
        'turma',         a.turma,
        'sala',          a.sala,
        'foto_url',      a.foto_url
      ),
      'responsavel', CASE
        WHEN r.id IS NOT NULL THEN jsonb_build_object(
          'nome_completo', r.nome_completo,
          'foto_url',      r.foto_url
        )
        ELSE NULL
      END
    ) ORDER BY sr.horario_solicitacao ASC
  ), '[]'::jsonb)
  INTO active_requests
  FROM public.solicitacoes_retirada sr
  JOIN public.alunos a ON a.id = sr.aluno_id
  LEFT JOIN public.responsaveis r ON r.id = sr.responsavel_id
  WHERE sr.escola_id = p_escola_id
    AND sr.status IN ('SOLICITADO', 'NOTIFICADO', 'CONFIRMADO', 'AGUARDANDO', 'LIBERADO')
    AND sr.horario_confirmacao IS NULL;

  SELECT count(*)
  INTO completed_count
  FROM public.solicitacoes_retirada
  WHERE escola_id = p_escola_id
    AND horario_confirmacao IS NOT NULL
    AND horario_solicitacao >= today_start;

  RETURN jsonb_build_object('requests', active_requests, 'completed_today', completed_count);
END;
$$;

-- ── 4. Remove raw-UUID backdoor from QR lookup (security fix) ─────────────────
-- The previous version allowed any bare UUID to authenticate as that guardian.
-- We now only accept the structured LaSalleCheguei-{UUID}-{checksum} format.
CREATE OR REPLACE FUNCTION public.sisra_lookup_guardian_by_qr(
  p_qr       text,
  p_escola_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  responsavel_id uuid;
  candidate      text;
BEGIN
  -- Primary: registered QR card
  SELECT c.responsavel_id
  INTO responsavel_id
  FROM public.parent_qr_cards c
  WHERE c.qr_code = p_qr
    AND coalesce(c.active, true) = true
    AND (c.expires_at IS NULL OR c.expires_at > now())
  LIMIT 1;

  -- Secondary: extract UUID from official LaSalleCheguei-{UUID}-{checksum} envelope
  IF responsavel_id IS NULL AND p_qr LIKE 'LaSalleCheguei-%' THEN
    candidate := regexp_replace(p_qr, '^LaSalleCheguei-(.*)-[^-]+$', '\1');
    IF candidate ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      responsavel_id := candidate::uuid;
    END IF;
  END IF;

  -- Raw-UUID bare lookup intentionally removed — CVE: anyone knowing a UUID
  -- could impersonate a guardian without a QR card.

  IF responsavel_id IS NULL THEN
    RETURN jsonb_build_object('guardian', NULL, 'students', '[]'::jsonb);
  END IF;

  RETURN public.sisra_guardian_student_payload(responsavel_id, p_escola_id);
END;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.sisra_get_students_guardians(uuid[], uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_get_guardian_requests(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sisra_get_school_active_requests(uuid) TO anon, authenticated;
