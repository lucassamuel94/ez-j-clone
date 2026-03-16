
-- 1. National holidays table
CREATE TABLE public.national_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT NOT NULL,
  date DATE NOT NULL,
  name TEXT NOT NULL,
  UNIQUE(date)
);
ALTER TABLE public.national_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read holidays" ON public.national_holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage holidays" ON public.national_holidays FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- 2. Cron locks table
CREATE TABLE public.cron_locks (
  job_name TEXT PRIMARY KEY,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE public.cron_locks ENABLE ROW LEVEL SECURITY;

-- 3. Message dispatch logs table
CREATE TABLE public.message_dispatch_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.automatic_messages(id) ON DELETE SET NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trigger_source TEXT NOT NULL DEFAULT 'cron',
  recipients_resolved JSONB DEFAULT '[]'::jsonb,
  recipients_ignored JSONB DEFAULT '[]'::jsonb,
  channel TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_reason TEXT,
  ai_used BOOLEAN DEFAULT false,
  ai_response_time_ms INT,
  message_body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.message_dispatch_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read dispatch logs" ON public.message_dispatch_logs FOR SELECT TO authenticated USING (true);

-- 4. Add columns to automatic_messages
ALTER TABLE public.automatic_messages ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;
ALTER TABLE public.automatic_messages ADD COLUMN IF NOT EXISTS last_dispatch_status TEXT;
ALTER TABLE public.automatic_messages ADD COLUMN IF NOT EXISTS last_dispatch_at TIMESTAMPTZ;

-- 5. Populate holidays for 2025, 2026, 2027 using a function
CREATE OR REPLACE FUNCTION public.populate_holidays_for_year(p_year INT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  a INT; b INT; c INT; d INT; e INT; f INT; g INT; h INT; i INT; k INT; l INT; m INT;
  easter_month INT; easter_day INT; easter_date DATE;
  carnival DATE; carnival_mon DATE; good_friday DATE; corpus_christi DATE;
BEGIN
  -- Easter calculation (Anonymous Gregorian algorithm)
  a := p_year % 19;
  b := p_year / 100;
  c := p_year % 100;
  d := b / 4;
  e := b % 4;
  f := (b + 8) / 25;
  g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30;
  i := c / 4;
  k := c % 4;
  l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := (a + 11 * h + 22 * l) / 451;
  easter_month := (h + l - 7 * m + 114) / 31;
  easter_day := ((h + l - 7 * m + 114) % 31) + 1;
  easter_date := make_date(p_year, easter_month, easter_day);

  carnival := easter_date - 47;
  carnival_mon := easter_date - 48;
  good_friday := easter_date - 2;
  corpus_christi := easter_date + 60;

  INSERT INTO national_holidays (year, date, name) VALUES
    (p_year, make_date(p_year, 1, 1), 'Confraternização Universal'),
    (p_year, carnival_mon, 'Carnaval (segunda)'),
    (p_year, carnival, 'Carnaval (terça)'),
    (p_year, good_friday, 'Sexta-feira Santa'),
    (p_year, make_date(p_year, 4, 21), 'Tiradentes'),
    (p_year, make_date(p_year, 5, 1), 'Dia do Trabalho'),
    (p_year, corpus_christi, 'Corpus Christi'),
    (p_year, make_date(p_year, 9, 7), 'Independência do Brasil'),
    (p_year, make_date(p_year, 10, 12), 'Nossa Senhora Aparecida'),
    (p_year, make_date(p_year, 11, 2), 'Finados'),
    (p_year, make_date(p_year, 11, 15), 'Proclamação da República'),
    (p_year, make_date(p_year, 12, 25), 'Natal')
  ON CONFLICT (date) DO NOTHING;
END;
$$;

SELECT public.populate_holidays_for_year(2025);
SELECT public.populate_holidays_for_year(2026);
SELECT public.populate_holidays_for_year(2027);
