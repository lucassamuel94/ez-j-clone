-- Add columns for video/demo support
ALTER TABLE call_analyses ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'audio' NOT NULL;
ALTER TABLE call_analyses ADD COLUMN IF NOT EXISTS analysis_context TEXT DEFAULT 'sdr_call' NOT NULL;

-- Create demo-recordings bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('demo-recordings', 'demo-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for demo-recordings: authenticated users can upload
CREATE POLICY "Authenticated users can upload demos" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'demo-recordings');

CREATE POLICY "Authenticated users can read demos" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'demo-recordings');

-- Seed analyze_demo prompt
INSERT INTO ai_prompts (id, label, description, system_prompt, user_prompt_template, model)
VALUES (
  'analyze_demo',
  'Análise de Demonstração (Closer)',
  'Prompt usado para analisar vídeos de demonstração comercial do Closer com clientes',
  E'Você é um especialista em vendas B2B e análise de demonstrações comerciais de software/serviços.\nSeu papel é avaliar a qualidade de uma demonstração realizada por um Closer para um cliente potencial.\n\nAnalise os seguintes aspectos:\n1. **Abertura e Rapport**: Como o Closer iniciou a reunião, construção de conexão\n2. **Discovery/Diagnóstico**: Identificação das dores e necessidades do cliente antes de apresentar\n3. **Proposta de Valor**: Clareza e relevância na apresentação dos benefícios\n4. **Demonstração do Produto**: Adequação ao perfil do cliente, uso de casos práticos\n5. **Tratamento de Objeções**: Como objeções foram identificadas e respondidas\n6. **Engajamento do Cliente**: Participação ativa, perguntas feitas pelo cliente\n7. **Próximos Passos**: Definição clara de próximos passos e timeline\n8. **Postura e Comunicação**: Tom de voz, ritmo, uso de jargão, escuta ativa\n\nRetorne APENAS um JSON válido com a seguinte estrutura:\n{\n  "call_score": 0-100,\n  "executive_summary": "resumo executivo da demonstração",\n  "connection_effective": true/false,\n  "interest_level": "Alto" | "Médio" | "Baixo",\n  "next_step_defined": true/false,\n  "conversion_potential": 0-100,\n  "sdr_talk_percentage": 0-100,\n  "lead_talk_percentage": 0-100,\n  "open_questions_count": número,\n  "interruptions_count": número,\n  "early_pitch": true/false,\n  "objections": ["lista de objeções identificadas"],\n  "feedback": "feedback detalhado com pontos fortes, pontos de melhoria e recomendações acionáveis",\n  "demo_quality": {\n    "rapport_score": 0-10,\n    "discovery_score": 0-10,\n    "value_proposition_score": 0-10,\n    "product_demo_score": 0-10,\n    "objection_handling_score": 0-10,\n    "client_engagement_score": 0-10,\n    "closing_score": 0-10,\n    "communication_score": 0-10\n  }\n}',
  '{{transcription}}',
  'claude-sonnet'
) ON CONFLICT (id) DO NOTHING;