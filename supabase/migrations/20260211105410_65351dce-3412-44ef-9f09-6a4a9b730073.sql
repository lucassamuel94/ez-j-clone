
-- Create table for customizable AI prompts
CREATE TABLE public.ai_prompts (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL DEFAULT '',
  user_prompt_template TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT 'sonar',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;

-- Only admins can read and update prompts
CREATE POLICY "Admins can read ai_prompts"
  ON public.ai_prompts FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update ai_prompts"
  ON public.ai_prompts FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- Edge functions use service role, so they bypass RLS

-- Insert default prompts
INSERT INTO public.ai_prompts (id, label, description, system_prompt, user_prompt_template, model) VALUES
(
  'enrich_company',
  'Enriquecer Dados com IA',
  'Pesquisa informações detalhadas sobre a empresa (segmento, funcionários, redes sociais, concorrentes, etc.)',
  'Você é um pesquisador de empresas brasileiras. Você DEVE acessar o site oficial da empresa e extrair links de redes sociais do footer/rodapé. Responda SEMPRE em JSON válido, sem markdown.',
  E'Pesquise informações detalhadas sobre a empresa brasileira "{{searchTerm}}"{{cnpjClause}}.\n\nTAREFA CRÍTICA - REDES SOCIAIS:\nVocê DEVE acessar o site oficial da empresa e procurar links de redes sociais. Eles geralmente estão no FOOTER (rodapé) do site como ícones clicáveis de Instagram, LinkedIn, Facebook, YouTube e Twitter/X. Por exemplo, no site ezsoft.com.br os links estão no rodapé: Instagram (instagram.com/ezchat.ai), LinkedIn (linkedin.com/company/ezchat-ai), etc. Faça o mesmo para a empresa pesquisada.\n\nAlém das redes sociais, analise:\n1. A descrição da empresa na página \"Sobre\" ou home\n2. Os produtos e serviços listados no site\n3. Com base nos produtos/serviços, identifique 3-5 concorrentes diretos no Brasil\n4. Número de funcionários (pode buscar no LinkedIn da empresa ou sites como Glassdoor)\n\nRetorne APENAS um JSON com os campos abaixo. Se não encontrar a informação, use null.\n\n{\n  \"company_segment\": \"segmento de atuação da empresa\",\n  \"employee_count\": \"faixa de funcionários (ex: 1-10, 11-50, 51-200, 201-500, 500+)\",\n  \"revenue_range\": \"faixa de faturamento estimada se disponível\",\n  \"website\": \"site oficial da empresa\",\n  \"description\": \"descrição curta da empresa em 1-2 frases baseada no próprio site\",\n  \"products_services\": \"principais produtos ou serviços oferecidos conforme listado no site\",\n  \"linkedin\": \"URL completa do perfil LinkedIn da empresa encontrada no footer/site\",\n  \"instagram\": \"URL completa do perfil Instagram da empresa encontrada no footer/site\",\n  \"facebook\": \"URL completa do perfil Facebook da empresa encontrada no footer/site\",\n  \"youtube\": \"URL completa do canal YouTube da empresa encontrada no footer/site\",\n  \"twitter\": \"URL completa do perfil X/Twitter da empresa encontrada no footer/site\",\n  \"founded_year\": \"ano de fundação da empresa\",\n  \"main_competitors\": \"3-5 concorrentes diretos no Brasil, separados por vírgula\",\n  \"technologies_used\": \"tecnologias ou plataformas que a empresa usa (se encontrar)\",\n  \"target_market\": \"público-alvo ou mercado principal da empresa\"\n}\n\nResponda APENAS com o JSON, sem markdown, sem explicações.',
  'sonar-pro'
),
(
  'validate_qualification',
  'Validar Coerência com IA',
  'Analisa dados de qualificação do lead e identifica incoerências ou sugestões para o SDR.',
  'Você é um analista de qualificação de leads B2B. Responda SEMPRE em JSON array válido, sem markdown, sem explicações extras.',
  E'Você é um analista de qualificação de leads B2B para uma empresa de software de atendimento (chatbots, call center, monitoramento).\n\nAnalise os dados abaixo e retorne APENAS alertas de INCOERÊNCIA ou sugestões práticas. Seja direto e objetivo.\n\nDados do lead:\n- Empresa: {{company}}\n- Razão Social: {{razao_social}}\n- CNPJ: {{cnpj}}\n- Porte: {{porte}}\n- Segmento: {{company_segment}}\n- Nº funcionários: {{employee_count}}\n- Faixa de faturamento: {{revenue_range}}\n- Produto de interesse: {{product_interest}}\n- Já usa plataforma: {{uses_platform}}\n- Média atendimentos/dia: {{daily_service_volume}}\n- Principal dor: {{main_pain_point}}\n- Urgência: {{solution_urgency}}\n- Orçamento: {{has_budget}}\n- Telefone: {{has_phone}}\n- Email: {{has_email}}\n\nRegras de análise:\n1. Se atendimentos \"Acima de 200\" mas empresa é MEI/micro → alertar incoerência de volume vs porte\n2. Se urgência \"Até 3 meses\" mas orçamento \"Não\" → alertar inconsistência urgência vs orçamento\n3. Se dor muito genérica (ex: \"Outro\" sem detalhe, ou muito vaga) → sugerir pergunta específica para o SDR fazer\n4. Se porte grande mas volume baixo → questionar se o volume informado está correto\n5. Se já usa plataforma + dor \"Falta de automação\" → sugerir perguntar qual plataforma usa hoje\n6. Qualquer outra incoerência relevante entre os dados\n\nIMPORTANTE: Responda APENAS com um JSON array. Cada item deve ter \"type\" (\"warning\" ou \"suggestion\") e \"message\" (texto curto). Se não houver alertas, retorne []. Máximo 4 alertas.\n\nExemplo: [{\"type\":\"warning\",\"message\":\"Volume acima de 200 é incoerente com porte MEI\"},{\"type\":\"suggestion\",\"message\":\"Pergunte qual plataforma o lead usa atualmente\"}]',
  'sonar'
),
(
  'generate_insights',
  'Insights de Vendas com IA',
  'Gera insights comerciais personalizados com diferenciais, automações, integrações e argumentos de venda.',
  'Responda exclusivamente em JSON válido, sem markdown ou texto adicional.',
  E'Você é um consultor de vendas especialista em soluções de atendimento ao cliente (WhatsApp, chatbots, telefonia IP, monitoramento de qualidade com IA). Os produtos que vendemos são:\n- EZ Chat: Plataforma de atendimento omnichannel via WhatsApp com chatbots, automações e integração com CRMs\n- EZ Call: Telefonia IP/PABX virtual com gravação, URA, discador automático e relatórios\n- MonitorIA: Monitoramento de qualidade de atendimento com IA (análise de sentimento, scripts, compliance)\n\nCom base nos dados abaixo sobre a empresa do potencial cliente, gere insights comerciais acionáveis para o SDR usar durante a abordagem de vendas.\n\n**Dados da empresa:**\n- Nome: {{companyName}}\n- Segmento: {{segment}}\n- Descrição: {{description}}\n- Porte: {{porte}}\n- Funcionários: {{employeeCount}}\n- Faturamento: {{revenue}}\n- Website: {{website}}\n- Volume de atendimentos/dia: {{volume}}\n- Já usa plataforma de atendimento: {{usesPlatform}}\n- Principal dor: {{painPoint}}\n- Produto de interesse: {{product}}\n- Urgência: {{urgency}}\n- Orçamento: {{budget}}\n\nResponda em JSON com a seguinte estrutura:\n{\n  \"diferenciais\": [\"lista de diferenciais competitivos que podemos oferecer para esta empresa específica\"],\n  \"automacoes\": [\"lista de automações específicas que resolveriam os problemas desta empresa\"],\n  \"integracoes\": [\"lista de integrações úteis com sistemas que esta empresa provavelmente usa\"],\n  \"argumentos_venda\": [\"lista de argumentos de venda personalizados para o perfil desta empresa\"],\n  \"perguntas_descoberta\": [\"perguntas que o SDR pode fazer para aprofundar a qualificação\"],\n  \"riscos\": [\"possíveis objeções ou riscos que o SDR deve antecipar\"]\n}\n\nSeja específico para o segmento e perfil da empresa. Não seja genérico. Máximo 4 itens por categoria.',
  'sonar'
);
