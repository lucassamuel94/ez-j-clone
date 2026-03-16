import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Small chunk per invocation to stay well under 60s timeout
const MAX_PER_INVOCATION = 8;
// Process this many clients in parallel
const PARALLEL_CONCURRENCY = 4;
// Safety: stop processing after this many ms and reinvoke
const MAX_WALL_MS = 45_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const startTime = Date.now();

  try {
    const cnpjaKey = Deno.env.get("CNPJA_API_KEY");
    const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { job_id, limit, use_cnpja = true, use_perplexity = true, _running_totals } = body;

    if (!job_id) {
      return new Response(
        JSON.stringify({ error: "job_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if job was cancelled
    const { data: jobCheck } = await supabase
      .from("enrichment_jobs")
      .select("status")
      .eq("id", job_id)
      .single();

    if (jobCheck?.status === "cancelled") {
      return new Response(
        JSON.stringify({ success: true, cancelled: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Running totals carried across self-reinvocations
    let cnpjaTotal = _running_totals?.cnpja || 0;
    let perplexityTotal = _running_totals?.perplexity || 0;
    let totalProcessed = _running_totals?.processed || 0;
    const isFirstInvocation = !_running_totals;

    // On first invocation, count total eligible and update job
    if (isFirstInvocation) {
      const { count } = await supabase
        .from("active_clients")
        .select("id", { count: "exact", head: true })
        .is("enriched_at", null)
        .not("cnpj", "is", null);

      const totalEligible = limit && limit > 0 ? Math.min(count || 0, limit) : (count || 0);

      await supabase
        .from("enrichment_jobs")
        .update({ total_eligible: totalEligible, updated_at: new Date().toISOString() })
        .eq("id", job_id);

      if (totalEligible === 0) {
        await supabase
          .from("enrichment_jobs")
          .update({ status: "completed", updated_at: new Date().toISOString() })
          .eq("id", job_id);

        return new Response(
          JSON.stringify({ success: true, total_eligible: 0, processed: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch eligible clients (enriched_at IS NULL filters out already processed)
    const { data: clients, error: fetchError } = await supabase
      .from("active_clients")
      .select("id, company, cnpj, razao_social, nome_fantasia, segment, employee_count, revenue_range, website")
      .is("enriched_at", null)
      .not("cnpj", "is", null)
      .order("created_at", { ascending: true })
      .range(0, MAX_PER_INVOCATION - 1);

    if (fetchError) throw fetchError;

    const chunkSize = clients?.length || 0;
    const effectiveLimit = limit && limit > 0 ? limit : Infinity;
    const clientsToProcess = clients!.slice(0, Math.max(0, effectiveLimit - totalProcessed));

    if (clientsToProcess.length === 0) {
      await supabase
        .from("enrichment_jobs")
        .update({
          status: "completed",
          processed: totalProcessed,
          cnpja_success: cnpjaTotal,
          perplexity_success: perplexityTotal,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job_id);

      return new Response(
        JSON.stringify({ success: true, processed: totalProcessed, completed: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process clients in parallel batches
    for (let i = 0; i < clientsToProcess.length; i += PARALLEL_CONCURRENCY) {
      // Wall-clock safety check
      if (Date.now() - startTime > MAX_WALL_MS) {
        console.log(`Wall-clock safety: stopping after ${totalProcessed} processed, will reinvoke`);
        break;
      }

      // Check cancellation between batches
      if (i > 0) {
        const { data: jc } = await supabase
          .from("enrichment_jobs")
          .select("status")
          .eq("id", job_id)
          .single();
        if (jc?.status === "cancelled") break;
      }

      const batch = clientsToProcess.slice(i, i + PARALLEL_CONCURRENCY);

      // Process batch in parallel
      const results = await Promise.allSettled(
        batch.map((client) => enrichClient(client, { use_cnpja, use_perplexity, cnpjaKey, perplexityKey }))
      );

      // Apply results
      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === "fulfilled" && result.value) {
          const { updates, cnpjaOk, perplexityOk } = result.value;
          if (Object.keys(updates).length > 0) {
            // Only stamp enriched_at when we actually got data
            updates.enriched_at = new Date().toISOString();
            await supabase.from("active_clients").update(updates).eq("id", batch[j].id);
          } else {
            // No data found — do NOT stamp enriched_at so the record is retried in future runs
            console.log(`No enrichment data found for ${batch[j].company}, will retry later`);
          }
          if (cnpjaOk) cnpjaTotal++;
          if (perplexityOk) perplexityTotal++;
        } else {
          // Error — do NOT stamp enriched_at, record will be retried in a future run
          if (result.status === "rejected") {
            console.error("Client enrich failed:", batch[j].company, result.reason);
          }
        }
        totalProcessed++;
      }

      // Update progress
      await supabase
        .from("enrichment_jobs")
        .update({
          processed: totalProcessed,
          cnpja_success: cnpjaTotal,
          perplexity_success: perplexityTotal,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job_id);
    }

    // Determine if more work remains
    const hasMore = chunkSize === MAX_PER_INVOCATION && totalProcessed < effectiveLimit;

    // Re-check cancellation
    const { data: finalCheck } = await supabase
      .from("enrichment_jobs")
      .select("status")
      .eq("id", job_id)
      .single();

    if (finalCheck?.status === "cancelled" || !hasMore) {
      if (finalCheck?.status !== "cancelled") {
        await supabase
          .from("enrichment_jobs")
          .update({
            status: "completed",
            processed: totalProcessed,
            cnpja_success: cnpjaTotal,
            perplexity_success: perplexityTotal,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job_id);
      }
    } else {
      // Self-reinvoke for next chunk
      const nextBody = {
        job_id,
        limit,
        use_cnpja,
        use_perplexity,
        _running_totals: { cnpja: cnpjaTotal, perplexity: perplexityTotal, processed: totalProcessed },
      };

      try {
        const reinvokeRes = await fetch(`${supabaseUrl}/functions/v1/enrich-active-clients`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify(nextBody),
        });
        if (!reinvokeRes.ok) {
          console.error("Self-reinvoke failed with status:", reinvokeRes.status);
          // Mark job as failed so it doesn't stay "running" forever
          await supabase.from("enrichment_jobs").update({
            status: "failed",
            error_message: `Self-reinvoke failed: HTTP ${reinvokeRes.status}`,
            updated_at: new Date().toISOString(),
          }).eq("id", job_id);
        }
        // Consume body to avoid resource leak
        await reinvokeRes.text();
      } catch (e) {
        console.error("Self-reinvoke error:", e);
        await supabase.from("enrichment_jobs").update({
          status: "failed",
          error_message: `Self-reinvoke error: ${e instanceof Error ? e.message : "Unknown"}`,
          updated_at: new Date().toISOString(),
        }).eq("id", job_id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: totalProcessed,
        cnpja_success: cnpjaTotal,
        perplexity_success: perplexityTotal,
        has_more: hasMore,
        elapsed_ms: Date.now() - startTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("enrich-active-clients error:", e);

    try {
      const { job_id } = await req.clone().json().catch(() => ({}));
      if (job_id) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase
          .from("enrichment_jobs")
          .update({
            status: "failed",
            error_message: e instanceof Error ? e.message : "Unknown error",
            updated_at: new Date().toISOString(),
          })
          .eq("id", job_id);
      }
    } catch {}

    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// --- Enrichment logic for a single client ---

interface EnrichOptions {
  use_cnpja: boolean;
  use_perplexity: boolean;
  cnpjaKey: string | undefined;
  perplexityKey: string | undefined;
}

interface EnrichResult {
  updates: Record<string, unknown>;
  cnpjaOk: boolean;
  perplexityOk: boolean;
}

async function enrichClient(
  client: { id: string; company: string; cnpj: string | null; razao_social: string | null; nome_fantasia: string | null; segment: string | null; employee_count?: string | null; revenue_range?: string | null; website?: string | null },
  opts: EnrichOptions
): Promise<EnrichResult> {
  const cleanCnpj = (client.cnpj || "").replace(/\D/g, "");
  const updates: Record<string, unknown> = {};
  let cnpjaOk = false;
  let perplexityOk = false;

  // CNPJa enrichment
  if (opts.use_cnpja && opts.cnpjaKey && cleanCnpj.length === 14) {
    try {
      const res = await fetch(`https://api.cnpja.com/office/${cleanCnpj}`, {
        headers: { Authorization: opts.cnpjaKey },
      });
      if (res.ok) {
        const item = await res.json();
        const company = item.company || {};
        const address = item.address || {};
        const mainActivity = item.mainActivity || {};
        const status = item.status || {};
        updates.razao_social = company.name || item.name || null;
        updates.nome_fantasia = item.alias || null;
        updates.porte = company.size?.text || null;
        updates.capital_social = company.equity || null;
        updates.situacao_cadastral = status.text || null;
        updates.cnae_fiscal = mainActivity.id || null;
        updates.cnae_fiscal_descricao = mainActivity.text || null;
        if (mainActivity.text && !client.segment) {
          updates.segment = mainActivity.text;
        }
        updates.data_inicio_atividade = item.founded || null;
        updates.city = address.city || null;
        updates.state = address.state || null;
        updates.cep = address.zip || null;
        if (item.sideActivities?.length > 0) {
          updates.cnaes_secundarios = item.sideActivities
            .map((a: { id: string; text: string }) => `${a.id} - ${a.text}`)
            .join("; ");
        }
        cnpjaOk = true;
      } else {
        await res.text(); // consume body
        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    } catch (e) {
      console.error("CNPJa error for", cleanCnpj, e);
    }
  }

  // Perplexity enrichment — unified schema matching bulk-enrich and enrich-individual-lead
  if (opts.use_perplexity && opts.perplexityKey) {
    try {
      const searchTerm = (updates.razao_social as string) || client.razao_social || client.nome_fantasia || client.company;
      const cnpjClause = cleanCnpj ? ` (CNPJ: ${cleanCnpj})` : "";
      const perplexityRes = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${opts.perplexityKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar-pro",
          messages: [
            {
              role: "system",
              content: "Você é um pesquisador de empresas brasileiras. Responda SEMPRE em JSON válido, sem markdown.",
            },
            {
              role: "user",
              content: `Pesquise informações sobre a empresa "${searchTerm}"${cnpjClause}. Retorne JSON com: company_segment, employee_count (faixa estimada, ex: "10-50"), revenue_range (faixa anual estimada), website, phone, whatsapp, email, linkedin, instagram, description, founded_year. Use null se não encontrar.`,
            },
          ],
        }),
      });
      if (perplexityRes.ok) {
        const pData = await perplexityRes.json();
        const content = pData.choices?.[0]?.message?.content || "{}";
        try {
          const cleaned = content.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
          const parsed = JSON.parse(cleaned);
          // Map to columns — non-destructive
          if (parsed.employee_count && !updates.employee_count) updates.employee_count = String(parsed.employee_count);
          if (parsed.revenue_range && !updates.revenue_range) updates.revenue_range = String(parsed.revenue_range);
          if (parsed.company_segment && !client.segment && !updates.segment) updates.segment = String(parsed.company_segment);
          if (parsed.website && !updates.website) updates.website = String(parsed.website);
          // Save full result for future reference
          updates.ai_enrichment_data = { ...parsed, enriched_at: new Date().toISOString() };
          perplexityOk = true;
        } catch {
          console.error("Failed to parse Perplexity response for", client.company);
        }
      } else {
        const errorText = await perplexityRes.text();
        if (perplexityRes.status === 429) {
          console.warn("Perplexity rate limit for", client.company, errorText);
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    } catch (e) {
      console.error("Perplexity error for", client.company, e);
    }
  }

  return { updates, cnpjaOk, perplexityOk };
}
