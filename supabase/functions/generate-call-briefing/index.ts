import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lead, interactions, callHistory } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const companyName = lead.razao_social || lead.nome_fantasia || lead.company || '';
    const segment = lead.company_segment || lead.cnae_fiscal_descricao || '';
    const interactionsSummary = (interactions || []).slice(0, 5).map((i: any) =>
      `[${i.type}] ${i.notes || 'Sem notas'} (${new Date(i.created_at).toLocaleDateString('pt-BR')})`
    ).join('\n') || 'Nenhuma interação anterior';

    const callHistorySummary = (callHistory || []).slice(0, 3).map((c: any) =>
      `Score: ${c.call_score}/100, Interesse: ${c.interest_level}, Objeções: ${(c.objections || []).join(', ') || 'nenhuma'}`
    ).join('\n') || 'Sem histórico de calls';

    const systemPrompt = `Você é um coach de vendas B2B especializado em SaaS de automação de atendimento (chatbots, CRM, PABX).
Gere um briefing PRÉ-CALL conciso e acionável para o SDR que vai ligar para esta empresa.
Responda EXCLUSIVAMENTE em JSON válido com estas chaves:
- contexto_empresa: 2-3 frases sobre a empresa baseado nos dados
- historico_resumo: resumo das interações anteriores (ou "Primeiro contato" se não houver)
- pontos_fortes: array de 2-3 argumentos de venda específicos para o segmento
- objecoes_previstas: array de 2-3 objeções prováveis baseadas no segmento/histórico
- estrategia_abertura: 1 frase sugerindo como abrir a ligação
- perguntas_chave: array de 3 perguntas que o SDR deve fazer
- nivel_prioridade: "Alta" | "Média" | "Baixa"
- tempo_estimado: duração sugerida da call`;

    const userPrompt = `Empresa: ${companyName}
Segmento/CNAE: ${segment}
Porte: ${lead.porte || 'N/A'}
Funcionários: ${lead.employee_count || 'N/A'}
Faturamento: ${lead.revenue_range || 'N/A'}
Volume diário: ${lead.daily_service_volume || 'N/A'}
Dor principal: ${lead.main_pain_point || 'N/A'}
Produto de interesse: ${lead.product_interest || 'N/A'}
Urgência: ${lead.solution_urgency || 'N/A'}
Orçamento: ${lead.has_budget || 'N/A'}
Temperatura: ${lead.temperature || 'N/A'}
Status: ${lead.status || 'N/A'}

Interações anteriores:
${interactionsSummary}

Histórico de calls:
${callHistorySummary}

Gere o briefing pré-call.`;

    const aiBody = JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
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
      if (status === 429) return new Response(JSON.stringify({ error: 'Rate limit excedido' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (status === 402) return new Response(JSON.stringify({ error: 'Créditos esgotados' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ error: 'Erro IA: ' + status }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const usage = data.usage || {};
    try {
      await supabase.from('ai_usage_logs').insert({
        prompt_id: 'generate_call_briefing',
        model: 'gemini-3-flash-preview',
        tokens_input: usage.prompt_tokens || 0,
        tokens_output: usage.completion_tokens || 0,
        estimated_cost_usd: ((usage.prompt_tokens || 0) * 0.15 / 1_000_000) + ((usage.completion_tokens || 0) * 0.6 / 1_000_000),
        lead_id: lead.id || null,
      });
    } catch (e) { console.error('Log error:', e); }

    let briefing;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      briefing = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch {
      return new Response(JSON.stringify({ error: 'Parse error', raw: content.substring(0, 200) }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
