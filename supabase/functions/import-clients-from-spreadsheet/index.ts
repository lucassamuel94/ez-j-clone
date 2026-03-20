import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FALLBACK_OWNER = "caaa1be1-c61c-4219-af88-a7acfa54a7a2"; // Rodrigo Schumann

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await userClient.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin check
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if (!roles?.some((r: any) => ["admin", "manager"].includes(r.role))) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { clients } = await req.json();
    if (!clients || !Array.isArray(clients) || clients.length === 0) {
      return new Response(JSON.stringify({ error: "No clients provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let created = 0;
    let updated = 0;
    let closerAssigned = 0;
    let errors = 0;

    for (const c of clients) {
      const cnpj = (c.cnpj || "").replace(/\D/g, "");
      if (!cnpj || cnpj.length < 11) { errors++; continue; }

      try {
        // Check if account exists by CNPJ
        const { data: existing } = await supabase
          .from("accounts")
          .select("id, cnpj")
          .or(`cnpj.eq.${cnpj},cnpj.eq.${cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}`)
          .limit(1)
          .maybeSingle();

        if (existing) {
          // Update existing: enrich + set lifecycle
          await supabase.from("accounts").update({
            razao_social: c.razao_social || undefined,
            email: c.email || undefined,
            phone: c.phone || undefined,
            logradouro: c.logradouro || undefined,
            numero: c.numero || undefined,
            complemento: c.complemento || undefined,
            bairro: c.bairro || undefined,
            city: c.city || undefined,
            cep: c.cep || undefined,
            state: c.state || undefined,
            lifecycle_stage: "client",
            updated_at: new Date().toISOString(),
          }).eq("id", existing.id);

          // Try to find closer from won opportunity
          const { data: wonOpp } = await supabase
            .from("opportunities")
            .select("assigned_to_user_id")
            .eq("account_id", existing.id)
            .eq("stage", "Ganho")
            .order("won_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (wonOpp?.assigned_to_user_id) {
            await supabase.from("accounts")
              .update({ account_owner_id: wonOpp.assigned_to_user_id })
              .eq("id", existing.id);
            closerAssigned++;
          } else {
            // Fallback owner if none set
            const { data: curr } = await supabase.from("accounts").select("account_owner_id").eq("id", existing.id).single();
            if (!curr?.account_owner_id) {
              await supabase.from("accounts")
                .update({ account_owner_id: FALLBACK_OWNER })
                .eq("id", existing.id);
            }
          }

          updated++;
        } else {
          // Insert new account
          const { error: insertErr } = await supabase.from("accounts").insert({
            cnpj,
            company_name: c.razao_social || c.company_name || "Sem nome",
            razao_social: c.razao_social || null,
            email: c.email || null,
            phone: c.phone || null,
            logradouro: c.logradouro || null,
            numero: c.numero || null,
            complemento: c.complemento || null,
            bairro: c.bairro || null,
            city: c.city || null,
            cep: c.cep || null,
            state: c.state || null,
            lifecycle_stage: "client",
            status: "active",
            account_owner_id: FALLBACK_OWNER,
          });

          if (insertErr) {
            console.error("Insert error:", insertErr.message, cnpj);
            errors++;
          } else {
            created++;
          }
        }
      } catch (e) {
        console.error("Error processing:", cnpj, e);
        errors++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total: clients.length,
      created,
      updated,
      closerAssigned,
      errors,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("import-clients error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
