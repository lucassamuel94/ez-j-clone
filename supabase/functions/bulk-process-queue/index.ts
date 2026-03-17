import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EZCALL_BASE = "https://ezsoft.br2.ezcall.com.br";
const DOWNLOAD_TIMEOUT_MS = 45_000; // 45s timeout for audio download
const LOGIN_TIMEOUT_MS = 10_000;    // 10s timeout for EZCall login

async function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getEZCallToken(): Promise<string> {
  const username = Deno.env.get("EZCALL_USERNAME");
  const password = Deno.env.get("EZCALL_PASSWORD");
  if (!username || !password) throw new Error("EZCALL credentials not configured");

  const res = await fetchWithTimeout(`${EZCALL_BASE}/ezcall/api/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  }, LOGIN_TIMEOUT_MS);
  if (!res.ok) throw new Error(`EZCall login failed [${res.status}]`);
  const data = await res.json();
  if (!data?.token) throw new Error("EZCall login returned no token");
  return data.token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch exactly 1 queued item (process one at a time)
    const { data: queued, error: fetchError } = await supabase
      .from("call_analyses")
      .select("id, sdr_user_id, ezcall_linkedid, original_filename, audio_path")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(1);

    if (fetchError) throw new Error(`Fetch queued failed: ${fetchError.message}`);
    if (!queued?.length) {
      const { count } = await supabase
        .from("call_analyses")
        .select("id", { count: "exact", head: true })
        .eq("status", "queued");
      return new Response(JSON.stringify({ processed: 0, remaining: count || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const item = queued[0];
    console.log(`[bulk-process] Processing ${item.ezcall_linkedid} (id=${item.id})`);

    // Update heartbeat
    await supabase.from("call_analyses").update({
      worker_heartbeat_at: new Date().toISOString(),
    } as any).eq("id", item.id);

    try {
      // Step 1: Download audio from EZCall
      const ezToken = await getEZCallToken();

      const recordRes = await fetchWithTimeout(
        `${EZCALL_BASE}/ezcall/api/files/load-record/${item.ezcall_linkedid}`,
        { headers: { Authorization: `Bearer ${ezToken}` } },
        DOWNLOAD_TIMEOUT_MS,
      );
      if (!recordRes.ok) {
        const msg = `Falha ao baixar gravação: HTTP ${recordRes.status}`;
        console.error(`[bulk-process] ${msg} for ${item.ezcall_linkedid}`);
        await supabase.from("call_analyses").update({
          status: "error",
          feedback: msg,
        } as any).eq("id", item.id);

        const { count } = await supabase
          .from("call_analyses")
          .select("id", { count: "exact", head: true })
          .eq("status", "queued");
        return new Response(JSON.stringify({ processed: 0, errors: 1, remaining: count || 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const audioBuffer = await recordRes.arrayBuffer();
      const audioBytes = new Uint8Array(audioBuffer);

      // Step 2: Upload to storage
      const storagePath = `bulk/${item.sdr_user_id}/${item.ezcall_linkedid}.mp3`;
      const { error: uploadError } = await supabase.storage
        .from("call-recordings")
        .upload(storagePath, audioBytes, {
          contentType: "audio/mpeg",
          upsert: true,
        });

      if (uploadError) {
        const msg = `Falha no upload: ${uploadError.message}`;
        console.error(`[bulk-process] ${msg} for ${item.ezcall_linkedid}`);
        await supabase.from("call_analyses").update({
          status: "error",
          feedback: msg,
        } as any).eq("id", item.id);

        const { count } = await supabase
          .from("call_analyses")
          .select("id", { count: "exact", head: true })
          .eq("status", "queued");
        return new Response(JSON.stringify({ processed: 0, errors: 1, remaining: count || 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Step 3: Update audio_path
      await supabase.from("call_analyses").update({
        audio_path: storagePath,
        status: "uploaded",
        worker_heartbeat_at: new Date().toISOString(),
      } as any).eq("id", item.id);

      // Step 4: Dispatch transcription (async — returns immediately)
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const transcribeRes = await fetch(`${supabaseUrl}/functions/v1/transcribe-call`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ analysis_id: item.id, audio_path: storagePath }),
      });

      if (!transcribeRes.ok) {
        const errBody = await transcribeRes.text();
        console.error(`[bulk-process] Transcription dispatch failed for ${item.id} [${transcribeRes.status}]:`, errBody);
        await supabase.from("call_analyses").update({
          status: "error",
          feedback: `Falha ao despachar transcrição: HTTP ${transcribeRes.status}`,
        } as any).eq("id", item.id);

        const { count } = await supabase
          .from("call_analyses")
          .select("id", { count: "exact", head: true })
          .eq("status", "queued");
        return new Response(JSON.stringify({ processed: 0, errors: 1, remaining: count || 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await transcribeRes.text(); // consume body

      console.log(`[bulk-process] Dispatched ${item.ezcall_linkedid} → uploaded + transcription sent`);
    } catch (itemErr) {
      console.error(`[bulk-process] Error processing ${item.ezcall_linkedid}:`, (itemErr as Error).message);
      await supabase.from("call_analyses").update({
        status: "error",
        feedback: `Erro: ${(itemErr as Error).message}`,
      } as any).eq("id", item.id);
    }

    // Count remaining
    const { count } = await supabase
      .from("call_analyses")
      .select("id", { count: "exact", head: true })
      .eq("status", "queued");

    return new Response(JSON.stringify({ processed: 1, remaining: count || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[bulk-process] Fatal:", error);
    const msg = (error as Error).message || "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
