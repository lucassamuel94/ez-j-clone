-- Add soft-delete column to accounts
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Index for filtering active accounts efficiently
CREATE INDEX IF NOT EXISTS idx_accounts_deleted_at ON public.accounts (deleted_at) WHERE deleted_at IS NULL;

-- Policy: only admins/managers can soft-delete accounts
CREATE POLICY "Admins can update accounts for soft-delete"
ON public.accounts
FOR UPDATE
TO authenticated
USING (
  public.is_admin(auth.uid()) OR public.is_manager(auth.uid())
)
WITH CHECK (
  public.is_admin(auth.uid()) OR public.is_manager(auth.uid())
);