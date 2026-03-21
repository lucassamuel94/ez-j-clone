import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { wonDeals, lostDeals } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `Você é um analista de vendas B2B. Analise padrões de deals ganhos vs perdidos.
Responda em JSON:
{
  "summary": "2-3 frases de resumo executivo",
  "win_patterns": [{ "pattern": string, "confidence": "alta"|"média"|"baixa", "detail": string }],
  "loss_patterns": [{ "pattern": string, "confidence": "alta"|"média"|"baixa", "detail": string }],
  "segment_insights": [{ "segment": string, "win_rate": number, "avg_deal_value": number, "recommendation": string }],
  "recommendations": ["ação 1", "ação 2", ...],
  "risk_factors": ["fator 1", "fator 2", ...]
}`;

    const userPrompt = `Deals Ganhos (${(wonDeals || []).length}):
${(wonDeals || []).slice(0, 30).map((d: any) => `Segmento: ${d.company_segment}, Valor: R$${d.deal_value}, Dias: ${d.days_to_close}, Porte: ${d.porte}`).join('\n')}

Deals Perdidos (${(lostDeals || []).length}):
${(lostDeals || []).slice(0, 30).map((d: any) => `Segmento: ${d.company_segment}, Valor: R$${d.deal_value}, Motivo: ${d.lost_reason}, Porte: ${d.porte}`).join('\n')}

Analise os padrões.`;

    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
          temperature: 0.3,
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
        prompt_id: 'analyze_win_loss', model: 'gemini-3-flash-preview',
        tokens_input: usage.prompt_tokens || 0, tokens_output: usage.completion_tokens || 0,
        estimated_cost_usd: ((usage.prompt_tokens || 0) * 0.15 / 1_000_000) + ((usage.completion_tokens || 0) * 0.6 / 1_000_000),
      });
    } catch (e) { console.error('Log error:', e); }

    let analysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
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
