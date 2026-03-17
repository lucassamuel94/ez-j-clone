import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin
    const { data: isAdmin } = await anonClient.rpc("is_admin", { _user_id: user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run !== false; // default true
    const batchSize = Math.min(Math.max(Number(body.batch_size) || 20, 1), 20);
    const offset = body.offset || 0;

    // Service role client for actual operations
    const db = createClient(supabaseUrl, serviceRoleKey);

    // Find duplicate groups
    const { data: groups, error: groupError } = await db.rpc("get_duplicate_lead_groups" as any);

    if (groupError) {
      // Fallback: use raw SQL via a direct query approach
      // We'll query leads directly and group in JS
      const { data: allLeads, error: leadsError } = await db
        .from("leads")
        .select("id, company, last_contact_at, updated_at, created_at, account_id, cnpj, email, phone, website, company_segment, city, state, whatsapp, phone_2, employee_count, revenue_range, nome_fantasia, razao_social, porte, cnae_fiscal, cnae_fiscal_descricao, cep, logradouro, bairro, numero, complemento, situacao_cadastral, cnaes_secundarios, data_inicio_atividade, qsa, capital_social")
        .neq("status", "Descartado")
        .order("created_at", { ascending: false });

      if (leadsError) {
        return new Response(JSON.stringify({ error: leadsError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Group by lower(trim(company))
      const groupMap = new Map<string, typeof allLeads>();
      for (const lead of allLeads || []) {
        const key = (lead.company || "").trim().toLowerCase();
        if (!key) continue;
        if (!groupMap.has(key)) groupMap.set(key, []);
        groupMap.get(key)!.push(lead);
      }

      // Filter to only duplicates, sort each group
      const duplicateGroups: { comp: string; leads: any[] }[] = [];
      for (const [comp, leads] of groupMap) {
        if (leads.length < 2) continue;
        leads.sort((a: any, b: any) => {
          const dateA = new Date(a.last_contact_at || a.updated_at || a.created_at).getTime();
          const dateB = new Date(b.last_contact_at || b.updated_at || b.created_at).getTime();
          return dateB - dateA;
        });
        duplicateGroups.push({ comp, leads });
      }

      const totalGroups = duplicateGroups.length;
      const totalLeadsToRemove = duplicateGroups.reduce((sum, g) => sum + g.leads.length - 1, 0);

      if (dryRun) {
        return new Response(
          JSON.stringify({
            dry_run: true,
            total_groups: totalGroups,
            total_leads_to_remove: totalLeadsToRemove,
            sample_groups: duplicateGroups.slice(0, 10).map((g) => ({
              company: g.comp,
              keep_id: g.leads[0].id,
              keep_company: g.leads[0].company,
              remove_count: g.leads.length - 1,
              remove_ids: g.leads.slice(1).map((l: any) => l.id),
            })),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Execute mode: process in batches
      const batch = duplicateGroups.slice(offset, offset + batchSize);
      const report = {
        dry_run: false,
        total_groups: totalGroups,
        batch_offset: offset,
        batch_size: batch.length,
        has_more: offset + batchSize < totalGroups,
        next_offset: offset + batchSize,
        groups_processed: 0,
        leads_removed: 0,
        migrations: {} as Record<string, number>,
        errors: [] as string[],
      };

      const DEPENDENT_TABLES = [
        "opportunities",
        "lead_notes",
        "lead_contacts",
        "interactions",
        "lead_cadences",
        "meetings",
        "call_history",
        "call_analyses",
        "lead_activity_logs",
        "lead_score_history",
        "sent_emails",
        "form_submissions",
        "ai_usage_logs",
        "projects",
        "project_tasks",
      ];

      const ENRICHABLE_FIELDS = [
        "cnpj", "email", "phone", "website", "company_segment", "city", "state",
        "whatsapp", "phone_2", "employee_count", "revenue_range", "nome_fantasia",
        "razao_social", "porte", "cnae_fiscal", "cnae_fiscal_descricao", "cep",
        "logradouro", "bairro", "numero", "complemento", "situacao_cadastral",
        "cnaes_secundarios", "data_inicio_atividade", "qsa", "capital_social",
      ];

      for (const group of batch) {
        try {
          const keepLead = group.leads[0];
          const deleteIds = group.leads.slice(1).map((l: any) => l.id);

          // 1. Inherit account_id if keep doesn't have one
          if (!keepLead.account_id) {
            const donorWithAccount = group.leads.slice(1).find((l: any) => l.account_id);
            if (donorWithAccount) {
              await db
                .from("leads")
                .update({ account_id: donorWithAccount.account_id })
                .eq("id", keepLead.id);
            }
          }

          // 2. Enrich keep lead with missing data from duplicates
          const enrichUpdate: Record<string, any> = {};
          for (const field of ENRICHABLE_FIELDS) {
            const keepVal = keepLead[field];
            if (keepVal === null || keepVal === undefined || keepVal === "" || keepVal === 0) {
              for (const donor of group.leads.slice(1)) {
                const donorVal = donor[field];
                if (donorVal !== null && donorVal !== undefined && donorVal !== "" && donorVal !== 0) {
                  enrichUpdate[field] = donorVal;
                  break;
                }
              }
            }
          }
          if (Object.keys(enrichUpdate).length > 0) {
            await db.from("leads").update(enrichUpdate).eq("id", keepLead.id);
          }

          // 3. Migrate dependent tables
          let migrationHadRealError = false;
          for (const table of DEPENDENT_TABLES) {
            const { count, error: migrateError } = await db
              .from(table)
              .update({ lead_id: keepLead.id } as any)
              .in("lead_id", deleteIds)
              .select("id");

            if (migrateError) {
              // Distinguish expected errors (no lead_id column) from real failures
              const isExpected = migrateError.message.includes("does not exist")
                || migrateError.message.includes("column")
                || migrateError.code === "42703";
              if (isExpected) {
                console.log(`Skipping ${table}: ${migrateError.message}`);
              } else {
                migrationHadRealError = true;
                report.errors.push(`Migration failed for ${table} in group "${group.comp}": ${migrateError.message}`);
              }
              continue;
            }
            if (count && count > 0) {
              report.migrations[table] = (report.migrations[table] || 0) + count;
            }
          }

          // 4. Delete duplicate leads (only if all migrations succeeded)
          if (migrationHadRealError) {
            report.errors.push(`Skipping delete for group "${group.comp}": migration errors prevent safe deletion`);
            continue;
          }

          const { error: deleteError } = await db
            .from("leads")
            .delete()
            .in("id", deleteIds);

          if (deleteError) {
            report.errors.push(`Delete error for group "${group.comp}": ${deleteError.message}`);
            continue;
          }

          report.groups_processed++;
          report.leads_removed += deleteIds.length;
        } catch (groupErr: any) {
          report.errors.push(`Error processing "${group.comp}": ${groupErr.message}`);
        }
      }

      return new Response(JSON.stringify(report), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unexpected path" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

