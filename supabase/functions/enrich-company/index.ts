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

    const { cnpj, company_name, razao_social } = await req.json();

    if (!cnpj && !company_name && !razao_social) {
      return new Response(
        JSON.stringify({ error: "Informe CNPJ ou nome da empresa" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const searchTerm = razao_social || company_name || cnpj;
    const cnpjClean = cnpj ? cnpj.replace(/\D/g, '') : '';
    const cnpjClause = cnpjClean ? ` (CNPJ: ${cnpjClean})` : '';

    // Fetch prompt from DB
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: promptData } = await supabase
      .from('ai_prompts')
      .select('system_prompt, user_prompt_template, model')
      .eq('id', 'enrich_company')
      .single();

    let systemPrompt = 'Você é um pesquisador de empresas brasileiras. Responda SEMPRE em JSON válido, sem markdown.';
    let userPromptTemplate = '';
    let model = 'sonar-pro';

    if (promptData) {
      systemPrompt = promptData.system_prompt;
      userPromptTemplate = promptData.user_prompt_template;
      model = promptData.model;
    }

    // Replace template variables
    const prompt = userPromptTemplate
      ? userPromptTemplate
          .replace(/\{\{searchTerm\}\}/g, searchTerm)
          .replace(/\{\{cnpjClause\}\}/g, cnpjClause)
      : `Pesquise informações sobre a empresa "${searchTerm}"${cnpjClause}. Retorne JSON com: company_segment, employee_count, revenue_range, website, description, products_services, linkedin, instagram, facebook, youtube, twitter, founded_year, main_competitors, technologies_used, target_market. Use null se não encontrar.`;

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
        return new Response(JSON.stringify({ error: "Rate limit Perplexity excedido. Tente novamente." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Perplexity API error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro na busca Perplexity" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const citations = data.citations || [];

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
        prompt_id: 'enrich_company',
        model,
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        estimated_cost_usd: estimatedCost,
      });
    } catch (logErr) {
      console.error('Failed to log AI usage:', logErr);
    }

    let enrichment: any = {};
    try {
      const cleaned = content.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
      enrichment = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse Perplexity response:", content);
      enrichment = {};
    }

    // If social media links are missing but we have a website, scrape the site directly
    const hasNoSocials = !enrichment.linkedin && !enrichment.instagram && !enrichment.youtube && !enrichment.twitter && !enrichment.facebook;
    const websiteUrl = enrichment.website || null;
    
    if (hasNoSocials && websiteUrl) {
      try {
        console.log("Scraping website for social links:", websiteUrl);
        const siteResponse = await fetch(websiteUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; Bot/1.0)" },
          redirect: "follow",
        });
        
        if (siteResponse.ok) {
          const html = await siteResponse.text();
          
          const socialPatterns: Record<string, RegExp[]> = {
            instagram: [/https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?/gi],
            linkedin: [/https?:\/\/(www\.)?linkedin\.com\/company\/[a-zA-Z0-9_-]+\/?/gi],
            facebook: [/https?:\/\/(www\.)?facebook\.com\/[a-zA-Z0-9_.]+\/?/gi],
            youtube: [/https?:\/\/(www\.)?youtube\.com\/(@[a-zA-Z0-9_-]+|channel\/[a-zA-Z0-9_-]+|c\/[a-zA-Z0-9_-]+)\/?/gi],
            twitter: [/https?:\/\/(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/?/gi],
          };

          for (const [platform, patterns] of Object.entries(socialPatterns)) {
            for (const pattern of patterns) {
              const matches = html.match(pattern);
              if (matches && matches.length > 0) {
                const validUrl = matches.find(url => 
                  !url.includes('/sharer') && 
                  !url.includes('/share') && 
                  !url.includes('/intent/') &&
                  !url.includes('/hashtag/')
                );
                if (validUrl) {
                  enrichment[platform] = validUrl;
                  console.log(`Found ${platform}:`, validUrl);
                }
              }
            }
          }
        }
      } catch (e) {
        console.error("Website scrape failed:", e);
      }
    }

    return new Response(JSON.stringify({ enrichment, citations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("enrich-company error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
