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

const SCOPES = "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
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

    const { action, code, redirect_uri } = await req.json();

    if (action === "get_auth_url") {
      // Generate OAuth URL
      console.log("OAuth get_auth_url — redirect_uri:", redirect_uri);
      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirect_uri,
        response_type: "code",
        scope: SCOPES,
        access_type: "offline",
        prompt: "consent",
        state: user.id,
      });

      return new Response(
        JSON.stringify({
          url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "exchange_code") {
      // Exchange authorization code for tokens
      console.log("OAuth exchange_code — redirect_uri:", redirect_uri);
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: redirect_uri,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) {
        console.error("Token exchange failed — redirect_uri used:", redirect_uri, "response:", JSON.stringify(tokenData));
        throw new Error(
          `Token exchange failed (redirect_uri: ${redirect_uri}): ${tokenData?.error || JSON.stringify(tokenData)}`
        );
      }

      const expiresAt = new Date(
        Date.now() + tokenData.expires_in * 1000
      ).toISOString();

      // Store tokens using service role to bypass RLS for upsert
      const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

      const { error: upsertError } = await adminClient
        .from("google_calendar_tokens")
        .upsert(
          {
            user_id: user.id,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: expiresAt,
          },
          { onConflict: "user_id" }
        );

      if (upsertError) throw upsertError;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "disconnect") {
      const { error: deleteError } = await supabase
        .from("google_calendar_tokens")
        .delete()
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "status") {
      const { data } = await supabase
        .from("google_calendar_tokens")
        .select("expires_at")
        .eq("user_id", user.id)
        .maybeSingle();

      return new Response(
        JSON.stringify({ connected: !!data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    console.error("google-calendar-auth error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
