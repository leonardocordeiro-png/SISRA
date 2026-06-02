-- =============================================================================
-- SISRA — Salas de Saída (Salas Físicas de Retirada)
-- Permite ao administrador criar e gerenciar as salas físicas do colégio,
-- além de vincular cada turma a sua respectiva sala de saída.
-- =============================================================================

-- ─── Tabela: salas ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.salas (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    nome        TEXT        NOT NULL,
    descricao   TEXT,
    escola_id   UUID,
    ativa       BOOLEAN     NOT NULL DEFAULT true,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para buscas por escola
CREATE INDEX IF NOT EXISTS salas_escola_idx ON public.salas (escola_id);

-- RLS
ALTER TABLE public.salas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "salas_auth_escola" ON public.salas;
CREATE POLICY "salas_auth_escola"
  ON public.salas
  FOR ALL
  TO authenticated
  USING (escola_id = get_user_escola_id())
  WITH CHECK (escola_id = get_user_escola_id());

-- ─── Turmas: adicionar FK para sala de saída ──────────────────────────────────
ALTER TABLE public.turmas
    ADD COLUMN IF NOT EXISTS sala_id UUID REFERENCES public.salas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS turmas_sala_id_idx ON public.turmas (sala_id);
