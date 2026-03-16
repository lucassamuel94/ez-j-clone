import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // ── 1. Acquire cron lock ──
    const lockName = "process-scheduled-messages";
    const lockTTL = 55; // seconds

    // Clean expired locks first
    await supabase.from("cron_locks").delete().lt("expires_at", new Date().toISOString());

    // Try to insert lock
    const { error: lockError } = await supabase.from("cron_locks").insert({
      job_name: lockName,
      locked_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + lockTTL * 1000).toISOString(),
    });

    if (lockError) {
      // Lock exists and not expired — skip
      console.log(`[process-scheduled-messages] Lock collision, skipping execution`);
      return new Response(
        JSON.stringify({ skipped: true, reason: "lock_collision" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Calculate São Paulo time ──
    const now = new Date();
    const spFormatter = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const currentTime = spFormatter.format(now);

    const spDayFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" });
    const dayStr = spDayFormatter.format(now);
    const dayOfWeekJS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(dayStr);

    const spDateFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", day: "numeric" });
    const dayOfMonth = parseInt(spDateFormatter.format(now), 10);

    const spMonthFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", month: "numeric" });
    const monthOfYear = parseInt(spMonthFormatter.format(now), 10);

    const spYearFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric" });
    const year = parseInt(spYearFormatter.format(now), 10);

    // ── 3. Check if today is a business day using national_holidays table ──
    const spDateStr = `${year}-${String(monthOfYear).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
    const isWeekend = dayOfWeekJS === 0 || dayOfWeekJS === 6;

    let isHoliday = false;
    const { data: holidayRow } = await supabase
      .from("national_holidays")
      .select("name")
      .eq("date", spDateStr)
      .maybeSingle();

    if (holidayRow) isHoliday = true;
    const isBizDay = !isWeekend && !isHoliday;

    // Check if holidays exist for current year
    const { count: holidayCount } = await supabase
      .from("national_holidays")
      .select("id", { count: "exact", head: true })
      .eq("year", year);

    if (!holidayCount || holidayCount === 0) {
      console.warn(`[process-scheduled-messages] ⚠️ No holidays found for year ${year}!`);
      // Notify admin
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      for (const admin of admins || []) {
        await supabase.from("notifications").insert({
          user_id: admin.user_id,
          title: "Feriados não cadastrados",
          message: `O ano ${year} não possui feriados cadastrados na tabela national_holidays. Mensagens agendadas para "Dias úteis" podem disparar em feriados.`,
          type: "system",
          link: "/settings",
        });
      }
    }

    // Get last day of current month for monthly fallback
    const lastDayOfMonth = new Date(year, monthOfYear, 0).getDate();

    console.log(`[process-scheduled-messages] time=${currentTime}, dayOfWeek=${dayOfWeekJS}, dayOfMonth=${dayOfMonth}, lastDayOfMonth=${lastDayOfMonth}, isBusinessDay=${isBizDay}, isHoliday=${isHoliday}${holidayRow ? ` (${holidayRow.name})` : ''}`);

    // ── 4. Fetch active scheduled messages ──
    const { data: messages, error } = await supabase
      .from("automatic_messages")
      .select("*")
      .eq("is_active", true)
      .not("schedule_type", "in", '("tempo_real","manual")')
      .not("schedule_time", "is", null);

    if (error) throw error;
    if (!messages || messages.length === 0) {
      console.log("[process-scheduled-messages] No scheduled messages found");
      await releaseLock(supabase, lockName);
      return new Response(
        JSON.stringify({ processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let triggered = 0;

    for (const msg of messages) {
      if (msg.schedule_time !== currentTime) continue;

      const scheduleType = msg.schedule_type as string;
      let skipReason = "";

      if (scheduleType === "diario") {
        // "Diário" = every day (Mon-Sun), NO holiday skip
        // No additional checks needed
      } else if (scheduleType === "dias_uteis") {
        // "Dias úteis" = Mon-Fri, skip holidays
        if (!isBizDay) {
          skipReason = isWeekend ? "weekend" : `holiday (${holidayRow?.name || "feriado"})`;
        }
      } else if (scheduleType === "semanal") {
        if (msg.schedule_day !== dayOfWeekJS) continue;
      } else if (scheduleType === "mensal") {
        const configuredDay = msg.schedule_day as number;
        if (configuredDay <= lastDayOfMonth) {
          // Normal case: day exists in this month
          if (configuredDay !== dayOfMonth) continue;
        } else {
          // Fallback: configured day > last day of month → fire on last day
          if (dayOfMonth !== lastDayOfMonth) continue;
          console.log(`[process-scheduled-messages] Monthly fallback: msg="${msg.name}" configured for day ${configuredDay}, firing on last day ${lastDayOfMonth}`);
        }
      } else {
        continue;
      }

      if (skipReason) {
        console.log(`[process-scheduled-messages] Skipping "${msg.name}" — ${skipReason}`);
        // Log the skip in dispatch logs
        await supabase.from("message_dispatch_logs").insert({
          message_id: msg.id,
          trigger_source: "cron",
          status: "skipped",
          error_reason: skipReason,
          channel: (msg.channels || [])[0] || "whatsapp",
        });
        continue;
      }

      const triggerKey = msg.trigger_key || `scheduled_${msg.id}`;
      console.log(`[process-scheduled-messages] Triggering msg="${msg.name}" trigger_key=${triggerKey}`);

      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/trigger-automatic-message`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ trigger_key: triggerKey, message_id: msg.id, _trigger_source: "cron" }),
        });
        const data = await resp.json();
        console.log(`[process-scheduled-messages] Result for "${msg.name}":`, JSON.stringify(data));
        triggered++;
        // Note: last_dispatch_status is updated by trigger-automatic-message with accurate data
      } catch (triggerErr) {
        console.error(`[process-scheduled-messages] Failed to trigger "${msg.name}":`, triggerErr);
        await supabase.from("automatic_messages").update({
          last_dispatch_status: "failed",
          last_dispatch_at: new Date().toISOString(),
        }).eq("id", msg.id);
        await supabase.from("message_dispatch_logs").insert({
          message_id: msg.id,
          trigger_source: "cron",
          status: "failed",
          error_reason: triggerErr instanceof Error ? triggerErr.message : "Unknown error",
          channel: (msg.channels || [])[0] || "whatsapp",
        });
      }
    }

    await releaseLock(supabase, lockName);

    console.log(`[process-scheduled-messages] Done. Triggered ${triggered} messages.`);
    return new Response(
      JSON.stringify({ processed: triggered }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[process-scheduled-messages] error:", e);
    // Try to release lock on error
    try { await supabase.from("cron_locks").delete().eq("job_name", "process-scheduled-messages"); } catch {}
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function releaseLock(supabase: any, jobName: string) {
  await supabase.from("cron_locks").delete().eq("job_name", jobName);
}
