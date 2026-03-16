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

  try {
    const { proposal_id } = await req.json();
    if (!proposal_id) {
      return new Response(JSON.stringify({ error: "proposal_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Throttle: check if last view notification was < 30 min ago
    const { data: recentView } = await supabase
      .from("proposal_views")
      .select("viewed_at")
      .eq("proposal_id", proposal_id)
      .order("viewed_at", { ascending: false })
      .limit(2); // current + previous

    if (recentView && recentView.length >= 2) {
      const previousView = new Date(recentView[1].viewed_at);
      const now = new Date();
      const diffMs = now.getTime() - previousView.getTime();
      if (diffMs < 30 * 60 * 1000) {
        return new Response(
          JSON.stringify({ skipped: true, reason: "throttled" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get proposal data
    const { data: proposal, error: propError } = await supabase
      .from("proposals")
      .select("id, company_name, created_by_user_id, view_count")
      .eq("id", proposal_id)
      .single();

    if (propError || !proposal) {
      console.error("Proposal not found:", propError);
      return new Response(
        JSON.stringify({ error: "proposal not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const closerId = proposal.created_by_user_id;
    if (!closerId) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no closer" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get closer profile
    const { data: closer } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("id", closerId)
      .single();

    if (!closer) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "closer profile not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const viewCount = proposal.view_count || 1;
    const companyName = proposal.company_name || "Empresa";
    const now = new Date();
    const timeStr = now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    // 1. In-app notification
    await supabase.from("notifications").insert({
      user_id: closerId,
      title: "Proposta visualizada",
      message: `A empresa ${companyName} abriu sua proposta. Visualizações: ${viewCount}`,
      type: "proposal_view",
      link: "/closer-pipeline",
    });

    // 2. Email via shared helper
    if (closer.email) {
      const { sendNotificationEmail, buildEmailCard, buildEmailButton } = await import('../_shared/email-sender.ts');
      const appUrl = Deno.env.get("SITE_URL") || "https://ez-journey.lovable.app";

      const cardHtml = buildEmailCard(`
        <div style="background: #f8f6ff; border-radius: 8px; padding: 16px;">
          <table style="width: 100%; font-size: 14px; color: #333;">
            <tr>
              <td style="padding: 6px 0; color: #888;">Empresa</td>
              <td style="padding: 6px 0; font-weight: 600; text-align: right;">${companyName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #888;">Horário</td>
              <td style="padding: 6px 0; font-weight: 600; text-align: right;">${timeStr}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #888;">Total de visualizações</td>
              <td style="padding: 6px 0; font-weight: 600; text-align: right;">${viewCount}</td>
            </tr>
          </table>
        </div>
      `);

      const bodyHtml = `
        <p style="color: #333; font-size: 15px; margin-top: 0;">Olá <strong>${closer.name}</strong>,</p>
        <p style="color: #555; font-size: 14px; line-height: 1.6;">Um cliente abriu sua proposta comercial.</p>
        <div style="margin: 20px 0;">${cardHtml}</div>
        <p style="color: #555; font-size: 13px; text-align: center; line-height: 1.5;">
          Este é o momento ideal para entrar em contato e conduzir a negociação. 🚀
        </p>
        ${buildEmailButton('Acessar Pipeline', `${appUrl}/closer-pipeline`)}
      `;

      try {
        await sendNotificationEmail({
          to: closer.email,
          subject: `Proposta visualizada: ${companyName}`,
          bodyHtml,
          headerTitle: 'Proposta Visualizada',
        });
      } catch (emailErr) {
        console.error("Failed to send email:", emailErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("notify-proposal-view error:", err);
    return new Response(
      JSON.stringify({ error: "internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
