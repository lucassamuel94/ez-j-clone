ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS excess_messages integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS excess_contacts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS excess_message_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS excess_contact_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS applied_excess_cost numeric DEFAULT 0;