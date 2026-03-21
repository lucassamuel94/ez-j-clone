-- Ghost Closer: Follow-up rules per stage
CREATE TABLE IF NOT EXISTS follow_up_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage text NOT NULL,
  step_number int NOT NULL DEFAULT 1,
  delay_days int NOT NULL DEFAULT 2,
  channel text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'email', 'both')),
  tone text NOT NULL DEFAULT 'professional' CHECK (tone IN ('professional', 'friendly', 'urgent', 'consultive')),
  strategy text, -- e.g., 'case_study', 'roi_argument', 'urgency', 'check_in'
  max_attempts int NOT NULL DEFAULT 5,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stage, step_number)
);

-- Ghost Closer: Log of every auto follow-up sent
CREATE TABLE IF NOT EXISTS follow_up_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  closer_user_id uuid,
  step_number int NOT NULL DEFAULT 1,
  channel text NOT NULL,
  message_content text NOT NULL,
  subject text, -- for emails
  ai_context jsonb, -- what context was fed to the AI
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'responded', 'failed', 'skipped')),
  responded_at timestamptz,
  response_type text, -- 'reply', 'meeting_booked', 'call_back', 'unsubscribe'
  led_to_meeting boolean DEFAULT false,
  led_to_won boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ghost Closer: Learned patterns (updated by ghost-closer-learn)
CREATE TABLE IF NOT EXISTS follow_up_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment text, -- CNAE/company_segment
  porte text, -- company size
  channel text NOT NULL,
  tone text,
  strategy text,
  avg_response_rate numeric(5,2) DEFAULT 0,
  avg_response_time_hours numeric(8,2) DEFAULT 0,
  total_sent int DEFAULT 0,
  total_responded int DEFAULT 0,
  total_meetings int DEFAULT 0,
  total_won int DEFAULT 0,
  best_time_of_day text, -- e.g., '09:00-10:00'
  best_day_of_week int, -- 0=Sun, 1=Mon...
  top_closer_id uuid, -- who performs best in this segment
  sample_messages jsonb, -- array of successful messages for reference
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (segment, porte, channel)
);

-- Ghost Closer: Closer profiles (learned voice/style per closer)
CREATE TABLE IF NOT EXISTS closer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  writing_style text, -- AI-generated description of their communication style
  common_phrases text[], -- phrases they use frequently
  avg_message_length int,
  preferred_tone text,
  objection_handling_style text, -- how they handle objections
  win_rate numeric(5,2) DEFAULT 0,
  avg_deal_value numeric(12,2) DEFAULT 0,
  avg_days_to_close numeric(8,2) DEFAULT 0,
  total_deals_won int DEFAULT 0,
  total_deals_lost int DEFAULT 0,
  is_top_performer boolean DEFAULT false,
  last_analyzed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_follow_up_logs_opp ON follow_up_logs (opportunity_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_logs_lead ON follow_up_logs (lead_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_logs_status ON follow_up_logs (status);
CREATE INDEX IF NOT EXISTS idx_follow_up_logs_created ON follow_up_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follow_up_rules_stage ON follow_up_rules (stage, active);

-- RLS
ALTER TABLE follow_up_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE closer_profiles ENABLE ROW LEVEL SECURITY;

-- Admin/service can read/write all
CREATE POLICY "Service role full access" ON follow_up_logs FOR ALL USING (true);
CREATE POLICY "Service role full access" ON follow_up_rules FOR ALL USING (true);
CREATE POLICY "Service role full access" ON follow_up_patterns FOR ALL USING (true);
CREATE POLICY "Service role full access" ON closer_profiles FOR ALL USING (true);

-- Insert default follow-up rules
INSERT INTO follow_up_rules (stage, step_number, delay_days, channel, tone, strategy) VALUES
  ('Demonstração', 1, 1, 'whatsapp', 'friendly', 'check_in'),
  ('Demonstração', 2, 3, 'email', 'consultive', 'case_study'),
  ('Demonstração', 3, 5, 'whatsapp', 'urgent', 'urgency'),
  ('Apresentar proposta', 1, 2, 'whatsapp', 'professional', 'check_in'),
  ('Apresentar proposta', 2, 4, 'email', 'consultive', 'roi_argument'),
  ('Proposta enviada', 1, 2, 'whatsapp', 'friendly', 'check_in'),
  ('Proposta enviada', 2, 5, 'email', 'consultive', 'case_study'),
  ('Proposta enviada', 3, 8, 'whatsapp', 'urgent', 'urgency'),
  ('Proposta enviada', 4, 12, 'email', 'professional', 'roi_argument'),
  ('Negociação', 1, 3, 'whatsapp', 'professional', 'check_in'),
  ('Negociação', 2, 7, 'email', 'consultive', 'roi_argument'),
  ('Negociação', 3, 10, 'whatsapp', 'urgent', 'urgency'),
  ('Opp Quente', 1, 3, 'whatsapp', 'friendly', 'check_in'),
  ('Opp Quente', 2, 7, 'email', 'consultive', 'case_study'),
  ('Opp Futura', 1, 7, 'email', 'friendly', 'check_in'),
  ('Opp Futura', 2, 14, 'whatsapp', 'consultive', 'roi_argument'),
  ('Opp Fria', 1, 14, 'email', 'friendly', 'check_in'),
  ('Opp Fria', 2, 30, 'whatsapp', 'professional', 'case_study'),
  ('Contrato enviado', 1, 2, 'whatsapp', 'professional', 'check_in'),
  ('Contrato enviado', 2, 4, 'whatsapp', 'urgent', 'urgency'),
  ('Aguardando pagamento', 1, 3, 'whatsapp', 'professional', 'check_in'),
  ('Aguardando pagamento', 2, 5, 'whatsapp', 'urgent', 'urgency')
ON CONFLICT (stage, step_number) DO NOTHING;
