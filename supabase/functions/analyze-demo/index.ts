import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callAI(
  modelName: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<{ content: string; tokensInput: number; tokensOutput: number; costUsd: number }> {
  if (modelName.startsWith("sonar")) {
    const key = Deno.env.get("PERPLEXITY_API_KEY");
    if (!key) throw new Error("PERPLEXITY_API_KEY is not configured");
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelName, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] }),
    });
    if (!res.ok) { const t = await res.text(); throw new Error(`Perplexity error ${res.status}: ${t.slice(0, 200)}`); }
    const d = await res.json();
    const u = d.usage || {};
    const ti = u.prompt_tokens || 0, to = u.completion_tokens || 0;
    const cost = ti * (modelName === "sonar-pro" ? 3 : 1) / 1e6 + to * (modelName === "sonar-pro" ? 15 : 1) / 1e6 + (modelName === "sonar" ? 5 : 6) / 1000;
    return { content: d.choices?.[0]?.message?.content || "", tokensInput: ti, tokensOutput: to, costUsd: cost };
  }

  if (modelName.startsWith("gemini")) {
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) throw new Error("GEMINI_API_KEY is not configured");
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }], generationConfig: { responseMimeType: "application/json" } }),
    });
    if (!res.ok) { const t = await res.text(); throw new Error(`Gemini error ${res.status}: ${t.slice(0, 200)}`); }
    const d = await res.json();
    const u = d.usageMetadata || {};
    const ti = u.promptTokenCount || 0, to = u.candidatesTokenCount || 0;
    const isPro = modelName.includes("pro");
    const cost = ti * (isPro ? 1.25 : 0.15) / 1e6 + to * (isPro ? 10 : 0.6) / 1e6;
    return { content: d.candidates?.[0]?.content?.parts?.[0]?.text || "", tokensInput: ti, tokensOutput: to, costUsd: cost };
  }

  if (modelName.startsWith("claude") || modelName.startsWith("anthropic")) {
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) throw new Error("ANTHROPIC_API_KEY is not configured");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelName, max_tokens: 8192, system: systemPrompt, messages: [{ role: "user", content: userPrompt }] }),
    });
    if (!res.ok) { const t = await res.text(); throw new Error(`Anthropic error ${res.status}: ${t.slice(0, 200)}`); }
    const d = await res.json();
    const u = d.usage || {};
    const ti = u.input_tokens || 0, to = u.output_tokens || 0;
    const cost = ti * 3 / 1e6 + to * 15 / 1e6;
    return { content: d.content?.[0]?.text || "", tokensInput: ti, tokensOutput: to, costUsd: cost };
  }

  // Fallback: Lovable AI Gateway
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  const gwModel = modelName.includes("/") ? modelName : `google/${modelName}`;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: gwModel, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] }),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Lovable Gateway error ${res.status}: ${t.slice(0, 200)}`); }
  const d = await res.json();
  return { content: d.choices?.[0]?.message?.content || "", tokensInput: 0, tokensOutput: 0, costUsd: 0 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let analysisId: string | null = null;

  try {
    const { analysis_id } = await req.json();
    analysisId = analysis_id ?? null;
    if (!analysis_id) {
      return new Response(JSON.stringify({ error: "analysis_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch analysis record
    const { data: analysis, error: fetchError } = await supabase
      .from("call_analyses")
      .select("*")
      .eq("id", analysis_id)
      .single();

    if (fetchError || !analysis) {
      throw new Error(`Análise não encontrada: ${fetchError?.message}`);
    }

    const transcription = analysis.transcription;
    const speakerSegments = analysis.speaker_segments || [];

    if (!transcription) {
      await supabase.from("call_analyses").update({ status: "error", feedback: "Transcrição vazia — não foi possível analisar" }).eq("id", analysis_id);
      throw new Error("Transcrição vazia");
    }

    // Format transcription with speakers and segment indices (for coaching annotations)
    const formattedTranscription = speakerSegments
      .map((s: { speaker: string; text: string }, index: number) => {
        const label = s.speaker === "speaker_0" ? "Closer" : "Cliente";
        return `[${index}] [${label}]: ${s.text}`;
      })
      .join("\n");

    // Get prompt config from ai_prompts
    const { data: promptData } = await supabase
      .from("ai_prompts")
      .select("system_prompt, user_prompt_template, model")
      .eq("id", "analyze_demo")
      .single();

    let systemPrompt = "Analise a demonstração e retorne JSON.";
    let userPromptTemplate = "Transcrição:\n\n{{transcription}}";
    let modelName = "claude-sonnet-4-20250514";

    if (promptData) {
      systemPrompt = promptData.system_prompt;
      userPromptTemplate = promptData.user_prompt_template || userPromptTemplate;
      modelName = promptData.model || modelName;
    }

    const userPrompt = userPromptTemplate.replace(/\{\{transcription\}\}/g, formattedTranscription);

    // Call AI with dynamic routing
    const aiResult = await callAI(modelName, systemPrompt, userPrompt);

    // Log usage
    await supabase.from("ai_usage_logs").insert({
      prompt_id: "analyze_demo",
      model: modelName,
      tokens_input: aiResult.tokensInput,
      tokens_output: aiResult.tokensOutput,
      estimated_cost_usd: aiResult.costUsd,
      lead_id: analysis.lead_id || null,
    });

    // Parse AI response
    let parsed: Record<string, unknown> = {};
    try {
      const cleaned = aiResult.content.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", aiResult.content);
      await supabase.from("call_analyses").update({ status: "error", feedback: "Erro ao interpretar resposta da IA" }).eq("id", analysis_id);
      throw new Error("Falha ao parsear resposta da IA");
    }

    // Update analysis record
    const { error: updateError } = await supabase.from("call_analyses").update({
      ai_analysis: parsed,
      call_score: (parsed.call_score as number) ?? 0,
      connection_effective: (parsed.connection_effective as boolean) ?? false,
      interest_level: (parsed.interest_level as string) ?? "Baixo",
      next_step_defined: (parsed.next_step_defined as boolean) ?? false,
      conversion_potential: (parsed.conversion_potential as number) ?? 0,
      sdr_talk_percentage: (parsed.sdr_talk_percentage as number) ?? 0,
      lead_talk_percentage: (parsed.lead_talk_percentage as number) ?? 0,
      open_questions_count: (parsed.open_questions_count as number) ?? 0,
      interruptions_count: (parsed.interruptions_count as number) ?? 0,
      early_pitch: (parsed.early_pitch as boolean) ?? false,
      objections: (parsed.objections as string[]) ?? [],
      executive_summary: (parsed.executive_summary as string) ?? "",
      feedback: (parsed.feedback as string) ?? "",
      status: "completed",
      completed_at: new Date().toISOString(),
    }).eq("id", analysis_id);
    if (updateError) throw new Error(`Failed to save analysis: ${updateError.message}`);

    // Send email notification to Closer
    try {
      const { data: closerProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", analysis.sdr_user_id)
        .single();

      const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();
      const closerAuth = authUsers?.find((u: { id: string }) => u.id === analysis.sdr_user_id);
      const closerEmail = closerAuth?.email;
      const closerName = closerProfile?.name || closerEmail || "Closer";

      if (closerEmail) {
        const { sendNotificationEmail, buildEmailCard, buildEmailButton } = await import("../_shared/email-sender.ts");

        const score = (parsed.call_score as number) ?? 0;
        const scoreColor = score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";
        const objectionsList = Array.isArray(parsed.objections) && (parsed.objections as string[]).length > 0
          ? (parsed.objections as string[]).map((o: string) => `<li style="margin-bottom:4px;">${o}</li>`).join("")
          : "<li>Nenhuma objeção identificada</li>";

        const bodyHtml = `
          <p style="color:#1a1a2e; font-size:14px;">Olá <strong>${closerName}</strong>,</p>
          <p style="color:#555; font-size:13px;">A análise da sua demonstração foi concluída. Confira os resultados:</p>

          ${buildEmailCard(`
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="width:56px; height:56px; border-radius:50%; background:${scoreColor}; display:flex; align-items:center; justify-content:center;">
                <span style="color:#fff; font-size:20px; font-weight:700;">${score}</span>
              </div>
              <div>
                <p style="margin:0; font-weight:600; font-size:15px; color:#1a1a2e;">Score da Demonstração</p>
                <p style="margin:2px 0 0; font-size:12px; color:#666;">Nível de interesse: <strong>${(parsed.interest_level as string) ?? "—"}</strong></p>
              </div>
            </div>
          `)}

          <h3 style="font-size:13px; color:#1a1a2e; margin:20px 0 8px;">📋 Resumo Executivo</h3>
          <p style="color:#555; font-size:13px; line-height:1.6;">${(parsed.executive_summary as string) ?? "Não disponível"}</p>

          <h3 style="font-size:13px; color:#1a1a2e; margin:20px 0 8px;">💡 Feedback</h3>
          <p style="color:#555; font-size:13px; line-height:1.6;">${(parsed.feedback as string) ?? "Não disponível"}</p>

          ${(parsed.coach_overall_message as string) ? `
          <h3 style="font-size:13px; color:#1a1a2e; margin:20px 0 8px;">🎯 Mensagem do Coach</h3>
          <p style="color:#555; font-size:13px; line-height:1.6; background:#f0f7ff; border-left:3px solid #3b82f6; padding:12px 16px; border-radius:0 8px 8px 0;">${parsed.coach_overall_message as string}</p>
          ` : ""}

          <h3 style="font-size:13px; color:#1a1a2e; margin:20px 0 8px;">⚠️ Objeções identificadas</h3>
          <ul style="color:#555; font-size:13px; padding-left:20px;">${objectionsList}</ul>

          ${buildEmailButton("Ver análise completa", "https://ez-journey.lovable.app/admin?tab=call-intelligence")}
        `;

        await sendNotificationEmail({
          to: closerEmail,
          subject: `Análise de Demo — Score ${score} | ${closerName}`,
          bodyHtml,
          headerTitle: "Resultado da Análise de Demonstração",
        });
      }
    } catch (emailErr) {
      console.error("Failed to send demo analysis email:", emailErr);
    }

    return new Response(JSON.stringify({ success: true, call_score: parsed.call_score }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-demo error:", e);

    if (analysisId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const errorMessage = e instanceof Error ? e.message : "Erro desconhecido";
        await supabase.from("call_analyses").update({ status: "error", feedback: errorMessage }).eq("id", analysisId);
      } catch (persistErr) {
        console.error("Failed to persist analyze-demo error feedback:", persistErr);
      }
    }

    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
