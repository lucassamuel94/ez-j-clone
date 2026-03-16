import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EZCHAT_FLOW_BASE = "https://api.ezchatbot.ai/run/a13ae890-a753-4d54-802a-ab1db27d906e/";

/** Convert Markdown formatting to WhatsApp-compatible formatting */
function markdownToWhatsApp(text: string): string {
  return text
    // Bold: **text** or __text__ → *text*
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/__(.+?)__/g, '*$1*')
    // Italic: _text_ stays _text_ (already WhatsApp compatible)
    // Strikethrough: ~~text~~ → ~text~
    .replace(/~~(.+?)~~/g, '~$1~')
    // Headers: remove # prefixes
    .replace(/^#{1,6}\s+/gm, '')
    // Inline code: `text` → unchanged (no WA equivalent, just remove backticks)
    .replace(/`([^`]+)`/g, '$1')
    // Code blocks: ```text``` → just text
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/```\w*\n?/g, '').trim())
    // Links: [text](url) → text (url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    // Clean double %% → single %
    .replace(/%%/g, '%');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, sender } = await req.json();

    if (!sender) {
      return new Response(
        JSON.stringify({ error: "sender é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiToken = Deno.env.get("EZCHAT_API_TOKEN");
    if (!apiToken) {
      throw new Error("EZCHAT_API_TOKEN is not configured");
    }

    const sanitizedMessage = message ? markdownToWhatsApp(message) : undefined;

    const url = new URL(EZCHAT_FLOW_BASE);
    url.searchParams.set("sender", sender);
    url.searchParams.set("token", apiToken);
    if (sanitizedMessage) {
      url.searchParams.set("message", sanitizedMessage);
    }

    console.log(`Calling EZ Chat: ${url.toString().replace(apiToken, '***')}`);

    const maxRetries = 3;
    let lastError = "";

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url.toString(), { method: "GET" });

        if (response.ok) {
          const data = await response.text();
          console.log("WhatsApp message sent successfully:", data);
          return new Response(
            JSON.stringify({ success: true, data }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const status = response.status;
        if (status === 429 || status >= 500) {
          lastError = `HTTP ${status}`;
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
            continue;
          }
        }

        lastError = `HTTP ${status}: ${await response.text()}`;
        break;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error.message : String(error);
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
          continue;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: lastError }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("send-whatsapp error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
