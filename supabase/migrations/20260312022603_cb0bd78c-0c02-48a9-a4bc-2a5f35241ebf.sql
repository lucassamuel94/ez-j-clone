-- Phase 2: Add processing_at for idempotency lock
ALTER TABLE public.email_sequence_enrollments 
  ADD COLUMN IF NOT EXISTS processing_at timestamptz DEFAULT NULL;

-- Phase 4: Unique partial constraint on email_sequence_enrollments
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_sequence_enrollments_active_unique
  ON public.email_sequence_enrollments(sequence_id, lead_id)
  WHERE status = 'active';

-- Phase 4: Unique constraint on lead_cadences(lead_id) - one active cadence per lead
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lead_cadences') THEN
    BEGIN
      CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_cadences_lead_unique
        ON public.lead_cadences(lead_id);
    EXCEPTION WHEN duplicate_table THEN
      NULL;
    END;
  END IF;
END
$$;