-- =============================================================================
-- SISRA — Atualiza campo sala dos alunos existentes
-- Substitui os nomes de sala hardcoded (ex: "Sala 101") pelo nome cadastrado
-- na tabela salas, buscado via turmas.sala_id (vínculo criado em 20260601000003).
-- Apenas alunos cuja turma corresponde exatamente a um registro em turmas são
-- atualizados; demais permanecem inalterados.
-- =============================================================================

UPDATE public.alunos a
SET    sala = s.nome
FROM   public.turmas t
JOIN   public.salas  s ON s.id = t.sala_id
WHERE  a.turma = t.nome
  AND  t.sala_id IS NOT NULL;
