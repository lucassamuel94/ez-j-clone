import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EZCALL_BASE = "https://ezsoft.br2.ezcall.com.br";
const MAX_ANALYSES_PER_SDR = 3;
const MIN_BILLSEC = 150; // 2:30 min

async function getEZCallToken(): Promise<string> {
  const username = Deno.env.get("EZCALL_USERNAME");
  const password = Deno.env.get("EZCALL_PASSWORD");
  if (!username || !password) throw new Error("EZCALL credentials not configured");

  const res = await fetch(`${EZCALL_BASE}/ezcall/api/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`EZCall login failed [${res.status}]`);
  const data = await res.json();
  if (!data?.token) throw new Error("EZCall login returned no token");
  return data.token;
}

async function fetchOutgoingCalls(
  token: string,
  date: string,
  extension: string,
): Promise<Array<{ linkedid: string; calldate: string; dst: string; billsec: number; duration: number }>> {
  const allRecords: Array<Record<string, unknown>> = [];
  let page = 1;
  let lastPage = 1;

  do {
    const url = new URL(`${EZCALL_BASE}/ezcall/api/call/reports/recent/outgoing/`);
    url.searchParams.set("startDate", date);
    url.searchParams.set("endDate", date);
    url.searchParams.set("search", extension);
    url.searchParams.set("disposition", "ANSWERED");
    url.searchParams.set("pagination", "500");
    url.searchParams.set("page", String(page));

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`EZCall reports failed [${res.status}]`);

    const json = await res.json();
    allRecords.push(...(json.data || []));
    lastPage = json.last_page || 1;
    page++;
  } while (page <= lastPage);

  return allRecords
    .filter((c: Record<string, unknown>) => (c.billsec as number) >= MIN_BILLSEC)
    .map((c: Record<string, unknown>) => ({
      linkedid: c.linkedid as string,
      calldate: c.calldate as string,
      dst: c.dst as string,
      billsec: c.billsec as number,
      duration: c.duration as number,
    }));
}

async function downloadRecording(token: string, linkedid: string): Promise<ArrayBuffer> {
  const res = await fetch(`${EZCALL_BASE}/ezcall/api/files/load-record/${linkedid}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Recording download failed for ${linkedid} [${res.status}]`);
  return res.arrayBuffer();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Acquire lock (5 min TTL)
    const lockName = "auto-analyze-calls";
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();

    const { error: lockError } = await supabase
      .from("cron_locks")
      .insert({ job_name: lockName, expires_at: expiresAt });

    if (lockError) {
      // Check if existing lock expired
      const { data: existingLock } = await supabase
        .from("cron_locks")
        .select("expires_at")
        .eq("job_name", lockName)
        .single();

      if (existingLock && new Date(existingLock.expires_at) > now) {
        console.log("[auto-analyze] Already running, skipping");
        return new Response(JSON.stringify({ skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Expired lock — update it
      await supabase
        .from("cron_locks")
        .update({ expires_at: expiresAt, locked_at: now.toISOString() })
        .eq("job_name", lockName);
    }

    try {
      // Get today's date in SP timezone
      const spDate = new Date(
        now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
      );
      const todayStr = `${spDate.getFullYear()}-${String(spDate.getMonth() + 1).padStart(2, "0")}-${String(spDate.getDate()).padStart(2, "0")}`;

      // Fetch SDR user IDs (role-filtered)
      const { data: sdrRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "sdr");

      const sdrUserIds = (sdrRoles || []).map((r: { user_id: string }) => r.user_id);
      if (!sdrUserIds.length) {
        console.log("[auto-analyze] No SDR users found");
        return new Response(JSON.stringify({ message: "No SDRs with extensions" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch SDRs with extensions
      const { data: sdrs, error: sdrError } = await supabase
        .from("profiles")
        .select("id, name, ramal")
        .in("id", sdrUserIds)
        .not("ramal", "is", null)
        .neq("ramal", "");

      if (sdrError) throw new Error(`SDR query failed: ${sdrError.message} (code: ${sdrError.code})`);
      if (!sdrs?.length) {
        console.log("[auto-analyze] No SDRs with extensions found");
        return new Response(JSON.stringify({ message: "No SDRs with extensions" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const ezToken = await getEZCallToken();
      let totalCreated = 0;

      for (const sdr of sdrs) {
        try {
          const calls = await fetchOutgoingCalls(ezToken, todayStr, sdr.ramal);
          if (!calls.length) continue;

          // Sort by billsec DESC to prioritize longest calls
          calls.sort((a, b) => b.billsec - a.billsec);

          // Check which linkedids already exist
          const linkedids = calls.map((c) => c.linkedid);
          const { data: existing } = await supabase
            .from("call_analyses")
            .select("ezcall_linkedid")
            .in("ezcall_linkedid", linkedids);

          const existingSet = new Set((existing || []).map((e) => e.ezcall_linkedid));
          const newCalls = calls.filter((c) => !existingSet.has(c.linkedid));

          // Take up to MAX_ANALYSES_PER_SDR
          const toAnalyze = newCalls.slice(0, MAX_ANALYSES_PER_SDR);

          for (const call of toAnalyze) {
            try {
              // Download audio
              const audioBuffer = await downloadRecording(ezToken, call.linkedid);
              const audioBytes = new Uint8Array(audioBuffer);

              // Upload to storage
              const storagePath = `auto/${sdr.id}/${call.linkedid}.mp3`;
              const { error: uploadError } = await supabase.storage
                .from("call-recordings")
                .upload(storagePath, audioBytes, {
                  contentType: "audio/mpeg",
                  upsert: false,
                });

              if (uploadError) {
                console.error(`[auto-analyze] Upload failed for ${call.linkedid}:`, uploadError.message);
                continue;
              }

              // Create call_analyses record
              const { data: analysis, error: insertError } = await supabase
                .from("call_analyses")
                .insert({
                  sdr_user_id: sdr.id,
                  uploaded_by: sdr.id,
                  audio_path: storagePath,
                  status: "uploaded",
                  ezcall_linkedid: call.linkedid,
                  auto_generated: true,
                  duration_seconds: call.billsec,
                  original_filename: `${call.dst}_${call.calldate.replace(/[: ]/g, "-")}.mp3`,
                  media_type: "audio",
                  analysis_context: "sdr_call",
                })
                .select("id")
                .single();

              if (insertError) {
                console.error(`[auto-analyze] Insert failed for ${call.linkedid}:`, insertError.message);
                continue;
              }

              // Dispatch transcription (fire-and-forget, but mark error on failure)
              fetch(`${supabaseUrl}/functions/v1/transcribe-call`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${serviceKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ analysis_id: analysis.id, audio_path: storagePath }),
              }).catch(async (e) => {
                console.error(`[auto-analyze] Transcribe dispatch failed:`, e);
                await supabase.from("call_analyses").update({
                  status: "error",
                  feedback: `Falha ao despachar transcrição: ${e?.message || "erro de rede"}`,
                }).eq("id", analysis.id);
              });

              totalCreated++;
              console.log(`[auto-analyze] Created analysis for SDR ${sdr.name}, call ${call.linkedid}`);
            } catch (callErr) {
              console.error(`[auto-analyze] Error processing call ${call.linkedid}:`, callErr);
            }
          }
        } catch (sdrErr) {
          console.error(`[auto-analyze] Error processing SDR ${sdr.name}:`, sdrErr);
        }
      }

      console.log(`[auto-analyze] Done. Created ${totalCreated} analyses.`);

      return new Response(JSON.stringify({ created: totalCreated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } finally {
      // Release lock
      await supabase.from("cron_locks").delete().eq("job_name", lockName);
    }
  } catch (error: unknown) {
    console.error("[auto-analyze] Fatal error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
