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
  if (!username || !password) {
    throw new Error("EZCALL_USERNAME or EZCALL_PASSWORD not configured");
  }

  const res = await fetch(`${EZCALL_BASE}/ezcall/api/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`EZCall login failed [${res.status}]: ${body}`);
  }

  const data = await res.json();
  if (!data?.token) {
    throw new Error(`EZCall login returned no token: ${JSON.stringify(data)}`);
  }

  return data.token;
}

async function fetchCallReports(
  token: string,
  startDate: string,
  endDate: string,
  extension: string,
): Promise<unknown[]> {
  const allRecords: unknown[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const url = new URL(
      `${EZCALL_BASE}/ezcall/api/call/reports/recent/outgoing/`,
    );
    url.searchParams.set("startDate", startDate);
    url.searchParams.set("endDate", endDate);
    url.searchParams.set("search", extension);
    url.searchParams.set("pagination", "500");
    url.searchParams.set("page", String(page));

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    // If 401, token expired — re-login and retry once
    if (res.status === 401 && page === 1) {
      const newToken = await getEZCallToken();
      const retryRes = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${newToken}` },
      });
      if (!retryRes.ok) {
        const body = await retryRes.text();
        throw new Error(`EZCall reports failed after re-login [${retryRes.status}]: ${body}`);
      }
      const json = await retryRes.json();
      return json.data || [];
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`EZCall reports failed [${res.status}]: ${body}`);
    }

    const json = await res.json();
    const records = json.data || [];
    allRecords.push(...records);
    lastPage = json.last_page || 1;
    page++;
  } while (page <= lastPage);

  return allRecords;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // Action: stream recording
    if (action === "stream") {
      const { linkedid } = body;
      if (!linkedid) {
        return new Response(
          JSON.stringify({ error: "linkedid required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const ezToken = await getEZCallToken();
      const recordRes = await fetch(
        `${EZCALL_BASE}/ezcall/api/files/load-record/${linkedid}`,
        { headers: { Authorization: `Bearer ${ezToken}` } },
      );

      if (!recordRes.ok) {
        const errBody = await recordRes.text();
        return new Response(
          JSON.stringify({ error: `Recording fetch failed: ${errBody}` }),
          {
            status: recordRes.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const audioBuffer = await recordRes.arrayBuffer();
      return new Response(audioBuffer, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": recordRes.headers.get("Content-Type") || "audio/mpeg",
          "Content-Disposition": `inline; filename="${linkedid}.mp3"`,
        },
      });
    }

    // Action: reports (default)
    const { startDate, endDate, extensions } = body;
    if (!startDate || !endDate || !extensions?.length) {
      return new Response(
        JSON.stringify({ error: "startDate, endDate, extensions required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const ezToken = await getEZCallToken();

    // Fetch calls for each extension in parallel
    const results = await Promise.all(
      extensions.map(
        async (ext: { userId: string; extension: string; name: string }) => {
          const calls = await fetchCallReports(
            ezToken,
            startDate,
            endDate,
            ext.extension,
          );

          const totalCalls = calls.length;
          const answeredCalls = calls.filter(
            (c: any) => c.disposition === "ANSWERED",
          );
          const totalAnswered = answeredCalls.length;
          const avgBillsec =
            totalAnswered > 0
              ? Math.round(
                  answeredCalls.reduce(
                    (sum: number, c: any) => sum + (c.billsec || 0),
                    0,
                  ) / totalAnswered,
                )
              : 0;

          return {
            userId: ext.userId,
            name: ext.name,
            extension: ext.extension,
            totalCalls,
            answeredCalls: totalAnswered,
            answerRate:
              totalCalls > 0
                ? Math.round((totalAnswered / totalCalls) * 100)
                : 0,
            avgTalkTime: avgBillsec,
            calls: calls.map((c: any) => ({
              linkedid: c.linkedid,
              calldate: c.calldate,
              dst: c.dst,
              extension: c.extension,
              disposition: c.disposition,
              duration: c.duration,
              billsec: c.billsec,
            })),
          };
        },
      ),
    );

    return new Response(JSON.stringify({ data: results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("EZCall reports error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
