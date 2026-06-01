-- =============================================================================
-- SISRA - LGPD: Enable RLS on logs_auditoria (previously unprotected)
-- =============================================================================
-- Without this, any authenticated admin can SELECT audit logs from ALL schools.
-- The frontend escola_id filter in SecurityAuditLog.tsx is client-side only —
-- it can be bypassed. This migration enforces isolation at the database level.
-- =============================================================================

ALTER TABLE public.logs_auditoria ENABLE ROW LEVEL SECURITY;

-- Authenticated users see only their own school's logs.
-- NULL escola_id rows (system-level events with no school context) remain visible.
DROP POLICY IF EXISTS "logs_auditoria_read_escola" ON public.logs_auditoria;
CREATE POLICY "logs_auditoria_read_escola"
  ON public.logs_auditoria
  FOR SELECT
  TO authenticated
  USING (escola_id = get_user_escola_id() OR escola_id IS NULL);

-- Any caller (anon OR authenticated) can INSERT audit events.
-- Required: totem, family portal, and other anon flows call logAudit() without JWT.
DROP POLICY IF EXISTS "logs_auditoria_insert_any" ON public.logs_auditoria;
CREATE POLICY "logs_auditoria_insert_any"
  ON public.logs_auditoria
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only school admins can DELETE their own school's logs (data-retention / cleanup feature).
-- Audit logs are immutable by design — no UPDATE policy is added intentionally.
DROP POLICY IF EXISTS "logs_auditoria_admin_delete" ON public.logs_auditoria;
CREATE POLICY "logs_auditoria_admin_delete"
  ON public.logs_auditoria
  FOR DELETE
  TO authenticated
  USING (
    escola_id = get_user_escola_id()
    AND get_user_tipo_usuario() = 'ADMIN'
  );
