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
    let period = "month";
    const url = new URL(req.url);
    period = url.searchParams.get("period") || period;
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
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    // Period start for SLA / rework calculations
    const periodStart = period === "week"
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
      : period === "quarter"
        ? new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
        : new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

    // 1. Fetch teams
    const { data: teams } = await (admin.from("teams") as any).select("id, name");
    if (!teams || teams.length === 0) {
      return new Response(JSON.stringify({ summary: { total_wip: 0, avg_utilization: 0, avg_sla: 0, free_hours_total: 0 }, teams: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch team_members
    const { data: members } = await (admin.from("team_members") as any).select("team_id, user_id");
    const teamMembersMap: Record<string, string[]> = {};
    for (const m of members || []) {
      if (!teamMembersMap[m.team_id]) teamMembersMap[m.team_id] = [];
      teamMembersMap[m.team_id].push(m.user_id);
    }

    // 3. Fetch team_capacity for current month
    const { data: capacities } = await (admin.from("team_capacity") as any)
      .select("team_id, capacity_hours, headcount")
      .eq("month", currentMonth);
    const capMap: Record<string, { capacity_hours: number; headcount: number }> = {};
    for (const c of capacities || []) {
      capMap[c.team_id] = { capacity_hours: c.capacity_hours, headcount: c.headcount };
    }

    // 4. Fetch active projects
    const { data: activeProjects } = await (admin.from("projects") as any)
      .select("id, company_name, overall_status, estimated_hours, ux_po_user_id, dev_user_id, treinamento_user_id, current_phase, due_date, delivered_at")
      .eq("overall_status", "ativo")
      .is("deleted_at", null)
      .limit(5000);

    // 5. Fetch delivered projects in period for SLA/rework
    const { data: deliveredProjects } = await (admin.from("projects") as any)
      .select("id, overall_status, due_date, delivered_at, ux_po_user_id, dev_user_id, treinamento_user_id")
      .eq("overall_status", "entregue")
      .gte("delivered_at", periodStart.toISOString())
      .is("deleted_at", null)
      .limit(5000);

    // 6. Fetch status history for rework (projects with >1 cycle back to 'ativo')
    const deliveredIds = (deliveredProjects || []).map((p: Record<string, unknown>) => p.id);
    let reworkSet = new Set<string>();
    if (deliveredIds.length > 0) {
      const { data: histories } = await (admin.from("project_status_history") as any)
        .select("project_id, new_status")
        .in("project_id", deliveredIds)
        .eq("new_status", "ativo");
      // Projects with >1 transition to 'ativo' = rework
      const countMap: Record<string, number> = {};
      for (const h of histories || []) {
        countMap[h.project_id] = (countMap[h.project_id] || 0) + 1;
      }
      reworkSet = new Set(Object.entries(countMap).filter(([, c]) => c > 1).map(([id]) => id));
    }

    // Helper: get team for a project (check if any assigned user is in team)
    function projectTeamIds(p: Record<string, unknown>): string[] {
      const userIds = [p.ux_po_user_id, p.dev_user_id, p.treinamento_user_id].filter(Boolean) as string[];
      const result: string[] = [];
      for (const [teamId, memberIds] of Object.entries(teamMembersMap)) {
        if (userIds.some((uid) => memberIds.includes(uid))) {
          result.push(teamId);
        }
      }
      return result;
    }

    // Build per-team data
    const DEFAULT_HOURS = 40;
    const teamResults = teams.map((team: Record<string, unknown>) => {
      const teamId = team.id as string;
      const cap = capMap[teamId] || { capacity_hours: 120, headcount: 1 };

      // Active projects for this team
      const teamActive = (activeProjects || []).filter((p: Record<string, unknown>) =>
        projectTeamIds(p).includes(teamId)
      );

      const projectCount = teamActive.length;
      const allocatedHours = teamActive.reduce((sum: number, p: Record<string, unknown>) => {
        return sum + (Number(p.estimated_hours) || DEFAULT_HOURS);
      }, 0);

      const utilizationPct = cap.capacity_hours > 0
        ? Math.round((allocatedHours / cap.capacity_hours) * 100)
        : 0;

      const wipPerPerson = cap.headcount > 0
        ? Math.round((projectCount / cap.headcount) * 10) / 10
        : projectCount;

      // SLA: delivered on time / total delivered
      const teamDelivered = (deliveredProjects || []).filter((p: Record<string, unknown>) =>
        projectTeamIds(p).includes(teamId)
      );
      const onTime = teamDelivered.filter((p: Record<string, unknown>) => {
        if (!p.due_date || !p.delivered_at) return true;
        return new Date(p.delivered_at as string) <= new Date(p.due_date as string);
      });
      const slaRate = teamDelivered.length > 0
        ? Math.round((onTime.length / teamDelivered.length) * 100)
        : 100;

      // Rework rate
      const teamDeliveredIds = teamDelivered.map((p: Record<string, unknown>) => p.id as string);
      const reworkCount = teamDeliveredIds.filter((id: string) => reworkSet.has(id)).length;
      const reworkRate = teamDelivered.length > 0
        ? Math.round((reworkCount / teamDelivered.length) * 100)
        : 0;

      // Status
      const status = utilizationPct >= 90 ? "critical" : utilizationPct >= 80 ? "warning" : "ok";

      // Main bottleneck: phase with most active projects
      const phaseCounts: Record<string, number> = {};
      for (const p of teamActive) {
        const phase = (p.current_phase as string) || "desconhecida";
        phaseCounts[phase] = (phaseCounts[phase] || 0) + 1;
      }
      const mainBottleneck = Object.entries(phaseCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

      return {
        id: teamId,
        name: team.name as string,
        allocated_hours: allocatedHours,
        capacity_hours: cap.capacity_hours,
        headcount: cap.headcount,
        utilization_pct: utilizationPct,
        wip_per_person: wipPerPerson,
        sla_rate: slaRate,
        rework_rate: reworkRate,
        status,
        main_bottleneck: mainBottleneck,
        active_projects: projectCount,
      };
    });

    // Summary
    const totalWip = teamResults.reduce((s: number, t: Record<string, unknown>) => s + (t.active_projects as number), 0);
    const avgUtil = teamResults.length > 0
      ? Math.round(teamResults.reduce((s: number, t: Record<string, unknown>) => s + (t.utilization_pct as number), 0) / teamResults.length)
      : 0;
    const avgSla = teamResults.length > 0
      ? Math.round(teamResults.reduce((s: number, t: Record<string, unknown>) => s + (t.sla_rate as number), 0) / teamResults.length)
      : 0;
    const freeHours = teamResults.reduce((s: number, t: Record<string, unknown>) =>
      s + Math.max(0, (t.capacity_hours as number) - (t.allocated_hours as number)), 0);

    return new Response(JSON.stringify({
      summary: { total_wip: totalWip, avg_utilization: avgUtil, avg_sla: avgSla, free_hours_total: freeHours },
      teams: teamResults,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
