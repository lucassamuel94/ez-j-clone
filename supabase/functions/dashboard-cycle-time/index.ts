import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DONE = new Set(["concluido"]);
const INACTIVE = new Set(["em_pausa", "cancelado"]);

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, (b.getTime() - a.getTime()) / 86_400_000);
}

interface StatusRow {
  project_id: string;
  status: string;
  changed_at: string;
}

function calcCycleTime(history: StatusRow[]) {
  if (!history.length) return null;
  const sorted = [...history].sort(
    (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
  );
  const start = new Date(sorted[0].changed_at);
  let endDate: Date | null = null;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (DONE.has(sorted[i].status)) {
      endDate = new Date(sorted[i].changed_at);
      break;
    }
  }
  if (!endDate) return null;
  const lead = daysBetween(start, endDate);
  let paused = 0;
  let pauseStart: Date | null = null;
  for (const e of sorted) {
    const ts = new Date(e.changed_at);
    if (INACTIVE.has(e.status)) {
      if (!pauseStart) pauseStart = ts;
    } else if (pauseStart) {
      paused += daysBetween(pauseStart, ts);
      pauseStart = null;
    }
  }
  if (pauseStart) paused += daysBetween(pauseStart, endDate);
  return {
    lead_time_days: Math.round(lead * 10) / 10,
    cycle_time_days: Math.round(Math.max(0, lead - paused) * 10) / 10,
    paused_days: Math.round(paused * 10) / 10,
  };
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function periodRange(period: string) {
  const now = new Date();
  let start: Date;
  if (period === "week") {
    start = new Date(now);
    start.setDate(now.getDate() - 7);
  } else if (period === "quarter") {
    const qm = Math.floor(now.getMonth() / 3) * 3;
    start = new Date(now.getFullYear(), qm, 1);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return { start: start.toISOString(), end: now.toISOString() };
}

const TYPE_LABELS: Record<string, string> = {
  venda: "Implantação",
  evolucao: "Evolução",
  api_oficial: "API Oficial",
  migracao: "Migração",
};

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

    // Fetch projects delivered in period
    const { data: projects, error: pErr } = await (admin.from("projects") as any)
      .select("id, project_type, head_user_id, dev_user_id, ux_po_user_id, updated_at")
      .is("deleted_at", null)
      .in("overall_status", ["concluido"])
      .gte("updated_at", start)
      .lte("updated_at", end)
      .limit(5000);

    if (pErr) throw pErr;
    if (!projects?.length) {
      return new Response(
        JSON.stringify({ by_type: [], by_team: [], overall: { lead_time_avg: 0, cycle_time_avg: 0, paused_avg: 0, reopen_rate: 0 } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const projectIds = projects.map((p: any) => p.id);

    // Fetch status history
    const { data: history, error: hErr } = await (admin.from("project_status_history") as any)
      .select("project_id, status, changed_at")
      .in("project_id", projectIds)
      .order("changed_at", { ascending: true })
      .limit(50000);

    if (hErr) throw hErr;

    // Group history by project
    const histMap = new Map<string, StatusRow[]>();
    for (const h of (history || [])) {
      const arr = histMap.get(h.project_id) || [];
      arr.push(h);
      histMap.set(h.project_id, arr);
    }

    // Fetch teams
    const userIds = new Set<string>();
    for (const p of projects) {
      if (p.head_user_id) userIds.add(p.head_user_id);
      if (p.dev_user_id) userIds.add(p.dev_user_id);
      if (p.ux_po_user_id) userIds.add(p.ux_po_user_id);
    }

    let userTeamMap = new Map<string, string>();
    if (userIds.size > 0) {
      const [membersRes, teamsRes] = await Promise.all([
        (admin.from("team_members") as any).select("user_id, team_id").in("user_id", [...userIds]),
        (admin.from("teams") as any).select("id, name"),
      ]);
      const teamNames = new Map<string, string>((teamsRes.data || []).map((t: any) => [String(t.id), String(t.name)]));
      for (const m of (membersRes.data || [])) {
        const mUserId = (m as any).user_id as string;
        if (!userTeamMap.has(mUserId)) {
          userTeamMap.set(mUserId, teamNames.get(String((m as any).team_id)) || "Sem equipe");
        }
      }
    }

    const getTeam = (p: any) => {
      const uid = p.head_user_id || p.dev_user_id || p.ux_po_user_id;
      return uid ? (userTeamMap.get(uid) || "Sem equipe") : "Sem equipe";
    };

    // By type
    const typeGroups: Record<string, any[]> = {};
    for (const p of projects) {
      const label = TYPE_LABELS[p.project_type] || p.project_type;
      (typeGroups[label] ??= []).push(p);
    }
    const by_type = Object.entries(typeGroups).map(([label, group]) => {
      const results = group.map((p: any) => calcCycleTime(histMap.get(p.id) || [])).filter(Boolean);
      return {
        type: label,
        lead_time_avg: avg(results.map((r: any) => r.lead_time_days)),
        cycle_time_avg: avg(results.map((r: any) => r.cycle_time_days)),
        paused_avg: avg(results.map((r: any) => r.paused_days)),
      };
    });

    // By team
    const teamGroups: Record<string, any[]> = {};
    for (const p of projects) {
      const team = getTeam(p);
      (teamGroups[team] ??= []).push(p);
    }
    const by_team = Object.entries(teamGroups).map(([team, group]) => {
      const results = group.map((p: any) => calcCycleTime(histMap.get(p.id) || [])).filter(Boolean);
      return {
        team,
        cycle_time_avg: avg(results.map((r: any) => r.cycle_time_days)),
      };
    });

    // Overall
    const allResults = projects.map((p: any) => calcCycleTime(histMap.get(p.id) || [])).filter(Boolean);
    let reopenCount = 0;
    for (const [, h] of histMap) {
      let wasDone = false;
      for (const entry of h) {
        if (DONE.has(entry.status)) wasDone = true;
        else if (wasDone && entry.status === "ativo") { reopenCount++; break; }
      }
    }

    const overall = {
      lead_time_avg: avg(allResults.map((r: any) => r.lead_time_days)),
      cycle_time_avg: avg(allResults.map((r: any) => r.cycle_time_days)),
      paused_avg: avg(allResults.map((r: any) => r.paused_days)),
      reopen_rate: Math.round((reopenCount / Math.max(projects.length, 1)) * 100),
    };

    return new Response(JSON.stringify({ by_type, by_team, overall }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
