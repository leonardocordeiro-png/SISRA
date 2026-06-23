-- =============================================================================
-- SISRA - Deduplicate responsaveis by CPF and enforce uniqueness
-- =============================================================================
-- Historically the same guardian could be inserted twice with the CPF stored in
-- different formats (clean "00000000000" vs formatted "000.000.000-00"), because
-- the existence check matched only one format. This migration:
--   1. Merges duplicate rows (same CPF ignoring formatting) into a single
--      survivor, keeping the most recently created record's data and filling any
--      gaps from the older duplicates.
--   2. Repoints every foreign key that referenced a removed duplicate to the
--      survivor.
--   3. Normalizes all CPFs to clean digits.
--   4. Adds a UNIQUE index on cpf so duplicates can never be created again.
--
-- Idempotent and transactional: safe to re-run.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Map each duplicate row to its survivor (newest by criado_em wins).
-- ---------------------------------------------------------------------------
CREATE TEMPORARY TABLE _resp_dupes ON COMMIT DROP AS
WITH normalized AS (
    SELECT
        id,
        regexp_replace(cpf, '\D', '', 'g') AS clean_cpf,
        criado_em
    FROM public.responsaveis
    WHERE cpf IS NOT NULL
      AND length(regexp_replace(cpf, '\D', '', 'g')) = 11
),
ranked AS (
    SELECT
        id,
        clean_cpf,
        first_value(id) OVER (
            PARTITION BY clean_cpf
            ORDER BY criado_em DESC NULLS LAST, id
        ) AS survivor_id
    FROM normalized
)
SELECT id AS dup_id, survivor_id, clean_cpf
FROM ranked
WHERE id <> survivor_id;

-- ---------------------------------------------------------------------------
-- 2. Fill missing fields on each survivor from its duplicates
--    (survivor's own non-null values take precedence; among duplicates the
--    most recently created non-null value wins).
-- ---------------------------------------------------------------------------
UPDATE public.responsaveis s
SET
    nome_completo = COALESCE(s.nome_completo, best.nome_completo),
    telefone      = COALESCE(s.telefone, best.telefone),
    email         = COALESCE(s.email, best.email),
    foto_url      = COALESCE(s.foto_url, best.foto_url),
    documento_url = COALESCE(s.documento_url, best.documento_url),
    codigo_acesso = COALESCE(s.codigo_acesso, best.codigo_acesso)
FROM (
    SELECT
        m.survivor_id,
        (array_agg(d.nome_completo ORDER BY d.criado_em DESC) FILTER (WHERE d.nome_completo IS NOT NULL))[1] AS nome_completo,
        (array_agg(d.telefone      ORDER BY d.criado_em DESC) FILTER (WHERE d.telefone IS NOT NULL))[1]      AS telefone,
        (array_agg(d.email         ORDER BY d.criado_em DESC) FILTER (WHERE d.email IS NOT NULL))[1]         AS email,
        (array_agg(d.foto_url      ORDER BY d.criado_em DESC) FILTER (WHERE d.foto_url IS NOT NULL))[1]      AS foto_url,
        (array_agg(d.documento_url ORDER BY d.criado_em DESC) FILTER (WHERE d.documento_url IS NOT NULL))[1] AS documento_url,
        (array_agg(d.codigo_acesso ORDER BY d.criado_em DESC) FILTER (WHERE d.codigo_acesso IS NOT NULL))[1] AS codigo_acesso
    FROM _resp_dupes m
    JOIN public.responsaveis d ON d.id = m.dup_id
    GROUP BY m.survivor_id
) best
WHERE s.id = best.survivor_id;

-- ---------------------------------------------------------------------------
-- 3. Repoint foreign keys from duplicates to survivors.
--    alunos_responsaveis has a composite (aluno_id, responsavel_id) key, so we
--    first drop links that would collide, then repoint the rest. Every other
--    table that references responsaveis(id) is repointed dynamically.
-- ---------------------------------------------------------------------------
DELETE FROM public.alunos_responsaveis ar
USING _resp_dupes m
WHERE ar.responsavel_id = m.dup_id
  AND EXISTS (
      SELECT 1 FROM public.alunos_responsaveis ar2
      WHERE ar2.aluno_id = ar.aluno_id
        AND ar2.responsavel_id = m.survivor_id
  );

UPDATE public.alunos_responsaveis ar
SET responsavel_id = m.survivor_id
FROM _resp_dupes m
WHERE ar.responsavel_id = m.dup_id;

DO $$
DECLARE
    fk RECORD;
BEGIN
    FOR fk IN
        SELECT tc.table_schema, tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = tc.constraint_name
         AND kcu.constraint_schema = tc.constraint_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
         AND ccu.constraint_schema = tc.constraint_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_schema = 'public'
          AND ccu.table_name = 'responsaveis'
          AND ccu.column_name = 'id'
          AND tc.table_name <> 'alunos_responsaveis'
    LOOP
        EXECUTE format(
            'UPDATE public.%I t SET %I = m.survivor_id FROM _resp_dupes m WHERE t.%I = m.dup_id',
            fk.table_name, fk.column_name, fk.column_name
        );
    END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Delete the now-orphaned duplicate rows.
-- ---------------------------------------------------------------------------
DELETE FROM public.responsaveis r
USING _resp_dupes m
WHERE r.id = m.dup_id;

-- ---------------------------------------------------------------------------
-- 5. Normalize all remaining CPFs to clean digits.
-- ---------------------------------------------------------------------------
UPDATE public.responsaveis
SET cpf = regexp_replace(cpf, '\D', '', 'g')
WHERE cpf IS NOT NULL
  AND cpf <> regexp_replace(cpf, '\D', '', 'g')
  AND length(regexp_replace(cpf, '\D', '', 'g')) = 11;

-- ---------------------------------------------------------------------------
-- 6. Enforce uniqueness so duplicates can never be created again.
--    Partial index so multiple rows without a CPF remain allowed.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS responsaveis_cpf_unique
    ON public.responsaveis (cpf)
    WHERE cpf IS NOT NULL;

COMMIT;
