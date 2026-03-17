import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Week {
  week: string;
  start_date: string;
  end_date: string;
}

function getMonthWeeks(year: number, month: number): Week[] {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const weeks: Week[] = [];
  const ranges = [
    [1, 7],
    [8, 14],
    [15, 21],
    [22, lastDay],
  ];
  // If month has days beyond 28 in S4 and lastDay > 28, check for S5
  if (lastDay > 28) {
    // S4 = 22-28, S5 = 29-lastDay (only if lastDay > 28)
    if (lastDay > 28) {
      ranges[3] = [22, 28];
      ranges.push([29, lastDay]);
    }
  }
  for (let i = 0; i < ranges.length; i++) {
    const [s, e] = ranges[i];
    weeks.push({
      week: `S${i + 1}`,
      start_date: `${year}-${String(month + 1).padStart(2, "0")}-${String(s).padStart(2, "0")}`,
      end_date: `${year}-${String(month + 1).padStart(2, "0")}-${String(e).padStart(2, "0")}`,
    });
  }
  return weeks;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const monthParam = url.searchParams.get("month"); // e.g. "2026-03"
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth(); // 0-indexed

    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [y, m] = monthParam.split("-").map(Number);
      year = y;
      month = m - 1;
    }

    const weeks = getMonthWeeks(year, month);
    const numWeeks = weeks.length;
    const monthStart = weeks[0].start_date;
    const monthEnd = weeks[weeks.length - 1].end_date;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const currentMonthFirst = `${year}-${String(month + 1).padStart(2, "0")}-01`;

    // Parallel fetches
    const [teamsRes, membersRes, capacitiesRes, projectsRes] = await Promise.all([
      (admin.from("teams") as any).select("id, name"),
      (admin.from("team_members") as any).select("team_id, user_id"),
      (admin.from("team_capacity") as any)
        .select("team_id, capacity_hours, headcount")
        .eq("month", currentMonthFirst),
      (admin.from("projects") as any)
        .select("id, company_name, overall_status, estimated_hours, ux_po_user_id, dev_user_id, treinamento_user_id, created_at, delivered_at, due_date")
        .is("deleted_at", null)
        .limit(5000),
    ]);

    const teams = teamsRes.data || [];
    const members = membersRes.data || [];
    const capacities = capacitiesRes.data || [];
    const projects = projectsRes.data || [];

    // Maps
    const teamMembersMap: Record<string, string[]> = {};
    for (const m of members) {
      if (!teamMembersMap[m.team_id]) teamMembersMap[m.team_id] = [];
      teamMembersMap[m.team_id].push(m.user_id);
    }

    const capMap: Record<string, { capacity_hours: number; headcount: number }> = {};
    for (const c of capacities) {
      capMap[c.team_id] = { capacity_hours: c.capacity_hours, headcount: c.headcount };
    }

    // Helper: teams a project belongs to
    function projectTeamIds(p: Record<string, unknown>): string[] {
      const userIds = [p.ux_po_user_id, p.dev_user_id, p.treinamento_user_id].filter(Boolean) as string[];
      const result: string[] = [];
      for (const [teamId, memberIds] of Object.entries(teamMembersMap)) {
        if (userIds.some((uid) => memberIds.includes(uid))) result.push(teamId);
      }
      return result;
    }

    // Helper: is project active during a date range?
    function isActiveInRange(p: Record<string, unknown>, startStr: string, endStr: string): boolean {
      const created = new Date(p.created_at as string);
      const rangeEnd = new Date(endStr + "T23:59:59Z");
      if (created > rangeEnd) return false;
      if (p.overall_status === "entregue" && p.delivered_at) {
        const delivered = new Date(p.delivered_at as string);
        const rangeStart = new Date(startStr + "T00:00:00Z");
        if (delivered < rangeStart) return false;
      }
      if (p.overall_status !== "ativo" && p.overall_status !== "entregue") return false;
      return true;
    }

    const DEFAULT_HOURS = 40;

    // 1. teams_weekly
    const teamsWeekly: Record<string, Array<Record<string, unknown>>> = {};
    const alerts: Array<Record<string, unknown>> = [];

    for (const team of teams) {
      const teamId = team.id as string;
      const teamName = (team.name as string).toLowerCase();
      const cap = capMap[teamId] || { capacity_hours: 120, headcount: 1 };
      const weeklyCapacity = Math.round((cap.capacity_hours / numWeeks) * 100) / 100;

      const weeklyData = weeks.map((w) => {
        const activeProjects = projects.filter(
          (p: Record<string, unknown>) =>
            projectTeamIds(p).includes(teamId) && isActiveInRange(p, w.start_date, w.end_date)
        );
        const count = activeProjects.length;
        // Distribute each project's total estimated hours across the month's weeks
        const allocatedHours = Math.round(
          activeProjects.reduce(
            (sum: number, p: Record<string, unknown>) => sum + (Number(p.estimated_hours) || DEFAULT_HOURS),
            0
          ) / numWeeks
        );
        const utilizationPct = weeklyCapacity > 0
          ? Math.round((allocatedHours / weeklyCapacity) * 100)
          : 0;

        if (utilizationPct >= 90) {
          alerts.push({
            team: team.name,
            week: w.week,
            utilization_pct: utilizationPct,
            message: `${team.name} está com ${utilizationPct}% de utilização na ${w.week}`,
          });
        }

        return {
          week: w.week,
          start_date: w.start_date,
          end_date: w.end_date,
          active_projects: count,
          allocated_hours: allocatedHours,
          capacity_hours: Math.round(weeklyCapacity),
          utilization_pct: utilizationPct,
        };
      });

      teamsWeekly[teamName] = weeklyData;
    }

    // 2. weekly_flow
    const weeklyFlow: Array<Record<string, unknown>> = [];
    for (let i = 0; i < weeks.length; i++) {
      const w = weeks[i];
      const wStart = new Date(w.start_date + "T00:00:00Z");
      const wEnd = new Date(w.end_date + "T23:59:59Z");

      const newProjects = projects.filter((p: Record<string, unknown>) => {
        const c = new Date(p.created_at as string);
        return c >= wStart && c <= wEnd;
      }).length;

      const delivered = projects.filter((p: Record<string, unknown>) => {
        if (!p.delivered_at) return false;
        const d = new Date(p.delivered_at as string);
        return d >= wStart && d <= wEnd;
      }).length;

      // wip_end: active projects at end of this week
      const wipEnd = projects.filter((p: Record<string, unknown>) =>
        isActiveInRange(p, monthStart, w.end_date) &&
        (p.overall_status === "ativo" || (p.overall_status === "entregue" && p.delivered_at && new Date(p.delivered_at as string) > wEnd))
      ).length;

      weeklyFlow.push({
        week: w.week,
        start_date: w.start_date,
        end_date: w.end_date,
        new_projects: newProjects,
        delivered,
        balance: newProjects - delivered,
        wip_end: wipEnd,
        is_projection: false,
      });
    }

    // Projection for next week (if current month)
    if (weeklyFlow.length > 0) {
      const pastWeeks = weeklyFlow.filter((w) => !w.is_projection);
      if (pastWeeks.length > 0) {
        const avgNew = Math.round(
          pastWeeks.reduce((s, w) => s + (w.new_projects as number), 0) / pastWeeks.length
        );
        const avgDelivered = Math.round(
          pastWeeks.reduce((s, w) => s + (w.delivered as number), 0) / pastWeeks.length
        );
        const lastWip = pastWeeks[pastWeeks.length - 1].wip_end as number;

        weeklyFlow.push({
          week: `S${weeks.length + 1}`,
          start_date: null,
          end_date: null,
          new_projects: avgNew,
          delivered: avgDelivered,
          balance: avgNew - avgDelivered,
          wip_end: lastWip + avgNew - avgDelivered,
          is_projection: true,
        });
      }
    }

    // 3. Summary
    let totalCapacity = 0;
    let totalAllocated = 0;
    let utilSum = 0;
    let utilCount = 0;
    for (const teamWeeks of Object.values(teamsWeekly)) {
      for (const w of teamWeeks as Array<Record<string, unknown>>) {
        totalCapacity += w.capacity_hours as number;
        totalAllocated += w.allocated_hours as number;
        utilSum += w.utilization_pct as number;
        utilCount++;
      }
    }

    const summary = {
      total_capacity_hours: totalCapacity,
      total_allocated_hours: totalAllocated,
      total_free_hours: Math.max(0, totalCapacity - totalAllocated),
      avg_utilization_pct: utilCount > 0 ? Math.round(utilSum / utilCount) : 0,
    };

    return new Response(
      JSON.stringify({ summary, teams_weekly: teamsWeekly, weekly_flow: weeklyFlow, alerts }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
