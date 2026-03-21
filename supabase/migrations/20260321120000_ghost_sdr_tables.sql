-- Ghost SDR: Follow-up rules per lead status
CREATE TABLE IF NOT EXISTS sdr_follow_up_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_status text NOT NULL,
  step_number int NOT NULL DEFAULT 1,
  delay_days int NOT NULL DEFAULT 1,
  channel text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'email', 'both')),
  tone text NOT NULL DEFAULT 'friendly' CHECK (tone IN ('professional', 'friendly', 'urgent', 'consultive', 'curious')),
  strategy text, -- 'cold_intro', 'pain_point', 'social_proof', 'value_prop', 'meeting_ask', 'reengagement'
  max_attempts int NOT NULL DEFAULT 6,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_status, step_number)
);

-- Ghost SDR: Log of every auto outreach sent
CREATE TABLE IF NOT EXISTS sdr_follow_up_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  sdr_user_id uuid,
  step_number int NOT NULL DEFAULT 1,
  lead_status text,
  channel text NOT NULL,
  message_content text NOT NULL,
  subject text,
  ai_context jsonb,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'responded', 'failed', 'skipped')),
  responded_at timestamptz,
  response_type text, -- 'reply', 'meeting_booked', 'call_back', 'not_interested', 'unsubscribe'
  led_to_meeting boolean DEFAULT false,
  led_to_meeting_confirmed boolean DEFAULT false,
  led_to_sqo boolean DEFAULT false,
  led_to_sale boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ghost SDR: Learned patterns
CREATE TABLE IF NOT EXISTS sdr_follow_up_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment text,
  porte text,
  channel text NOT NULL,
  tone text,
  strategy text,
  avg_response_rate numeric(5,2) DEFAULT 0,
  avg_response_time_hours numeric(8,2) DEFAULT 0,
  total_sent int DEFAULT 0,
  total_responded int DEFAULT 0,
  total_meetings int DEFAULT 0,
  total_meetings_confirmed int DEFAULT 0,
  total_sqos int DEFAULT 0,
  total_sales int DEFAULT 0,
  best_time_of_day text,
  best_day_of_week int,
  top_sdr_id uuid,
  sample_messages jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (segment, porte, channel)
);

-- Ghost SDR: SDR profiles (learned voice/style)
CREATE TABLE IF NOT EXISTS sdr_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  writing_style text,
  common_phrases text[],
  avg_message_length int,
  preferred_tone text,
  qualification_style text, -- how they qualify leads
  opening_style text, -- how they open cold conversations
  sqo_rate numeric(5,2) DEFAULT 0, -- SQOs / leads worked
  sqo_to_sale_rate numeric(5,2) DEFAULT 0, -- SQOs that became sales / total SQOs
  avg_call_score numeric(5,2) DEFAULT 0,
  total_sqos int DEFAULT 0,
  total_sales_from_sqo int DEFAULT 0,
  total_meetings_confirmed int DEFAULT 0,
  total_calls int DEFAULT 0,
  sqo_goal numeric(5,2) DEFAULT 0, -- monthly SQO goal
  sqo_goal_attainment numeric(5,2) DEFAULT 0, -- % of goal achieved
  is_top_performer boolean DEFAULT false,
  last_analyzed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sdr_follow_up_logs_lead ON sdr_follow_up_logs (lead_id);
CREATE INDEX IF NOT EXISTS idx_sdr_follow_up_logs_status ON sdr_follow_up_logs (status);
CREATE INDEX IF NOT EXISTS idx_sdr_follow_up_logs_created ON sdr_follow_up_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sdr_follow_up_rules_status ON sdr_follow_up_rules (lead_status, active);

-- RLS
ALTER TABLE sdr_follow_up_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sdr_follow_up_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sdr_follow_up_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sdr_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON sdr_follow_up_logs FOR ALL USING (true);
CREATE POLICY "Service role full access" ON sdr_follow_up_rules FOR ALL USING (true);
CREATE POLICY "Service role full access" ON sdr_follow_up_patterns FOR ALL USING (true);
CREATE POLICY "Service role full access" ON sdr_profiles FOR ALL USING (true);

-- Default SDR follow-up rules
INSERT INTO sdr_follow_up_rules (lead_status, step_number, delay_days, channel, tone, strategy) VALUES
  -- Leads novos (cold outreach)
  ('Novo', 1, 0, 'whatsapp', 'friendly', 'cold_intro'),
  ('Novo', 2, 1, 'email', 'consultive', 'value_prop'),
  ('Novo', 3, 3, 'whatsapp', 'curious', 'pain_point'),
  ('Novo', 4, 5, 'email', 'professional', 'social_proof'),
  ('Novo', 5, 8, 'whatsapp', 'friendly', 'meeting_ask'),
  ('Novo', 6, 12, 'email', 'professional', 'reengagement'),
  -- Leads em contato (já respondeu, manter engajamento)
  ('Em contato', 1, 2, 'whatsapp', 'friendly', 'pain_point'),
  ('Em contato', 2, 4, 'email', 'consultive', 'value_prop'),
  ('Em contato', 3, 7, 'whatsapp', 'curious', 'meeting_ask'),
  -- Leads com interesse (empurrar para reunião)
  ('Interesse', 1, 1, 'whatsapp', 'friendly', 'meeting_ask'),
  ('Interesse', 2, 3, 'email', 'consultive', 'social_proof'),
  ('Interesse', 3, 5, 'whatsapp', 'urgent', 'meeting_ask'),
  -- Agendar retorno
  ('Interesse/Agendar Retorno', 1, 1, 'whatsapp', 'friendly', 'meeting_ask'),
  ('Interesse/Agendar Retorno', 2, 3, 'whatsapp', 'professional', 'value_prop'),
  ('Interesse/Agendar Retorno', 3, 7, 'email', 'urgent', 'meeting_ask'),
  -- Lead quente (prioridade máxima)
  ('Lead Quente', 1, 0, 'whatsapp', 'urgent', 'meeting_ask'),
  ('Lead Quente', 2, 1, 'whatsapp', 'friendly', 'pain_point'),
  ('Lead Quente', 3, 2, 'email', 'consultive', 'social_proof')
ON CONFLICT (lead_status, step_number) DO NOTHING;
