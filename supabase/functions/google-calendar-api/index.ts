import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    // Treat invalid_grant as token revoked
    if (data?.error === 'invalid_grant') {
      throw new Error('TOKEN_REVOKED');
    }
    throw new Error(`Refresh failed: ${JSON.stringify(data)}`);
  }
  return data;
}

async function getValidToken(userId: string): Promise<string> {
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: tokenRow, error } = await adminClient
    .from("google_calendar_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !tokenRow) throw new Error("Google Calendar not connected");

  const now = new Date();
  const expiresAt = new Date(tokenRow.expires_at);

  // Refresh if expiring within 5 minutes
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(tokenRow.refresh_token);
    const newExpiresAt = new Date(
      Date.now() + refreshed.expires_in * 1000
    ).toISOString();

    await adminClient
      .from("google_calendar_tokens")
      .update({
        access_token: refreshed.access_token,
        expires_at: newExpiresAt,
      })
      .eq("user_id", userId);

    return refreshed.access_token;
  }

  return tokenRow.access_token;
}

async function callGoogleAPI(
  accessToken: string,
  method: string,
  path: string,
  body?: unknown
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  const res = await fetch(`${CALENDAR_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  // Handle 401 - token might be revoked
  if (res.status === 401) {
    throw new Error("TOKEN_REVOKED");
  }

  if (method === "DELETE" && res.status === 204) {
    return { success: true };
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Google API error [${res.status}]: ${JSON.stringify(data)}`);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { action, ...params } = await req.json();
    let accessToken: string;

    try {
      accessToken = await getValidToken(user.id);
    } catch (e) {
      if ((e as Error).message === "Google Calendar not connected") {
        return new Response(
          JSON.stringify({ error: "not_connected" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      throw e;
    }

    let result;

    switch (action) {
      case "listEvents": {
        const { timeMin, timeMax, maxResults = 50, calendarId = "primary" } = params;
        const qs = new URLSearchParams({
          orderBy: "startTime",
          singleEvents: "true",
          maxResults: String(maxResults),
        });
        if (timeMin) qs.set("timeMin", timeMin);
        if (timeMax) qs.set("timeMax", timeMax);

        result = await callGoogleAPI(
          accessToken,
          "GET",
          `/calendars/${encodeURIComponent(calendarId)}/events?${qs}`
        );
        break;
      }

      case "createEvent": {
        const { event, calendarId = "primary", sendUpdates = "all" } = params;
        // Add Google Meet conferencing automatically
        const eventWithMeet = {
          ...event,
          conferenceData: {
            createRequest: {
              requestId: crypto.randomUUID(),
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        };
        result = await callGoogleAPI(
          accessToken,
          "POST",
          `/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=${sendUpdates}&conferenceDataVersion=1`,
          eventWithMeet
        );
        break;
      }

      case "updateEvent": {
        const { eventId, event, calendarId = "primary" } = params;
        result = await callGoogleAPI(
          accessToken,
          "PATCH",
          `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
          event
        );
        break;
      }

      case "deleteEvent": {
        const { eventId, calendarId = "primary" } = params;
        result = await callGoogleAPI(
          accessToken,
          "DELETE",
          `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
        );
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("google-calendar-api error:", error);

    const status = (error as Error).message === "TOKEN_REVOKED" ? 401 : 400;

    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
