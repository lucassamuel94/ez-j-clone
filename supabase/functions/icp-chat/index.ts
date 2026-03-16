import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Validate user via getUser instead of getClaims
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { question, analysisId, history } = await req.json();
    if (!question) {
      return new Response(JSON.stringify({ error: "Question is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch the latest ICP analysis statistics
    let analysisStats: any = null;
    if (analysisId) {
      const { data } = await supabase.from("icp_analyses").select("statistics, clients_analyzed, ai_analysis").eq("id", analysisId).single();
      analysisStats = data;
    } else {
      const { data } = await supabase.from("icp_analyses").select("statistics, clients_analyzed, ai_analysis").order("created_at", { ascending: false }).limit(1).single();
      analysisStats = data;
    }

    // Fetch active clients data for context (limited fields)
    const { data: clients } = await supabase
      .from("active_clients")
      .select("company, nome_fantasia, cnae_fiscal_descricao, cnaes_secundarios, porte, employee_count, revenue_range, city, state, segment")
      .limit(500);

    // Build context
    const statsContext = analysisStats?.statistics
      ? `
ESTATÍSTICAS DA ANÁLISE ICP (${analysisStats.clients_analyzed || 0} clientes analisados):
${JSON.stringify(analysisStats.statistics, null, 2)}

ANÁLISE DESCRITIVA PRÉVIA:
${analysisStats.ai_analysis || "Não disponível"}
`
      : "Nenhuma análise ICP disponível ainda.";

    const clientsContext = clients && clients.length > 0
      ? `
DADOS DOS CLIENTES ATIVOS (${clients.length} registros):
${clients.map((c: any) => `- ${c.company}${c.nome_fantasia ? ` (${c.nome_fantasia})` : ""} | CNAE: ${c.cnae_fiscal_descricao || "N/A"} | Sub-CNAEs: ${c.cnaes_secundarios || "N/A"} | Porte: ${c.porte || "N/A"} | Funcionários: ${c.employee_count || "N/A"} | Faturamento: ${c.revenue_range || "N/A"} | ${c.city || ""}/${c.state || ""} | Segmento: ${c.segment || "N/A"}`).join("\n")}
`
      : "";

    const systemPrompt = `Você é um analista de ICP (Perfil de Cliente Ideal) direto e objetivo.

CONTEXTO: Você tem acesso aos dados reais dos clientes ativos da empresa.

FORMATO OBRIGATÓRIO DAS RESPOSTAS:
- Máximo 300 palavras por resposta
- Comece SEMPRE com a resposta direta (sem introdução, sem "Ótima pergunta")
- Use listas numeradas ou com bullets para dados
- Quando citar CNAEs, use o formato: **Código - Descrição** (X clientes)
- Termine com 1 ação prática que o SDR pode executar agora
- NÃO use frases genéricas como "é importante considerar" ou "vale ressaltar"
- NÃO repita a pergunta do usuário
- Responda em português brasileiro

${statsContext}

${clientsContext}`;

    // Build messages array with history
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    if (history && Array.isArray(history)) {
      for (const msg of history) {
        if (msg.role === 'error') continue; // Skip error messages from history
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: "user", content: question });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("icp-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
