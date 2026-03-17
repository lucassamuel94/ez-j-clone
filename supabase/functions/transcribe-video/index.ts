// v2 – nova-3, no keyterm/keywords
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_RETRY_COUNT = 5;

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[transcribe-video] START analysis_id=${analysis_id}`);

    // ── Step 1: Check retry count ──
    const { data: analysis, error: fetchErr } = await supabase
      .from("call_analyses")
      .select("worker_retry_count, status")
      .eq("id", analysis_id)
      .single();

    if (fetchErr || !analysis) throw new Error(`Análise não encontrada: ${fetchErr?.message}`);

    const retryCount = (analysis.worker_retry_count ?? 0) + 1;
    if (retryCount > MAX_RETRY_COUNT) {
      await supabase.from("call_analyses").update({
        status: "error",
        feedback: `Excedeu limite de ${MAX_RETRY_COUNT} tentativas de processamento.`,
        worker_retry_count: retryCount,
      }).eq("id", analysis_id);
      return new Response(JSON.stringify({ error: "Max retries exceeded" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("call_analyses").update({
      worker_retry_count: retryCount,
      worker_heartbeat_at: new Date().toISOString(),
    }).eq("id", analysis_id);

    // ── Step 2: Generate signed URL ──
    let signedUrl: string | null = null;
    let bucket = "demo-recordings";

    for (const b of ["demo-recordings", "call-recordings"]) {
      const { data } = await supabase.storage.from(b).createSignedUrl(audio_path, 7200);
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

    console.log(`[transcribe-video] bucket=${bucket}, retry=${retryCount}`);

    // ── Step 3: Submit to Deepgram async (callback) ──
    // Deepgram processes the video and POSTs results to deepgram-webhook.
    // This function returns immediately — no waiting, no worker needed.
    const callbackUrl = `${supabaseUrl}/functions/v1/deepgram-webhook?analysis_id=${analysis_id}&type=demo`;

    // Brand vocabulary is handled post-transcription via transcription_vocabulary table.
    const deepgramParams = new URLSearchParams({
      model: "nova-3",
      language: "pt-BR",
      diarize: "true",
      punctuate: "true",
      utterances: "true",
      smart_format: "true",
      callback: callbackUrl,
    });

    const sttResponse = await fetch(`https://api.deepgram.com/v1/listen?${deepgramParams}`, {
      method: "POST",
      headers: {
        "Authorization": `Token ${DEEPGRAM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: signedUrl }),
    });

    if (!sttResponse.ok) {
      const errText = await sttResponse.text();
      console.error("[transcribe-video] Deepgram submit error:", sttResponse.status, errText.slice(0, 300));
      throw new Error(`Deepgram submit falhou (status ${sttResponse.status}): ${errText.slice(0, 200)}`);
    }

    const submitResult = await sttResponse.json() as { request_id?: string };
    const requestId = submitResult.request_id || "";
    console.log(`[transcribe-video] Deepgram async submitted. request_id=${requestId}`);

    // ── Step 4: Update status ──
    await supabase.from("call_analyses").update({
      status: "processing",
      worker_partial_text: requestId,
      worker_heartbeat_at: new Date().toISOString(),
    }).eq("id", analysis_id);

    return new Response(JSON.stringify({
      success: true,
      async: true,
      request_id: requestId,
      analysis_id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[transcribe-video] ERROR:", e);

    if (analysisId) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        const errorMessage = e instanceof Error ? e.message : "Erro desconhecido";
        await supabase.from("call_analyses").update({
          status: "error",
          feedback: errorMessage,
        }).eq("id", analysisId);
      } catch (persistErr) {
        console.error("Failed to persist error:", persistErr);
      }
    }

    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
