
-- Table for dynamic lead contacts
CREATE TABLE public.lead_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  phone_2 TEXT,
  role TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_contacts_lead_id ON public.lead_contacts(lead_id);

ALTER TABLE public.lead_contacts ENABLE ROW LEVEL SECURITY;

-- Users who can see the lead can see its contacts
CREATE POLICY "Users can view contacts on accessible leads"
ON public.lead_contacts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = lead_contacts.lead_id
    AND (
      is_manager(auth.uid())
      OR leads.owner_user_id = auth.uid()
      OR leads.owner_user_id IS NULL
      OR EXISTS (
        SELECT 1 FROM opportunities
        WHERE opportunities.lead_id = leads.id
        AND opportunities.assigned_to_user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Users can insert contacts on accessible leads"
ON public.lead_contacts FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = lead_contacts.lead_id
    AND (
      is_manager(auth.uid())
      OR leads.owner_user_id = auth.uid()
      OR leads.owner_user_id IS NULL
      OR EXISTS (
        SELECT 1 FROM opportunities
        WHERE opportunities.lead_id = leads.id
        AND opportunities.assigned_to_user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Users can update contacts on accessible leads"
ON public.lead_contacts FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = lead_contacts.lead_id
    AND (
      is_manager(auth.uid())
      OR leads.owner_user_id = auth.uid()
      OR leads.owner_user_id IS NULL
      OR EXISTS (
        SELECT 1 FROM opportunities
        WHERE opportunities.lead_id = leads.id
        AND opportunities.assigned_to_user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Users can delete contacts on accessible leads"
ON public.lead_contacts FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = lead_contacts.lead_id
    AND (
      is_manager(auth.uid())
      OR leads.owner_user_id = auth.uid()
      OR leads.owner_user_id IS NULL
      OR EXISTS (
        SELECT 1 FROM opportunities
        WHERE opportunities.lead_id = leads.id
        AND opportunities.assigned_to_user_id = auth.uid()
      )
    )
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_lead_contacts_updated_at
BEFORE UPDATE ON public.lead_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
