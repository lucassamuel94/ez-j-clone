
-- Add SQO validation fields to leads table
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS sqo_pain_category text,
ADD COLUMN IF NOT EXISTS sqo_pain_clear boolean,
ADD COLUMN IF NOT EXISTS sqo_pain_financial_impact boolean,
ADD COLUMN IF NOT EXISTS sqo_urgency text,
ADD COLUMN IF NOT EXISTS sqo_budget text,
ADD COLUMN IF NOT EXISTS sqo_decision_maker text,
ADD COLUMN IF NOT EXISTS sqo_icp_fit text,
ADD COLUMN IF NOT EXISTS sqo_next_step text,
ADD COLUMN IF NOT EXISTS sqo_pain_other text;
