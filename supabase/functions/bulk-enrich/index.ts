import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchBrasilAPI(cnpj: string) {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length < 14) return null;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.error(`BrasilAPI HTTP ${res.status} for ${clean}`);
      return null;
    }
    const data = await res.json();
    return {
      razao_social: data.razao_social || null,
      nome_fantasia: data.nome_fantasia || null,
      porte: data.porte || null,
      capital_social: data.capital_social || null,
      cnae_fiscal: data.cnae_fiscal || null,
      cnae_fiscal_descricao: data.cnae_fiscal_descricao || null,
      cnaes_secundarios: data.cnaes_secundarios ? JSON.stringify(data.cnaes_secundarios) : null,
      situacao_cadastral: data.descricao_situacao_cadastral || null,
      data_inicio_atividade: data.data_inicio_atividade || null,
      logradouro: data.logradouro || null,
      numero: data.numero || null,
      complemento: data.complemento || null,
      bairro: data.bairro || null,
      city: data.municipio || null,
      state: data.uf || null,
      cep: data.cep || null,
      qsa: data.qsa ? JSON.stringify(data.qsa) : null,
    };
  } catch (e: unknown) {
    console.error(`BrasilAPI error for ${clean}:`, (e as Error).message || e);
    return null;
  }
}

async function fetchPerplexityEnrichment(
  supabase: any,
  cnpj: string,
  companyName: string,
  perplexityKey: string
) {
  try {
    // Fetch prompt from DB
    const { data: promptData } = await supabase
      .from('ai_prompts')
      .select('system_prompt, user_prompt_template, model')
      .eq('id', 'enrich_company')
      .maybeSingle();

    let systemPrompt = 'Você é um pesquisador de empresas brasileiras. Responda SEMPRE em JSON válido, sem markdown.';
    let userPromptTemplate = '';
    let model = 'sonar-pro';

    if (promptData) {
      systemPrompt = promptData.system_prompt;
      userPromptTemplate = promptData.user_prompt_template;
      model = promptData.model;
    }

    const searchTerm = companyName || cnpj;
    const cnpjClean = cnpj.replace(/\D/g, '');
    const cnpjClause = cnpjClean ? ` (CNPJ: ${cnpjClean})` : '';

    const prompt = userPromptTemplate
      ? userPromptTemplate
          .replace(/\{\{searchTerm\}\}/g, searchTerm)
          .replace(/\{\{cnpjClause\}\}/g, cnpjClause)
      : `Pesquise informações sobre a empresa "${searchTerm}"${cnpjClause}. Retorne JSON com: company_segment, employee_count, revenue_range, website, description, products_services, linkedin, instagram, facebook, youtube, twitter, founded_year, main_competitors, technologies_used, target_market, phone, whatsapp, email. Use null se não encontrar.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${perplexityKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Perplexity error for ${searchTerm}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const citations = data.citations || [];

    // Log AI usage
    const usage = data.usage || {};
    const tokensInput = usage.prompt_tokens || 0;
    const tokensOutput = usage.completion_tokens || 0;
    const costPerInputToken = model === 'sonar-pro' ? 3 / 1_000_000 : 1 / 1_000_000;
    const costPerOutputToken = model === 'sonar-pro' ? 15 / 1_000_000 : 1 / 1_000_000;
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
      console.error("Failed to parse Perplexity response:", content.substring(0, 200));
      return null;
    }

    return { enrichment, citations };
  } catch (e: unknown) {
    console.error(`Perplexity enrichment error:`, (e as Error).message || e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const enrichBrasilAPI = body.enrich_brasilapi !== false;
    const enrichPerplexity = body.enrich_perplexity !== false && !!perplexityKey;
    const onlyMissingData = body.only_missing !== false;
    const batchSize = body.batch_size || 10;
    const batchOffset = body.batch_offset || 0;

    // Fetch leads with valid CNPJ
    let query = supabase
      .from('leads')
      .select('id, cnpj, razao_social, nome_fantasia, company, ai_enrichment_data, company_segment, employee_count, revenue_range, website, cnae_fiscal, porte, phone, whatsapp, email')
      .not('cnpj', 'is', null)
      .neq('cnpj', '')
      .order('created_at', { ascending: false })
      .range(batchOffset, batchOffset + batchSize - 1);

    const { data: leads, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching leads:', fetchError);
      return new Response(JSON.stringify({ error: 'Erro ao buscar leads', details: fetchError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter valid CNPJs (>= 11 digits) and skip invalid ones like 000000000000
    const validLeads = (leads || []).filter(l => {
      const clean = (l.cnpj || '').replace(/\D/g, '');
      if (clean.length < 11) return false;
      // Skip all-zeros CNPJs
      if (/^0+$/.test(clean)) return false;
      return true;
    });

    // If only_missing, filter leads that are missing at least one key enrichment field
    // (broader than just cnae_fiscal+porte to catch leads with CNAE but no contact info)
    const filteredLeads = onlyMissingData
      ? validLeads.filter(l =>
          l.cnae_fiscal == null ||
          l.porte == null ||
          !l.website ||
          !l.employee_count ||
          !l.company_segment
        )
      : validLeads;

    // Also get total count for progress tracking
    const { count: totalCount } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .not('cnpj', 'is', null)
      .neq('cnpj', '');

    const results = {
      total_eligible: totalCount || 0,
      batch_size: batchSize,
      batch_offset: batchOffset,
      batch_count: filteredLeads.length,
      brasilapi_success: 0,
      brasilapi_failed: 0,
      perplexity_success: 0,
      perplexity_failed: 0,
      perplexity_skipped: 0,
      updated: 0,
      processed: 0,
      has_more: (leads || []).length === batchSize,
    };

    for (const lead of filteredLeads) {
      const updates: Record<string, any> = {};

      // Step 1: BrasilAPI — non-destructive: only fill fields that are empty on the lead
      if (enrichBrasilAPI) {
        const brasilData = await fetchBrasilAPI(lead.cnpj);
        if (brasilData) {
          results.brasilapi_success++;
          for (const [key, val] of Object.entries(brasilData)) {
            if (val !== null && val !== '' && !(lead as any)[key]) {
              updates[key] = val;
            }
          }
          // Auto-fill company_segment from cnae_fiscal_descricao if empty
          if (brasilData.cnae_fiscal_descricao && !lead.company_segment && !updates.company_segment) {
            updates.company_segment = brasilData.cnae_fiscal_descricao;
          }
        } else {
          results.brasilapi_failed++;
        }
        // Rate limit: wait between requests
        await new Promise(r => setTimeout(r, 500));
      }

      // Step 2: Perplexity
      if (enrichPerplexity) {
        const companyName = updates.razao_social || lead.razao_social || lead.nome_fantasia || lead.company;
        const perplexityResult = await fetchPerplexityEnrichment(supabase, lead.cnpj, companyName, perplexityKey!);
        if (perplexityResult) {
          results.perplexity_success++;
          updates.ai_enrichment_data = {
            ...(typeof lead.ai_enrichment_data === 'object' && lead.ai_enrichment_data ? lead.ai_enrichment_data : {}),
            ...perplexityResult.enrichment,
            citations: perplexityResult.citations,
            enriched_at: new Date().toISOString(),
          };
          const aiData = perplexityResult.enrichment;
          if (!updates.company_segment && !lead.company_segment && aiData.company_segment) updates.company_segment = aiData.company_segment;
          if (!updates.employee_count && !lead.employee_count && aiData.employee_count) updates.employee_count = String(aiData.employee_count);
          if (!updates.revenue_range && !lead.revenue_range && aiData.revenue_range) updates.revenue_range = aiData.revenue_range;
          if (!updates.website && !lead.website && aiData.website) updates.website = aiData.website;
          // Map contact fields from Perplexity to visible lead columns (non-destructive)
          if (aiData.phone) {
            const existingPhone = (updates.phone as string) || (lead as any).phone;
            if (!existingPhone) {
              updates.phone = aiData.phone;
            } else if (aiData.phone !== existingPhone && !(lead as any).phone_2) {
              updates.phone_2 = aiData.phone;
            }
          }
          if (aiData.whatsapp && !(lead as any).whatsapp) updates.whatsapp = aiData.whatsapp;
          if (aiData.email && !(lead as any).email) updates.email = aiData.email;
        } else {
          results.perplexity_failed++;
        }
        await new Promise(r => setTimeout(r, 1000));
      } else if (!perplexityKey) {
        results.perplexity_skipped++;
      }

      // Apply updates
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('leads')
          .update(updates)
          .eq('id', lead.id);
        if (updateError) {
          console.error(`Error updating lead ${lead.id}:`, updateError.message);
        } else {
          results.updated++;
        }
      }

      results.processed++;
    }

    console.log(`Batch done: offset=${batchOffset}, processed=${results.processed}, updated=${results.updated}, brasilapi_ok=${results.brasilapi_success}, brasilapi_fail=${results.brasilapi_failed}`);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("bulk-enrich error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
