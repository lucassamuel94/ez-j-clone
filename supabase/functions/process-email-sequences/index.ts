import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildEmailTemplate } from "../_shared/email-sender.ts";

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
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!resendApiKey) {
    return new Response(
      JSON.stringify({ error: "RESEND_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Fetch active enrollments ready to send, excluding ones currently being processed
  const { data: enrollments, error: enrollErr } = await supabase
    .from("email_sequence_enrollments")
    .select(`
      id, sequence_id, lead_id, current_step, status,
      email_sequences!inner(name, active),
      leads!inner(name, company, email, razao_social, nome_fantasia)
    `)
    .eq("status", "active")
    .lte("next_send_at", new Date().toISOString())
    .or("processing_at.is.null,processing_at.lt." + new Date(Date.now() - 5 * 60 * 1000).toISOString());

  if (enrollErr) {
    console.error("Error fetching enrollments:", enrollErr);
    return new Response(JSON.stringify({ error: enrollErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  let errors = 0;

  for (const enrollment of enrollments || []) {
    try {
      // Acquire processing lock — only proceed if we successfully set it
      const { data: lockResult, error: lockErr } = await supabase
        .from("email_sequence_enrollments")
        .update({ processing_at: new Date().toISOString() })
        .eq("id", enrollment.id)
        .or("processing_at.is.null,processing_at.lt." + new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .select("id")
        .single();

      if (lockErr || !lockResult) {
        // Another instance already locked this enrollment
        continue;
      }

      const lead = enrollment.leads as any;
      const sequence = enrollment.email_sequences as any;

      if (!sequence.active || !lead.email) {
        // Release lock
        await supabase
          .from("email_sequence_enrollments")
          .update({ processing_at: null })
          .eq("id", enrollment.id);
        continue;
      }

      // Get current step
      const { data: step } = await supabase
        .from("email_sequence_steps")
        .select("*")
        .eq("sequence_id", enrollment.sequence_id)
        .eq("step_number", enrollment.current_step)
        .single();

      if (!step) {
        // No step found, mark as completed
        await supabase
          .from("email_sequence_enrollments")
          .update({ status: "completed", processing_at: null, updated_at: new Date().toISOString() })
          .eq("id", enrollment.id);
        continue;
      }

      // Replace variables in subject and body
      const contactName = lead.name || "Contato";
      const companyName = lead.razao_social || lead.nome_fantasia || lead.company || "";

      const subject = step.subject
        .replace(/\{\{nome_contato\}\}/g, contactName)
        .replace(/\{\{empresa\}\}/g, companyName);

      const bodyHtml = step.body
        .replace(/\{\{nome_contato\}\}/g, contactName)
        .replace(/\{\{empresa\}\}/g, companyName);

      // Send email via Resend
      const html = buildEmailTemplate({
        bodyHtml,
        headerTitle: sequence.name,
      });

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "EZ Journey CRM <noreply@notifications.ezsoft.com.br>",
          to: [lead.email],
          subject,
          html,
        }),
      });

      if (!resendRes.ok) {
        const errText = await resendRes.text();
        console.error(`Resend error for enrollment ${enrollment.id}:`, errText);
        // Release lock on failure
        await supabase
          .from("email_sequence_enrollments")
          .update({ processing_at: null })
          .eq("id", enrollment.id);
        errors++;
        continue;
      }

      const resendData = await resendRes.json();

      // Log the sent email
      await supabase.from("email_sequence_logs").insert({
        enrollment_id: enrollment.id,
        step_id: step.id,
        resend_message_id: resendData.id || null,
      });

      // Check if there's a next step
      const { data: nextStep } = await supabase
        .from("email_sequence_steps")
        .select("step_number, delay_hours")
        .eq("sequence_id", enrollment.sequence_id)
        .eq("step_number", enrollment.current_step + 1)
        .single();

      if (nextStep) {
        const nextSendAt = new Date(
          Date.now() + nextStep.delay_hours * 60 * 60 * 1000
        ).toISOString();

        await supabase
          .from("email_sequence_enrollments")
          .update({
            current_step: nextStep.step_number,
            next_send_at: nextSendAt,
            processing_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", enrollment.id);
      } else {
        // Last step — mark as completed
        await supabase
          .from("email_sequence_enrollments")
          .update({
            status: "completed",
            processing_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", enrollment.id);
      }

      sent++;
    } catch (e) {
      console.error(`Error processing enrollment ${enrollment.id}:`, e);
      // Release lock on exception
      try {
        await supabase
          .from("email_sequence_enrollments")
          .update({ processing_at: null })
          .eq("id", enrollment.id);
      } catch (_) { /* ignore cleanup errors */ }
      errors++;
    }
  }

  return new Response(
    JSON.stringify({ processed: (enrollments || []).length, sent, errors }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
