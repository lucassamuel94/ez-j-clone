import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch ALL enriched clients using pagination to bypass 1000-row limit
    const PAGE_SIZE = 1000;
    let allClients: any[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: page, error: pageError } = await supabase
        .from("active_clients")
        .select("*")
        .not("enriched_at", "is", null)
        .range(from, from + PAGE_SIZE - 1);

      if (pageError) throw pageError;
      const rows = page || [];
      allClients = [...allClients, ...rows];
      hasMore = rows.length === PAGE_SIZE;
      from += PAGE_SIZE;
    }

    const clients = allClients;

    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhum cliente enriquecido encontrado. Enriqueça os clientes primeiro." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Aggregate statistics
    const countBy = (arr: any[], key: string) => {
      const counts: Record<string, number> = {};
      for (const item of arr) {
        const val = item[key];
        if (val) counts[val] = (counts[val] || 0) + 1;
      }
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({ name, value }));
    };

    const top_cnaes = countBy(clients, "cnae_fiscal_descricao").slice(0, 10);
    const porte_distribution = countBy(clients, "porte");
    const top_locations = countBy(
      clients.map((c) => ({
        location: c.city && c.state ? `${c.city}/${c.state}` : c.state || c.city || null,
      })).filter((c) => c.location),
      "location"
    ).slice(0, 10);
    const revenue_distribution = countBy(clients, "revenue_range");
    const employee_distribution = countBy(clients, "employee_count");

    // Aggregate secondary CNAEs
    const subCnaeCounts: Record<string, number> = {};
    for (const client of clients) {
      const raw = client.cnaes_secundarios;
      if (!raw || typeof raw !== "string") continue;
      let items: string[] = [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          items = parsed.map((p: any) => typeof p === "string" ? p : (p.descricao || p.text || "")).filter(Boolean);
        }
      } catch {
        items = raw.split(",").map((s: string) => s.trim()).filter(Boolean);
      }
      for (const item of items) {
        subCnaeCounts[item] = (subCnaeCounts[item] || 0) + 1;
      }
    }
    const top_sub_cnaes = Object.entries(subCnaeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name, value]) => ({ name, value }));

    const statistics = {
      top_cnaes,
      top_sub_cnaes,
      porte_distribution,
      top_locations,
      revenue_distribution,
      employee_distribution,
    };

    // Generate AI analysis using Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let aiAnalysis = "";

    if (LOVABLE_API_KEY) {
      const prompt = `Você é um analista de perfil de cliente ideal (ICP) para uma empresa de tecnologia brasileira.

Analise os seguintes dados agregados de ${clients.length} clientes ativos:

**Top 10 CNAEs (atividades econômicas):**
${top_cnaes.map((c) => `- ${c.name}: ${c.value} empresas`).join("\n")}

**Top 15 CNAEs Secundários (sub-atividades):**
${top_sub_cnaes.map((c) => `- ${c.name}: ${c.value} empresas`).join("\n")}

**Distribuição por Porte:**
${porte_distribution.map((c) => `- ${c.name}: ${c.value} empresas`).join("\n")}

**Top Cidades/Estados:**
${top_locations.map((c) => `- ${c.name}: ${c.value} empresas`).join("\n")}

**Faixa de Faturamento:**
${revenue_distribution.map((c) => `- ${c.name}: ${c.value} empresas`).join("\n")}

**Faixa de Funcionários:**
${employee_distribution.map((c) => `- ${c.name}: ${c.value} empresas`).join("\n")}

Com base nesses dados, gere um relatório completo contendo:
1. **Perfil Ideal de Cliente (ICP)**: Descreva o perfil ideal com base nos padrões encontrados
2. **Padrões Identificados**: Quais são os padrões mais relevantes na base de clientes
3. **Recomendações para SDRs**: Dicas práticas para os SDRs na prospecção
4. **CNAEs e Segmentos Prioritários**: Quais setores devem ser priorizados
5. **Insights sobre Porte e Faturamento**: O que os dados de porte e faturamento revelam

Escreva em português do Brasil, de forma clara e objetiva.`;

      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: "Você é um analista de ICP (Perfil de Cliente Ideal). Responda em português do Brasil." },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          aiAnalysis = aiData.choices?.[0]?.message?.content || "";
        } else if (aiRes.status === 429) {
          console.warn("AI rate limited, saving analysis without AI text");
        } else if (aiRes.status === 402) {
          console.warn("AI credits insufficient, saving analysis without AI text");
        } else {
          const errText = await aiRes.text();
          console.error("AI gateway error:", aiRes.status, errText);
        }
      } catch (e) {
        console.error("AI gateway error:", e);
      }
    } else {
      console.warn("LOVABLE_API_KEY not configured, skipping AI analysis");
    }

    // Get user from auth header
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    let userId: string | null = null;
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // Save analysis
    const { error: insertError } = await supabase.from("icp_analyses").insert({
      created_by: userId,
      statistics,
      ai_analysis: aiAnalysis || null,
      clients_analyzed: clients.length,
    });

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ success: true, statistics, ai_analysis: aiAnalysis, clients_analyzed: clients.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("analyze-client-profile error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
