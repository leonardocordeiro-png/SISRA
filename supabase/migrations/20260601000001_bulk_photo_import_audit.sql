-- Ensure the foto_url column on alunos supports large base64 payloads (text is already unlimited in PG).
-- This migration adds an explicit index on matricula to speed up bulk photo matching
-- and documents the IMPORTACAO_FOTOS_LOTE audit event type.

-- Fast lookup by matricula for batch photo import matching
CREATE INDEX IF NOT EXISTS idx_alunos_matricula ON alunos (matricula);

-- No schema changes needed: foto_url is already a text column in alunos.
-- The audit_logs table already accepts any action string via the existing RLS policies.

COMMENT ON COLUMN alunos.foto_url IS
  'Base64-encoded JPEG data URL of the student photo. '
  'Updated individually via registration wizard or in bulk via IMPORTACAO_FOTOS_LOTE audit action.';
