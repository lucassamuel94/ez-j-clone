import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all active leads (not discarded)
    const allLeads: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('leads')
        .select('id, status, lead_type, temperature, last_contact_at, next_action_at, created_at, attempts_count, behavioral_score, main_pain_point, solution_urgency, has_budget, daily_service_volume, phone, email, cnpj, razao_social, employee_count, ai_enrichment_data, ai_insights_data, ai_validation_alerts, company_segment, sqo_pain_clear, sqo_budget, sqo_decision_maker, sqo_icp_fit, is_hot_lead, owner_user_id')
        .not('status', 'eq', 'Descartado')
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (data) allLeads.push(...data);
      hasMore = (data?.length || 0) === pageSize;
      from += pageSize;
    }

    // Fetch discarded leads separately (needed for lostNoAttempt metric)
    const { data: discardedLeads } = await supabase
      .from('leads')
      .select('id, owner_user_id, attempts_count, status')
      .eq('status', 'Descartado');

    console.log(`Processing ${allLeads.length} leads for score calculation`);

    const now = new Date();
    const nowMs = now.getTime();

    // ── Fetch 48h score history for accurate variation calculation ──
    // We take the OLDEST recorded score within the last 48h window per lead.
    // This gives the true delta over ~48 hours, not just since the last cron run.
    const fortyEightHoursAgo = new Date(nowMs - 48 * 60 * 60 * 1000).toISOString();
    const { data: historyData } = await supabase
      .from('lead_score_history')
      .select('lead_id, score')
      .gte('recorded_at', fortyEightHoursAgo)
      .order('recorded_at', { ascending: true }); // oldest first

    // Build map: lead_id → oldest score in the 48h window
    const scoreAt48hAgo: Record<string, number> = {};
    for (const entry of historyData || []) {
      if (!(entry.lead_id in scoreAt48hAgo)) {
        scoreAt48hAgo[entry.lead_id] = entry.score;
      }
    }

    const updates: any[] = [];

    for (const lead of allLeads) {
      const oldScore = lead.behavioral_score ?? 0;

      // Calculate qualification component (0-100)
      let qualScore = 0;
      const volume = lead.daily_service_volume || '';
      if (volume === '51 a 100' || volume === '100 a 200' || volume === 'Acima de 200') qualScore += 20;
      if (lead.main_pain_point) qualScore += 20;
      if (lead.solution_urgency === 'Até 3 meses') qualScore += 20;
      if (lead.has_budget === 'sim' || lead.has_budget === 'viabilizar') qualScore += 20;
      if (lead.phone && lead.email) qualScore += 20;

      // Idle component
      const lastDate = lead.last_contact_at || lead.created_at;
      const idleHours = Math.abs(nowMs - new Date(lastDate).getTime()) / (1000 * 60 * 60);
      let idleScore = 0;
      if (idleHours > 120) idleScore = 100;
      else if (idleHours > 72) idleScore = 80;
      else if (idleHours > 48) idleScore = 60;
      else if (idleHours > 24) idleScore = 40;
      else if (idleHours > 8) idleScore = 20;

      // AI priority component
      let aiScore = 0;
      if (lead.ai_enrichment_data) aiScore += 20;
      if (lead.ai_insights_data) aiScore += 20;
      if (lead.ai_validation_alerts && Array.isArray(lead.ai_validation_alerts) && lead.ai_validation_alerts.length > 0) aiScore += 30;
      if (lead.cnpj) aiScore += 10;
      if (lead.razao_social) aiScore += 10;
      if (lead.employee_count) aiScore += 10;
      aiScore = Math.min(100, aiScore);

      // Temperature component
      let tempScore = 0;
      if (lead.temperature === 'quente') tempScore = 100;
      else if (lead.temperature === 'morno') tempScore = 50;
      else if (lead.temperature === 'frio') tempScore = 10;

      // SLA component
      let slaScore = 0;
      if (lead.next_action_at) {
        const diffHours = (nowMs - new Date(lead.next_action_at).getTime()) / (1000 * 60 * 60);
        if (diffHours > 48) slaScore = 100;
        else if (diffHours > 24) slaScore = 80;
        else if (diffHours > 4) slaScore = 60;
        else if (diffHours > 0) slaScore = 40;
        else if (diffHours > -4) slaScore = 20;
      }

      const newScore = Math.round(
        qualScore * 0.4 + idleScore * 0.2 + aiScore * 0.2 + tempScore * 0.1 + slaScore * 0.1
      );
      const clampedScore = Math.min(100, newScore);

      // Real 48h variation: compare against the oldest score in the 48h window.
      // Falls back to current DB score if no history exists (first run).
      const baseScore = lead.id in scoreAt48hAgo ? scoreAt48hAgo[lead.id] : oldScore;
      const variation = clampedScore - baseScore;

      // Determine variation reason
      let variationReason = '';
      if (Math.abs(variation) >= 5) {
        const reasons: string[] = [];
        if (slaScore > 60) reasons.push('Tarefa atrasada');
        if (idleScore > 60) reasons.push('Tempo parado elevado');
        if (qualScore > oldScore * 0.4) reasons.push('Qualificação melhorou');
        if (tempScore > 50) reasons.push('Temperatura alta');
        variationReason = reasons.join('; ') || (variation > 0 ? 'Score em alta' : 'Score em queda');
      }

      // Hot lead check
      const isHot = clampedScore >= 75 && lead.status === 'Oportunidade criada';

      updates.push({
        id: lead.id,
        behavioral_score: clampedScore,
        score_variation_48h: variation,
        score_variation_reason: variationReason || null,
        is_hot_lead: isHot,
        last_score_calculated_at: now.toISOString(),
      });
    }

    // Batch upsert in chunks of 200 (single roundtrip per chunk vs 200 parallel queries)
    let updated = 0;
    for (let i = 0; i < updates.length; i += 200) {
      const chunk = updates.slice(i, i + 200);
      const { error: upsertErr } = await supabase
        .from('leads')
        .upsert(chunk, { onConflict: 'id' });
      if (upsertErr) console.error(`[calculate-lead-scores] upsert error at chunk ${i}:`, upsertErr);
      updated += chunk.length;
    }

    // Insert score history entries for significant changes
    const significantChanges = updates.filter(u => Math.abs(u.score_variation_48h) >= 5);
    if (significantChanges.length > 0) {
      const historyEntries = significantChanges.map(u => ({
        lead_id: u.id,
        score: u.behavioral_score,
        factors: { variation: u.score_variation_48h, reason: u.score_variation_reason },
      }));

      for (let i = 0; i < historyEntries.length; i += 100) {
        await supabase.from('lead_score_history').insert(historyEntries.slice(i, i + 100));
      }
    }

    // ── SDR performance snapshots ──
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('active', true);

    if (profiles) {
      const today = now.toISOString().split('T')[0];

      // Fetch today's already-sent stalled_leads alerts to avoid duplicates
      const { data: todayAlerts } = await supabase
        .from('performance_alerts')
        .select('user_id')
        .eq('alert_type', 'stalled_leads')
        .gte('created_at', `${today}T00:00:00.000Z`);
      const alreadyAlerted = new Set((todayAlerts || []).map((a: any) => a.user_id));

      for (const profile of profiles) {
        const userLeads = allLeads.filter((l: any) => l.owner_user_id === profile.id);
        const stalled = userLeads.filter((l: any) => {
          const idle = Math.abs(nowMs - new Date(l.last_contact_at || l.created_at).getTime()) / (1000 * 60 * 60);
          return idle > 120; // 5+ days
        });

        // lostNoAttempt: discarded leads with fewer than 3 attempts (uses separately fetched data)
        const lostNoAttempt = (discardedLeads || []).filter(
          (l: any) => l.owner_user_id === profile.id && l.attempts_count < 3
        );

        const sqo = userLeads.filter((l: any) => l.status === 'Oportunidade criada');

        await supabase.from('sdr_performance_snapshots').upsert({
          user_id: profile.id,
          period_date: today,
          leads_stalled_count: stalled.length,
          leads_lost_without_min_attempts: lostNoAttempt.length,
          leads_promoted_to_sqo: sqo.length,
          total_leads: userLeads.length,
        }, { onConflict: 'user_id,period_date' });

        // Generate alert only once per day per user
        if (stalled.length >= 3 && !alreadyAlerted.has(profile.id)) {
          await supabase.from('performance_alerts').insert({
            user_id: profile.id,
            alert_type: 'stalled_leads',
            message: `${stalled.length} leads parados há mais de 5 dias`,
            severity: stalled.length >= 5 ? 'critical' : 'warning',
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, updated, significant_changes: significantChanges.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error calculating scores:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
