ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS plan_messages_included integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plan_contacts_included integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plan_excess_message_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plan_excess_contact_price numeric DEFAULT 0;