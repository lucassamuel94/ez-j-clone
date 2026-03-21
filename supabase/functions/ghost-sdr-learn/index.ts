import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

  try {
    // ══════════════════════════════════════════════════
    // PART 1: Update outreach patterns from results
    // ══════════════════════════════════════════════════
    const { data: logs } = await supabase
      .from('sdr_follow_up_logs')
      .select('channel, status, ai_context, created_at, responded_at, led_to_meeting, led_to_meeting_confirmed, led_to_sqo, led_to_sale')
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    let patternsUpdated = 0;
    if (logs && logs.length > 0) {
      const groups = new Map<string, any[]>();
      for (const log of logs) {
        const ctx = log.ai_context || {};
        const key = `${ctx.segment || 'unknown'}|${ctx.porte || 'unknown'}|${log.channel}`;
        const existing = groups.get(key) || [];
        existing.push(log);
        groups.set(key, existing);
      }

      for (const [key, groupLogs] of groups) {
        const [segment, porte, channel] = key.split('|');
        const total = groupLogs.length;
        const responded = groupLogs.filter((l: any) => l.status === 'responded').length;
        const meetings = groupLogs.filter((l: any) => l.led_to_meeting).length;
        const meetingsConfirmed = groupLogs.filter((l: any) => l.led_to_meeting_confirmed).length;
        const sqos = groupLogs.filter((l: any) => l.led_to_sqo).length;
        const sales = groupLogs.filter((l: any) => l.led_to_sale).length;
        const responseRate = total > 0 ? (responded / total) * 100 : 0;

        const responseTimes = groupLogs
          .filter((l: any) => l.responded_at)
          .map((l: any) => (new Date(l.responded_at).getTime() - new Date(l.created_at).getTime()) / (1000 * 60 * 60));
        const avgResponseTime = responseTimes.length > 0
          ? responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length : 0;

        // Best time of day
        const hourCounts = new Map<number, { total: number; responded: number }>();
        for (const log of groupLogs) {
          const hour = new Date(log.created_at).getHours();
          const existing = hourCounts.get(hour) || { total: 0, responded: 0 };
          existing.total++;
          if (log.status === 'responded') existing.responded++;
          hourCounts.set(hour, existing);
        }
        let bestHour = -1, bestRate = 0;
        for (const [hour, counts] of hourCounts) {
          const rate = counts.total > 2 ? counts.responded / counts.total : 0;
          if (rate > bestRate) { bestRate = rate; bestHour = hour; }
        }

        await supabase.from('sdr_follow_up_patterns').upsert({
          segment: segment === 'unknown' ? null : segment,
          porte: porte === 'unknown' ? null : porte,
          channel,
          avg_response_rate: Math.round(responseRate * 100) / 100,
          avg_response_time_hours: Math.round(avgResponseTime * 100) / 100,
          total_sent: total,
          total_responded: responded,
          total_meetings: meetings,
          total_meetings_confirmed: meetingsConfirmed,
          total_sqos: sqos,
          total_sales: sales,
          best_time_of_day: bestHour >= 0 ? `${bestHour}:00-${bestHour + 1}:00` : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'segment,porte,channel' });

        patternsUpdated++;
      }
    }

    // ══════════════════════════════════════════════════
    // PART 2: Analyze SDR profiles
    // Top performer = highest SQO rate within goal + best conversion to sale
    // ══════════════════════════════════════════════════
    const { data: sdrs } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'sdr');

    if (!sdrs || sdrs.length === 0) {
      return new Response(JSON.stringify({ patterns_updated: patternsUpdated, sdrs_analyzed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    interface SdrStat {
      userId: string;
      sqos: number;
      salesFromSqo: number;
      meetingsConfirmed: number;
      calls: number;
      avgCallScore: number;
      sqoRate: number;
      sqoToSaleRate: number;
      performerScore: number; // composite score for ranking
    }

    const sdrStats: SdrStat[] = [];

    for (const sdr of sdrs) {
      // Count opportunities created by this SDR (= SQOs)
      const { data: sqoOpps } = await supabase
        .from('opportunities')
        .select('id, stage')
        .eq('sdr_user_id', sdr.user_id);

      const sqos = (sqoOpps || []).length;
      const salesFromSqo = (sqoOpps || []).filter((o: any) => o.stage === 'Ganho').length;

      // Count confirmed meetings (leads that reached "Reunião Confirmada")
      const { count: meetingsConfirmed } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('owner_user_id', sdr.user_id)
        .eq('status', 'Reunião Confirmada');

      // Count calls
      const { count: calls } = await supabase
        .from('call_analyses')
        .select('*', { count: 'exact', head: true })
        .eq('sdr_user_id', sdr.user_id)
        .eq('analysis_context', 'sdr_call')
        .eq('status', 'completed');

      // Avg call score
      const { data: callScores } = await supabase
        .from('call_analyses')
        .select('call_score')
        .eq('sdr_user_id', sdr.user_id)
        .eq('analysis_context', 'sdr_call')
        .eq('status', 'completed')
        .not('call_score', 'is', null);

      const avgCallScore = (callScores || []).length > 0
        ? (callScores || []).reduce((s: number, c: any) => s + (c.call_score || 0), 0) / (callScores || []).length
        : 0;

      // Total leads worked
      const { count: leadsWorked } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('owner_user_id', sdr.user_id)
        .not('status', 'eq', 'Novo');

      const sqoRate = (leadsWorked || 0) > 0 ? (sqos / (leadsWorked || 1)) * 100 : 0;
      const sqoToSaleRate = sqos > 0 ? (salesFromSqo / sqos) * 100 : 0;

      // Composite performer score:
      // 50% SQO-to-sale rate (quality) + 30% SQO rate (productivity) + 20% avg call score
      const performerScore = (sqoToSaleRate * 0.5) + (sqoRate * 0.3) + (avgCallScore * 0.2);

      sdrStats.push({
        userId: sdr.user_id, sqos, salesFromSqo, meetingsConfirmed: meetingsConfirmed || 0,
        calls: calls || 0, avgCallScore, sqoRate, sqoToSaleRate, performerScore,
      });
    }

    // Identify top performer (min 3 SQOs to qualify)
    const topPerformer = sdrStats
      .filter(s => s.sqos >= 3)
      .sort((a, b) => b.performerScore - a.performerScore)[0];

    // Analyze each SDR's communication style via AI
    for (const sdr of sdrStats) {
      // Get their sent emails
      const { data: emails } = await supabase
        .from('sent_emails')
        .select('subject, body')
        .eq('user_id', sdr.userId)
        .order('created_at', { ascending: false }).limit(10);

      // Get their call analysis summaries (SDR calls)
      const { data: callSummaries } = await supabase
        .from('call_analyses')
        .select('executive_summary, feedback, call_score, objections, interest_level')
        .eq('sdr_user_id', sdr.userId)
        .eq('analysis_context', 'sdr_call')
        .eq('status', 'completed')
        .order('created_at', { ascending: false }).limit(5);

      const { data: profile } = await supabase.from('profiles').select('name').eq('id', sdr.userId).single();

      let styleData: any = {};

      if (LOVABLE_API_KEY && ((emails || []).length > 0 || (callSummaries || []).length > 0)) {
        const emailSamples = (emails || []).slice(0, 5).map((e: any) => `Assunto: ${e.subject}\nCorpo: ${(e.body || '').substring(0, 200)}`).join('\n---\n');
        const callSamples = (callSummaries || []).slice(0, 3).map((c: any) =>
          `Score: ${c.call_score}, Interesse: ${c.interest_level}, Objeções: ${(c.objections || []).join(', ')}\nResumo: ${c.executive_summary || 'N/A'}`
        ).join('\n---\n');

        const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [{
              role: 'user',
              content: `Analise o estilo de prospecção deste SDR (${profile?.name || 'SDR'}).

Emails de prospecção:
${emailSamples || 'Nenhum'}

Análises de calls:
${callSamples || 'Nenhum'}

Stats: ${sdr.sqos} SQOs, ${sdr.salesFromSqo} convertidos em venda (${sdr.sqoToSaleRate.toFixed(0)}%), Score médio calls: ${sdr.avgCallScore.toFixed(0)}

Responda em JSON:
{
  "writing_style": "estilo de escrita em 2 frases",
  "common_phrases": ["frase1", "frase2", "frase3"],
  "preferred_tone": "professional|friendly|urgent|consultive|curious",
  "opening_style": "como abre conversas frias em 1 frase",
  "qualification_style": "como qualifica leads em 1 frase",
  "avg_message_length": número
}`,
            }],
            temperature: 0.2,
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const content = aiData.choices?.[0]?.message?.content || '';
          try { const m = content.match(/\{[\s\S]*\}/); styleData = m ? JSON.parse(m[0]) : {}; } catch { /* ignore */ }

          const usage = aiData.usage || {};
          try {
            await supabase.from('ai_usage_logs').insert({
              prompt_id: 'ghost_sdr_learn', model: 'gemini-3-flash-preview',
              tokens_input: usage.prompt_tokens || 0, tokens_output: usage.completion_tokens || 0,
              estimated_cost_usd: ((usage.prompt_tokens || 0) * 0.15 / 1_000_000) + ((usage.completion_tokens || 0) * 0.6 / 1_000_000),
            });
          } catch { /* ignore */ }
        }
      }

      await supabase.from('sdr_profiles').upsert({
        user_id: sdr.userId,
        writing_style: styleData.writing_style || null,
        common_phrases: styleData.common_phrases || null,
        avg_message_length: styleData.avg_message_length || null,
        preferred_tone: styleData.preferred_tone || null,
        opening_style: styleData.opening_style || null,
        qualification_style: styleData.qualification_style || null,
        sqo_rate: Math.round(sdr.sqoRate * 100) / 100,
        sqo_to_sale_rate: Math.round(sdr.sqoToSaleRate * 100) / 100,
        avg_call_score: Math.round(sdr.avgCallScore * 100) / 100,
        total_sqos: sdr.sqos,
        total_sales_from_sqo: sdr.salesFromSqo,
        total_meetings_confirmed: sdr.meetingsConfirmed,
        total_calls: sdr.calls,
        is_top_performer: topPerformer?.userId === sdr.userId,
        last_analyzed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    }

    return new Response(JSON.stringify({
      patterns_updated: patternsUpdated,
      sdrs_analyzed: sdrStats.length,
      top_performer: topPerformer?.userId || null,
      top_performer_score: topPerformer?.performerScore?.toFixed(1) || null,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[ghost-sdr-learn] Error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
