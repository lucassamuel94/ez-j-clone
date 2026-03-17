import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EZCHAT_FLOW_BASE = "https://api.ezchatbot.ai/run/a13ae890-a753-4d54-802a-ab1db27d906e/";
const EZCHAT_TOKEN = "89854e63-8e44-4ecf-8791-64c32de5c6d6";

const NOTIFY_MAP: Record<string, { minutes: number; label: string }> = {
  "5min": { minutes: 5, label: "5 minutos" },
  "15min": { minutes: 15, label: "15 minutos" },
  "30min": { minutes: 30, label: "30 minutos" },
  "1h": { minutes: 60, label: "1 hora" },
  "1d": { minutes: 1440, label: "1 dia" },
  "2d": { minutes: 2880, label: "2 dias" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch eligible tasks
    const { data: tasks, error } = await (supabase.from("project_tasks") as any)
      .select("id, title, due_date, notify_before, assigned_user_id")
      .neq("status", "concluida")
      .not("notify_before", "is", null)
      .neq("notify_before", "none")
      .not("due_date", "is", null)
      .not("assigned_user_id", "is", null)
      .is("reminder_sent_at", null);

    if (error) {
      console.error("Query error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tasks || tasks.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = Date.now();
    let sent = 0;

    for (const task of tasks) {
      const config = NOTIFY_MAP[task.notify_before];
      if (!config) continue;

      const dueDate = new Date(task.due_date).getTime();
      const alertTime = dueDate - config.minutes * 60 * 1000;

      // Check if NOW is within [alertTime, alertTime + 1 minute)
      if (now < alertTime || now >= alertTime + 60_000) continue;

      // Fetch user whatsapp
      const { data: profile } = await supabase
        .from("profiles")
        .select("whatsapp")
        .eq("id", task.assigned_user_id)
        .single();

      const phone = (profile as any)?.whatsapp;
      if (!phone) {
        console.log(`No whatsapp for user ${task.assigned_user_id}, skipping task ${task.id}`);
        // Still mark as sent to avoid retrying endlessly
        await (supabase.from("project_tasks") as any)
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("id", task.id);
        continue;
      }

      const message = `🔔 Lembrete: a tarefa "${task.title}" vence em ${config.label}. Acesse o sistema para mais detalhes.`;

      // Send WhatsApp via EZ Chat
      const url = new URL(EZCHAT_FLOW_BASE);
      url.searchParams.set("sender", phone);
      url.searchParams.set("token", EZCHAT_TOKEN);
      url.searchParams.set("message", message);

      let success = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const resp = await fetch(url.toString(), { method: "GET" });
          if (resp.ok) {
            await resp.text();
            success = true;
            break;
          }
          const status = resp.status;
          await resp.text();
          if ((status === 429 || status >= 500) && attempt < 3) {
            await new Promise((r) => setTimeout(r, 300 * attempt));
            continue;
          }
          break;
        } catch (e) {
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 300 * attempt));
            continue;
          }
        }
      }

      if (success) {
        console.log(`Reminder sent for task ${task.id} to ${phone}`);
      } else {
        console.error(`Failed to send reminder for task ${task.id}`);
      }

      // Mark as sent regardless to avoid spam
      await (supabase.from("project_tasks") as any)
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", task.id);

      sent++;
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-task-reminders error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
