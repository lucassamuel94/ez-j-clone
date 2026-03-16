
-- Create proposals table
CREATE TABLE public.proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID REFERENCES public.opportunities(id),
  created_by_user_id UUID NOT NULL,
  
  -- Company data (snapshot at proposal time)
  company_name TEXT NOT NULL DEFAULT '',
  cnpj TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  sdr_name TEXT,
  closer_name TEXT,
  
  -- Simulation data
  plan_name TEXT NOT NULL DEFAULT '',
  plan_price NUMERIC NOT NULL DEFAULT 0,
  estimated_contacts INTEGER NOT NULL DEFAULT 0,
  estimated_messages INTEGER NOT NULL DEFAULT 0,
  meta_cost NUMERIC NOT NULL DEFAULT 0,
  total_monthly NUMERIC NOT NULL DEFAULT 0,
  setup_total NUMERIC NOT NULL DEFAULT 0,
  setup_payment_method TEXT NOT NULL DEFAULT 'pix',
  setup_installments INTEGER NOT NULL DEFAULT 1,
  
  -- Integrations snapshot
  integrations JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Contractual terms (editable)
  contract_months INTEGER NOT NULL DEFAULT 12,
  cancellation_fee_percent NUMERIC NOT NULL DEFAULT 20,
  validity_days INTEGER NOT NULL DEFAULT 30,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft',
  
  -- Custom notes
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view proposals they created or are assigned to"
  ON public.proposals FOR SELECT
  USING (
    created_by_user_id = auth.uid() OR is_manager(auth.uid())
  );

CREATE POLICY "Users can create proposals"
  ON public.proposals FOR INSERT
  WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Users can update own proposals"
  ON public.proposals FOR UPDATE
  USING (created_by_user_id = auth.uid() OR is_manager(auth.uid()));

CREATE POLICY "Admins can delete proposals"
  ON public.proposals FOR DELETE
  USING (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_proposals_updated_at
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
