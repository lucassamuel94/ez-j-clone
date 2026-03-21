import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { lead } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `Você é um analista de qualificação de leads B2B para SaaS de automação.
Analise o lead e gere um score de qualificação detalhado.
Responda em JSON:
{
  "total_score": 0-100,
  "grade": "A"|"B"|"C"|"D",
  "factors": [{ "name": string, "score": number, "max": number, "detail": string }],
  "recommendation": "1 frase sobre o que fazer com este lead",
  "conversion_probability": 0-100,
  "ideal_next_action": "ação específica"
}
Fatores a avaliar (com pesos):
- Completude de dados (15 pts): CNPJ, email, telefone, dados da empresa
- ICP Fit (25 pts): segmento, porte, número de funcionários
- Engajamento (25 pts): temperatura, score comportamental, interações
- Sinais de compra (20 pts): orçamento, urgência, dor identificada
- Qualidade de enriquecimento (15 pts): dados de IA, website, CNAE`;

    const userPrompt = `Lead: ${lead.name || 'N/A'} - ${lead.razao_social || lead.company || 'N/A'}
CNPJ: ${lead.cnpj || 'N/A'} | Email: ${lead.email || 'N/A'} | Telefone: ${lead.phone || 'N/A'}
Segmento: ${lead.company_segment || lead.cnae_fiscal_descricao || 'N/A'}
Porte: ${lead.porte || 'N/A'} | Funcionários: ${lead.employee_count || 'N/A'}
Faturamento: ${lead.revenue_range || 'N/A'} | Website: ${lead.website || 'N/A'}
Dor: ${lead.main_pain_point || 'N/A'} | Produto: ${lead.product_interest || 'N/A'}
Urgência: ${lead.solution_urgency || 'N/A'} | Orçamento: ${lead.has_budget || 'N/A'}
Temperatura: ${lead.temperature || 'N/A'} | Status: ${lead.status || 'N/A'}
Score comportamental: ${lead.behavioral_score || 'N/A'}
Dados IA: ${lead.ai_enrichment_data ? 'Sim' : 'Não'}`;

    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
          temperature: 0.2,
        }),
      });
      if (response.ok || (response.status !== 500 && response.status !== 503)) break;
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }

    if (!response || !response.ok) {
      const status = response?.status || 500;
      return new Response(JSON.stringify({ error: 'Erro IA: ' + status }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const usage = data.usage || {};
    try {
      await supabase.from('ai_usage_logs').insert({
        prompt_id: 'predict_lead_score', model: 'gemini-3-flash-preview',
        tokens_input: usage.prompt_tokens || 0, tokens_output: usage.completion_tokens || 0,
        estimated_cost_usd: ((usage.prompt_tokens || 0) * 0.15 / 1_000_000) + ((usage.completion_tokens || 0) * 0.6 / 1_000_000),
        lead_id: lead.id || null,
      });
    } catch (e) { console.error('Log error:', e); }

    let score;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      score = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch {
      return new Response(JSON.stringify({ error: 'Parse error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ score }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
