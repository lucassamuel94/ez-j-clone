CREATE TABLE public.transcription_vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_text TEXT NOT NULL,
  to_text TEXT NOT NULL,
  is_regex BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 10,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transcription_vocabulary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage vocabulary"
  ON public.transcription_vocabulary
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);