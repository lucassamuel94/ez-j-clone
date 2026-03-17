import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EZCALL_BASE = "https://ezsoft.br2.ezcall.com.br";

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

async function fetchAnsweredCalls(
  token: string,
  date: string,
  extension: string,
  minBillsec: number,
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
    .filter((c) => (c.billsec as number) >= minBillsec)
    .map((c) => ({
      linkedid: c.linkedid as string,
      calldate: c.calldate as string,
      dst: c.dst as string,
      billsec: c.billsec as number,
      duration: c.duration as number,
    }));
}

function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (current <= last) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(current.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    current.setDate(current.getDate() + 1);
  }
  return dates;
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

    const body = await req.json();
    const { startDate, endDate, minDurationSeconds, maxCallsPerSdr, allowReanalyze, confirm } = body;
    const minBillsec = typeof minDurationSeconds === "number" && minDurationSeconds > 0 ? minDurationSeconds : 150;
    const maxPerSdr = typeof maxCallsPerSdr === "number" && maxCallsPerSdr > 0 ? maxCallsPerSdr : 0;
    const skipDedup = allowReanalyze === true;
    const shouldInsert = confirm === true;

    if (!startDate || !endDate) {
      return new Response(JSON.stringify({ error: "startDate and endDate required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get SDR user IDs (role-filtered)
    const { data: sdrRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "sdr");

    const sdrUserIds = (sdrRoles || []).map((r: { user_id: string }) => r.user_id);
    if (!sdrUserIds.length) {
      return new Response(JSON.stringify({ found: 0, newCount: 0, queued: 0, message: "No SDRs with extensions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get SDRs with extensions
    const { data: sdrs, error: sdrError } = await supabase
      .from("profiles")
      .select("id, name, ramal")
      .in("id", sdrUserIds)
      .not("ramal", "is", null)
      .neq("ramal", "");

    if (sdrError) throw new Error(`SDR query failed: ${sdrError.message}`);
    if (!sdrs?.length) {
      return new Response(JSON.stringify({ found: 0, newCount: 0, queued: 0, message: "No SDRs with extensions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ezToken = await getEZCallToken();
    const dates = getDatesInRange(startDate, endDate);
    let totalFound = 0;
    let totalNew = 0;
    let totalQueued = 0;

    for (const sdr of sdrs) {
      let sdrCalls: Array<{ linkedid: string; calldate: string; dst: string; billsec: number; duration: number }> = [];

      for (const date of dates) {
        try {
          const calls = await fetchAnsweredCalls(ezToken, date, sdr.ramal, minBillsec);
          sdrCalls.push(...calls);
        } catch (dateErr) {
          console.error(`[bulk-scan] Error for SDR ${sdr.name}, date ${date}:`, (dateErr as Error).message);
        }
      }

      if (!sdrCalls.length) continue;

      // Sort by duration desc and apply per-SDR limit
      sdrCalls.sort((a, b) => b.billsec - a.billsec);
      if (maxPerSdr > 0) sdrCalls = sdrCalls.slice(0, maxPerSdr);

      totalFound += sdrCalls.length;

      // Deduplication
      let newCalls = sdrCalls;
      if (!skipDedup) {
        const linkedids = sdrCalls.map((c) => c.linkedid);
        const { data: existing } = await supabase
          .from("call_analyses")
          .select("ezcall_linkedid")
          .in("ezcall_linkedid", linkedids);

        const existingSet = new Set((existing || []).map((e: { ezcall_linkedid: string }) => e.ezcall_linkedid));
        newCalls = sdrCalls.filter((c) => !existingSet.has(c.linkedid));
      }

      totalNew += newCalls.length;

      // Only insert when confirm=true
      if (!shouldInsert || !newCalls.length) continue;

      const rows = newCalls.map((call) => ({
        sdr_user_id: sdr.id,
        uploaded_by: user.id,
        audio_path: `pending/${sdr.id}/${call.linkedid}.mp3`,
        status: "queued",
        ezcall_linkedid: call.linkedid,
        auto_generated: true,
        duration_seconds: call.billsec,
        original_filename: `${call.dst}_${call.calldate.replace(/[: ]/g, "-")}.mp3`,
        media_type: "audio",
        analysis_context: "sdr_call",
      }));

      const { error: insertError } = await (supabase.from("call_analyses") as ReturnType<typeof supabase.from>).insert(rows);
      if (insertError) {
        console.error(`[bulk-scan] Insert failed for SDR ${sdr.name}:`, insertError.message);
        continue;
      }

      totalQueued += newCalls.length;
      console.log(`[bulk-scan] SDR ${sdr.name} | found ${sdrCalls.length} | queued ${newCalls.length}`);
    }

    console.log(`[bulk-scan] Done. Found ${totalFound}, new ${totalNew}, queued ${totalQueued}, confirm=${shouldInsert}`);
    return new Response(JSON.stringify({ found: totalFound, newCount: totalNew, queued: totalQueued }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[bulk-scan] Fatal:", error);
    const msg = (error as Error).message || "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
