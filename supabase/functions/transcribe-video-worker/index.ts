import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const WORKER_VERSION = "4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Segment {
  speaker: string;
  text: string;
  start: number;
  end: number;
}

const MAX_WORKER_RETRY_COUNT = 5;
// Deepgram is extremely fast (~real-time), 10min is more than enough
const STT_TIMEOUT_MS = 10 * 60 * 1000;

function createSupabaseClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function updateStatus(
  supabase: ReturnType<typeof createSupabaseClient>,
  analysisId: string,
  extra: Record<string, unknown> = {}
) {
  await supabase.from("call_analyses").update({
    worker_heartbeat_at: new Date().toISOString(),
    ...extra,
  }).eq("id", analysisId);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let analysisId: string | null = null;

  try {
    const { analysis_id, audio_path } = await req.json();
    analysisId = analysis_id ?? null;
    if (!analysis_id || !audio_path) {
      return new Response(JSON.stringify({ error: "analysis_id e audio_path são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const DEEPGRAM_API_KEY = Deno.env.get("DEEPGRAM_API_KEY");
    if (!DEEPGRAM_API_KEY) throw new Error("DEEPGRAM_API_KEY is not configured");

    const supabase = createSupabaseClient();

    console.log(`[worker v${WORKER_VERSION}] START analysis_id=${analysis_id}, audio_path=${audio_path}`);

    // ── Step 1: Check retry count ──
    const { data: analysis, error: fetchErr } = await supabase
      .from("call_analyses")
      .select("worker_retry_count, status")
      .eq("id", analysis_id)
      .single();

    if (fetchErr || !analysis) throw new Error(`Análise não encontrada: ${fetchErr?.message}`);

    const retryCount = (analysis.worker_retry_count ?? 0) + 1;
    if (retryCount > MAX_WORKER_RETRY_COUNT) {
      await supabase.from("call_analyses").update({
        status: "error",
        feedback: `Excedeu limite de ${MAX_WORKER_RETRY_COUNT} tentativas de processamento.`,
        worker_retry_count: retryCount,
      }).eq("id", analysis_id);
      return new Response(JSON.stringify({ error: "Max retries exceeded" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await updateStatus(supabase, analysis_id, { worker_retry_count: retryCount });

    // ── Step 2: Generate signed URL ──
    let signedUrl: string | null = null;
    let bucket = "demo-recordings";

    for (const b of ["demo-recordings", "call-recordings"]) {
      const { data } = await supabase.storage.from(b).createSignedUrl(audio_path, 3600);
      if (data?.signedUrl) {
        signedUrl = data.signedUrl;
        bucket = b;
        break;
      }
    }

    if (!signedUrl) {
      const errMsg = `Arquivo não encontrado em nenhum bucket: ${audio_path}`;
      await supabase.from("call_analyses").update({ status: "error", feedback: errMsg }).eq("id", analysis_id);
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[worker] bucket=${bucket}, retry=${retryCount}`);

    // ── Step 3: Send to Deepgram Nova-2 ──
    await updateStatus(supabase, analysis_id);

    const deepgramParams = new URLSearchParams({
      model: "nova-2",
      language: "pt-BR",
      diarize: "true",
      punctuate: "true",
      utterances: "true",
      smart_format: "true",
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), STT_TIMEOUT_MS);

    let sttResponse: Response;
    try {
      sttResponse = await fetch(`https://api.deepgram.com/v1/listen?${deepgramParams}`, {
        method: "POST",
        headers: {
          "Authorization": `Token ${DEEPGRAM_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: signedUrl }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      if ((fetchErr as Error).name === "AbortError") {
        throw new Error(`Deepgram timeout após ${STT_TIMEOUT_MS / 1000}s`);
      }
      throw fetchErr;
    }
    clearTimeout(timeoutId);

    if (!sttResponse.ok) {
      const errText = await sttResponse.text();
      console.error("[worker] Deepgram STT error:", sttResponse.status, errText.slice(0, 300));
      throw new Error(`Deepgram STT falhou (status ${sttResponse.status}): ${errText.slice(0, 200)}`);
    }

    // ── Step 4: Parse Deepgram response ──
    // Deepgram response structure:
    // results.channels[0].alternatives[0].transcript — full text
    // results.utterances — array of {speaker, transcript, start, end}
    let fullText = "";
    let segments: Segment[] = [];
    let durationSeconds = 0;

    try {
      const parsed = await sttResponse.json() as {
        results?: {
          channels?: Array<{
            alternatives?: Array<{ transcript?: string }>;
          }>;
          utterances?: Array<{
            speaker: number;
            transcript: string;
            start: number;
            end: number;
          }>;
        };
        metadata?: { duration?: number };
      };

      fullText = (
        parsed.results?.channels?.[0]?.alternatives?.[0]?.transcript || ""
      ).replace(/\s+/g, " ").trim();

      durationSeconds = Math.round(parsed.metadata?.duration || 0);

      const utterances = parsed.results?.utterances || [];
      const rawSpeakers = new Set<number>(utterances.map((u) => u.speaker));
      console.log(`[worker] Speakers: ${[...rawSpeakers].join(",")} (${rawSpeakers.size} unique)`);
      console.log(`[worker] Transcription: ${fullText.length} chars, ${utterances.length} utterances`);

      if (utterances.length > 0) {
        segments = utterances.map((u) => ({
          speaker: `speaker_${u.speaker}`,
          text: u.transcript.trim(),
          start: u.start,
          end: u.end,
        }));
      } else {
        // Fallback: single segment
        segments = [{
          speaker: "speaker_0",
          text: fullText,
          start: 0,
          end: durationSeconds,
        }];
      }
    } catch (parseErr) {
      throw new Error(`Erro ao parsear resposta Deepgram: ${(parseErr as Error).message}`);
    }

    console.log(`[worker] ${segments.length} segments, duration=${durationSeconds}s`);

    // ── Step 5: Save transcription ──
    const { error: saveErr } = await supabase.from("call_analyses").update({
      transcription: fullText,
      speaker_segments: segments,
      duration_seconds: durationSeconds,
      status: "transcribed",
      transcribed_at: new Date().toISOString(),
      worker_heartbeat_at: new Date().toISOString(),
      worker_partial_text: "",
      worker_chunk_cursor: null,
    }).eq("id", analysis_id);

    if (saveErr) {
      throw new Error(`Erro ao salvar transcrição: ${saveErr.message}`);
    }

    // ── Step 6: Trigger analysis ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const analyzeUrl = `${supabaseUrl}/functions/v1/analyze-demo`;

    let analyzeTriggered = false;
    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        const analyzeRes = await fetch(analyzeUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ analysis_id }),
        });

        if (analyzeRes.ok) {
          analyzeTriggered = true;
          break;
        }
        const errText = await analyzeRes.text();
        console.error(`[worker] analyze-demo trigger failed (${attempt + 1}): ${analyzeRes.status}: ${errText.slice(0, 200)}`);
        if (analyzeRes.status >= 500 && attempt < 1) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        break;
      } catch (fetchErr) {
        console.error(`[worker] analyze-demo fetch error:`, fetchErr);
        break;
      }
    }

    if (!analyzeTriggered) {
      console.error("[worker] Failed to trigger analyze-demo");
    }

    console.log(`[worker] DONE analysis_id=${analysis_id}, analyze_triggered=${analyzeTriggered}`);

    return new Response(JSON.stringify({
      success: true,
      version: WORKER_VERSION,
      segments_count: segments.length,
      duration_seconds: durationSeconds,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(`[worker v${WORKER_VERSION}] ERROR:`, e);

    if (analysisId) {
      try {
        const supabase = createSupabaseClient();
        const errorMessage = e instanceof Error ? e.message : "Erro desconhecido";
        await supabase.from("call_analyses").update({
          status: "error",
          feedback: `[v${WORKER_VERSION}] ${errorMessage}`,
          worker_heartbeat_at: new Date().toISOString(),
        }).eq("id", analysisId);
      } catch (persistErr) {
        console.error("Failed to persist worker error:", persistErr);
      }
    }

    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido", version: WORKER_VERSION }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
