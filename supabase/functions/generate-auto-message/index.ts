import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// All available variables grouped by module context
const ALL_VARIABLES = `
Variáveis disponíveis (use no formato {{variavel}}):
— Lead / SDR: {{lead_name}}, {{empresa}}, {{cnpj}}, {{sdr}}, {{fonte}}, {{telefone}}, {{email}}, {{status}}
— Métricas SDR: {{total_agendado}}, {{total_realizado}}, {{total_sqo}}, {{total_sql_hoje}}, {{total_sqo_hoje}}, {{total_agendamentos_hoje}}, {{total_agendamentos_mes}}, {{meta_agendamentos}}, {{percentual_agendamentos}}, {{performance_sdrs}}
— Oportunidade / Closer: {{closer}}, {{valor}}, {{estagio}}, {{motivo_perda}}, {{link_negociacao}}
— Métricas Closer: {{total_vendas}}, {{valor_vendas}}, {{total_propostas}}, {{meta_vendas}}, {{percentual_vendas}}
— Projeto: {{projeto}}, {{fase}}, {{status_fase}}, {{data_inicio}}, {{prazo}}, {{dias_em_fase}}, {{link_projeto}}
— Equipe Projeto: {{head}}, {{ux_po}}, {{dev}}, {{treinamento}}
— Tempo: {{horario}}, {{dias_uteis_restantes}}, {{dias_uteis_decorridos}}
— Website: {{website}}
`;

const SYSTEM_PROMPT = `Você é um especialista em comunicação corporativa B2B e automação de mensagens para um CRM de vendas.

Regras obrigatórias:
- Responda APENAS com o texto da mensagem, sem explicações, comentários ou introduções.
- Respeite FIELMENTE as instruções do usuário (prompt). Se o usuário pediu variáveis específicas, use EXATAMENTE essas variáveis.
- NÃO invente dados. Se uma variável foi fornecida, use-a no formato {{variavel}}. NÃO substitua por valores fictícios.
- NÃO adicione NENHUMA variável que o usuário NÃO mencionou explicitamente no prompt. Use SOMENTE as variáveis que o usuário listou. Se o usuário listou 3 variáveis, a mensagem deve conter exatamente essas 3 variáveis e nenhuma outra.
- NÃO adicione seções, métricas ou informações extras além do que o usuário pediu. Siga a estrutura e o escopo do prompt à risca.
- Use APENAS formatação do WhatsApp:
  - Negrito: *texto* (um asterisco de cada lado)
  - Itálico: _texto_ (um underscore de cada lado)
  - Tachado: ~texto~ (um til de cada lado)
  - NÃO use **texto**, __texto__, ## cabeçalhos, [links](url) ou qualquer Markdown.
- Use emojis com moderação para dar personalidade.
- Mantenha tom profissional mas acessível.

${ALL_VARIABLES}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, context, current_body } = await req.json();

    if (!action) {
      return new Response(
        JSON.stringify({ error: "Ação é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let userPrompt: string;

    switch (action) {
      case "generate":
        // Use the user's prompt DIRECTLY as the main instruction
        userPrompt = context || "Crie uma mensagem automática profissional para uma notificação geral de CRM de vendas.";
        break;
      case "improve":
        userPrompt = `Melhore a seguinte mensagem automática, tornando-a mais profissional, clara e persuasiva. Mantenha as variáveis dinâmicas existentes:\n\n${current_body}`;
        break;
      case "shorten":
        userPrompt = `Encurte a seguinte mensagem automática, mantendo a essência e as variáveis dinâmicas:\n\n${current_body}`;
        break;
      case "formal":
        userPrompt = `Reescreva a seguinte mensagem automática em tom mais formal e corporativo. Mantenha as variáveis dinâmicas:\n\n${current_body}`;
        break;
      case "friendly":
        userPrompt = `Reescreva a seguinte mensagem automática em tom mais amigável e acolhedor, mas profissional. Mantenha as variáveis dinâmicas:\n\n${current_body}`;
        break;
      case "persuasive":
        userPrompt = `Reescreva a seguinte mensagem automática de forma mais persuasiva, usando técnicas de copywriting. Mantenha as variáveis dinâmicas:\n\n${current_body}`;
        break;
      default:
        return new Response(
          JSON.stringify({ error: "Ação inválida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Erro ao processar com IA");
    }

    const data = await response.json();
    const generatedText = data.choices?.[0]?.message?.content;

    if (!generatedText) {
      throw new Error("Resposta vazia da IA");
    }

    return new Response(
      JSON.stringify({ text: generatedText.trim() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-auto-message error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
