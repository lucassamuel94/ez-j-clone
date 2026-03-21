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
    // PART 1: Update follow-up patterns from results
    // ══════════════════════════════════════════════════
    const { data: logs } = await supabase
      .from('follow_up_logs')
      .select('channel, status, ai_context, created_at, responded_at, led_to_meeting, led_to_won')
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()); // last 90 days

    if (logs && logs.length > 0) {
      // Group by segment + porte + channel
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
        const responded = groupLogs.filter(l => l.status === 'responded').length;
        const meetings = groupLogs.filter(l => l.led_to_meeting).length;
        const won = groupLogs.filter(l => l.led_to_won).length;
        const responseRate = total > 0 ? (responded / total) * 100 : 0;

        // Calculate avg response time
        const responseTimes = groupLogs
          .filter(l => l.responded_at)
          .map(l => (new Date(l.responded_at).getTime() - new Date(l.created_at).getTime()) / (1000 * 60 * 60));
        const avgResponseTime = responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;

        // Find best time of day
        const hourCounts = new Map<number, { total: number; responded: number }>();
        for (const log of groupLogs) {
          const hour = new Date(log.created_at).getHours();
          const existing = hourCounts.get(hour) || { total: 0, responded: 0 };
          existing.total++;
          if (log.status === 'responded') existing.responded++;
          hourCounts.set(hour, existing);
        }
        let bestHour = -1;
        let bestRate = 0;
        for (const [hour, counts] of hourCounts) {
          const rate = counts.total > 2 ? counts.responded / counts.total : 0;
          if (rate > bestRate) { bestRate = rate; bestHour = hour; }
        }

        // Collect sample successful messages
        const successMessages = groupLogs
          .filter(l => l.status === 'responded' && l.led_to_meeting)
          .slice(0, 3)
          .map(l => ({ tone: l.ai_context?.tone, strategy: l.ai_context?.strategy }));

        await supabase.from('follow_up_patterns').upsert({
          segment: segment === 'unknown' ? null : segment,
          porte: porte === 'unknown' ? null : porte,
          channel,
          avg_response_rate: Math.round(responseRate * 100) / 100,
          avg_response_time_hours: Math.round(avgResponseTime * 100) / 100,
          total_sent: total,
          total_responded: responded,
          total_meetings: meetings,
          total_won: won,
          best_time_of_day: bestHour >= 0 ? `${bestHour}:00-${bestHour + 1}:00` : null,
          sample_messages: successMessages.length > 0 ? successMessages : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'segment,porte,channel' });
      }
    }

    // ══════════════════════════════════════════════════
    // PART 2: Analyze closer profiles from behavior
    // ══════════════════════════════════════════════════
    const { data: closers } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'closer');

    if (!closers || closers.length === 0) {
      return new Response(JSON.stringify({ patterns_updated: groups?.size || 0, closers_analyzed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const closerStats: Array<{ userId: string; winRate: number; avgValue: number; avgDays: number; won: number; lost: number }> = [];

    for (const closer of closers) {
      const [{ data: wonOpps }, { data: lostOpps }] = await Promise.all([
        supabase.from('opportunities').select('deal_value, created_at, won_at')
          .eq('assigned_to_user_id', closer.user_id).eq('stage', 'Ganho'),
        supabase.from('opportunities').select('id')
          .eq('assigned_to_user_id', closer.user_id).eq('stage', 'Perdido'),
      ]);

      const won = (wonOpps || []).length;
      const lost = (lostOpps || []).length;
      const total = won + lost;
      const winRate = total > 0 ? (won / total) * 100 : 0;
      const avgValue = won > 0 ? (wonOpps || []).reduce((s, o) => s + (Number(o.deal_value) || 0), 0) / won : 0;
      const avgDays = won > 0 ? (wonOpps || []).reduce((s, o) => {
        const start = new Date(o.created_at).getTime();
        const end = new Date(o.won_at || o.created_at).getTime();
        return s + (end - start) / (1000 * 60 * 60 * 24);
      }, 0) / won : 0;

      closerStats.push({ userId: closer.user_id, winRate, avgValue, avgDays, won, lost });
    }

    // Identify top performer
    const topPerformer = closerStats
      .filter(c => c.won >= 3) // minimum 3 deals to qualify
      .sort((a, b) => b.winRate - a.winRate || b.avgValue - a.avgValue)[0];

    // Analyze each closer's communication style via AI
    for (const closer of closerStats) {
      // Get their sent emails for style analysis
      const { data: emails } = await supabase
        .from('sent_emails')
        .select('subject, body')
        .eq('user_id', closer.userId)
        .order('created_at', { ascending: false })
        .limit(10);

      // Get their demo analysis summaries
      const { data: demos } = await supabase
        .from('call_analyses')
        .select('executive_summary, feedback, call_score')
        .eq('sdr_user_id', closer.userId)
        .eq('analysis_context', 'demo_closer')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(5);

      // Get closer name
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', closer.userId)
        .single();

      if (!LOVABLE_API_KEY || ((emails || []).length === 0 && (demos || []).length === 0)) {
        // Just update stats without AI analysis
        await supabase.from('closer_profiles').upsert({
          user_id: closer.userId,
          win_rate: Math.round(closer.winRate * 100) / 100,
          avg_deal_value: Math.round(closer.avgValue * 100) / 100,
          avg_days_to_close: Math.round(closer.avgDays * 100) / 100,
          total_deals_won: closer.won,
          total_deals_lost: closer.lost,
          is_top_performer: topPerformer?.userId === closer.userId,
          last_analyzed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        continue;
      }

      // AI analyzes the closer's style
      const emailSamples = (emails || []).slice(0, 5).map(e => `Assunto: ${e.subject}\nCorpo: ${(e.body || '').substring(0, 200)}`).join('\n---\n');
      const demoSamples = (demos || []).slice(0, 3).map(d => `Score: ${d.call_score}, Resumo: ${d.executive_summary || 'N/A'}`).join('\n');

      const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [{
            role: 'user',
            content: `Analise o estilo de comunicação deste closer de vendas B2B (${profile?.name || 'Closer'}).

Emails enviados:
${emailSamples || 'Nenhum'}

Resumo de demos:
${demoSamples || 'Nenhum'}

Stats: Win rate ${closer.winRate.toFixed(0)}%, Ticket médio R$${closer.avgValue.toFixed(0)}, Ciclo ${closer.avgDays.toFixed(0)} dias

Responda em JSON:
{
  "writing_style": "descrição do estilo de escrita em 2 frases",
  "common_phrases": ["frase1", "frase2", "frase3"],
  "preferred_tone": "professional|friendly|urgent|consultive",
  "objection_handling_style": "como este closer lida com objeções em 1 frase",
  "avg_message_length": número estimado de palavras por mensagem
}`,
          }],
          temperature: 0.2,
        }),
      });

      let styleData: any = {};
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const content = aiData.choices?.[0]?.message?.content || '';
        try {
          const match = content.match(/\{[\s\S]*\}/);
          styleData = match ? JSON.parse(match[0]) : {};
        } catch { /* ignore */ }

        // Log usage
        const usage = aiData.usage || {};
        try {
          await supabase.from('ai_usage_logs').insert({
            prompt_id: 'ghost_closer_learn', model: 'gemini-3-flash-preview',
            tokens_input: usage.prompt_tokens || 0, tokens_output: usage.completion_tokens || 0,
            estimated_cost_usd: ((usage.prompt_tokens || 0) * 0.15 / 1_000_000) + ((usage.completion_tokens || 0) * 0.6 / 1_000_000),
          });
        } catch { /* ignore */ }
      }

      await supabase.from('closer_profiles').upsert({
        user_id: closer.userId,
        writing_style: styleData.writing_style || null,
        common_phrases: styleData.common_phrases || null,
        avg_message_length: styleData.avg_message_length || null,
        preferred_tone: styleData.preferred_tone || null,
        objection_handling_style: styleData.objection_handling_style || null,
        win_rate: Math.round(closer.winRate * 100) / 100,
        avg_deal_value: Math.round(closer.avgValue * 100) / 100,
        avg_days_to_close: Math.round(closer.avgDays * 100) / 100,
        total_deals_won: closer.won,
        total_deals_lost: closer.lost,
        is_top_performer: topPerformer?.userId === closer.userId,
        last_analyzed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    }

    return new Response(JSON.stringify({
      patterns_updated: logs?.length || 0,
      closers_analyzed: closerStats.length,
      top_performer: topPerformer?.userId || null,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[ghost-closer-learn] Error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
