import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const payload = await req.json();

    // Resend webhook events: email.delivered, email.opened, email.bounced, email.complained
    // We care about replies — Resend sends email.replied or we detect via bounce-back
    const eventType = payload.type;
    const messageId = payload.data?.email_id;

    if (!messageId) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the log entry by resend_message_id
    const { data: logEntry } = await supabase
      .from("email_sequence_logs")
      .select("id, enrollment_id")
      .eq("resend_message_id", messageId)
      .single();

    if (!logEntry) {
      return new Response(JSON.stringify({ ok: true, message: "No matching log" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (eventType === "email.opened") {
      await supabase
        .from("email_sequence_logs")
        .update({ opened_at: new Date().toISOString() })
        .eq("id", logEntry.id);
    }

    // Clicked a link — strong engagement signal, stop the sequence
    if (eventType === "email.clicked") {
      await supabase
        .from("email_sequence_logs")
        .update({ replied_at: new Date().toISOString() })
        .eq("id", logEntry.id);

      await supabase
        .from("email_sequence_enrollments")
        .update({ status: "replied", updated_at: new Date().toISOString() })
        .eq("id", logEntry.enrollment_id);
    }

    // Bounced or complained — stop the sequence
    if (eventType === "email.bounced" || eventType === "email.complained") {
      await supabase
        .from("email_sequence_enrollments")
        .update({ status: "unsubscribed", updated_at: new Date().toISOString() })
        .eq("id", logEntry.enrollment_id);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
