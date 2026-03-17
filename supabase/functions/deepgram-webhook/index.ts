/**
 * deepgram-webhook — receives async Deepgram transcription results (callback).
 *
 * Called by Deepgram when async transcription finishes.
 * Query params:
 *   - analysis_id (required)
 *   - type: "demo" | "sdr" (defaults to "demo")
 *
 * Flow:
 *   1. Parse Deepgram JSON result
 *   2. Extract utterances, words, duration
 *   3. Diarize speakers (or fallback to AI organization)
 *   4. Apply vocabulary normalization
 *   5. Save transcription + speaker_segments to call_analyses
 *   6. Trigger analyze-demo or analyze-call depending on type
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Vocabulary normalization ──────────────────────────────────────────────────

interface VocabRule {
  from_text: string;
  to_text: string;
  is_regex: boolean;
  priority: number;
}

async function fetchVocabularyRules(supabase: any): Promise<VocabRule[]> {
  const { data } = await supabase
    .from("transcription_vocabulary")
    .select("from_text, to_text, is_regex, priority")
    .eq("is_active", true)
    .order("priority", { ascending: true });
  return (data || []) as VocabRule[];
}

function applyVocabulary(text: string, rules: VocabRule[]): string {
  let result = text;
  for (const rule of rules) {
    try {
      if (rule.is_regex) {
        result = result.replace(new RegExp(rule.from_text, "gi"), rule.to_text);
      } else {
        const escaped = rule.from_text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        result = result.replace(new RegExp(escaped, "gi"), rule.to_text);
      }
    } catch {
      // Invalid regex — skip silently
    }
  }
  return result;
}

// ── AI dialogue organization (fallback when diarization fails) ────────────────

interface Segment {
  speaker: string;
  text: string;
  start: number;
  end: number;
}

interface AIDialogueSegment {
  speaker: "closer" | "client";
  text: string;
}

async function organizeTranscriptWithAI(fullText: string, type: string): Promise<AIDialogueSegment[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY || fullText.trim().length < 20) return [];

  const speakerA = type === "demo" ? "closer" : "sdr";
  const speakerADesc = type === "demo"
    ? `Closer (vendedor que demonstra o produto):
- Apresenta funcionalidades do produto
- Responde perguntas técnicas
- Conduz a demonstração
- Tenta fechar a venda ou próximo passo`
    : `SDR (vendedor que prospecta):
- Se apresenta, menciona a empresa
- Faz perguntas de qualificação (BANT, SPIN)
- Apresenta soluções brevemente
- Tenta agendar reuniões`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um especialista em análise de ligações comerciais B2B.
Você receberá a transcrição bruta de uma conversa entre um ${speakerA === "closer" ? "Closer" : "SDR"} e um Cliente.

Pistas para identificar o ${speakerA === "closer" ? "Closer" : "SDR"}:
${speakerADesc}

Pistas para identificar o Cliente:
- Responde perguntas sobre sua empresa
- Faz perguntas sobre preço/produto
- Levanta objeções
- Fala sobre seus problemas/necessidades

REGRAS IMPORTANTES:
1. Mantenha TODO o texto original, não omita nenhuma palavra
2. Divida nos pontos naturais de troca de turno na conversa
3. Cada segmento deve conter a fala completa de um interlocutor antes da troca

Responda APENAS com um JSON array no formato:
[{"speaker": "${speakerA}", "text": "..."}, {"speaker": "client", "text": "..."}, ...]

Não inclua explicações, apenas o JSON array.`,
          },
          { role: "user", content: fullText },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error("[deepgram-webhook] AI organization failed:", response.status);
      return [];
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content?.trim() || "";

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed: AIDialogueSegment[] = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed) || parsed.length < 2) return [];

    const validSpeakers = [speakerA, "client"];
    const valid = parsed.every(
      (s) => validSpeakers.includes(s.speaker) && typeof s.text === "string" && s.text.trim().length > 0
    );
    if (!valid) return [];

    return parsed;
  } catch (e) {
    console.error("[deepgram-webhook] AI organization error:", e);
    return [];
  }
}

function mapTimestampsToSegments(
  aiSegments: AIDialogueSegment[],
  words: Array<{ word?: string; start?: number; end?: number }>
): Segment[] {
  if (words.length === 0 || aiSegments.length === 0) return [];

  const segments: Segment[] = [];
  let wordIdx = 0;

  for (const aiSeg of aiSegments) {
    const segWords = aiSeg.text.trim().split(/\s+/);
    const speakerLabel = aiSeg.speaker === "client" ? "speaker_1" : "speaker_0";

    const startWordIdx = wordIdx;
    const targetCount = segWords.length;
    let matchedCount = 0;

    while (wordIdx < words.length && matchedCount < targetCount) {
      wordIdx++;
      matchedCount++;
    }

    if (matchedCount < targetCount && wordIdx < words.length) {
      const remaining = Math.min(targetCount - matchedCount, words.length - wordIdx);
      wordIdx += remaining;
    }

    const endWordIdx = Math.max(startWordIdx, wordIdx - 1);

    segments.push({
      speaker: speakerLabel,
      text: aiSeg.text.trim(),
      start: words[startWordIdx]?.start || 0,
      end: words[endWordIdx]?.end || words[startWordIdx]?.start || 0,
    });
  }

  return segments;
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const analysisId = url.searchParams.get("analysis_id");
  const type = url.searchParams.get("type") || "demo"; // "demo" or "sdr"

  if (!analysisId) {
    console.error("[deepgram-webhook] Missing analysis_id param");
    return new Response(JSON.stringify({ error: "analysis_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log(`[deepgram-webhook] START analysis_id=${analysisId}, type=${type}`);

    // Parse Deepgram result from POST body
    const deepgramResult = await req.json() as {
      results?: {
        channels?: Array<{
          alternatives?: Array<{
            transcript?: string;
            words?: Array<{ word?: string; start?: number; end?: number; speaker?: number }>;
          }>;
        }>;
        utterances?: Array<{
          speaker: number;
          transcript: string;
          start: number;
          end: number;
        }>;
      };
      metadata?: { duration?: number; request_id?: string };
    };

    const fullText = (
      deepgramResult.results?.channels?.[0]?.alternatives?.[0]?.transcript || ""
    ).replace(/\s+/g, " ").trim();

    const words = deepgramResult.results?.channels?.[0]?.alternatives?.[0]?.words || [];
    const utterances = deepgramResult.results?.utterances || [];
    const durationSeconds = Math.round(deepgramResult.metadata?.duration || 0);
    const requestId = deepgramResult.metadata?.request_id || "";

    if (!fullText || fullText.length < 10) {
      const errMsg = "Transcrição vazia ou muito curta retornada pelo Deepgram.";
      console.error(`[deepgram-webhook] ${errMsg}`);
      await supabase.from("call_analyses").update({
        status: "error",
        feedback: errMsg,
      }).eq("id", analysisId);
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawSpeakers = new Set<number>(utterances.map((u) => u.speaker));
    console.log(`[deepgram-webhook] request_id=${requestId}, words=${words.length}, utterances=${utterances.length}, speakers=${rawSpeakers.size}, duration=${durationSeconds}s`);

    // ── Diarize speakers ──
    let segments: Segment[] = [];
    let usedAIOrganization = false;

    if (rawSpeakers.size >= 2) {
      // Deepgram diarization succeeded
      console.log(`[deepgram-webhook] Diarization OK with ${rawSpeakers.size} speakers`);
      segments = utterances.map((u) => ({
        speaker: `speaker_${u.speaker}`,
        text: u.transcript.trim(),
        start: u.start,
        end: u.end,
      }));
    } else {
      // Diarization failed — use AI fallback
      console.log(`[deepgram-webhook] Diarization failed (${rawSpeakers.size} speaker). Using AI fallback.`);
      const aiSegments = await organizeTranscriptWithAI(fullText, type);

      if (aiSegments.length >= 2) {
        const wordList = words.map((w) => ({ word: w.word, start: w.start, end: w.end }));
        segments = mapTimestampsToSegments(aiSegments, wordList);
        usedAIOrganization = true;
        console.log(`[deepgram-webhook] AI organized into ${segments.length} segments`);
      } else {
        console.log(`[deepgram-webhook] AI organization failed, single segment fallback`);
        segments = [{
          speaker: "speaker_0",
          text: fullText,
          start: 0,
          end: durationSeconds,
        }];
      }
    }

    // ── Apply vocabulary normalization ──
    const vocabRules = await fetchVocabularyRules(supabase);
    const normalizedText = applyVocabulary(fullText, vocabRules);
    const normalizedSegments = segments.map((seg) => ({
      ...seg,
      text: applyVocabulary(seg.text, vocabRules),
    }));
    console.log(`[deepgram-webhook] Applied ${vocabRules.length} vocabulary rules`);

    // ── Save transcription ──
    await supabase.from("call_analyses").update({
      transcription: normalizedText,
      speaker_segments: normalizedSegments,
      duration_seconds: durationSeconds,
      status: "transcribed",
      transcribed_at: new Date().toISOString(),
      worker_heartbeat_at: new Date().toISOString(),
    }).eq("id", analysisId);

    console.log(`[deepgram-webhook] Saved transcription. Triggering analysis...`);

    // ── Trigger analysis ──
    const analyzeFn = type === "demo" ? "analyze-demo" : "analyze-call";
    const analyzeUrl = `${supabaseUrl}/functions/v1/${analyzeFn}`;
    const MAX_ANALYZE_RETRIES = 2;
    let analyzeTriggered = false;
    let lastAnalyzeError = "";

    for (let attempt = 0; attempt <= MAX_ANALYZE_RETRIES; attempt++) {
      try {
        const analyzeResponse = await fetch(analyzeUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ analysis_id: analysisId }),
        });

        if (analyzeResponse.ok) {
          analyzeTriggered = true;
          console.log(`[deepgram-webhook] ${analyzeFn} triggered successfully`);
          break;
        }

        const errText = await analyzeResponse.text();
        lastAnalyzeError = `status ${analyzeResponse.status}: ${errText.slice(0, 220)}`;
        console.error(`[deepgram-webhook] ${analyzeFn} trigger failed (attempt ${attempt + 1}):`, lastAnalyzeError);

        const shouldRetry = (analyzeResponse.status >= 500 || analyzeResponse.status === 429) && attempt < MAX_ANALYZE_RETRIES;
        if (shouldRetry) {
          await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1500));
          continue;
        }
        break;
      } catch (fetchErr) {
        lastAnalyzeError = fetchErr instanceof Error ? fetchErr.message : "network error";
        console.error(`[deepgram-webhook] ${analyzeFn} fetch error (attempt ${attempt + 1}):`, lastAnalyzeError);
        if (attempt < MAX_ANALYZE_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1500));
          continue;
        }
      }
    }

    if (!analyzeTriggered) {
      const feedback = `Transcrição concluída, mas falhou ao iniciar a análise automática (${lastAnalyzeError || "erro desconhecido"}). Use "Reanalisar" para tentar novamente.`;
      await supabase.from("call_analyses").update({ feedback }).eq("id", analysisId);
      console.warn(`[deepgram-webhook] Analysis trigger failed but transcription was saved.`);
    }

    return new Response(JSON.stringify({
      success: true,
      analysis_id: analysisId,
      segments_count: normalizedSegments.length,
      used_ai_organization: usedAIOrganization,
      analyze_triggered: analyzeTriggered,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[deepgram-webhook] ERROR:", e);

    try {
      const errorMessage = e instanceof Error ? e.message : "Erro desconhecido no webhook";
      await supabase.from("call_analyses").update({
        status: "error",
        feedback: `Erro no processamento da transcrição: ${errorMessage}`,
      }).eq("id", analysisId);
    } catch (persistErr) {
      console.error("[deepgram-webhook] Failed to persist error:", persistErr);
    }

    // Return 200 to Deepgram so it doesn't retry — the error is on our side
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
