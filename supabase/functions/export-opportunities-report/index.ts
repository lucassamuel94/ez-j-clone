import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const stages = ["Oportunidade Futura", "Oportunidade Fria", "Perdido"];
    const PAGE_SIZE = 1000;
    const allRows: Record<string, string>[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await (admin.from("opportunities") as any)
        .select(`
          stage,
          lead_id,
          assigned_to_user_id,
          leads!inner(razao_social, company, name, phone, phone_2, phone_3, phone_4, whatsapp, email, email_2)
        `)
        .in("stage", stages)
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;
      if (!data || data.length === 0) {
        hasMore = false;
        break;
      }

      for (const row of data) {
        allRows.push(row);
      }
      offset += PAGE_SIZE;
      if (data.length < PAGE_SIZE) hasMore = false;
    }

    // Get closer names
    const closerIds = [...new Set(allRows.map((r: any) => r.assigned_to_user_id).filter(Boolean))];
    const closerMap = new Map<string, string>();
    if (closerIds.length > 0) {
      for (let i = 0; i < closerIds.length; i += 500) {
        const batch = closerIds.slice(i, i + 500);
        const { data: profiles } = await (admin.from("profiles") as any)
          .select("id, name")
          .in("id", batch);
        for (const p of (profiles || [])) {
          closerMap.set(p.id, p.name || "");
        }
      }
    }

    // Build CSV rows (TSV for Excel compatibility)
    const header = ["Razão Social", "Nome do Contato", "Telefone", "Telefone 2", "Telefone 3", "Telefone 4", "WhatsApp", "E-mail", "E-mail 2", "Closer", "Estágio"];
    
    const csvRows = [header.join("\t")];
    for (const row of allRows) {
      const lead = (row as any).leads;
      const cols = [
        (lead?.razao_social || lead?.company || "").replace(/\t/g, " "),
        (lead?.name || "").replace(/\t/g, " "),
        (lead?.phone || "").replace(/\t/g, " "),
        (lead?.phone_2 || "").replace(/\t/g, " "),
        (lead?.phone_3 || "").replace(/\t/g, " "),
        (lead?.phone_4 || "").replace(/\t/g, " "),
        (lead?.whatsapp || "").replace(/\t/g, " "),
        (lead?.email || "").replace(/\t/g, " "),
        (lead?.email_2 || "").replace(/\t/g, " "),
        closerMap.get((row as any).assigned_to_user_id) || "",
        (row as any).stage || "",
      ];
      csvRows.push(cols.join("\t"));
    }

    const csvContent = "\uFEFF" + csvRows.join("\r\n"); // BOM for Excel UTF-8

    return new Response(csvContent, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/tab-separated-values; charset=utf-8",
        "Content-Disposition": `attachment; filename="relatorio_oportunidades_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
