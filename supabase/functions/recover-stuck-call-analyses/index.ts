import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STUCK_PROCESSING_MINUTES = 10; // Consider processing stuck after 10 min without heartbeat
const STUCK_TRANSCRIBED_MINUTES = 10; // Re-trigger analyze-demo after 10 min stuck in transcribed
const MAX_RETRY_COUNT = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const results = { recovered_processing: 0, recovered_transcribed: 0, marked_error: 0 };

  try {
    const now = new Date();

    // 1. Find stuck "processing" analyses
    const processingCutoff = new Date(now.getTime() - STUCK_PROCESSING_MINUTES * 60 * 1000).toISOString();

    const { data: stuckProcessing } = await supabase
      .from("call_analyses")
      .select("id, audio_path, worker_retry_count, worker_heartbeat_at, created_at")
      .eq("status", "processing")
      .or(`worker_heartbeat_at.is.null,worker_heartbeat_at.lt.${processingCutoff}`)
      .limit(10);

    for (const item of stuckProcessing || []) {
      const retries = (item.worker_retry_count ?? 0);

      if (retries >= MAX_RETRY_COUNT) {
        // Too many retries — mark as error
        await supabase.from("call_analyses").update({
          status: "error",
          feedback: `Processamento falhou após ${retries} tentativas automáticas. Use "Reprocessar" para tentar novamente.`,
          worker_heartbeat_at: now.toISOString(),
        }).eq("id", item.id);
        results.marked_error++;
        console.log(`[watchdog] Marked ${item.id} as error after ${retries} retries`);
        continue;
      }

      // Re-dispatch worker
      console.log(`[watchdog] Re-dispatching ${item.id} (retry ${retries + 1})`);
      try {
        const workerUrl = `${supabaseUrl}/functions/v1/transcribe-video-worker`;
        const res = await fetch(workerUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ analysis_id: item.id, audio_path: item.audio_path }),
        });

        // 504 is OK (worker may still be running)
        if (res.ok || res.status === 504) {
          results.recovered_processing++;
        } else {
          const errText = await res.text().catch(() => "");
          console.error(`[watchdog] Worker dispatch failed for ${item.id}: ${res.status} ${errText.slice(0, 200)}`);
        }
      } catch (fetchErr) {
        console.error(`[watchdog] Worker dispatch error for ${item.id}:`, fetchErr);
      }
    }

    // 2. Find stuck "transcribed" analyses (analyze-demo never finished)
    const transcribedCutoff = new Date(now.getTime() - STUCK_TRANSCRIBED_MINUTES * 60 * 1000).toISOString();

    const { data: stuckTranscribed } = await supabase
      .from("call_analyses")
      .select("id, transcribed_at, worker_heartbeat_at")
      .eq("status", "transcribed")
      .or(`worker_heartbeat_at.is.null,worker_heartbeat_at.lt.${transcribedCutoff}`)
      .limit(10);

    for (const item of stuckTranscribed || []) {
      console.log(`[watchdog] Re-triggering analyze-demo for ${item.id}`);
      try {
        // Update heartbeat so we don't re-trigger next cycle
        await supabase.from("call_analyses").update({
          worker_heartbeat_at: now.toISOString(),
        }).eq("id", item.id);

        const analyzeUrl = `${supabaseUrl}/functions/v1/analyze-demo`;
        const res = await fetch(analyzeUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ analysis_id: item.id }),
        });

        if (res.ok || res.status === 504) {
          results.recovered_transcribed++;
        } else {
          const errText = await res.text().catch(() => "");
          console.error(`[watchdog] analyze-demo failed for ${item.id}: ${res.status} ${errText.slice(0, 200)}`);
        }
      } catch (fetchErr) {
        console.error(`[watchdog] analyze-demo error for ${item.id}:`, fetchErr);
      }
    }

    console.log(`[watchdog] Done:`, results);

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("recover-stuck-call-analyses error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
