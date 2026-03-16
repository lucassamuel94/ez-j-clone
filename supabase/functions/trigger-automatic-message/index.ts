import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Convert Markdown formatting to WhatsApp-compatible formatting */
function markdownToWhatsApp(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/__(.+?)__/g, '*$1*')
    .replace(/~~(.+?)~~/g, '~$1~')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/```\w*\n?/g, '').trim())
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/%%/g, '%');
}

interface TriggerPayload {
  trigger_key: string;
  message_id?: string; // When set, process ONLY this specific message (used by cron)
  lead_id?: string;
  opportunity_id?: string;
  project_id?: string;
  context?: Record<string, string>;
  _trigger_source?: string; // "cron" | "event" | "manual_test"
  _test_user_id?: string; // For manual test: send only to this user
}

// Rate limiting: max 30 per minute per channel
const sendTimestamps: Record<string, number[]> = {};
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(channel: string): boolean {
  const now = Date.now();
  if (!sendTimestamps[channel]) sendTimestamps[channel] = [];
  sendTimestamps[channel] = sendTimestamps[channel].filter(t => now - t < RATE_WINDOW_MS);
  if (sendTimestamps[channel].length >= RATE_LIMIT) return false;
  sendTimestamps[channel].push(now);
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const payload: TriggerPayload = await req.json();
    const { trigger_key, message_id, lead_id, opportunity_id, project_id, context: extraContext, _trigger_source, _test_user_id } = payload;
    const triggerSource = _trigger_source || "event";

    if (!trigger_key && !message_id) {
      return new Response(
        JSON.stringify({ error: "trigger_key ou message_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[trigger] key=${trigger_key}, message_id=${message_id}, lead=${lead_id}, opp=${opportunity_id}, proj=${project_id}, source=${triggerSource}`);

    // 1. Find matching messages
    let messages: Record<string, unknown>[] | null = null;
    let msgError: Error | null = null;

    if (message_id) {
      // Cron path or manual test: process ONLY this specific message
      const query = supabase
        .from("automatic_messages")
        .select("*")
        .eq("id", message_id);
      // For manual tests/force sends, allow inactive messages too
      if (triggerSource !== "manual_test" && triggerSource !== "manual_force") {
        query.eq("is_active", true);
      }
      const result = await query;
      messages = result.data;
      msgError = result.error;
    } else {
      // Event path: match by trigger_key (original behavior)
      const triggerParts = trigger_key!.split(':');
      const matchKeys = [trigger_key!];
      if (triggerParts.length >= 2) {
        matchKeys.push(triggerParts[0]);
        if (triggerParts.length === 2) matchKeys.push(`${triggerParts[0]}:*`);
        if (triggerParts.length === 3) {
          matchKeys.push(`${triggerParts[0]}:${triggerParts[1]}`);
          matchKeys.push(`${triggerParts[0]}:*`);
          matchKeys.push(`${triggerParts[0]}:${triggerParts[1]}:*`);
        }
      }

      const result = await supabase
        .from("automatic_messages")
        .select("*")
        .in("trigger_key", [...new Set(matchKeys)])
        .eq("is_active", true);
      messages = result.data;
      msgError = result.error;
    }

    if (msgError) throw msgError;
    if (!messages || messages.length === 0) {
      console.log(`[trigger] No active messages for key=${trigger_key}, message_id=${message_id}`);
      return new Response(
        JSON.stringify({ sent: 0, message: "Nenhuma mensagem ativa para este trigger" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Resolve context data
    const vars: Record<string, string> = { ...extraContext };
    await resolveContext(supabase, vars, { lead_id, opportunity_id, project_id, trigger_key });

    console.log(`[trigger] Resolved vars:`, Object.keys(vars));

    // 3. Process each message
    const results: Array<{ message_id: string; sent_to: string[]; errors: string[] }> = [];

    for (const msg of messages) {
      const sentTo: string[] = [];
      const errors: string[] = [];
      const recipientsResolved: Array<{ id?: string; name: string; channel: string }> = [];
      const recipientsIgnored: Array<{ id?: string; name: string; reason: string }> = [];
      let aiUsed = false;
      let aiResponseTimeMs: number | undefined;

      // ── Resolve message body (AI or template) ──
      let body = msg.body || "";

      if (msg.ai_enabled && msg.ai_prompt) {
        aiUsed = true;
        const aiResult = await generateWithAI(vars, msg.ai_prompt, msg.body);
        body = aiResult.body;
        aiResponseTimeMs = aiResult.responseTimeMs;
        if (aiResult.failed) {
          errors.push(aiResult.errorMessage || "AI generation failed");
          if (!body) {
            // No fallback body — cancel
            await logDispatch(supabase, {
              message_id: msg.id, triggerSource, recipientsResolved, recipientsIgnored,
              channel: (msg.channels || [])[0] || "whatsapp", status: "failed",
              errorReason: "AI failed, no fallback body", aiUsed, aiResponseTimeMs, messageBody: "",
            });
            await notifyAdmin(supabase, "Falha de IA sem fallback", `Mensagem "${msg.name}": IA falhou e não há corpo manual. Envio cancelado.`);

            await supabase.from("automatic_messages").update({
              last_dispatch_status: "failed",
              last_dispatch_at: new Date().toISOString(),
            }).eq("id", msg.id);

            results.push({ message_id: msg.id, sent_to: sentTo, errors });
            continue;
          }
        }
      }

      // Replace variables — unresolved → empty string (item 7)
      body = replaceVars(body, vars);
      body = markdownToWhatsApp(body);

      // ── Determine recipients ──
      const msgSender = String(msg.sender || "");
      const msgChannels = Array.isArray(msg.channels) ? (msg.channels as string[]) : [];

      const recipients: Array<{ id?: string; whatsapp?: string; email?: string; name: string }> = [];

      // Manual test mode: override recipients with the test user only
      if (_test_user_id) {
        const { data: testProfile } = await supabase
          .from("profiles")
          .select("name, whatsapp, email")
          .eq("id", _test_user_id)
          .single();
        if (testProfile?.whatsapp) {
          recipients.push({ id: _test_user_id, whatsapp: testProfile.whatsapp, email: testProfile.email || "", name: testProfile.name || "Teste" });
        } else {
          errors.push("Usuário de teste sem WhatsApp cadastrado");
          recipientsIgnored.push({ id: _test_user_id, name: testProfile?.name || "", reason: "sem_whatsapp" });
        }
      } else if (msg.target_type === "group" && msgSender.startsWith("group:")) {
        // Group mode: send message to the group's phone_or_id as sender
        const groupId = msgSender.replace("group:", "");
        const { data: grp } = await supabase
          .from("whatsapp_groups")
          .select("name, phone_or_id")
          .eq("id", groupId)
          .single();
        if (grp?.phone_or_id) {
          recipients.push({ whatsapp: grp.phone_or_id, name: grp.name || "Grupo" });
        } else {
          errors.push("Grupo não encontrado ou sem ID configurado");
          recipientsIgnored.push({ name: groupId, reason: "group_not_found" });
        }
      } else if (msg.target_type === "dynamic") {
        const dynamicRecipients: string[] = msg.dynamic_recipients || [];
        for (const role of dynamicRecipients) {
          const wa = vars[`${role}_whatsapp`];
          const email = vars[`${role}_email`] || "";
          const name = vars[role] || role;

          if (wa) {
            recipients.push({ whatsapp: wa, email, name });
          } else {
            // Item 5 & 6: fallback chain for critical roles
            if (["closer", "sdr"].includes(role)) {
              if (email && msg.channels?.includes("email")) {
                recipients.push({ email, name, whatsapp: undefined });
                recipientsIgnored.push({ name, reason: "sem_whatsapp_fallback_email" });
              } else {
                // Push notification fallback
                const userId = vars[`${role}_user_id`];
                if (userId) {
                  await supabase.from("notifications").insert({
                    user_id: userId,
                    title: `Mensagem automática: ${msg.name}`,
                    message: body.substring(0, 200),
                    type: "automatic_message",
                  });
                  recipientsIgnored.push({ id: userId, name, reason: "sem_whatsapp_sem_email_push_sent" });
                } else {
                  recipientsIgnored.push({ name, reason: "sem_whatsapp_not_assigned" });
                }
              }
              errors.push(`${role}: sem WhatsApp cadastrado`);
            } else {
              // Item 6: non-critical role not resolved — skip only this recipient
              recipientsIgnored.push({ name, reason: "not_assigned" });
              console.log(`[trigger] Dynamic role "${role}" not resolved, skipping`);
            }
          }
        }
      } else if (msg.target_type === "all" || msg.target_type === "department" || msg.target_type === "roles" || msg.target_type === "users") {
        const userIds = await resolveStaticRecipients(supabase, msg);
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, name, whatsapp, email")
            .in("id", userIds);
          for (const profile of profiles || []) {
            if (profile.whatsapp) {
              recipients.push({ id: profile.id, whatsapp: profile.whatsapp, email: profile.email || "", name: profile.name || "" });
            } else {
              recipientsIgnored.push({ id: profile.id, name: profile.name || "", reason: "sem_whatsapp" });
            }
          }
        }
      }

      // ── Send via channels ──

      for (const recipient of recipients) {
        if (msgChannels.includes("whatsapp") && recipient.whatsapp) {
          if (checkRateLimit("whatsapp")) {
            const success = await sendWhatsApp(recipient.whatsapp, body);
            if (success) {
              sentTo.push(recipient.whatsapp);
              recipientsResolved.push({ id: recipient.id, name: recipient.name, channel: "whatsapp" });
            } else {
              errors.push(`Falha ao enviar para ${recipient.name}`);
            }
          } else {
            errors.push(`Rate limit: ${recipient.name}`);
          }
        }
        // Email channel: not yet implemented in this orchestrator
        // (individual emails are sent via send-gmail; automatic emails via process-email-sequences)
        if (msgChannels.includes("email") && recipient.email && !msgChannels.includes("whatsapp")) {
          recipientsIgnored.push({ id: recipient.id, name: recipient.name, reason: "email_not_implemented" });
        }
      }

      // ── Log dispatch ──
      const status = errors.length === 0 && sentTo.length > 0 ? "sent" :
                     sentTo.length > 0 && errors.length > 0 ? "partial" :
                     sentTo.length === 0 && recipientsIgnored.length > 0 ? "skipped" : "failed";

      await logDispatch(supabase, {
        message_id: msg.id, triggerSource, recipientsResolved, recipientsIgnored,
        channel: (msg.channels || [])[0] || "whatsapp", status,
        errorReason: errors.length > 0 ? errors.join("; ") : undefined,
        aiUsed, aiResponseTimeMs, messageBody: body,
      });

      // Update last dispatch status on the message
      await supabase.from("automatic_messages").update({
        last_dispatch_status: status,
        last_dispatch_at: new Date().toISOString(),
      }).eq("id", msg.id);

      results.push({ message_id: msg.id, sent_to: sentTo, errors });
      console.log(`[trigger] msg=${msg.name}: sent=${sentTo.length}, errors=${errors.length}, ignored=${recipientsIgnored.length}`);
    }

    return new Response(
      JSON.stringify({ sent: results.reduce((s, r) => s + r.sent_to.length, 0), results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[trigger] error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/** Replace {{var}} — unresolved vars become empty string */
function replaceVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

/** Generate body via AI with retry + backoff (item 8) */
async function generateWithAI(
  vars: Record<string, string>,
  aiPrompt: string,
  fallbackBody: string
): Promise<{ body: string; failed: boolean; errorMessage?: string; responseTimeMs?: number }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return { body: fallbackBody, failed: true, errorMessage: "LOVABLE_API_KEY not configured" };
  }

  const prompt = replaceVars(aiPrompt, vars);
  const dataLines: string[] = [];
  for (const [k, v] of Object.entries(vars)) {
    if (v && v !== `{{${k}}}`) dataLines.push(`${k} = ${v}`);
  }
  const dataContext = dataLines.length > 0
    ? `\n\nDADOS REAIS (use exatamente estes valores, NÃO invente números nem use placeholders):\n${dataLines.join("\n")}`
    : "";

  const delays = [1000, 3000, 9000]; // exponential backoff
  let lastError = "";

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, delays[attempt - 1]));

    try {
      const startTime = Date.now();
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: "Você cria mensagens de WhatsApp corporativas. Use APENAS formatação do WhatsApp: *negrito*, _itálico_, ~tachado~. NÃO use Markdown. Responda APENAS com o texto da mensagem. IMPORTANTE: Use SOMENTE os dados reais fornecidos. NUNCA use placeholders como [Inserir Número], [Nome], etc. Se um dado não estiver disponível, omita a linha.",
            },
            { role: "user", content: prompt + dataContext },
          ],
        }),
      });
      const responseTimeMs = Date.now() - startTime;

      if (resp.ok) {
        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content) return { body: content, failed: false, responseTimeMs };
      } else {
        lastError = `HTTP ${resp.status}`;
        await resp.text(); // consume
        if (resp.status === 429 || resp.status >= 500) continue;
        break;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  // All retries failed — use fallback body if available
  console.error(`[generateWithAI] All retries failed: ${lastError}`);
  if (fallbackBody?.trim()) {
    return { body: fallbackBody, failed: true, errorMessage: `AI failed after 3 attempts: ${lastError}, using fallback` };
  }
  return { body: "", failed: true, errorMessage: `AI failed: ${lastError}, no fallback` };
}

/** Send WhatsApp via direct GET to EZChat API */
async function sendWhatsApp(sender: string, message: string): Promise<boolean> {
  const EZCHAT_URL = "https://api.ezchatbot.ai/run/a13ae890-a753-4d54-802a-ab1db27d906e/";
  const EZCHAT_TOKEN = Deno.env.get("EZCHAT_API_TOKEN");
  if (!EZCHAT_TOKEN) {
    console.error("[sendWhatsApp] EZCHAT_API_TOKEN not configured");
    return false;
  }
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const url = new URL(EZCHAT_URL);
      url.searchParams.set("sender", sender);
      url.searchParams.set("token", EZCHAT_TOKEN);
      if (message) url.searchParams.set("message", message);

      const resp = await fetch(url.toString(), { method: "GET" });
      if (resp.ok) {
        console.log(`[sendWhatsApp] OK for ${sender}`);
        return true;
      }
      const status = resp.status;
      if ((status === 429 || status >= 500) && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 300 * attempt));
        continue;
      }
      console.error(`[sendWhatsApp] HTTP ${status} for ${sender}`);
      return false;
    } catch (e) {
      console.error(`[sendWhatsApp] attempt ${attempt} error for ${sender}:`, e);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 300 * attempt));
        continue;
      }
      return false;
    }
  }
  return false;
}

/** Resolve static recipients (all/department/roles/users) into user IDs */
async function resolveStaticRecipients(
  supabase: ReturnType<typeof createClient>,
  msg: Record<string, unknown>
): Promise<string[]> {
  const targetType = msg.target_type as string;

  if (targetType === "users" && Array.isArray(msg.target_user_ids)) {
    return msg.target_user_ids as string[];
  }
  if (targetType === "department" && Array.isArray(msg.target_departments)) {
    const teamIds = msg.target_departments as string[];
    const { data: members } = await supabase.from("team_members").select("user_id").in("team_id", teamIds);
    return [...new Set((members || []).map((m: { user_id: string }) => m.user_id))];
  }
  if (targetType === "roles" && Array.isArray(msg.target_roles)) {
    const roleIds = msg.target_roles as string[];
    const { data: userRoles } = await supabase.from("user_roles").select("user_id").in("role_id", roleIds);
    return [...new Set((userRoles || []).map((r: { user_id: string }) => r.user_id))];
  }
  if (targetType === "all") {
    const { data: profiles } = await supabase.from("profiles").select("id").eq("active", true);
    return (profiles || []).map((p: { id: string }) => p.id);
  }
  return [];
}

/** Resolve all context variables */
async function resolveContext(
  supabase: ReturnType<typeof createClient>,
  vars: Record<string, string>,
  ctx: { lead_id?: string; opportunity_id?: string; project_id?: string; trigger_key: string }
) {
  const { lead_id, opportunity_id, project_id, trigger_key } = ctx;

  if (opportunity_id) {
    const { data: opp } = await supabase
      .from("opportunities")
      .select("lead_id, assigned_to_user_id, sdr_user_id, deal_value, stage")
      .eq("id", opportunity_id)
      .single();

    if (opp) {
      if (opp.assigned_to_user_id) {
        const { data: p } = await supabase.from("profiles").select("name, whatsapp, email").eq("id", opp.assigned_to_user_id).single();
        if (p) { vars.closer = p.name || ""; vars.closer_whatsapp = p.whatsapp || ""; vars.closer_email = p.email || ""; vars.closer_user_id = opp.assigned_to_user_id; }
      }
      if (opp.sdr_user_id) {
        const { data: p } = await supabase.from("profiles").select("name, whatsapp, email").eq("id", opp.sdr_user_id).single();
        if (p) { vars.sdr = p.name || ""; vars.sdr_whatsapp = p.whatsapp || ""; vars.sdr_email = p.email || ""; vars.sdr_user_id = opp.sdr_user_id; }
      }
      if (opp.deal_value) vars.valor = String(opp.deal_value);

      const resolvedLeadId = lead_id || opp.lead_id;
      if (resolvedLeadId) {
        const { data: lead } = await supabase.from("leads").select("name, company, razao_social, nome_fantasia, whatsapp, phone, email, owner_user_id").eq("id", resolvedLeadId).single();
        if (lead) {
          vars.lead_name = lead.name || "";
          vars.empresa = lead.razao_social || lead.nome_fantasia || lead.company || "";
          vars.lead_whatsapp = lead.whatsapp || lead.phone || "";
          vars.lead_email = lead.email || "";
        }
      }
    }
  } else if (lead_id) {
    const { data: lead } = await supabase.from("leads").select("name, company, razao_social, nome_fantasia, whatsapp, phone, email, owner_user_id").eq("id", lead_id).single();
    if (lead) {
      vars.lead_name = lead.name || "";
      vars.empresa = lead.razao_social || lead.nome_fantasia || lead.company || "";
      vars.lead_whatsapp = lead.whatsapp || lead.phone || "";
      vars.lead_email = lead.email || "";
      if (lead.owner_user_id) {
        const { data: p } = await supabase.from("profiles").select("name, whatsapp, email").eq("id", lead.owner_user_id).single();
        if (p) { vars.sdr = p.name || ""; vars.sdr_whatsapp = p.whatsapp || ""; vars.sdr_email = p.email || ""; vars.sdr_user_id = lead.owner_user_id; }
      }
    }
  }

  if (project_id) {
    const { data: project } = await supabase
      .from("projects")
      .select("client_name, dev_user_id, ux_po_user_id, treinamento_user_id, head_user_id, closer_user_id, sdr_user_id")
      .eq("id", project_id)
      .single();

    if (project) {
      if (!vars.empresa) vars.empresa = project.client_name || "";
      const roleUserMap: Record<string, string | null> = {
        dev: project.dev_user_id,
        ux_po: project.ux_po_user_id,
        treinamento: project.treinamento_user_id,
        head: project.head_user_id,
      };
      if (!vars.closer && project.closer_user_id) roleUserMap.closer = project.closer_user_id;
      if (!vars.sdr && project.sdr_user_id) roleUserMap.sdr = project.sdr_user_id;

      for (const [role, userId] of Object.entries(roleUserMap)) {
        if (userId && !vars[`${role}_whatsapp`]) {
          const { data: p } = await supabase.from("profiles").select("name, whatsapp, email").eq("id", userId).single();
          if (p) {
            vars[role] = p.name || "";
            vars[`${role}_whatsapp`] = p.whatsapp || "";
            vars[`${role}_email`] = p.email || "";
            vars[`${role}_user_id`] = userId;
          }
        }
      }
    }
  }

  if (trigger_key === 'parciais_sdr' || trigger_key.startsWith('parciais_sdr:')) {
    await resolveSDRMetrics(supabase, vars);
  }
}

/** Resolve SDR scheduling metrics for parciais_sdr reports */
async function resolveSDRMetrics(
  supabase: ReturnType<typeof createClient>,
  vars: Record<string, string>
): Promise<void> {
  try {
    const now = new Date();
    const spDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(now);

    const spMonth = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo", month: "numeric" });
    const spYear = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo", year: "numeric" });

    const startOfDay = `${spDate}T00:00:00-03:00`;
    const endOfDay = `${spDate}T23:59:59-03:00`;

    const spTime = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(now);

    // Count meetings today (same source as the SDR Execution Dashboard)
    const { data: todayMeetings } = await supabase
      .from("meetings")
      .select("user_id")
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay);

    const sdrCounts: Record<string, number> = {};
    let totalToday = 0;
    for (const m of todayMeetings || []) {
      if (!m.user_id) continue;
      sdrCounts[m.user_id] = (sdrCounts[m.user_id] || 0) + 1;
      totalToday++;
    }

    const { data: goals } = await supabase
      .from("goals")
      .select("target_user_id, meetings_scheduled_goal")
      .eq("goal_type", "sdr")
      .eq("period_month", parseInt(spMonth))
      .eq("period_year", parseInt(spYear))
      .not("target_user_id", "is", null);

    const sdrIds = [...new Set([...Object.keys(sdrCounts), ...(goals || []).map((g: { target_user_id: string }) => g.target_user_id)])];

    if (sdrIds.length === 0) return;

    const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", sdrIds);
    const nameMap: Record<string, string> = {};
    for (const p of profiles || []) nameMap[p.id] = p.name || "Sem nome";

    // Count meetings this month
    const startOfMonth = `${spYear}-${spMonth.padStart(2, "0")}-01T00:00:00-03:00`;
    const { data: monthMeetings } = await supabase
      .from("meetings")
      .select("user_id")
      .gte("created_at", startOfMonth);

    const monthCounts: Record<string, number> = {};
    let totalMonth = 0;
    for (const m of monthMeetings || []) {
      if (!m.user_id) continue;
      monthCounts[m.user_id] = (monthCounts[m.user_id] || 0) + 1;
      totalMonth++;
    }

    const goalMap: Record<string, number> = {};
    let totalGoal = 0;
    for (const g of goals || []) {
      goalMap[g.target_user_id] = g.meetings_scheduled_goal;
      totalGoal += g.meetings_scheduled_goal;
    }

    const allSdrIds = [...new Set([...Object.keys(sdrCounts), ...Object.keys(goalMap)])];
    allSdrIds.sort((a, b) => (sdrCounts[b] || 0) - (sdrCounts[a] || 0));

    const lines: string[] = [];
    for (const sdrId of allSdrIds) {
      const name = nameMap[sdrId] || "SDR";
      const firstName = name.split(" ")[0];
      const todayCount = sdrCounts[sdrId] || 0;
      const monthCount = monthCounts[sdrId] || 0;
      const goal = goalMap[sdrId] || 0;
      const pct = goal > 0 ? Math.round((monthCount / goal) * 100) : 0;
      lines.push(`• ${firstName}: ${todayCount} hoje (${monthCount}/${goal} mês - ${pct}%)`);
    }

    const totalPct = totalGoal > 0 ? Math.round((totalMonth / totalGoal) * 100) : 0;
    vars.total_agendamentos_hoje = String(totalToday);
    vars.total_agendamentos_mes = String(totalMonth);
    vars.meta_agendamentos = String(totalGoal);
    vars.percentual_agendamentos = `${totalPct}%`;
    vars.performance_sdrs = lines.join("\n");
    vars.horario = spTime;

    console.log(`[resolveSDRMetrics] today=${totalToday}, month=${totalMonth}, goal=${totalGoal}, sdrs=${allSdrIds.length}`);
  } catch (err) {
    console.error("[resolveSDRMetrics] error:", err);
  }
}

/** Log dispatch to message_dispatch_logs */
async function logDispatch(
  supabase: ReturnType<typeof createClient>,
  params: {
    message_id: string;
    triggerSource: string;
    recipientsResolved: Array<{ id?: string; name: string; channel: string }>;
    recipientsIgnored: Array<{ id?: string; name: string; reason: string }>;
    channel: string;
    status: string;
    errorReason?: string;
    aiUsed: boolean;
    aiResponseTimeMs?: number;
    messageBody: string;
  }
) {
  try {
    await supabase.from("message_dispatch_logs").insert({
      message_id: params.message_id,
      trigger_source: params.triggerSource,
      recipients_resolved: params.recipientsResolved,
      recipients_ignored: params.recipientsIgnored,
      channel: params.channel,
      status: params.status,
      error_reason: params.errorReason || null,
      ai_used: params.aiUsed,
      ai_response_time_ms: params.aiResponseTimeMs || null,
      message_body: params.messageBody,
    });
  } catch (e) {
    console.error("[logDispatch] error:", e);
  }
}

/** Notify all admins via push notification */
async function notifyAdmin(supabase: ReturnType<typeof createClient>, title: string, message: string) {
  try {
    const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    for (const admin of admins || []) {
      await supabase.from("notifications").insert({
        user_id: admin.user_id,
        title,
        message,
        type: "system",
      });
    }
  } catch (e) {
    console.error("[notifyAdmin] error:", e);
  }
}
