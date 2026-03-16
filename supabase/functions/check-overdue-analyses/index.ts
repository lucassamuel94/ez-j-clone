import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find overdue analyses
    const { data: overdue, error } = await supabase
      .from("api_analysis_requests")
      .select("id, title, assigned_to, deadline_at")
      .in("status", ["pending", "in_progress"])
      .lt("deadline_at", new Date().toISOString())
      .not("assigned_to", "is", null);

    if (error) throw error;

    let notified = 0;

    for (const item of overdue || []) {
      // Check if a notification for this item was already sent today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", item.assigned_to)
        .eq("type", "api_analysis")
        .ilike("message", `%${item.id}%`)
        .gte("created_at", today.toISOString())
        .limit(1);

      if (existing && existing.length > 0) continue;

      await supabase.from("notifications").insert({
        user_id: item.assigned_to,
        title: "Análise de API atrasada",
        message: `A análise "${item.title}" ultrapassou o prazo de 48h. ID: ${item.id}`,
        type: "api_analysis",
        link: `/api-analysis?id=${item.id}`,
      });
      notified++;
    }

    return new Response(JSON.stringify({ overdue: overdue?.length || 0, notified }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
