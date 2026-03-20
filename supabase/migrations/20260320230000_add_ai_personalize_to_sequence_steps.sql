-- Add AI personalization flag to email sequence steps
ALTER TABLE public.email_sequence_steps
ADD COLUMN IF NOT EXISTS ai_personalize boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.email_sequence_steps.ai_personalize IS
  'When true, the step body is used as a directive and Claude generates personalized content based on the lead CNAE/segment';
