-- =============================================================================
-- SISRA — Corrigir turma e sala dos alunos por código de seção
--
-- Problema: alunos importados via CSV Windows-1252 lido como UTF-8 têm
-- caracteres corrompidos (U+FFFD) em nome_completo e turma (ex: "1♦ Ano"
-- em vez de "1º Ano"). A JOIN texto-exato da migration anterior não batia.
--
-- Solução: extrai o código da seção entre parênteses no final do campo turma
-- (ex: "112T" de "1♦ Ano - Ensino Fundamental I (112T)") — esses caracteres
-- são ASCII puro e não sofrem corrupção de encoding. Usa esse código para
-- localizar a turma correta no banco e atualizar turma + sala.
-- =============================================================================

-- Passo 1: Corrigir campo turma usando o nome correto da tabela turmas,
--          casado pelo código de seção (único por turma dentro de uma escola).
UPDATE public.alunos a
SET    turma = t.nome
FROM   public.turmas t
WHERE  a.turma  ~ '\([A-Za-z0-9]+\)$'
  AND  t.nome   ~ '\([A-Za-z0-9]+\)$'
  AND  lower((regexp_match(a.turma, '\(([A-Za-z0-9]+)\)$'))[1])
       = lower((regexp_match(t.nome, '\(([A-Za-z0-9]+)\)$'))[1])
  -- garantir que só há uma turma com esse código (evitar ambiguidade)
  AND (
        SELECT COUNT(*)
        FROM   public.turmas t2
        WHERE  t2.nome ~ '\([A-Za-z0-9]+\)$'
          AND  lower((regexp_match(t2.nome, '\(([A-Za-z0-9]+)\)$'))[1])
               = lower((regexp_match(a.turma, '\(([A-Za-z0-9]+)\)$'))[1])
      ) = 1;

-- Passo 2: Corrigir campo sala usando a sala vinculada à turma (agora corrigida).
UPDATE public.alunos a
SET    sala = s.nome
FROM   public.turmas t
JOIN   public.salas  s ON s.id = t.sala_id
WHERE  a.turma = t.nome
  AND  t.sala_id IS NOT NULL;
