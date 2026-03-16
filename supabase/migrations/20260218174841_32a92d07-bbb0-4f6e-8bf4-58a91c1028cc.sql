
-- 1. Tabela call_analyses
CREATE TABLE public.call_analyses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id),
  sdr_user_id uuid NOT NULL REFERENCES public.profiles(id),
  lead_id uuid REFERENCES public.leads(id),
  audio_path text NOT NULL,
  duration_seconds integer DEFAULT 0,
  transcription text,
  speaker_segments jsonb DEFAULT '[]'::jsonb,
  ai_analysis jsonb DEFAULT '{}'::jsonb,
  call_score integer DEFAULT 0,
  connection_effective boolean DEFAULT false,
  interest_level text DEFAULT 'Baixo',
  next_step_defined boolean DEFAULT false,
  conversion_potential integer DEFAULT 0,
  sdr_talk_percentage numeric DEFAULT 0,
  lead_talk_percentage numeric DEFAULT 0,
  open_questions_count integer DEFAULT 0,
  interruptions_count integer DEFAULT 0,
  early_pitch boolean DEFAULT false,
  objections jsonb DEFAULT '[]'::jsonb,
  executive_summary text,
  feedback text,
  status text NOT NULL DEFAULT 'processing',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.call_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view all call analyses"
  ON public.call_analyses FOR SELECT
  USING (is_manager(auth.uid()));

CREATE POLICY "Managers can insert call analyses"
  ON public.call_analyses FOR INSERT
  WITH CHECK (is_manager(auth.uid()) OR uploaded_by = auth.uid());

CREATE POLICY "Service role can update call analyses"
  ON public.call_analyses FOR UPDATE
  USING (true);

-- 2. Bucket call-recordings (privado)
INSERT INTO storage.buckets (id, name, public) VALUES ('call-recordings', 'call-recordings', false);

CREATE POLICY "Managers can upload call recordings"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'call-recordings' AND is_manager(auth.uid()));

CREATE POLICY "Managers can view call recordings"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'call-recordings' AND is_manager(auth.uid()));

-- 3. Registro analyze_call no ai_prompts
INSERT INTO public.ai_prompts (id, label, model, system_prompt, user_prompt_template, description)
VALUES (
  'analyze_call',
  'Análise de Ligação',
  'gemini-2.5-flash',
  'Você é um especialista em vendas B2B e coaching de SDRs. Analise a transcrição da ligação a seguir e retorne um JSON com a seguinte estrutura exata:
{
  "executive_summary": "resumo executivo em no máximo 6 linhas",
  "connection_effective": true/false,
  "interest_level": "Baixo" | "Médio" | "Alto",
  "next_step_defined": true/false,
  "conversion_potential": 0-100,
  "sdr_talk_percentage": 0-100,
  "lead_talk_percentage": 0-100,
  "open_questions_count": número,
  "interruptions_count": número,
  "early_pitch": true/false,
  "objections": ["Preço", "Concorrente", ...],
  "call_score": 0-100,
  "feedback": "recomendações claras e acionáveis para o SDR"
}
Retorne APENAS o JSON, sem markdown, sem explicações.',
  'Transcrição da ligação:\n\n{{transcription}}',
  'Analisa transcrições de ligações de SDRs gerando score, métricas e feedback para coaching.'
);
