import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { input, existing_names } = await req.json();

    if (!input || typeof input !== "string") {
      return new Response(
        JSON.stringify({ error: "input is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const existingList = (existing_names || []).join(", ");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a system integration name normalizer. Given a user input that describes a software system or integration, determine if it matches any existing system name from the catalog. If it does, return the existing canonical name. If it doesn't match any existing system, return the properly formatted/capitalized canonical name for the system.

Rules:
- Match variations like "asaas boleto", "asaas - segunda via", "Asaas" all to "Asaas"
- Match "rd station", "RD", "rdstation" all to "RD Station"  
- Match "hubspot", "hub spot", "HubSpot CRM" all to "HubSpot"
- Always return the most commonly used official name
- If the input is clearly a new system not in the catalog, return its proper name with correct capitalization
- Only return the system name, nothing else`,
          },
          {
            role: "user",
            content: `Existing catalog: [${existingList}]\n\nUser input: "${input}"`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "normalize_integration",
              description: "Return the normalized integration name and whether it matches an existing catalog entry.",
              parameters: {
                type: "object",
                properties: {
                  normalized_name: {
                    type: "string",
                    description: "The canonical/normalized name of the integration system",
                  },
                  is_existing: {
                    type: "boolean",
                    description: "Whether this matches an existing name in the catalog",
                  },
                  confidence: {
                    type: "number",
                    description: "Confidence score from 0 to 1",
                  },
                },
                required: ["normalized_name", "is_existing", "confidence"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "normalize_integration" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: return input as-is
    return new Response(
      JSON.stringify({ normalized_name: input, is_existing: false, confidence: 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("normalize-integration error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
