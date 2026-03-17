import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Correct BrasilAPI field mapping
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
      cnaes_secundarios: data.cnaes_secundarios?.length
        ? data.cnaes_secundarios.map((a: any) => `${a.codigo} - ${a.descricao}`).join('; ')
        : null,
      situacao_cadastral: data.descricao_situacao_cadastral || null,
      data_inicio_atividade: data.data_inicio_atividade || null,
      logradouro: data.logradouro || null,
      numero: data.numero || null,
      complemento: data.complemento || null,
      bairro: data.bairro || null,
      city: data.municipio || null,
      state: data.uf || null,
      cep: data.cep || null,
      qsa: data.qsa?.length ? JSON.stringify(data.qsa) : null,
    };
  } catch (e: any) {
    console.error(`BrasilAPI error for ${clean}:`, e.message || e);
    return null;
  }
}

if (import.meta.main) {
  const { serve } = await import('https://deno.land/std@0.208.0/http/server.ts');

  serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Fix: use SUPABASE_URL (not VITE_SUPABASE_URL which doesn't exist in Edge Functions)
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

      // Verify caller is authenticated
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: corsHeaders,
        });
      }
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await authClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: corsHeaders,
        });
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      const { leadId, enrich_brasilapi, enrich_perplexity } = await req.json();

      if (!leadId) {
        return new Response(JSON.stringify({ error: 'Lead ID required' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      // Fetch lead
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (leadError || !lead) {
        return new Response(JSON.stringify({ error: 'Lead not found' }), {
          status: 404,
          headers: corsHeaders,
        });
      }

      if (!lead.cnpj) {
        return new Response(
          JSON.stringify({ error: 'Lead does not have a valid CNPJ' }),
          { status: 400, headers: corsHeaders }
        );
      }

      const updates: Record<string, any> = {};

      // ─── Step 1: BrasilAPI ─────────────────────────────────────────────────
      if (enrich_brasilapi !== false) {
        const brasilData = await fetchBrasilAPI(lead.cnpj);
        if (brasilData) {
          // Non-destructive: only fill fields that are empty on the lead
          for (const [key, val] of Object.entries(brasilData)) {
            if (val !== null && val !== '' && !lead[key]) {
              updates[key] = val;
            }
          }
          // Auto-fill company_segment from CNAE description only if empty
          const newCnaeDesc = updates.cnae_fiscal_descricao || lead.cnae_fiscal_descricao;
          if (newCnaeDesc && !lead.company_segment && !updates.company_segment) {
            updates.company_segment = newCnaeDesc;
          }
        }
      }

      // ─── Step 2: Perplexity ────────────────────────────────────────────────
      if (enrich_perplexity !== false) {
        const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
        if (!perplexityKey) {
          console.error('PERPLEXITY_API_KEY not configured');
        } else {
          try {
            // Fetch customisable prompt from DB (same table used by bulk-enrich)
            const { data: promptData } = await supabase
              .from('ai_prompts')
              .select('system_prompt, user_prompt_template, model')
              .eq('id', 'enrich_company')
              .maybeSingle();

            const systemPrompt = promptData?.system_prompt
              || 'Você é um pesquisador de empresas brasileiras. Responda SEMPRE em JSON válido, sem markdown.';
            const model = promptData?.model || 'sonar-pro';

            const searchTerm = (updates.razao_social as string)
              || lead.razao_social
              || lead.nome_fantasia
              || lead.company;
            const cnpjClean = lead.cnpj.replace(/\D/g, '');
            const cnpjClause = cnpjClean ? ` (CNPJ: ${cnpjClean})` : '';

            const userPrompt = promptData?.user_prompt_template
              ? promptData.user_prompt_template
                  .replace(/\{\{searchTerm\}\}/g, searchTerm)
                  .replace(/\{\{cnpjClause\}\}/g, cnpjClause)
              : `Pesquise informações sobre a empresa "${searchTerm}"${cnpjClause}. Retorne JSON com: company_segment, employee_count, revenue_range, website, description, phone, whatsapp, email, linkedin, instagram, facebook, youtube, twitter, founded_year. Use null se não encontrar.`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await fetch('https://api.perplexity.ai/chat/completions', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${perplexityKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userPrompt },
                ],
              }),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (response.ok) {
              const result = await response.json();
              const content = result.choices?.[0]?.message?.content || '{}';

              // Log real token usage
              const usage = result.usage || {};
              const tokensInput = usage.prompt_tokens || 0;
              const tokensOutput = usage.completion_tokens || 0;
              const costPerIn = model === 'sonar-pro' ? 3 / 1_000_000 : 1 / 1_000_000;
              const costPerOut = model === 'sonar-pro' ? 15 / 1_000_000 : 1 / 1_000_000;
              const requestFee = model === 'sonar' ? 5 / 1000 : 6 / 1000;
              try {
                await supabase.from('ai_usage_logs').insert({
                  prompt_id: 'enrich_company',
                  model,
                  tokens_input: tokensInput,
                  tokens_output: tokensOutput,
                  estimated_cost_usd: (tokensInput * costPerIn) + (tokensOutput * costPerOut) + requestFee,
                });
              } catch (logErr) {
                console.error('Failed to log AI usage:', logErr);
              }

              let aiData: Record<string, any> = {};
              try {
                const cleaned = content.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
                aiData = JSON.parse(cleaned);
              } catch {
                console.error('Failed to parse Perplexity response:', content.substring(0, 200));
              }

              if (Object.keys(aiData).length > 0) {
                // Save full AI result for future reference
                updates.ai_enrichment_data = {
                  ...(typeof lead.ai_enrichment_data === 'object' && lead.ai_enrichment_data
                    ? lead.ai_enrichment_data : {}),
                  ...aiData,
                  citations: result.citations || [],
                  enriched_at: new Date().toISOString(),
                };

                // Map contact/business fields — only fill empty columns
                if (aiData.company_segment && !lead.company_segment && !updates.company_segment)
                  updates.company_segment = aiData.company_segment;
                if (aiData.employee_count && !lead.employee_count)
                  updates.employee_count = String(aiData.employee_count);
                if (aiData.revenue_range && !lead.revenue_range)
                  updates.revenue_range = aiData.revenue_range;
                if (aiData.website && !lead.website && !updates.website)
                  updates.website = aiData.website;
                if (aiData.phone) {
                  const existingPhone = (updates.phone as string) || lead.phone;
                  if (!existingPhone) {
                    updates.phone = aiData.phone;
                  } else if (aiData.phone !== existingPhone && !lead.phone_2) {
                    // Lead already has a primary phone — save as alternative number
                    updates.phone_2 = aiData.phone;
                  }
                }
                if (aiData.whatsapp && !lead.whatsapp)
                  updates.whatsapp = aiData.whatsapp;
                if (aiData.email && !lead.email)
                  updates.email = aiData.email;
              }
            } else {
              const errText = await response.text();
              console.error('Perplexity error:', response.status, errText.substring(0, 200));
            }
          } catch (error) {
            console.error('Perplexity error:', error);
          }
        }
      }

      // Apply updates
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('leads')
          .update(updates)
          .eq('id', leadId);

        if (updateError) {
          console.error('Update error:', updateError);
          return new Response(JSON.stringify({ error: 'Erro ao salvar dados no lead' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          updated_fields: Object.keys(updates),
          message: `Lead enriquecido com sucesso. ${Object.keys(updates).length} campo(s) atualizado(s)`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('Error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  });
}
