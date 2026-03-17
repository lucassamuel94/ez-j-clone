import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STAGE_MAP: Record<string, string> = {
  Acionar: "requested",
  "Em contato": "requested",
  "Reunião agendada": "verified",
  "Aguardando retorno": "pending",
  "Enviar Pós Venda": "active",
  "Não quer agora": "lost",
};

function periodRange(period: string): { start: string; end: string } {
  const now = new Date();
  let start: Date;
  if (period === "week") {
    start = new Date(now);
    start.setDate(now.getDate() - 7);
  } else if (period === "quarter") {
    start = new Date(now);
    start.setMonth(now.getMonth() - 3);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return { start: start.toISOString(), end: now.toISOString() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const period = url.searchParams.get("period") || "month";
    const { start, end } = periodRange(period);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey) as any;

    // 1. Fetch deals created in period
    const { data: deals } = await admin
      .from("api_oficial_deals")
      .select("id, stage, lead_company, lead_name, created_at, updated_at, lost_reason")
      .gte("created_at", start)
      .lte("created_at", end)
      .limit(5000);

    const rows = (deals || []) as any[];

    // 2. Count funnel stages
    let requested = 0, verified = 0, pending = 0, active = 0;
    for (const d of rows) {
      const mapped = STAGE_MAP[d.stage] || "requested";
      if (mapped === "requested") requested++;
      else if (mapped === "verified") { requested++; verified++; }
      else if (mapped === "pending") { requested++; verified++; pending++; }
      else if (mapped === "active") { requested++; verified++; active++; }
      // lost doesn't count toward funnel progression
    }

    const conversion_rate = requested > 0 ? Math.round((active / requested) * 100) : 0;

    // 3. Avg days to activate — deals that reached "Enviar Pós Venda"
    const activatedDeals = rows.filter((d: any) => d.stage === "Enviar Pós Venda");
    let avg_days_to_activate = 0;
    if (activatedDeals.length > 0) {
      const totalDays = activatedDeals.reduce((sum: number, d: any) => {
        const created = new Date(d.created_at).getTime();
        const updated = new Date(d.updated_at).getTime();
        return sum + (updated - created) / (1000 * 60 * 60 * 24);
      }, 0);
      avg_days_to_activate = Math.round((totalDays / activatedDeals.length) * 10) / 10;
    }

    // 4. Blocked reasons from "Não quer agora"
    const lostDeals = rows.filter((d: any) => d.stage === "Não quer agora");
    const reasonMap: Record<string, number> = {};
    for (const d of lostDeals) {
      const reason = (d as any).lost_reason || "Sem motivo informado";
      reasonMap[reason] = (reasonMap[reason] || 0) + 1;
    }
    const totalLost = lostDeals.length || 1;
    const blocked_reasons = Object.entries(reasonMap)
      .map(([reason, count]) => ({
        reason,
        count,
        pct: Math.round((count / totalLost) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    // 5. Awaiting activation (pending) — all time, ordered oldest first
    const { data: awaitingRaw } = await admin
      .from("api_oficial_deals")
      .select("id, lead_company, lead_name, created_at, updated_at, lost_reason")
      .eq("stage", "Aguardando retorno")
      .order("created_at", { ascending: true })
      .limit(100);

    const now = new Date();
    const awaiting = ((awaitingRaw || []) as any[]).map((d: any) => {
      const createdDate = new Date(d.created_at);
      const waitingDays = Math.round((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: d.id,
        project_name: d.lead_company || d.lead_name || "—",
        client: d.lead_name || "—",
        verified_at: d.created_at,
        waiting_days: waitingDays,
        blocked_reason: d.lost_reason || null,
      };
    });

    // 6. History 6 months — avg days to activate per month
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: histDeals } = await admin
      .from("api_oficial_deals")
      .select("created_at, updated_at, stage")
      .eq("stage", "Enviar Pós Venda")
      .gte("updated_at", sixMonthsAgo.toISOString())
      .limit(5000);

    const monthBuckets: Record<string, { total: number; count: number }> = {};
    for (const d of (histDeals || []) as any[]) {
      const created = new Date(d.created_at);
      const updated = new Date(d.updated_at);
      const days = (updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      const key = `${updated.getFullYear()}-${String(updated.getMonth() + 1).padStart(2, "0")}`;
      if (!monthBuckets[key]) monthBuckets[key] = { total: 0, count: 0 };
      monthBuckets[key].total += days;
      monthBuckets[key].count++;
    }

    const history_6m = Object.entries(monthBuckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, { total, count }]) => ({
        month,
        avg_days: Math.round((total / count) * 10) / 10,
      }));

    const result = {
      funnel: { requested, verified, pending, active, conversion_rate },
      avg_days_to_activate,
      blocked_reasons,
      awaiting,
      history_6m,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
