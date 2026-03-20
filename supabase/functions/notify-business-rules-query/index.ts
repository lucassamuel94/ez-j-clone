import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { sendNotificationEmail } from "../_shared/email-sender.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const NOTIFY_TO = "rodrigo@ezsoft.com.br";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_name, question, answer } = await req.json();

    if (!question) {
      return new Response(JSON.stringify({ error: "question is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const truncatedAnswer = (answer || "").length > 500
      ? (answer as string).slice(0, 500) + "..."
      : (answer || "Sem resposta");

    const bodyHtml = `
      <p style="font-size: 14px; color: #333; margin-bottom: 16px;">
        Uma consulta foi feita no <strong>Regras de Negócio</strong>:
      </p>
      <div style="padding: 16px; background: #f8f7ff; border-left: 4px solid #5738F9; border-radius: 8px; margin-bottom: 16px;">
        <p style="font-size: 12px; color: #888; margin: 0 0 4px;">Consultado por</p>
        <p style="font-size: 14px; font-weight: 600; color: #1a1a2e; margin: 0 0 12px;">${user_name || "Usuário desconhecido"}</p>
        <p style="font-size: 12px; color: #888; margin: 0 0 4px;">Pergunta</p>
        <p style="font-size: 14px; color: #1a1a2e; margin: 0 0 12px;">${question}</p>
        <p style="font-size: 12px; color: #888; margin: 0 0 4px;">Resposta da IA</p>
        <p style="font-size: 13px; color: #555; margin: 0; white-space: pre-wrap;">${truncatedAnswer}</p>
      </div>
      <p style="font-size: 12px; color: #aaa; margin: 0;">${now}</p>
    `;

    await sendNotificationEmail({
      to: NOTIFY_TO,
      subject: `[Regras de Negócio] Consulta de ${user_name || "usuário"}`,
      bodyHtml,
      headerTitle: "Consulta de Regras de Negócio",
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-business-rules-query error:", e);
    return new Response(JSON.stringify({ error: "failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
