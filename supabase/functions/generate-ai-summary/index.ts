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
    const { lead } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const companyName = lead.razao_social || lead.nome_fantasia || lead.company || '';
    const segment = lead.company_segment || lead.cnae_fiscal_descricao || '';
    const porte = lead.porte || '';
    const dataInicio = lead.data_inicio_atividade || '';
    const website = lead.website || '';
    const volume = lead.daily_service_volume || '';
    const painPoint = lead.main_pain_point || '';
    const product = lead.product_interest || '';
    const usesPlatform = lead.uses_platform || '';
    const employeeCount = lead.employee_count || '';
    const revenue = lead.revenue_range || '';
    const urgency = lead.solution_urgency || '';
    const budget = lead.has_budget || '';
    const aiData = lead.ai_enrichment_data || {};
    const aiDescription = aiData.descricao || aiData.description || '';

    const systemPrompt = `Você é um assistente de vendas B2B especializado em SaaS de automação de atendimento (WhatsApp, chatbots, CRM). 
Gere um resumo operacional CURTO (máximo 6 linhas) para o SDR que vai ligar para esta empresa.
Responda EXCLUSIVAMENTE em JSON válido, sem markdown, sem texto adicional. 
O JSON deve ter exatamente estas chaves: tempo_mercado, segmento, necessidade_automacao, potencial, sugestao_abordagem, prioridade.
Valores devem ser strings curtas e objetivas. Nada genérico.`;

    const userPrompt = `Analise esta empresa e gere o resumo operacional:

Empresa: ${companyName}
Segmento/CNAE: ${segment}
Porte: ${porte}
Início de atividade: ${dataInicio}
Website: ${website}
Funcionários: ${employeeCount}
Faturamento: ${revenue}
Volume diário de atendimentos: ${volume}
Usa plataforma: ${usesPlatform}
Dor principal: ${painPoint}
Produto de interesse: ${product}
Urgência: ${urgency}
Orçamento: ${budget}
Descrição IA: ${aiDescription}

Retorne JSON com:
- tempo_mercado: tempo estimado de atuação no mercado
- segmento: segmento principal da empresa
- necessidade_automacao: nível e tipo de necessidade (Baixa/Média/Alta + motivo curto)
- potencial: potencial estimado (Baixo/Médio/Médio-Alto/Alto)
- sugestao_abordagem: uma frase com a abordagem recomendada
- prioridade: prioridade sugerida (Baixa/Média/Alta)`;

    const aiBody = JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    });

    let response: Response | null = null;
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      response = await fetch(
        'https://ai.gateway.lovable.dev/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: aiBody,
        }
      );
      if (response.ok || (response.status !== 500 && response.status !== 503)) break;
      console.warn(`AI gateway attempt ${attempt + 1} failed with ${response.status}, retrying...`);
      if (attempt < maxRetries - 1) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }

    if (!response || !response.ok) {
      const errorText = response ? await response.text() : 'No response';
      console.error('AI gateway error:', response?.status, errorText);
      const status = response?.status || 500;
      if (status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit excedido, tente novamente em alguns segundos.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos de IA esgotados.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Erro na API de IA: ' + status }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response!.json();
    const content = data.choices?.[0]?.message?.content || '';
    console.log('AI response content:', content.substring(0, 500));

    // Log usage
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const usage = data.usage || {};
    const tokensInput = usage.prompt_tokens || 0;
    const tokensOutput = usage.completion_tokens || 0;
    const estimatedCost = (tokensInput * 0.15 / 1_000_000) + (tokensOutput * 0.6 / 1_000_000);

    try {
      await supabase.from('ai_usage_logs').insert({
        prompt_id: 'generate_ai_summary',
        model: 'gemini-2.5-flash',
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        estimated_cost_usd: estimatedCost,
        lead_id: lead.id || null,
      });
    } catch (logErr) {
      console.error('Failed to log AI usage:', logErr);
    }

    let summary;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      summary = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch (parseErr) {
      console.error('Failed to parse AI response:', content);
      summary = null;
    }

    if (!summary) {
      return new Response(JSON.stringify({ error: 'Não foi possível gerar o resumo', raw: content.substring(0, 200) }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Error generating AI summary:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
