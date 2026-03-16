
-- Add notification preference columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_overdue_push boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_overdue_email boolean NOT NULL DEFAULT false;
