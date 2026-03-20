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
      id, sequence_id, lead_id, current_step, status, enrolled_by,
      email_sequences!inner(name, active),
      leads!inner(name, company, email, razao_social, nome_fantasia, cnae_fiscal_descricao, cnaes_secundarios, segment)
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
      const enrolledBy = (enrollment as any).enrolled_by as string | null;

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

      // Get sender info (person who enrolled the lead)
      // Fallback to Rodrigo if enroller is inactive/not found
      const FALLBACK_NAME = "Rodrigo Schumann";
      const FALLBACK_EMAIL = "rodrigo@ezsoft.com.br";
      let senderName = FALLBACK_NAME;
      let replyTo: string = FALLBACK_EMAIL;

      if (enrolledBy) {
        const { data: senderProfile } = await supabase
          .from("profiles")
          .select("name, email, active")
          .eq("id", enrolledBy)
          .single();

        if (senderProfile?.active && senderProfile.name) {
          senderName = senderProfile.name;
          replyTo = senderProfile.email || FALLBACK_EMAIL;
        }
      }

      // Replace variables in subject and body
      const contactName = lead.name || "Contato";
      const companyName = lead.razao_social || lead.nome_fantasia || lead.company || "";

      let subject = step.subject
        .replace(/\{\{nome_contato\}\}/g, contactName)
        .replace(/\{\{empresa\}\}/g, companyName);

      let bodyHtml = step.body
        .replace(/\{\{nome_contato\}\}/g, contactName)
        .replace(/\{\{empresa\}\}/g, companyName);

      // AI Personalization: generate content based on CNAE/segment
      if (step.ai_personalize) {
        const cnaeDesc = lead.cnae_fiscal_descricao || "";
        const cnaesSecundarios = lead.cnaes_secundarios || "";
        const segment = lead.segment || "";
        const segmentInfo = [cnaeDesc, cnaesSecundarios, segment].filter(Boolean).join(" | ");

        const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
        if (ANTHROPIC_API_KEY && segmentInfo) {
          try {
            const stripHtml = (html: string) => html.replace(/<[^>]*>/g, "").trim();
            const directive = stripHtml(bodyHtml);

            const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "claude-sonnet-4-20250514",
                max_tokens: 1024,
                messages: [{
                  role: "user",
                  content: `Você é um especialista em vendas B2B de soluções de automação (chatbots, CRM, atendimento digital).

Gere um e-mail comercial personalizado em HTML seguindo estas regras:
- Destinatário: ${contactName} da empresa ${companyName}
- Segmento da empresa (CNAE): ${segmentInfo}
- Remetente: ${senderName}
- Diretriz do e-mail: ${directive}
- Step ${enrollment.current_step} de uma sequência de follow-up chamada "${sequence.name}"

REGRAS:
- Escreva em português brasileiro, tom profissional mas amigável
- Cite automações, vantagens e diferenciais ESPECÍFICOS para o segmento do cliente
- Dê exemplos concretos de como a automação beneficia empresas desse setor
- Máximo 200 palavras
- Retorne APENAS o HTML do corpo do e-mail (sem <html>, <head>, <body>)
- Use tags simples: <p>, <strong>, <ul>, <li>
- NÃO inclua assunto, apenas o corpo
- NÃO inclua saudação genérica tipo "Prezado", use o nome do contato naturalmente`,
                }],
              }),
            });

            if (aiRes.ok) {
              const aiData = await aiRes.json();
              const aiContent = aiData.content?.[0]?.text || "";
              if (aiContent.length > 50) {
                bodyHtml = aiContent;
                console.log(`[sequences] AI personalized email for ${companyName} (CNAE: ${cnaeDesc})`);
              }
            } else {
              console.error(`[sequences] AI personalization failed: ${aiRes.status}`);
            }
          } catch (aiErr) {
            console.error("[sequences] AI personalization error:", aiErr);
            // Falls back to original template
          }
        }
      }

      // Send email via Resend — from the person who enrolled
      const html = buildEmailTemplate({
        bodyHtml,
        headerTitle: sequence.name,
      });

      const emailPayload: Record<string, unknown> = {
        from: `${senderName} <noreply@notifications.ezsoft.com.br>`,
        to: [lead.email],
        reply_to: replyTo,
        subject,
        html,
      };

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailPayload),
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
