import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_MODEL_MAP: Record<string, string> = {
  "gemini-2.0-flash": "gemini-2.0-flash",
  "gemini-2.5-flash": "gemini-2.5-flash",
  "gemini-2.5-pro": "gemini-2.5-pro",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysis_id } = await req.json();
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
      await supabase.from("call_analyses").update({ status: "error" }).eq("id", analysis_id);
      throw new Error("Transcrição vazia");
    }

    // Format transcription with speakers and segment indices (for coaching annotations)
    const formattedTranscription = speakerSegments
      .map((s: { speaker: string; text: string }, index: number) => {
        const label = s.speaker === "speaker_0" ? "SDR" : "Lead";
        return `[${index}] [${label}]: ${s.text}`;
      })
      .join("\n");

    // Get prompt config from ai_prompts
    const { data: promptData } = await supabase
      .from("ai_prompts")
      .select("system_prompt, user_prompt_template, model")
      .eq("id", "analyze_call")
      .single();

    let systemPrompt = "Analise a ligação e retorne JSON.";
    let userPromptTemplate = "Transcrição:\n\n{{transcription}}";
    let modelName = "gemini-2.5-flash";

    if (promptData) {
      systemPrompt = promptData.system_prompt;
      userPromptTemplate = promptData.user_prompt_template || userPromptTemplate;
      modelName = promptData.model || modelName;
    }

    const userPrompt = userPromptTemplate.replace(/\{\{transcription\}\}/g, formattedTranscription);

    let aiContent = "";

    // Route by provider
    if (modelName.startsWith("sonar")) {
      // Perplexity
      const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
      if (!PERPLEXITY_API_KEY) throw new Error("PERPLEXITY_API_KEY is not configured");

      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Perplexity error:", response.status, errText);
        throw new Error(`Perplexity API error: ${response.status}`);
      }

      const data = await response.json();
      aiContent = data.choices?.[0]?.message?.content || "";

      // Log usage
      const usage = data.usage || {};
      const tokensInput = usage.prompt_tokens || 0;
      const tokensOutput = usage.completion_tokens || 0;
      const costPerInput = modelName === "sonar-pro" ? 3 / 1_000_000 : 1 / 1_000_000;
      const costPerOutput = modelName === "sonar-pro" ? 15 / 1_000_000 : 1 / 1_000_000;
      const requestFee = modelName === "sonar" ? 5 / 1000 : 6 / 1000;
      const cost = tokensInput * costPerInput + tokensOutput * costPerOutput + requestFee;

      const { error: usageErr1 } = await supabase.from("ai_usage_logs").insert({
        prompt_id: "analyze_call",
        model: modelName,
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        estimated_cost_usd: cost,
        lead_id: analysis.lead_id || null,
      });
      if (usageErr1) console.error("Failed to log usage:", usageErr1);

    } else if (modelName.startsWith("gemini")) {
      // Gemini
      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
      if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

      const apiModel = GEMINI_MODEL_MAP[modelName] || modelName;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            generationConfig: {
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error("Gemini error:", response.status, errText);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      aiContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

      const usage = data.usageMetadata || {};
      const tokensInput = usage.promptTokenCount || 0;
      const tokensOutput = usage.candidatesTokenCount || 0;
      const costPerInput = modelName === "gemini-2.5-pro" ? 1.25 / 1_000_000 : 0.15 / 1_000_000;
      const costPerOutput = modelName === "gemini-2.5-pro" ? 10 / 1_000_000 : 0.6 / 1_000_000;
      const cost = tokensInput * costPerInput + tokensOutput * costPerOutput;

      const { error: usageErr2 } = await supabase.from("ai_usage_logs").insert({
        prompt_id: "analyze_call",
        model: modelName,
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        estimated_cost_usd: cost,
        lead_id: analysis.lead_id || null,
      });
      if (usageErr2) console.error("Failed to log usage:", usageErr2);

    } else if (modelName.startsWith("claude") || modelName.startsWith("anthropic")) {
      // Anthropic / Claude
      const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
      if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelName,
          max_tokens: 8192,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Anthropic error:", response.status, errText);
        throw new Error(`Anthropic API error: ${response.status}`);
      }

      const data = await response.json();
      aiContent = data.content?.[0]?.text || "";

      // Log usage
      const usage = data.usage || {};
      const tokensInput = usage.input_tokens || 0;
      const tokensOutput = usage.output_tokens || 0;
      const costPerInput = 3 / 1_000_000;
      const costPerOutput = 15 / 1_000_000;
      const cost = tokensInput * costPerInput + tokensOutput * costPerOutput;

      const { error: usageErr3 } = await supabase.from("ai_usage_logs").insert({
        prompt_id: "analyze_call",
        model: modelName,
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        estimated_cost_usd: cost,
        lead_id: analysis.lead_id || null,
      });
      if (usageErr3) console.error("Failed to log usage:", usageErr3);

    } else {
      // Fallback: Lovable AI Gateway
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelName.includes("/") ? modelName : `google/${modelName}`,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Lovable AI Gateway error:", response.status, errText);
        throw new Error(`Lovable AI Gateway error: ${response.status}`);
      }

      const data = await response.json();
      aiContent = data.choices?.[0]?.message?.content || "";
    }

    // Parse AI response
    let parsed: any = {};
    try {
      const cleaned = aiContent.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", aiContent);
      await supabase.from("call_analyses").update({ status: "error", feedback: "Erro ao interpretar resposta da IA" }).eq("id", analysis_id);
      throw new Error("Falha ao parsear resposta da IA");
    }

    // Update analysis
    const { error: updateError } = await supabase.from("call_analyses").update({
      ai_analysis: parsed,
      call_score: parsed.call_score ?? 0,
      connection_effective: parsed.connection_effective ?? false,
      interest_level: parsed.interest_level ?? "Baixo",
      next_step_defined: parsed.next_step_defined ?? false,
      conversion_potential: parsed.conversion_potential ?? 0,
      sdr_talk_percentage: parsed.sdr_talk_percentage ?? 0,
      lead_talk_percentage: parsed.lead_talk_percentage ?? 0,
      open_questions_count: parsed.open_questions_count ?? 0,
      interruptions_count: parsed.interruptions_count ?? 0,
      early_pitch: parsed.early_pitch ?? false,
      objections: parsed.objections ?? [],
      executive_summary: parsed.executive_summary ?? "",
      feedback: parsed.feedback ?? "",
      status: "completed",
      completed_at: new Date().toISOString(),
    }).eq("id", analysis_id);
    if (updateError) throw new Error(`Failed to save analysis: ${updateError.message}`);

    // Send email notification to SDR
    try {
      const { data: sdrProfile } = await supabase
        .from("profiles")
        .select("name, email:id")
        .eq("id", analysis.sdr_user_id)
        .single();

      // Get SDR email from auth (profiles may not have email)
      const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();
      const sdrAuth = authUsers?.find((u: any) => u.id === analysis.sdr_user_id);
      const sdrEmail = sdrAuth?.email;
      const sdrName = sdrProfile?.name || sdrEmail || "SDR";

      if (sdrEmail) {
        const { sendNotificationEmail, buildEmailCard, buildEmailButton } = await import("../_shared/email-sender.ts");

        const score = parsed.call_score ?? 0;
        const scoreColor = score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";
        const objectionsList = Array.isArray(parsed.objections) && parsed.objections.length > 0
          ? parsed.objections.map((o: string) => `<li style="margin-bottom:4px;">${o}</li>`).join("")
          : "<li>Nenhuma objeção identificada</li>";

        const bodyHtml = `
          <p style="color:#1a1a2e; font-size:14px;">Olá <strong>${sdrName}</strong>,</p>
          <p style="color:#555; font-size:13px;">A análise da sua ligação foi concluída. Confira os resultados:</p>

          ${buildEmailCard(`
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="width:56px; height:56px; border-radius:50%; background:${scoreColor}; display:flex; align-items:center; justify-content:center;">
                <span style="color:#fff; font-size:20px; font-weight:700;">${score}</span>
              </div>
              <div>
                <p style="margin:0; font-weight:600; font-size:15px; color:#1a1a2e;">Score da Ligação</p>
                <p style="margin:2px 0 0; font-size:12px; color:#666;">Nível de interesse: <strong>${parsed.interest_level ?? "—"}</strong></p>
              </div>
            </div>
          `)}

          <h3 style="font-size:13px; color:#1a1a2e; margin:20px 0 8px;">📋 Resumo Executivo</h3>
          <p style="color:#555; font-size:13px; line-height:1.6;">${parsed.executive_summary ?? "Não disponível"}</p>

          <h3 style="font-size:13px; color:#1a1a2e; margin:20px 0 8px;">💡 Feedback</h3>
          <p style="color:#555; font-size:13px; line-height:1.6;">${parsed.feedback ?? "Não disponível"}</p>

          <h3 style="font-size:13px; color:#1a1a2e; margin:20px 0 8px;">🎯 Próximo passo definido?</h3>
          <p style="color:#555; font-size:13px;">${parsed.next_step_defined ? "✅ Sim" : "❌ Não"}</p>

          <h3 style="font-size:13px; color:#1a1a2e; margin:20px 0 8px;">⚠️ Objeções identificadas</h3>
          <ul style="color:#555; font-size:13px; padding-left:20px;">${objectionsList}</ul>

          ${buildEmailButton("Ver análise completa", "https://ez-journey.lovable.app/admin?tab=call-intelligence")}
        `;

        await sendNotificationEmail({
          to: sdrEmail,
          subject: `Análise de Ligação — Score ${score} | ${sdrName}`,
          bodyHtml,
          headerTitle: "Resultado da Análise de Ligação",
        });
      }
    } catch (emailErr) {
      console.error("Failed to send analysis email:", emailErr);
    }

    // CRM alert: if SDR has 3+ consecutive low scores
    try {
      const { data: recentAnalyses } = await supabase
        .from("call_analyses")
        .select("call_score")
        .eq("sdr_user_id", analysis.sdr_user_id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(3);

      if (recentAnalyses && recentAnalyses.length >= 3) {
        const allLow = recentAnalyses.every((a: any) => (a.call_score || 0) < 40);
        if (allLow) {
          await supabase.from("performance_alerts").insert({
            user_id: analysis.sdr_user_id,
            alert_type: "low_call_quality",
            message: `SDR possui 3+ ligações consecutivas com score abaixo de 40. Último score: ${parsed.call_score}. Recomenda-se sessão de coaching.`,
            severity: "critical",
          });
        }
      }
    } catch (alertErr) {
      console.error("Failed to check CRM alerts:", alertErr);
    }

    return new Response(JSON.stringify({ success: true, call_score: parsed.call_score }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-call error:", e);

    // Persist error feedback for UI tooltip
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, supabaseServiceKey);
      const { analysis_id: aid } = await req.clone().json().catch(() => ({ analysis_id: null }));
      if (aid) {
        const errorMessage = e instanceof Error ? e.message : "Erro desconhecido";
        await sb.from("call_analyses").update({ status: "error", feedback: errorMessage }).eq("id", aid);
      }
    } catch (persistErr) {
      console.error("Failed to persist analyze-call error:", persistErr);
    }

    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
