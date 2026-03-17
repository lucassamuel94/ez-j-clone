import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) throw new Error("PERPLEXITY_API_KEY is not configured");

    const { lead } = await req.json();

    // Fetch prompt from DB
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: promptData } = await supabase
      .from('ai_prompts')
      .select('system_prompt, user_prompt_template, model')
      .eq('id', 'validate_qualification')
      .single();

    let systemPrompt = 'Você é um analista de qualificação de leads B2B. Responda SEMPRE em JSON array válido, sem markdown.';
    let userPromptTemplate = '';
    let model = 'sonar';

    if (promptData) {
      systemPrompt = promptData.system_prompt;
      userPromptTemplate = promptData.user_prompt_template;
      model = promptData.model;
    }

    // Replace template variables
    const prompt = userPromptTemplate
      ? userPromptTemplate
          .replace(/\{\{company\}\}/g, lead.company || 'N/I')
          .replace(/\{\{razao_social\}\}/g, lead.razao_social || 'N/I')
          .replace(/\{\{cnpj\}\}/g, lead.cnpj || 'N/I')
          .replace(/\{\{porte\}\}/g, lead.porte || 'N/I')
          .replace(/\{\{company_segment\}\}/g, lead.company_segment || 'N/I')
          .replace(/\{\{employee_count\}\}/g, lead.employee_count || 'N/I')
          .replace(/\{\{revenue_range\}\}/g, lead.revenue_range || 'N/I')
          .replace(/\{\{product_interest\}\}/g, lead.product_interest || 'N/I')
          .replace(/\{\{uses_platform\}\}/g, lead.uses_platform || 'N/I')
          .replace(/\{\{daily_service_volume\}\}/g, lead.daily_service_volume || 'N/I')
          .replace(/\{\{main_pain_point\}\}/g, lead.main_pain_point || 'N/I')
          .replace(/\{\{solution_urgency\}\}/g, lead.solution_urgency || 'N/I')
          .replace(/\{\{has_budget\}\}/g, lead.has_budget || 'N/I')
          .replace(/\{\{has_phone\}\}/g, lead.phone ? 'Sim' : 'Não')
          .replace(/\{\{has_email\}\}/g, lead.email ? 'Sim' : 'Não')
      : `Analise os dados do lead "${lead.company || 'N/I'}" e retorne alertas de incoerência como JSON array.`;

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit Perplexity excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Perplexity API error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro na análise Perplexity" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";

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
        prompt_id: 'validate_qualification',
        model,
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        estimated_cost_usd: estimatedCost,
      });
    } catch (logErr) {
      console.error('Failed to log AI usage:', logErr);
    }

    let alerts: any[] = [];
    let parseError = false;
    try {
      const cleaned = content.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
      alerts = JSON.parse(cleaned);
      if (!Array.isArray(alerts)) alerts = [];
    } catch {
      console.error("Failed to parse Perplexity response:", content);
      parseError = true;
    }

    return new Response(JSON.stringify({ alerts, ai_failed: parseError }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("validate-qualification error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
