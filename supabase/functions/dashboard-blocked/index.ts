import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

function periodStart(period: string): Date {
  const now = new Date();
  if (period === "week") return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  if (period === "quarter") return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let period = url.searchParams.get("period") || "month";

    // Also accept body JSON (from supabase.functions.invoke)
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.period) period = body.period;
      } catch { /* ignore */ }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const from = periodStart(period);

    // 1. Fetch paused projects
    const { data: pausedProjects } = await (admin.from("projects") as any)
      .select("id, company, project_type, overall_status, created_at, responsible_user_id")
      .eq("overall_status", "em_pausa")
      .limit(500);

    // 2. Fetch cancelled projects in period
    const { data: cancelledProjects } = await (admin.from("projects") as any)
      .select("id, company, project_type, overall_status, created_at, responsible_user_id")
      .eq("overall_status", "cancelado")
      .limit(500);

    const allIds = [
      ...(pausedProjects || []).map((p: any) => p.id),
      ...(cancelledProjects || []).map((p: any) => p.id),
    ];

    // 3. Get history for these projects
    let historyMap: Record<string, any[]> = {};
    if (allIds.length > 0) {
      const { data: history } = await (admin.from("project_status_history") as any)
        .select("project_id, status, changed_at, reason")
        .in("project_id", allIds)
        .order("changed_at", { ascending: false })
        .limit(5000);

      for (const h of history || []) {
        if (!historyMap[h.project_id]) historyMap[h.project_id] = [];
        historyMap[h.project_id].push(h);
      }
    }

    // 4. Get responsible names
    const responsibleIds = [
      ...(pausedProjects || []).map((p: any) => p.responsible_user_id),
      ...(cancelledProjects || []).map((p: any) => p.responsible_user_id),
    ].filter(Boolean);

    let profileMap: Record<string, string> = {};
    if (responsibleIds.length > 0) {
      const { data: profiles } = await (admin.from("profiles") as any)
        .select("id, name")
        .in("id", [...new Set(responsibleIds)])
        .limit(200);
      for (const p of profiles || []) {
        profileMap[p.id] = p.name || "—";
      }
    }

    // 5. Build paused list
    const paused = (pausedProjects || []).map((p: any) => {
      const hist = historyMap[p.id] || [];
      // Find last em_pausa entry
      const lastPause = hist.find((h: any) => h.status === "em_pausa");
      const pausedSince = lastPause?.changed_at || p.created_at;
      const agingDays = daysBetween(new Date(pausedSince), now);
      const reason = lastPause?.reason || null;
      const action = agingDays > 15 ? "escalar" : agingDays > 7 ? "follow_up" : "monitorar";

      return {
        id: p.id,
        name: p.company,
        client: p.company,
        reason,
        responsible: profileMap[p.responsible_user_id] || "—",
        paused_since: pausedSince,
        aging_days: agingDays,
        action,
      };
    }).sort((a: any, b: any) => b.aging_days - a.aging_days);

    // 6. Build cancelled list
    const cancelled = (cancelledProjects || []).map((p: any) => {
      const hist = historyMap[p.id] || [];
      const lastCancel = hist.find((h: any) => h.status === "cancelado");
      return {
        id: p.id,
        name: p.company,
        client: p.company,
        reason: lastCancel?.reason || null,
        cancelled_at: lastCancel?.changed_at || p.created_at,
      };
    });

    // 7. Reason summaries
    const buildSummary = (items: any[], field = "reason") => {
      const counts: Record<string, number> = {};
      for (const item of items) {
        const r = item[field] || "Sem motivo";
        counts[r] = (counts[r] || 0) + 1;
      }
      const total = items.length || 1;
      return Object.entries(counts)
        .map(([reason, count]) => ({ reason, count, pct: Math.round((count / total) * 100) }))
        .sort((a, b) => b.count - a.count);
    };

    const paused_reasons_summary = buildSummary(paused);
    const cancelled_reasons_summary = buildSummary(cancelled);

    // 8. History 6 months — all pauses and cancellations
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const { data: allHistory6m } = await (admin.from("project_status_history") as any)
      .select("status, changed_at")
      .in("status", ["em_pausa", "cancelado"])
      .gte("changed_at", sixMonthsAgo.toISOString())
      .order("changed_at", { ascending: true })
      .limit(5000);

    const monthBuckets: Record<string, { paused_count: number; cancelled_count: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthLabel(d);
      monthBuckets[key] = { paused_count: 0, cancelled_count: 0 };
    }

    for (const h of allHistory6m || []) {
      const key = monthLabel(new Date(h.changed_at));
      if (monthBuckets[key]) {
        if (h.status === "em_pausa") monthBuckets[key].paused_count++;
        else if (h.status === "cancelado") monthBuckets[key].cancelled_count++;
      }
    }

    const history_6m = Object.entries(monthBuckets).map(([month, v]) => ({
      month,
      ...v,
    }));

    return new Response(
      JSON.stringify({ paused, cancelled, paused_reasons_summary, cancelled_reasons_summary, history_6m }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
