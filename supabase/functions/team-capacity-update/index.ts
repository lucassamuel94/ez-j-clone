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
    const { team_id, month, capacity_hours, headcount } = await req.json();

    if (!team_id || !month) {
      return new Response(JSON.stringify({ error: "team_id and month are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const upsertData: Record<string, unknown> = { team_id, month };
    if (capacity_hours !== undefined) upsertData.capacity_hours = capacity_hours;
    if (headcount !== undefined) upsertData.headcount = headcount;
    upsertData.updated_at = new Date().toISOString();

    const { data, error } = await (admin.from("team_capacity") as any)
      .upsert(upsertData, { onConflict: "team_id,month" })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
