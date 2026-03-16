-- Update generate_insights prompt to split insights by product (Chatbot and PABX)
UPDATE ai_prompts
SET
  label        = 'Insights de TI por Produto',
  description  = 'Gera insights de TI separados por produto: EZChat (Chatbot) e EZCall (PABX)',
  system_prompt = 'Você é um especialista em vendas de tecnologia B2B, com profundo conhecimento em soluções de chatbot de atendimento ao cliente e PABX em nuvem. Responda exclusivamente em JSON válido, sem markdown, texto adicional ou blocos de código.',
  user_prompt_template = 'Gere insights de TI para a empresa "{{companyName}}" com os seguintes dados:
- Segmento: {{segment}}
- Porte: {{porte}}
- Funcionários: {{employeeCount}}
- Receita: {{revenue}}
- Website: {{website}}
- Volume de atendimento diário: {{volume}}
- Usa plataforma similar: {{usesPlatform}}
- Dor principal: {{painPoint}}
- Produto de interesse: {{product}}
- Urgência: {{urgency}}
- Orçamento: {{budget}}
- Descrição (IA): {{description}}
{{sqoContext}}

Gere insights separados para dois produtos da empresa:

1. **EZChat (Chatbot de Atendimento)**: foco em automação de atendimento ao cliente, fluxos conversacionais e integrações com sistemas internos.

2. **EZCall (PABX em Nuvem)**: foco em telefonia corporativa, discagem, ramal, gravação de chamadas e produtividade da equipe de vendas/suporte.

Retorne exclusivamente JSON neste formato exato (sem markdown):
{
  "chatbot": {
    "automacoes": ["3 a 4 automações de atendimento via chatbot específicas para o segmento desta empresa"],
    "integracoes": ["3 a 4 integrações do chatbot com sistemas que esta empresa provavelmente usa (ERP, CRM, e-commerce, etc.)"],
    "argumentos": ["3 a 4 argumentos de venda para chatbot personalizados para o contexto deste cliente"],
    "perguntas": ["3 a 4 perguntas de descoberta para qualificar a necessidade de chatbot deste cliente"]
  },
  "pabx": {
    "diferenciais": ["3 a 4 diferenciais competitivos do PABX em nuvem mais relevantes para este cliente e segmento"],
    "argumentos": ["3 a 4 argumentos de venda para PABX personalizados para o contexto deste cliente"],
    "perguntas": ["3 a 4 perguntas de descoberta para qualificar a necessidade de PABX deste cliente"],
    "riscos": ["3 a 4 objeções comuns sobre PABX em nuvem e como superá-las para este perfil de empresa"]
  }
}',
  updated_at   = NOW()
WHERE id = 'generate_insights';
