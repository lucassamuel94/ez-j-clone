
-- Add 'closer' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'closer';

-- Add 'closer' to user_role enum  
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'closer';

-- Extend opportunities table for Closer pipeline
ALTER TABLE public.opportunities 
  ADD COLUMN IF NOT EXISTS sdr_user_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS closer_notes text,
  ADD COLUMN IF NOT EXISTS returned_to_sdr boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS return_reason text,
  ADD COLUMN IF NOT EXISTS lost_reason text,
  ADD COLUMN IF NOT EXISTS meeting_datetime timestamp with time zone;

-- Update default stage
ALTER TABLE public.opportunities ALTER COLUMN stage SET DEFAULT 'Demonstração';

-- Allow closers to view opportunities assigned to them
CREATE POLICY "Closers can view assigned opportunities"
  ON public.opportunities FOR SELECT
  USING (assigned_to_user_id = auth.uid());

-- Allow closers to update assigned opportunities
CREATE POLICY "Closers can update assigned opportunities"
  ON public.opportunities FOR UPDATE
  USING (assigned_to_user_id = auth.uid());

-- Allow managers to view all opportunities
CREATE POLICY "Managers can view all opportunities"
  ON public.opportunities FOR SELECT
  USING (is_manager(auth.uid()));

-- Allow managers to update all opportunities
CREATE POLICY "Managers can update all opportunities"
  ON public.opportunities FOR UPDATE
  USING (is_manager(auth.uid()));

-- Allow managers to delete opportunities
CREATE POLICY "Managers can delete opportunities"
  ON public.opportunities FOR DELETE
  USING (is_manager(auth.uid()));
