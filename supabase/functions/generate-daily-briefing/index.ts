import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { role, stats } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

    const systemPrompt = `Você é um assistente de produtividade para um time de vendas B2B de SaaS.
Gere um briefing diário CONCISO e ACIONÁVEL. Use "${greeting}" na saudação.
Responda em JSON: { "greeting": string, "priorities": string[], "alerts": string[], "tip": string, "score": number }
- priorities: 3-5 itens prioritários (strings curtas e diretas)
- alerts: alertas importantes (deals em risco, metas, etc.)
- tip: 1 dica de vendas relevante
- score: 0-100 estimando a "saúde" do dia`;

    const userPrompt = `Role: ${role}
Stats: Leads quentes: ${stats.hotLeads || 0}, Retornos pendentes: ${stats.pendingReturns || 0}, Reuniões: ${stats.scheduledMeetings || 0}, Opps ativas: ${stats.activeOpps || 0}, Deals parados: ${stats.stuckDeals || 0}, Tarefas: ${stats.pendingTasks || 0}, Atrasados: ${stats.overdueItems || 0}, Score calls: ${stats.recentCallScore || 'N/A'}, Meta: ${stats.weeklyTarget || 'N/A'}, Realizado: ${stats.weeklyActual || 'N/A'}`;

    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
          temperature: 0.5,
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
        prompt_id: 'daily_briefing', model: 'gemini-3-flash-preview',
        tokens_input: usage.prompt_tokens || 0, tokens_output: usage.completion_tokens || 0,
        estimated_cost_usd: ((usage.prompt_tokens || 0) * 0.15 / 1_000_000) + ((usage.completion_tokens || 0) * 0.6 / 1_000_000),
      });
    } catch (e) { console.error('Log error:', e); }

    let briefing;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      briefing = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch {
      return new Response(JSON.stringify({ error: 'Parse error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ briefing }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
