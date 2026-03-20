import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STUCK_PROCESSING_MINUTES = 10;
const STUCK_TRANSCRIBED_MINUTES = 10;
const MAX_RETRY_COUNT = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const results = { recovered_processing: 0, recovered_transcribed: 0, recovered_queued: 0, marked_error: 0 };

  try {
    const now = new Date();

    // 0. Find stuck "queued" auto-generated analyses (chain dispatch broke)
    // If there are queued items but nothing is currently processing/uploaded, restart the chain
    const STUCK_QUEUED_MINUTES = 15;
    const queuedCutoff = new Date(now.getTime() - STUCK_QUEUED_MINUTES * 60 * 1000).toISOString();

    const { data: queuedItems } = await supabase
      .from("call_analyses")
      .select("id, audio_path")
      .eq("status", "queued")
      .eq("auto_generated", true)
      .lt("created_at", queuedCutoff)
      .order("created_at", { ascending: true })
      .limit(1);

    if (queuedItems?.length) {
      // Check if anything is currently in-flight (processing/uploaded)
      const { count: inFlightCount } = await supabase
        .from("call_analyses")
        .select("id", { count: "exact", head: true })
        .eq("auto_generated", true)
        .in("status", ["uploaded", "processing"]);

      if (!inFlightCount || inFlightCount === 0) {
        const item = queuedItems[0];
        console.log(`[watchdog] Chain seems broken — dispatching queued item ${item.id}`);
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/transcribe-call`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ analysis_id: item.id, audio_path: item.audio_path }),
          });
          if (res.ok || res.status === 504) {
            results.recovered_queued++;
          } else {
            const errText = await res.text().catch(() => "");
            console.error(`[watchdog] Queued dispatch failed for ${item.id}: ${res.status} ${errText.slice(0, 200)}`);
          }
        } catch (fetchErr) {
          console.error(`[watchdog] Queued dispatch error for ${item.id}:`, fetchErr);
        }
      } else {
        console.log(`[watchdog] ${inFlightCount} items still in-flight, not restarting chain`);
      }
    }

    // 1. Find stuck "processing" analyses
    const processingCutoff = new Date(now.getTime() - STUCK_PROCESSING_MINUTES * 60 * 1000).toISOString();

    const { data: stuckProcessing } = await supabase
      .from("call_analyses")
      .select("id, audio_path, worker_retry_count, worker_heartbeat_at, created_at, media_type")
      .eq("status", "processing")
      .or(`worker_heartbeat_at.is.null,worker_heartbeat_at.lt.${processingCutoff}`)
      .limit(10);

    for (const item of stuckProcessing || []) {
      const retries = (item.worker_retry_count ?? 0);

      if (retries >= MAX_RETRY_COUNT) {
        await supabase.from("call_analyses").update({
          status: "error",
          feedback: `Processamento falhou após ${retries} tentativas automáticas. Use "Reprocessar" para tentar novamente.`,
          worker_heartbeat_at: now.toISOString(),
        }).eq("id", item.id);
        results.marked_error++;
        console.log(`[watchdog] Marked ${item.id} as error after ${retries} retries`);
        continue;
      }

      // Route based on media_type: audio → transcribe-call, video → transcribe-video
      const workerFn = item.media_type === "video" ? "transcribe-video" : "transcribe-call";
      console.log(`[watchdog] Re-dispatching ${item.id} via ${workerFn} (retry ${retries + 1})`);
      try {
        const workerUrl = `${supabaseUrl}/functions/v1/${workerFn}`;
        const res = await fetch(workerUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ analysis_id: item.id, audio_path: item.audio_path }),
        });

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

    // 2. Find stuck "transcribed" analyses (analysis never finished)
    const transcribedCutoff = new Date(now.getTime() - STUCK_TRANSCRIBED_MINUTES * 60 * 1000).toISOString();

    const { data: stuckTranscribed } = await supabase
      .from("call_analyses")
      .select("id, transcribed_at, worker_heartbeat_at, analysis_context")
      .eq("status", "transcribed")
      .or(`worker_heartbeat_at.is.null,worker_heartbeat_at.lt.${transcribedCutoff}`)
      .limit(10);

    for (const item of stuckTranscribed || []) {
      // Route based on analysis_context: demo → analyze-demo, sdr_call → analyze-call
      const analyzeFn = item.analysis_context === "demo" ? "analyze-demo" : "analyze-call";
      console.log(`[watchdog] Re-triggering ${analyzeFn} for ${item.id}`);
      try {
        await supabase.from("call_analyses").update({
          worker_heartbeat_at: now.toISOString(),
        }).eq("id", item.id);

        const analyzeUrl = `${supabaseUrl}/functions/v1/${analyzeFn}`;
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
          console.error(`[watchdog] ${analyzeFn} failed for ${item.id}: ${res.status} ${errText.slice(0, 200)}`);
        }
      } catch (fetchErr) {
        console.error(`[watchdog] ${analyzeFn} error for ${item.id}:`, fetchErr);
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
