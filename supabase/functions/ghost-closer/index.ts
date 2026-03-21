import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // ── 1. Acquire lock ──
    const lockName = 'ghost-closer';
    await supabase.from('cron_locks').delete().lt('expires_at', new Date().toISOString());
    const { error: lockError } = await supabase.from('cron_locks').insert({
      job_name: lockName,
      locked_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 300_000).toISOString(), // 5 min TTL
    });
    if (lockError) {
      return new Response(JSON.stringify({ skipped: true, reason: 'lock_collision' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 2. Check business hours (São Paulo) ──
    const spHour = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date()));
    if (spHour < 8 || spHour >= 19) {
      await supabase.from('cron_locks').delete().eq('job_name', lockName);
      return new Response(JSON.stringify({ skipped: true, reason: 'outside_business_hours' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 3. Fetch active opportunities needing follow-up ──
    const excludedStages = ['Ganho', 'Perdido'];
    const { data: opps, error: oppsErr } = await supabase
      .from('opportunities')
      .select('id, lead_id, stage, deal_value, assigned_to_user_id, updated_at, active_objection, closer_notes, expected_close_date, opportunity_type')
      .not('stage', 'in', `(${excludedStages.join(',')})`)
      .order('updated_at', { ascending: true })
      .limit(50);

    if (oppsErr) throw oppsErr;

    // ── 4. Fetch follow-up rules ──
    const { data: rules } = await supabase
      .from('follow_up_rules')
      .select('*')
      .eq('active', true)
      .order('stage')
      .order('step_number');

    const rulesByStage = new Map<string, any[]>();
    for (const rule of (rules || [])) {
      const existing = rulesByStage.get(rule.stage) || [];
      existing.push(rule);
      rulesByStage.set(rule.stage, existing);
    }

    // ── 5. Fetch learned patterns for context ──
    const { data: patterns } = await supabase
      .from('follow_up_patterns')
      .select('*')
      .gt('total_sent', 5)
      .order('avg_response_rate', { ascending: false })
      .limit(20);

    // ── 6. Fetch top closer profile for voice cloning ──
    const { data: topCloser } = await supabase
      .from('closer_profiles')
      .select('*')
      .eq('is_top_performer', true)
      .limit(1)
      .maybeSingle();

    // ── 7. Process each opportunity ──
    let sent = 0;
    let skipped = 0;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const EZCHAT_API_TOKEN = Deno.env.get('EZCHAT_API_TOKEN');

    for (const opp of (opps || [])) {
      const stageRules = rulesByStage.get(opp.stage);
      if (!stageRules || stageRules.length === 0) { skipped++; continue; }

      const daysSinceUpdate = Math.floor((Date.now() - new Date(opp.updated_at).getTime()) / (1000 * 60 * 60 * 24));

      // Find which step we should be on
      const { data: lastLog } = await supabase
        .from('follow_up_logs')
        .select('step_number, created_at, status')
        .eq('opportunity_id', opp.id)
        .order('step_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      // If last follow-up got a response, skip this opp
      if (lastLog?.status === 'responded') { skipped++; continue; }

      const currentStep = lastLog ? lastLog.step_number + 1 : 1;
      const currentRule = stageRules.find(r => r.step_number === currentStep);
      if (!currentRule) { skipped++; continue; } // All steps exhausted

      // Check if enough time has passed since last follow-up (or stage entry)
      const lastActionDate = lastLog ? new Date(lastLog.created_at) : new Date(opp.updated_at);
      const daysSinceLastAction = Math.floor((Date.now() - lastActionDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceLastAction < currentRule.delay_days) { skipped++; continue; }

      // Check max attempts
      const { count: totalAttempts } = await supabase
        .from('follow_up_logs')
        .select('*', { count: 'exact', head: true })
        .eq('opportunity_id', opp.id);
      if ((totalAttempts || 0) >= currentRule.max_attempts) { skipped++; continue; }

      // ── 8. Gather context for AI ──
      const { data: lead } = await supabase
        .from('leads')
        .select('name, company, razao_social, nome_fantasia, email, whatsapp, phone, company_segment, cnae_fiscal_descricao, porte, main_pain_point, product_interest')
        .eq('id', opp.lead_id)
        .single();

      if (!lead) { skipped++; continue; }
      const contactName = lead.name || 'Contato';
      const companyName = lead.razao_social || lead.nome_fantasia || lead.company || '';

      // Get closer profile for voice cloning
      let closerProfile: any = null;
      if (opp.assigned_to_user_id) {
        const { data: cp } = await supabase
          .from('closer_profiles')
          .select('writing_style, common_phrases, preferred_tone, objection_handling_style')
          .eq('user_id', opp.assigned_to_user_id)
          .maybeSingle();
        closerProfile = cp;

        // Get closer name
        const { data: closerUser } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', opp.assigned_to_user_id)
          .single();
        if (closerUser) closerProfile = { ...closerProfile, name: closerUser.name };
      }

      // Get recent demo transcription if available
      let demoContext = '';
      const { data: demoAnalysis } = await supabase
        .from('call_analyses')
        .select('executive_summary, objections, feedback, call_score, interest_level')
        .eq('lead_id', opp.lead_id)
        .eq('analysis_context', 'demo_closer')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (demoAnalysis) {
        demoContext = `\nÚltima demo: Score ${demoAnalysis.call_score}/100, Interesse: ${demoAnalysis.interest_level}
Resumo: ${demoAnalysis.executive_summary || 'N/A'}
Objeções: ${(demoAnalysis.objections || []).join(', ') || 'nenhuma'}
Feedback: ${demoAnalysis.feedback || 'N/A'}`;
      }

      // Get recent interactions
      const { data: interactions } = await supabase
        .from('interactions')
        .select('channel, message_summary, occurred_at, outcome')
        .eq('lead_id', opp.lead_id)
        .order('occurred_at', { ascending: false })
        .limit(5);

      const interactionContext = (interactions || []).map(i =>
        `[${i.channel}] ${i.message_summary || ''} (${new Date(i.occurred_at).toLocaleDateString('pt-BR')})`
      ).join('\n') || 'Sem interações recentes';

      // Get pattern insights for this segment
      const segmentPatterns = (patterns || []).find(p =>
        p.segment === (lead.company_segment || lead.cnae_fiscal_descricao)
      );

      // ── 9. Generate AI message ──
      if (!LOVABLE_API_KEY) { skipped++; continue; }

      const isWhatsApp = currentRule.channel === 'whatsapp' || currentRule.channel === 'both';
      const isEmail = currentRule.channel === 'email' || currentRule.channel === 'both';

      const voiceContext = closerProfile?.writing_style
        ? `\nESTILO DO CLOSER (imite este estilo): ${closerProfile.writing_style}
Frases típicas: ${(closerProfile.common_phrases || []).join('; ')}
Tom preferido: ${closerProfile.preferred_tone || 'profissional'}`
        : topCloser?.writing_style
          ? `\nESTILO DO MELHOR CLOSER (use como referência): ${topCloser.writing_style}
Frases: ${(topCloser.common_phrases || []).join('; ')}`
          : '';

      const patternContext = segmentPatterns
        ? `\nDados de performance para este segmento: ${segmentPatterns.avg_response_rate}% de resposta via ${segmentPatterns.channel}, melhor horário: ${segmentPatterns.best_time_of_day || 'N/A'}`
        : '';

      const systemPrompt = `Você é o Ghost Closer — um assistente de follow-up que escreve COMO SE FOSSE o closer ${closerProfile?.name || 'da equipe'}.
REGRAS ABSOLUTAS:
- ${isWhatsApp ? 'Mensagem de WhatsApp: MÁXIMO 4 linhas, direto, sem formalidade excessiva' : 'Email: máximo 150 palavras, com assunto curto'}
- NÃO use "Prezado" ou "Caro" — use o primeiro nome naturalmente
- NÃO se apresente novamente se já houve contato
- Tom: ${currentRule.tone}
- Estratégia: ${currentRule.strategy === 'case_study' ? 'mencione um caso de sucesso do mesmo segmento' : currentRule.strategy === 'roi_argument' ? 'argumente sobre ROI e retorno financeiro' : currentRule.strategy === 'urgency' ? 'crie senso de urgência sutil' : 'check-in casual e amigável'}
- Este é o follow-up #${currentStep} — ${currentStep === 1 ? 'primeiro contato após interação' : `o ${currentStep}º follow-up, seja mais direto`}
- ${isWhatsApp ? 'Retorne APENAS o texto da mensagem WhatsApp, sem formatação HTML' : 'Retorne JSON: { "subject": "...", "body": "..." }'}
${voiceContext}${patternContext}`;

      const userPrompt = `Gere follow-up para:
Contato: ${contactName} | Empresa: ${companyName}
Segmento: ${lead.company_segment || lead.cnae_fiscal_descricao || 'N/A'}
Porte: ${lead.porte || 'N/A'} | Dor: ${lead.main_pain_point || 'N/A'}
Produto: ${lead.product_interest || 'N/A'}
Estágio: ${opp.stage} | Valor: R$${opp.deal_value || 0}
Objeção ativa: ${opp.active_objection || 'nenhuma'}
Dias desde última ação: ${daysSinceLastAction}
${demoContext}

Interações recentes:
${interactionContext}

Notas do closer: ${opp.closer_notes || 'nenhuma'}`;

      const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.6,
        }),
      });

      if (!aiRes.ok) { skipped++; continue; }
      const aiData = await aiRes.json();
      const aiContent = aiData.choices?.[0]?.message?.content || '';
      if (aiContent.length < 10) { skipped++; continue; }

      // Log AI usage
      const usage = aiData.usage || {};
      try {
        await supabase.from('ai_usage_logs').insert({
          prompt_id: 'ghost_closer', model: 'gemini-3-flash-preview',
          tokens_input: usage.prompt_tokens || 0, tokens_output: usage.completion_tokens || 0,
          estimated_cost_usd: ((usage.prompt_tokens || 0) * 0.15 / 1_000_000) + ((usage.completion_tokens || 0) * 0.6 / 1_000_000),
          lead_id: opp.lead_id,
        });
      } catch { /* ignore */ }

      // ── 10. Send message ──
      let messageContent = aiContent;
      let emailSubject = '';

      if (isEmail) {
        try {
          const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            emailSubject = parsed.subject || `Follow-up — ${companyName}`;
            messageContent = parsed.body || aiContent;
          }
        } catch { /* use raw content */ }
      }

      // Send WhatsApp via EZ Chat
      if (isWhatsApp && EZCHAT_API_TOKEN && lead.whatsapp) {
        const whatsappNumber = lead.whatsapp.replace(/\D/g, '');
        if (whatsappNumber.length >= 10) {
          try {
            const { error: sendErr } = await supabase.functions.invoke('send-whatsapp', {
              body: { sender: whatsappNumber, message: messageContent },
            });
            if (sendErr) console.error('WhatsApp send error:', sendErr);
          } catch (e) { console.error('WhatsApp error:', e); }
        }
      }

      // Send Email via Resend
      if (isEmail && lead.email) {
        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        if (resendApiKey) {
          const senderName = closerProfile?.name || 'EZ Journey';
          try {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: `${senderName} <noreply@notifications.ezsoft.com.br>`,
                to: [lead.email],
                subject: emailSubject || `Follow-up — ${companyName}`,
                html: `<div style="font-family: sans-serif; font-size: 14px; line-height: 1.6;">${messageContent.replace(/\n/g, '<br>')}</div>`,
              }),
            });
          } catch (e) { console.error('Email error:', e); }
        }
      }

      // ── 11. Log the follow-up ──
      await supabase.from('follow_up_logs').insert({
        opportunity_id: opp.id,
        lead_id: opp.lead_id,
        closer_user_id: opp.assigned_to_user_id,
        step_number: currentStep,
        channel: currentRule.channel,
        message_content: messageContent,
        subject: emailSubject || null,
        ai_context: {
          stage: opp.stage,
          tone: currentRule.tone,
          strategy: currentRule.strategy,
          segment: lead.company_segment || lead.cnae_fiscal_descricao,
          porte: lead.porte,
          had_demo: !!demoAnalysis,
          closer_profile_used: !!closerProfile?.writing_style,
          top_closer_used: !closerProfile?.writing_style && !!topCloser?.writing_style,
        },
        status: 'sent',
      });

      // Create activity log
      await supabase.from('lead_activity_logs').insert({
        lead_id: opp.lead_id,
        action_type: 'interaction_added',
        description: `[Ghost Closer] Follow-up #${currentStep} enviado via ${currentRule.channel}`,
        user_id: opp.assigned_to_user_id,
      });

      sent++;

      // Rate limit: max 10 per run
      if (sent >= 10) break;
    }

    // Release lock
    await supabase.from('cron_locks').delete().eq('job_name', lockName);

    console.log(`[ghost-closer] Done. Sent: ${sent}, Skipped: ${skipped}`);
    return new Response(JSON.stringify({ sent, skipped, total: (opps || []).length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[ghost-closer] Error:', e);
    try { await supabase.from('cron_locks').delete().eq('job_name', 'ghost-closer'); } catch { /* ignore */ }
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
