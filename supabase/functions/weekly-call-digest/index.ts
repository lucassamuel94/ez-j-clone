import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sendNotificationEmail,
  buildEmailCard,
  buildEmailButton,
} from "../_shared/email-sender.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AnalysisSummary {
  call_score: number | null;
  connection_effective: boolean | null;
  conversion_potential: number | null;
  next_step_defined: boolean | null;
  early_pitch: boolean | null;
  sdr_talk_percentage: number | null;
  lead_talk_percentage: number | null;
  objections: unknown;
  executive_summary: string | null;
}

async function generateDigestWithAI(
  sdrName: string,
  analyses: AnalysisSummary[],
): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return buildFallbackDigest(analyses);

  const scores = analyses.filter((a) => a.call_score != null).map((a) => a.call_score!);
  const avgScore = scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;

  const allObjections: string[] = [];
  for (const a of analyses) {
    if (a.objections && Array.isArray(a.objections)) {
      for (const obj of a.objections as Array<{ text?: string }>) {
        if (obj.text) allObjections.push(obj.text);
      }
    }
  }

  const connectionRate = analyses.filter((a) => a.connection_effective).length;
  const earlyPitchCount = analyses.filter((a) => a.early_pitch).length;
  const nextStepCount = analyses.filter((a) => a.next_step_defined).length;
  const avgSdrTalk = analyses
    .filter((a) => a.sdr_talk_percentage != null)
    .reduce((s, a) => s + a.sdr_talk_percentage!, 0) / (analyses.filter((a) => a.sdr_talk_percentage != null).length || 1);

  const prompt = `Você é um coach de vendas B2B. Gere um resumo semanal para o SDR "${sdrName}" baseado nas seguintes métricas de ${analyses.length} ligações analisadas:

- Score médio: ${avgScore}/100
- Taxa de conexão efetiva: ${connectionRate}/${analyses.length}
- Pitch precoce: ${earlyPitchCount}/${analyses.length}
- Próximo passo definido: ${nextStepCount}/${analyses.length}
- % fala SDR médio: ${Math.round(avgSdrTalk)}%
- Objeções encontradas: ${allObjections.slice(0, 10).join("; ") || "nenhuma registrada"}
- Resumos executivos: ${analyses.map((a) => a.executive_summary || "").filter(Boolean).slice(0, 5).join(" | ")}

Responda em HTML formatado com:
1. Uma saudação curta e motivacional
2. 📊 Resumo dos números (score, conexão, etc)
3. ✅ 3 Pontos positivos identificados
4. 🔧 3 Pontos de melhoria
5. 💡 2-3 Dicas práticas personalizadas
6. Uma mensagem motivacional de encerramento

Use tags HTML simples (p, strong, ul, li). Sem headers h1/h2. Mantenha conciso.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um coach de vendas B2B expert. Responda em HTML formatado e conciso." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      console.error("[weekly-digest] AI error:", res.status, await res.text());
      return buildFallbackDigest(analyses);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || buildFallbackDigest(analyses);
  } catch (e) {
    console.error("[weekly-digest] AI error:", e);
    return buildFallbackDigest(analyses);
  }
}

function buildFallbackDigest(analyses: AnalysisSummary[]): string {
  const scores = analyses.filter((a) => a.call_score != null).map((a) => a.call_score!);
  const avgScore = scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;
  const connectionRate = analyses.filter((a) => a.connection_effective).length;
  const nextStepCount = analyses.filter((a) => a.next_step_defined).length;

  return `
<p><strong>Resumo da Semana</strong></p>
<ul>
  <li>Ligações analisadas: <strong>${analyses.length}</strong></li>
  <li>Score médio: <strong>${avgScore}/100</strong></li>
  <li>Conexões efetivas: <strong>${connectionRate}/${analyses.length}</strong></li>
  <li>Próximo passo definido: <strong>${nextStepCount}/${analyses.length}</strong></li>
</ul>
<p>Acesse o dashboard Call Intelligence para mais detalhes.</p>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Lock
    const lockName = "weekly-call-digest";
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

    const { error: lockError } = await supabase
      .from("cron_locks")
      .insert({ job_name: lockName, expires_at: expiresAt });

    if (lockError) {
      const { data: existing } = await supabase
        .from("cron_locks")
        .select("expires_at")
        .eq("job_name", lockName)
        .single();

      if (existing && new Date(existing.expires_at) > now) {
        console.log("[weekly-digest] Already running, skipping");
        return new Response(JSON.stringify({ skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabase
        .from("cron_locks")
        .update({ expires_at: expiresAt, locked_at: now.toISOString() })
        .eq("job_name", lockName);
    }

    try {
      // Last 7 days
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Get completed analyses from last week grouped by SDR
      const { data: analyses, error: fetchError } = await supabase
        .from("call_analyses")
        .select(
          "sdr_user_id, call_score, connection_effective, conversion_potential, next_step_defined, early_pitch, sdr_talk_percentage, lead_talk_percentage, objections, executive_summary",
        )
        .eq("status", "completed")
        .gte("created_at", weekAgo)
        .limit(5000);

      if (fetchError) throw fetchError;
      if (!analyses?.length) {
        console.log("[weekly-digest] No completed analyses this week");
        return new Response(JSON.stringify({ message: "No analyses" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Group by SDR
      const bySdr = new Map<string, AnalysisSummary[]>();
      for (const a of analyses) {
        const list = bySdr.get(a.sdr_user_id) || [];
        list.push(a as AnalysisSummary);
        bySdr.set(a.sdr_user_id, list);
      }

      // Fetch SDR profiles
      const sdrIds = Array.from(bySdr.keys());
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", sdrIds);

      if (!profiles?.length) {
        console.log("[weekly-digest] No profiles found");
        return new Response(JSON.stringify({ message: "No profiles" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let emailsSent = 0;
      const appUrl = "https://ez-journey.lovable.app";

      for (const profile of profiles) {
        if (!profile.email) continue;

        const sdrAnalyses = bySdr.get(profile.id);
        if (!sdrAnalyses?.length) continue;

        try {
          const aiContent = await generateDigestWithAI(profile.full_name || "SDR", sdrAnalyses);

          const bodyHtml = `
            <p style="color: #555; font-size: 14px;">Olá, <strong>${profile.full_name || "SDR"}</strong>! 👋</p>
            <p style="color: #666; font-size: 13px;">Aqui está seu resumo semanal de ligações analisadas pelo Call Intelligence:</p>
            ${buildEmailCard(aiContent)}
            ${buildEmailButton("Ver Dashboard Completo", `${appUrl}/sdr/call-intelligence`)}
            <p style="color: #999; font-size: 11px; margin-top: 24px; text-align: center;">
              Este resumo foi gerado automaticamente pelo EZ Journey Call Intelligence.
            </p>`;

          const sent = await sendNotificationEmail({
            to: profile.email,
            subject: `📊 Call Intelligence — Resumo Semanal`,
            bodyHtml,
            headerTitle: "Resumo Semanal de Ligações",
          });

          if (sent) emailsSent++;
        } catch (e) {
          console.error(`[weekly-digest] Error for SDR ${profile.full_name}:`, e);
        }
      }

      console.log(`[weekly-digest] Done. Sent ${emailsSent} emails to ${profiles.length} SDRs.`);

      return new Response(JSON.stringify({ emailsSent, sdrsProcessed: profiles.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } finally {
      await supabase.from("cron_locks").delete().eq("job_name", lockName);
    }
  } catch (error: unknown) {
    console.error("[weekly-digest] Fatal error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
