import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { clients } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientsContext = (clients || []).map((c: any, i: number) =>
      `Cliente ${i + 1}: ${c.client_name} | Dias como cliente: ${c.days_as_client} | Projeto: ${c.project_status || 'N/A'} | Fase: ${c.current_phase || 'N/A'} | Bloqueado: ${c.has_blocked_project ? 'Sim' : 'Não'} | Valor: R$${c.opportunity_value || 0}`
    ).join('\n');

    const systemPrompt = `Você é um analista de Customer Success para SaaS B2B.
Avalie a saúde de cada cliente baseado nos dados fornecidos.
Responda em JSON: { "healthScores": [{ "client_index": number, "health_score": 0-100, "status": "healthy"|"attention"|"at_risk"|"critical", "churn_risk": "low"|"medium"|"high", "upsell_readiness": "ready"|"not_ready"|"nurturing", "key_signals": string[], "recommended_action": string }] }`;

    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: `Avalie estes clientes:\n${clientsContext}` }],
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
        prompt_id: 'calculate_health_score', model: 'gemini-3-flash-preview',
        tokens_input: usage.prompt_tokens || 0, tokens_output: usage.completion_tokens || 0,
        estimated_cost_usd: ((usage.prompt_tokens || 0) * 0.15 / 1_000_000) + ((usage.completion_tokens || 0) * 0.6 / 1_000_000),
      });
    } catch (e) { console.error('Log error:', e); }

    let healthScores;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
      healthScores = parsed.healthScores || parsed;
    } catch {
      return new Response(JSON.stringify({ error: 'Parse error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ healthScores }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
