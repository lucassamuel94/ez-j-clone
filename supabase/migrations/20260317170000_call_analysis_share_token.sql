-- share_token: null = análise privada, uuid = compartilhada publicamente
ALTER TABLE public.call_analyses
  ADD COLUMN IF NOT EXISTS share_token uuid DEFAULT NULL UNIQUE;

-- Qualquer pessoa (incluindo anon) pode ler análises que tenham share_token definido
CREATE POLICY "Anyone can view shared call analyses"
ON public.call_analyses
FOR SELECT
USING (share_token IS NOT NULL);
