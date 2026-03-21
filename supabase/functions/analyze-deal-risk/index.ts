import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { deals } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const dealsContext = (deals || []).map((d: any, i: number) =>
      `Deal ${i + 1}: ${d.company_name} | Estágio: ${d.stage} | Valor: R$${d.deal_value} | ${d.days_in_stage} dias parado | Objeção: ${d.active_objection || 'nenhuma'} | Previsão: ${d.expected_close_date || 'N/A'}`
    ).join('\n');

    const systemPrompt = `Você é um estrategista de vendas B2B. Analise deals travados no pipeline e sugira ações de recuperação.
Responda EXCLUSIVAMENTE em JSON: { "analysis": [{ "deal_index": number, "risk_level": "critical"|"high"|"medium"|"low", "risk_reason": string, "suggested_actions": string[], "probability_estimate": number, "recommended_next_step": string }] }`;

    const aiBody = JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analise estes deals travados:\n${dealsContext}` },
      ],
      temperature: 0.3,
    });

    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: aiBody,
      });
      if (response.ok || (response.status !== 500 && response.status !== 503)) break;
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }

    if (!response || !response.ok) {
      const status = response?.status || 500;
      if (status === 429) return new Response(JSON.stringify({ error: 'Rate limit' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ error: 'Erro IA: ' + status }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const usage = data.usage || {};
    try {
      await supabase.from('ai_usage_logs').insert({
        prompt_id: 'analyze_deal_risk', model: 'gemini-3-flash-preview',
        tokens_input: usage.prompt_tokens || 0, tokens_output: usage.completion_tokens || 0,
        estimated_cost_usd: ((usage.prompt_tokens || 0) * 0.15 / 1_000_000) + ((usage.completion_tokens || 0) * 0.6 / 1_000_000),
      });
    } catch (e) { console.error('Log error:', e); }

    let analysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
      analysis = parsed.analysis || parsed;
    } catch {
      return new Response(JSON.stringify({ error: 'Parse error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
