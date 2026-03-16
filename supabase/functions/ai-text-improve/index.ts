import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Fallback prompts if DB is not configured
const fallbackPrompts: Record<string, string> = {
  improve:
    "Você é um especialista em comunicação corporativa B2B. Reescreva o texto a seguir corrigindo gramática, melhorando clareza, fluidez e profissionalismo. Mantenha o mesmo tom e intenção original. Retorne APENAS o texto melhorado, sem explicações.",
  shorten:
    "Você é um especialista em comunicação concisa. Reescreva o texto a seguir de forma mais curta e direta, mantendo a mensagem principal e o tom profissional. Elimine redundâncias e palavras desnecessárias. Retorne APENAS o texto encurtado, sem explicações.",
  lengthen:
    "Você é um especialista em comunicação corporativa B2B. Expanda o texto a seguir adicionando mais detalhes, contexto e argumentos relevantes. Mantenha o tom profissional e a coerência. Retorne APENAS o texto expandido, sem explicações.",
  formal:
    "Você é um especialista em comunicação corporativa. Reescreva o texto a seguir usando linguagem mais formal, profissional e corporativa. Use vocabulário sofisticado e estrutura adequada para comunicação empresarial. Retorne APENAS o texto formalizado, sem explicações.",
  friendly:
    "Você é um especialista em comunicação empática. Reescreva o texto a seguir usando um tom mais amigável, acessível e acolhedor, mas ainda profissional. Use linguagem mais leve e próxima. Retorne APENAS o texto reescrito, sem explicações.",
  persuasive:
    "Você é um especialista em copywriting e vendas B2B. Reescreva o texto a seguir aplicando técnicas de persuasão: gatilhos de urgência, prova social quando cabível, destaque de benefícios claros, e um CTA (call-to-action) forte. Mantenha naturalidade e profissionalismo. Retorne APENAS o texto persuasivo, sem explicações.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, action } = await req.json();

    if (!text || !action) {
      return new Response(
        JSON.stringify({ error: "Texto e ação são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to load prompt config from database
    let systemPrompt: string | null = null;
    let modelName: string | null = null;

    const promptId = `text_${action}`;

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: promptData } = await supabase
        .from("ai_prompts")
        .select("system_prompt, model")
        .eq("id", promptId)
        .single();

      if (promptData) {
        systemPrompt = promptData.system_prompt;
        modelName = promptData.model || null;
      }
    } catch (dbError) {
      console.warn("Could not load prompt from DB, using fallback:", dbError);
    }

    // Fallback to hardcoded prompts
    if (!systemPrompt) {
      systemPrompt = fallbackPrompts[action];
    }

    if (!systemPrompt) {
      return new Response(
        JSON.stringify({ error: "Ação inválida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default model
    if (!modelName) modelName = "google/gemini-2.5-flash";

    let improvedText = "";

    if (modelName.startsWith("claude") || modelName.startsWith("anthropic")) {
      // Anthropic / Claude
      const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
      if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelName,
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: "user", content: text }],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Limite de requisições excedido, tente novamente em instantes." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const errText = await response.text();
        console.error("Anthropic error:", response.status, errText);
        throw new Error("Erro ao processar com IA");
      }

      const data = await response.json();
      improvedText = data.content?.[0]?.text || "";

    } else if (modelName.startsWith("sonar")) {
      // Perplexity
      const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
      if (!PERPLEXITY_API_KEY) throw new Error("PERPLEXITY_API_KEY is not configured");

      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text },
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Limite de requisições excedido, tente novamente em instantes." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const errText = await response.text();
        console.error("Perplexity error:", response.status, errText);
        throw new Error("Erro ao processar com IA");
      }

      const data = await response.json();
      improvedText = data.choices?.[0]?.message?.content || "";

    } else if (modelName.startsWith("gemini") && !modelName.includes("/")) {
      // Gemini direct API
      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
      if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${text}` }] }],
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Limite de requisições excedido, tente novamente em instantes." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const errText = await response.text();
        console.error("Gemini error:", response.status, errText);
        throw new Error("Erro ao processar com IA");
      }

      const data = await response.json();
      improvedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    } else {
      // Fallback: Lovable AI Gateway (covers google/*, openai/*, etc.)
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

      const gwModel = modelName.includes("/") ? modelName : `google/${modelName}`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: gwModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text },
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Limite de requisições excedido, tente novamente em instantes." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos ao workspace." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const errorText = await response.text();
        console.error("AI gateway error:", response.status, errorText);
        throw new Error("Erro ao processar com IA");
      }

      const data = await response.json();
      improvedText = data.choices?.[0]?.message?.content || "";
    }

    if (!improvedText) {
      throw new Error("Resposta vazia da IA");
    }

    return new Response(
      JSON.stringify({ improved_text: improvedText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ai-text-improve error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
