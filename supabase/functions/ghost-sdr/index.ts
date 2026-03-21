import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    // ── 1. Lock ──
    const lockName = 'ghost-sdr';
    await supabase.from('cron_locks').delete().lt('expires_at', new Date().toISOString());
    const { error: lockError } = await supabase.from('cron_locks').insert({
      job_name: lockName, locked_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 300_000).toISOString(),
    });
    if (lockError) return new Response(JSON.stringify({ skipped: true, reason: 'lock_collision' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // ── 2. Business hours check (São Paulo) ──
    const spHour = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date()));
    if (spHour < 8 || spHour >= 19) {
      await supabase.from('cron_locks').delete().eq('job_name', lockName);
      return new Response(JSON.stringify({ skipped: true, reason: 'outside_business_hours' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── 3. Fetch active leads needing outreach ──
    const activeStatuses = ['Novo', 'Em contato', 'Interesse', 'Interesse/Agendar Retorno', 'Lead Quente'];
    const { data: leads, error: leadsErr } = await supabase
      .from('leads')
      .select('id, name, company, razao_social, nome_fantasia, email, whatsapp, phone, company_segment, cnae_fiscal_descricao, porte, main_pain_point, product_interest, solution_urgency, has_budget, status, temperature, owner_user_id, updated_at, daily_service_volume, employee_count, revenue_range, ai_enrichment_data')
      .in('status', activeStatuses)
      .order('updated_at', { ascending: true })
      .limit(60);

    if (leadsErr) throw leadsErr;

    // ── 4. Fetch rules ──
    const { data: rules } = await supabase.from('sdr_follow_up_rules').select('*').eq('active', true).order('lead_status').order('step_number');
    const rulesByStatus = new Map<string, any[]>();
    for (const rule of (rules || [])) {
      const existing = rulesByStatus.get(rule.lead_status) || [];
      existing.push(rule);
      rulesByStatus.set(rule.lead_status, existing);
    }

    // ── 5. Fetch patterns & top SDR ──
    const { data: patterns } = await supabase.from('sdr_follow_up_patterns').select('*').gt('total_sent', 5).order('avg_response_rate', { ascending: false }).limit(20);
    const { data: topSdr } = await supabase.from('sdr_profiles').select('*').eq('is_top_performer', true).limit(1).maybeSingle();

    // ── 6. Process leads ──
    let sent = 0;
    let skipped = 0;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    for (const lead of (leads || [])) {
      const statusRules = rulesByStatus.get(lead.status);
      if (!statusRules || statusRules.length === 0) { skipped++; continue; }

      // Find current step
      const { data: lastLog } = await supabase
        .from('sdr_follow_up_logs')
        .select('step_number, created_at, status')
        .eq('lead_id', lead.id)
        .eq('lead_status', lead.status)
        .order('step_number', { ascending: false })
        .limit(1).maybeSingle();

      if (lastLog?.status === 'responded') { skipped++; continue; }

      const currentStep = lastLog ? lastLog.step_number + 1 : 1;
      const currentRule = statusRules.find((r: any) => r.step_number === currentStep);
      if (!currentRule) { skipped++; continue; }

      // Check delay
      const lastActionDate = lastLog ? new Date(lastLog.created_at) : new Date(lead.updated_at);
      const daysSinceLastAction = Math.floor((Date.now() - lastActionDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceLastAction < currentRule.delay_days) { skipped++; continue; }

      // Check max attempts
      const { count: totalAttempts } = await supabase
        .from('sdr_follow_up_logs')
        .select('*', { count: 'exact', head: true })
        .eq('lead_id', lead.id);
      if ((totalAttempts || 0) >= currentRule.max_attempts) { skipped++; continue; }

      // ── 7. Gather context ──
      const contactName = lead.name || 'Contato';
      const companyName = lead.razao_social || lead.nome_fantasia || lead.company || '';

      // SDR profile for voice cloning
      let sdrProfile: any = null;
      if (lead.owner_user_id) {
        const { data: sp } = await supabase.from('sdr_profiles')
          .select('writing_style, common_phrases, preferred_tone, opening_style, qualification_style')
          .eq('user_id', lead.owner_user_id).maybeSingle();
        sdrProfile = sp;
        const { data: sdrUser } = await supabase.from('profiles').select('name').eq('id', lead.owner_user_id).single();
        if (sdrUser) sdrProfile = { ...sdrProfile, name: sdrUser.name };
      }

      // Recent call analysis
      let callContext = '';
      const { data: callAnalysis } = await supabase
        .from('call_analyses')
        .select('executive_summary, objections, feedback, call_score, interest_level')
        .eq('lead_id', lead.id).eq('analysis_context', 'sdr_call').eq('status', 'completed')
        .order('created_at', { ascending: false }).limit(1).maybeSingle();

      if (callAnalysis) {
        callContext = `\nÚltima call: Score ${callAnalysis.call_score}/100, Interesse: ${callAnalysis.interest_level}
Resumo: ${callAnalysis.executive_summary || 'N/A'}
Objeções: ${(callAnalysis.objections || []).join(', ') || 'nenhuma'}`;
      }

      // Recent interactions
      const { data: interactions } = await supabase
        .from('interactions')
        .select('channel, message_summary, occurred_at, outcome')
        .eq('lead_id', lead.id).order('occurred_at', { ascending: false }).limit(5);

      const interactionContext = (interactions || []).map((i: any) =>
        `[${i.channel}] ${i.message_summary || ''} → ${i.outcome || 'N/A'} (${new Date(i.occurred_at).toLocaleDateString('pt-BR')})`
      ).join('\n') || 'Nenhuma interação anterior';

      // Segment pattern
      const segmentPattern = (patterns || []).find((p: any) =>
        p.segment === (lead.company_segment || lead.cnae_fiscal_descricao));

      // Enrichment data
      const aiData = lead.ai_enrichment_data || {};
      const aiDescription = aiData.descricao || aiData.description || '';

      // ── 8. Strategy-specific instructions ──
      const strategyInstructions: Record<string, string> = {
        cold_intro: 'Apresentação inicial fria. Seja curto, mencione algo específico da empresa para mostrar que pesquisou. Não venda, gere curiosidade.',
        pain_point: 'Foque na dor do lead. Se tem dados de CNAE/segmento, cite problemas comuns desse setor. Faça uma pergunta aberta.',
        value_prop: 'Apresente o valor da solução de forma concreta. Use números se possível (ex: "empresas do seu porte reduzem 40% no tempo de atendimento").',
        social_proof: 'Mencione um caso de sucesso de empresa do mesmo segmento/porte. Se não souber, cite resultados genéricos com automação de atendimento.',
        meeting_ask: 'Peça uma reunião de forma direta mas educada. Sugira 2 horários específicos. Máximo 3 frases.',
        reengagement: 'Reengajamento após silêncio. Tom leve, sem pressão. Pode usar humor sutil. Pergunte se mudou algo ou se pode ajudar de outra forma.',
      };

      // ── 9. Generate AI message ──
      if (!LOVABLE_API_KEY) { skipped++; continue; }

      const isWhatsApp = currentRule.channel === 'whatsapp' || currentRule.channel === 'both';
      const isEmail = currentRule.channel === 'email' || currentRule.channel === 'both';

      const voiceContext = sdrProfile?.writing_style
        ? `\nESTILO DO SDR (imite): ${sdrProfile.writing_style}
Frases típicas: ${(sdrProfile.common_phrases || []).join('; ')}
Abertura: ${sdrProfile.opening_style || 'N/A'}
Qualificação: ${sdrProfile.qualification_style || 'N/A'}`
        : topSdr?.writing_style
          ? `\nESTILO DO MELHOR SDR (referência): ${topSdr.writing_style}
Frases: ${(topSdr.common_phrases || []).join('; ')}
Abertura: ${topSdr.opening_style || 'N/A'}`
          : '';

      const patternContext = segmentPattern
        ? `\nDados: ${segmentPattern.avg_response_rate}% resposta via ${segmentPattern.channel}, melhor horário: ${segmentPattern.best_time_of_day || 'N/A'}`
        : '';

      const systemPrompt = `Você é o Ghost SDR — um assistente de prospecção que escreve COMO SE FOSSE o SDR ${sdrProfile?.name || 'da equipe'}.
REGRAS:
- ${isWhatsApp ? 'WhatsApp: MÁXIMO 4 linhas, direto, informal mas profissional' : 'Email: máximo 120 palavras, com assunto curto e chamativo'}
- NÃO use "Prezado" — use o primeiro nome
- Tom: ${currentRule.tone}
- Estratégia: ${strategyInstructions[currentRule.strategy] || 'check-in casual'}
- Follow-up #${currentStep} — ${currentStep === 1 ? 'primeiro contato' : 'continuação, seja mais direto'}
- ${lead.status === 'Novo' ? 'COLD OUTREACH — o lead NÃO sabe quem você é' : 'Lead já teve contato, pode ser mais direto'}
- OBJETIVO FINAL: conseguir uma reunião para demonstrar a solução
- ${isWhatsApp ? 'Retorne APENAS o texto WhatsApp' : 'Retorne JSON: { "subject": "...", "body": "..." }'}
${voiceContext}${patternContext}`;

      const userPrompt = `Gere outreach para:
Contato: ${contactName} | Empresa: ${companyName}
Segmento: ${lead.company_segment || lead.cnae_fiscal_descricao || 'N/A'}
Porte: ${lead.porte || 'N/A'} | Funcionários: ${lead.employee_count || 'N/A'}
Faturamento: ${lead.revenue_range || 'N/A'}
Volume diário: ${lead.daily_service_volume || 'N/A'}
Dor: ${lead.main_pain_point || 'N/A'} | Produto: ${lead.product_interest || 'N/A'}
Urgência: ${lead.solution_urgency || 'N/A'} | Orçamento: ${lead.has_budget || 'N/A'}
Temperatura: ${lead.temperature || 'N/A'} | Status: ${lead.status}
${aiDescription ? `Sobre a empresa: ${aiDescription}` : ''}
${callContext}

Interações anteriores:
${interactionContext}`;

      const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
          temperature: 0.65,
        }),
      });

      if (!aiRes.ok) { skipped++; continue; }
      const aiData2 = await aiRes.json();
      const aiContent = aiData2.choices?.[0]?.message?.content || '';
      if (aiContent.length < 10) { skipped++; continue; }

      // Log AI usage
      const usage = aiData2.usage || {};
      try {
        await supabase.from('ai_usage_logs').insert({
          prompt_id: 'ghost_sdr', model: 'gemini-3-flash-preview',
          tokens_input: usage.prompt_tokens || 0, tokens_output: usage.completion_tokens || 0,
          estimated_cost_usd: ((usage.prompt_tokens || 0) * 0.15 / 1_000_000) + ((usage.completion_tokens || 0) * 0.6 / 1_000_000),
          lead_id: lead.id,
        });
      } catch { /* ignore */ }

      // ── 10. Send ──
      let messageContent = aiContent;
      let emailSubject = '';

      if (isEmail) {
        try {
          const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            emailSubject = parsed.subject || `${companyName} — automação de atendimento`;
            messageContent = parsed.body || aiContent;
          }
        } catch { /* use raw */ }
      }

      // WhatsApp via EZ Chat
      if (isWhatsApp && lead.whatsapp) {
        const num = lead.whatsapp.replace(/\D/g, '');
        if (num.length >= 10) {
          try {
            await supabase.functions.invoke('send-whatsapp', { body: { sender: num, message: messageContent } });
          } catch (e) { console.error('WA error:', e); }
        }
      }

      // Email via Resend
      if (isEmail && lead.email) {
        const resendKey = Deno.env.get('RESEND_API_KEY');
        if (resendKey) {
          const senderName = sdrProfile?.name || 'EZ Journey';
          try {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: `${senderName} <noreply@notifications.ezsoft.com.br>`,
                to: [lead.email],
                subject: emailSubject || `${companyName} — automação de atendimento`,
                html: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6">${messageContent.replace(/\n/g, '<br>')}</div>`,
              }),
            });
          } catch (e) { console.error('Email error:', e); }
        }
      }

      // ── 11. Log ──
      await supabase.from('sdr_follow_up_logs').insert({
        lead_id: lead.id,
        sdr_user_id: lead.owner_user_id,
        step_number: currentStep,
        lead_status: lead.status,
        channel: currentRule.channel,
        message_content: messageContent,
        subject: emailSubject || null,
        ai_context: {
          lead_status: lead.status,
          tone: currentRule.tone,
          strategy: currentRule.strategy,
          segment: lead.company_segment || lead.cnae_fiscal_descricao,
          porte: lead.porte,
          temperature: lead.temperature,
          had_call_analysis: !!callAnalysis,
          sdr_profile_used: !!sdrProfile?.writing_style,
          top_sdr_used: !sdrProfile?.writing_style && !!topSdr?.writing_style,
        },
        status: 'sent',
      });

      await supabase.from('lead_activity_logs').insert({
        lead_id: lead.id,
        action_type: 'interaction_added',
        description: `[Ghost SDR] Outreach #${currentStep} enviado via ${currentRule.channel} (${currentRule.strategy})`,
        user_id: lead.owner_user_id,
      });

      sent++;
      if (sent >= 15) break; // Rate limit
    }

    await supabase.from('cron_locks').delete().eq('job_name', lockName);

    console.log(`[ghost-sdr] Done. Sent: ${sent}, Skipped: ${skipped}`);
    return new Response(JSON.stringify({ sent, skipped, total: (leads || []).length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[ghost-sdr] Error:', e);
    try { await supabase.from('cron_locks').delete().eq('job_name', 'ghost-sdr'); } catch { /* ignore */ }
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
