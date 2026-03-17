import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendNotificationEmail, buildEmailButton, buildEmailCard } from "../_shared/email-sender.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Convert notify_before string to milliseconds */
function reminderToMs(val: string | null): number | null {
  if (!val || val === "none") return null;
  const map: Record<string, number> = {
    "5min": 5 * 60_000,
    "15min": 15 * 60_000,
    "30min": 30 * 60_000,
    "1h": 60 * 60_000,
    "1d": 24 * 60 * 60_000,
    "2d": 2 * 24 * 60 * 60_000,
  };
  return map[val] ?? null;
}

/** Simple delay for rate limiting */
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const nowMs = now.getTime();
    const nowIso = now.toISOString();
    const in24h = new Date(nowMs + 24 * 60 * 60 * 1000).toISOString();
    // Check tasks that became overdue in the last 6 hours (catch missed cron runs)
    const recentOverdueLimit = new Date(nowMs - 6 * 60 * 60 * 1000).toISOString();

    console.log(`[check-overdue-tasks] now=${nowIso}, in24h=${in24h}, overdueLimit=${recentOverdueLimit}`);

    // ── 1) Tasks due within next 24h (upcoming reminder) ──
    const { data: upcomingTasks, error: err1 } = await supabase
      .from("project_tasks")
      .select("id, title, due_date, assigned_user_id, project_id, notify_before, lead_id, opportunity_id")
      .in("status", ["pendente", "em_andamento"])
      .gt("due_date", nowIso)
      .lt("due_date", in24h)
      .not("assigned_user_id", "is", null);

    if (err1) throw err1;
    console.log(`[check-overdue-tasks] upcoming: ${upcomingTasks?.length || 0}`);

    // ── 2) Tasks that recently became overdue ──
    const { data: overdueTasks, error: err2 } = await supabase
      .from("project_tasks")
      .select("id, title, due_date, assigned_user_id, project_id, notify_before, lead_id, opportunity_id")
      .in("status", ["pendente", "em_andamento"])
      .lte("due_date", nowIso)
      .gte("due_date", recentOverdueLimit)
      .not("assigned_user_id", "is", null);

    if (err2) throw err2;
    console.log(`[check-overdue-tasks] overdue: ${overdueTasks?.length || 0}`);

    const allTasks = [...(upcomingTasks || []), ...(overdueTasks || [])];
    // Deduplicate by id
    const seen = new Set<string>();
    const tasks = allTasks.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    console.log(`[check-overdue-tasks] total unique tasks: ${tasks.length}`);

    let notified = 0;
    let emailsSent = 0;
    let skippedReminder = 0;
    let skippedExisting = 0;

    for (const task of tasks) {
      try {
        const dueMs = new Date(task.due_date).getTime();
        const isOverdue = dueMs <= nowMs;

        // For upcoming tasks with notify_before, check if we're within the reminder window
        if (!isOverdue && task.notify_before && task.notify_before !== "none") {
          const reminderMs = reminderToMs(task.notify_before);
          if (reminderMs !== null) {
            const reminderTriggerAt = dueMs - reminderMs;
            if (nowMs < reminderTriggerAt) {
              skippedReminder++;
              continue;
            }
          }
        }

        // Check if notification already sent for this task today
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", task.assigned_user_id)
          .eq("type", "task_due")
          .like("message", `%ID: ${task.id}%`)
          .gte("created_at", todayStart.toISOString())
          .limit(1);

        if (existing && existing.length > 0) {
          skippedExisting++;
          continue;
        }

        let link: string;
        if (task.project_id) {
          link = `/projects?project=${task.project_id}`;
        } else if (task.lead_id) {
          link = `/leads?lead=${task.lead_id}`;
        } else if (task.opportunity_id) {
          // Fetch the lead_id from the opportunity for navigation
          const { data: opp } = await supabase
            .from("opportunities")
            .select("lead_id")
            .eq("id", task.opportunity_id)
            .single();
          if (opp?.lead_id) {
            link = `/closer?lead=${opp.lead_id}&opp=${task.opportunity_id}`;
          } else {
            link = `/tasks?task=${task.id}`;
          }
        } else {
          link = `/tasks?task=${task.id}`;
        }

        const notifTitle = isOverdue ? "Tarefa vencida" : "Tarefa com prazo próximo";
        const notifMsg = isOverdue
          ? `A tarefa "${task.title}" já passou do prazo! ID: ${task.id}`
          : `A tarefa "${task.title}" vence em breve. ID: ${task.id}`;

        // Insert in-app notification
        const { error: insertErr } = await supabase.from("notifications").insert({
          user_id: task.assigned_user_id,
          title: notifTitle,
          message: notifMsg,
          type: "task_due",
          link,
        });

        if (insertErr) {
          console.error(`Insert error for task ${task.id}:`, insertErr);
          continue;
        }
        notified++;

        // Send email notification with rate limiting (max ~1.5 req/s)
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("name, email")
            .eq("id", task.assigned_user_id)
            .single();

          if (profile?.email) {
            await delay(700); // Rate limit: ~1.4 req/s to stay under Resend's 2 req/s

            const dueDate = new Date(task.due_date);
            const formattedDate = dueDate.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            const appUrl = Deno.env.get("SITE_URL") || Deno.env.get("APP_URL") || "https://ez-journey.lovable.app";
            const fullLink = `${appUrl}${link}`;

            const statusLabel = isOverdue ? "⚠️ Vencida" : `Vencimento: ${formattedDate}`;

            const bodyHtml = `
              <p style="color: #333; font-size: 15px;">
                Olá, <strong>${profile.name || "usuário"}</strong>!
              </p>
              <p style="color: #555; font-size: 14px;">
                ${isOverdue ? "Você tem uma tarefa que já passou do prazo:" : "Você tem uma tarefa com prazo próximo:"}
              </p>
              ${buildEmailCard(`
                <strong style="font-size: 14px;">${task.title}</strong>
                <br><span style="color: #777; font-size: 13px;">${statusLabel}</span>
              `)}
              ${buildEmailButton("Ver tarefa", fullLink)}
            `;

            const sent = await sendNotificationEmail({
              to: profile.email,
              subject: isOverdue
                ? `⚠️ Tarefa "${task.title}" está vencida`
                : `⏰ Tarefa "${task.title}" vence em breve`,
              bodyHtml,
              headerTitle: isOverdue ? "Tarefa Vencida" : "Lembrete de Tarefa",
            });
            if (sent) emailsSent++;
          }
        } catch (emailErr) {
          console.error(`Email error for task ${task.id}:`, emailErr);
        }
      } catch (taskErr) {
        console.error(`Error notifying task ${task.id}:`, taskErr);
      }
    }

    console.log(
      `[check-overdue-tasks] Done — checked: ${tasks.length}, notified: ${notified}, emails: ${emailsSent}, skippedReminder: ${skippedReminder}, skippedExisting: ${skippedExisting}`
    );

    return new Response(
      JSON.stringify({
        tasks_checked: tasks.length,
        notified,
        emails_sent: emailsSent,
        skipped_reminder: skippedReminder,
        skipped_existing: skippedExisting,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Error in check-overdue-tasks:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
