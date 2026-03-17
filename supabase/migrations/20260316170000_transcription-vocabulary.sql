-- Vocabulary normalization table for transcription post-processing.
-- Rules are applied in ascending priority order after Deepgram returns the transcript.
CREATE TABLE IF NOT EXISTS public.transcription_vocabulary (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_text   text NOT NULL,          -- Regex pattern (case-insensitive) to find
  to_text     text NOT NULL,          -- Replacement string
  is_regex    boolean NOT NULL DEFAULT false,  -- If true, from_text is treated as regex
  is_active   boolean NOT NULL DEFAULT true,
  priority    integer NOT NULL DEFAULT 10,     -- Lower = applied first
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Compound terms first (higher specificity → lower priority number)
INSERT INTO public.transcription_vocabulary (from_text, to_text, is_regex, priority, notes) VALUES
  ('Easy Chat',  'EZ Chat',  false, 1,  'Produto EZ Chat reconhecido como Easy Chat'),
  ('Easy Soft',  'EZ Soft',  false, 2,  'Produto EZ Soft reconhecido como Easy Soft'),
  ('EZY Chat',   'EZ Chat',  false, 3,  'Variante ortográfica EZY Chat'),
  ('EZY Soft',   'EZ Soft',  false, 4,  'Variante ortográfica EZY Soft'),
  ('EZY',        'EZ',       false, 5,  'Variante ortográfica EZY'),
  -- Standalone "Easy" as brand name (Portuguese calls: adjective = "fácil")
  ('\bEasy\b',   'EZ',       true,  10, 'Easy isolado → EZ (em ligações PT-BR, é referência à marca)');

-- RLS: only authenticated users can read; only service_role can write
ALTER TABLE public.transcription_vocabulary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read vocabulary"
  ON public.transcription_vocabulary FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "service role can manage vocabulary"
  ON public.transcription_vocabulary FOR ALL
  TO service_role USING (true);
