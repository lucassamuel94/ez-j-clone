import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lead } = await req.json();
    const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build context from lead data
    const companyName = lead.razao_social || lead.nome_fantasia || lead.company || '';
    const segment = lead.company_segment || lead.cnae_fiscal_descricao || '';
    const painPoint = lead.main_pain_point || '';
    const product = lead.product_interest || '';
    const volume = lead.daily_service_volume || '';
    const employeeCount = lead.employee_count || '';
    const revenue = lead.revenue_range || '';
    const website = lead.website || '';
    const porte = lead.porte || '';
    const usesPlatform = lead.uses_platform || '';
    const urgency = lead.solution_urgency || '';
    const budget = lead.has_budget || '';
    const aiData = lead.ai_enrichment_data || {};
    const aiDescription = aiData.descricao || aiData.description || '';

    // SQO validation data (filled by Closer after meeting)
    const sqoPainClear = lead.sqo_pain_clear != null ? (lead.sqo_pain_clear ? 'Sim' : 'Não') : '';
    const sqoPainCategory = lead.sqo_pain_category || '';
    const sqoPainOther = lead.sqo_pain_other || '';
    const sqoPainFinancialImpact = lead.sqo_pain_financial_impact != null ? (lead.sqo_pain_financial_impact ? 'Sim' : 'Não') : '';
    const sqoUrgency = lead.sqo_urgency || '';
    const sqoBudget = lead.sqo_budget || '';
    const sqoDecisionMaker = lead.sqo_decision_maker || '';
    const sqoIcpFit = lead.sqo_icp_fit || '';
    const sqoNextStep = lead.sqo_next_step || '';

    // Build SQO context block
    const hasSqoData = sqoPainClear || sqoPainCategory || sqoUrgency || sqoBudget || sqoDecisionMaker || sqoIcpFit;
    const sqoContext = hasSqoData
      ? `\n\n--- VALIDAÇÃO SQO (preenchida pelo Closer após reunião) ---\nDor clara: ${sqoPainClear}\nCategoria da dor: ${sqoPainCategory}${sqoPainOther ? ` (${sqoPainOther})` : ''}\nImpacto financeiro da dor: ${sqoPainFinancialImpact}\nUrgência: ${sqoUrgency}\nOrçamento: ${sqoBudget}\nDecistor mapeado: ${sqoDecisionMaker}\nFit ICP: ${sqoIcpFit}\nPróximo passo: ${sqoNextStep}`
      : '';

    // Fetch prompt from DB
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: promptData } = await supabase
      .from('ai_prompts')
      .select('system_prompt, user_prompt_template, model')
      .eq('id', 'generate_insights')
      .single();

    let systemPrompt = 'Responda exclusivamente em JSON válido, sem markdown ou texto adicional.';
    let userPromptTemplate = '';
    let model = 'sonar';

    if (promptData) {
      model = promptData.model;
      // Only use DB template if it already has the new split-by-product format.
      // Old DB records don't contain 'chatbot'/'pabx' — fall through to hardcoded default.
      const isNewFormat = promptData.user_prompt_template.includes('chatbot') ||
                          promptData.user_prompt_template.includes('pabx');
      if (isNewFormat) {
        systemPrompt = promptData.system_prompt;
        userPromptTemplate = promptData.user_prompt_template;
      }
    }

    // Replace template variables
    const basePrompt = userPromptTemplate
      ? userPromptTemplate
          .replace(/\{\{companyName\}\}/g, companyName)
          .replace(/\{\{segment\}\}/g, segment)
          .replace(/\{\{description\}\}/g, aiDescription)
          .replace(/\{\{porte\}\}/g, porte)
          .replace(/\{\{employeeCount\}\}/g, employeeCount)
          .replace(/\{\{revenue\}\}/g, revenue)
          .replace(/\{\{website\}\}/g, website)
          .replace(/\{\{volume\}\}/g, volume)
          .replace(/\{\{usesPlatform\}\}/g, usesPlatform)
          .replace(/\{\{painPoint\}\}/g, painPoint)
          .replace(/\{\{product\}\}/g, product)
          .replace(/\{\{urgency\}\}/g, urgency)
          .replace(/\{\{budget\}\}/g, budget)
          .replace(/\{\{sqoContext\}\}/g, sqoContext)
      : `Gere insights de TI para a empresa "${companyName}" (segmento: ${segment || 'não informado'}, porte: ${porte || 'não informado'}, funcionários: ${employeeCount || 'não informado'}).

Retorne exclusivamente JSON neste formato (sem markdown):
{
  "chatbot": {
    "automacoes": ["3 automações de atendimento via chatbot específicas para este segmento"],
    "integracoes": ["3 integrações com sistemas que a empresa provavelmente usa"],
    "argumentos": ["3 argumentos de venda para chatbot personalizados para este cliente"],
    "perguntas": ["3 perguntas de descoberta para qualificar necessidade de chatbot"]
  },
  "pabx": {
    "diferenciais": ["3 diferenciais do PABX em nuvem relevantes para este cliente"],
    "argumentos": ["3 argumentos de venda para PABX personalizados para este cliente"],
    "perguntas": ["3 perguntas de descoberta para qualificar necessidade de PABX"],
    "riscos": ["3 objeções comuns e como superá-las"]
  }
}`;

    // Append SQO context if available and not already in template
    const prompt = (userPromptTemplate && !userPromptTemplate.includes('{{sqoContext}}') && sqoContext)
      ? basePrompt + sqoContext
      : basePrompt;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Log AI usage
    const usage = data.usage || {};
    const tokensInput = usage.prompt_tokens || 0;
    const tokensOutput = usage.completion_tokens || 0;
    const costPerInputToken = model === 'sonar-pro' ? 3 / 1_000_000 : model === 'sonar-reasoning' ? 2 / 1_000_000 : 1 / 1_000_000;
    const costPerOutputToken = model === 'sonar-pro' ? 15 / 1_000_000 : model === 'sonar-reasoning' ? 8 / 1_000_000 : 1 / 1_000_000;
    const requestFee = model === 'sonar' ? 5 / 1000 : 6 / 1000;
    const estimatedCost = (tokensInput * costPerInputToken) + (tokensOutput * costPerOutputToken) + requestFee;

    try {
      await supabase.from('ai_usage_logs').insert({
        prompt_id: 'generate_insights',
        model,
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        estimated_cost_usd: estimatedCost,
      });
    } catch (logErr) {
      console.error('Failed to log AI usage:', logErr);
    }

    let insights;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      insights = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      insights = null;
    }

    if (!insights) {
      return new Response(JSON.stringify({ error: 'Não foi possível gerar insights' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ insights }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Error generating insights:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
