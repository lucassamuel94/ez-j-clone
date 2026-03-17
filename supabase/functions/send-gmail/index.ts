import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface AttachmentInfo {
  path: string;
  name: string;
  type: string;
}

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
    if (data?.error === "invalid_grant") throw new Error("TOKEN_REVOKED");
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

  if (error || !tokenRow) throw new Error("not_connected");

  const now = new Date();
  const expiresAt = new Date(tokenRow.expires_at);

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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createMimeMessage(
  to: string,
  subject: string,
  body: string,
  fromEmail: string,
  cc?: string,
  bcc?: string,
  attachmentParts?: string[]
): string {
  const boundary = "boundary_" + crypto.randomUUID().replace(/-/g, "");

  const headers = [`From: ${fromEmail}`, `To: ${to}`];
  if (cc) headers.push(`Cc: ${cc}`);
  if (bcc) headers.push(`Bcc: ${bcc}`);

  headers.push(
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    `MIME-Version: 1.0`
  );

  const hasAttachments = attachmentParts && attachmentParts.length > 0;

  if (hasAttachments) {
    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

    const altBoundary = "alt_" + crypto.randomUUID().replace(/-/g, "");
    const plainText = body.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ");

    const parts = [
      ...headers,
      ``,
      `--${boundary}`,
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      ``,
      `--${altBoundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      btoa(unescape(encodeURIComponent(plainText))),
      `--${altBoundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      btoa(unescape(encodeURIComponent(body))),
      `--${altBoundary}--`,
      ...attachmentParts,
      `--${boundary}--`,
    ];

    const mimeMessage = parts.join("\r\n");
    return btoa(unescape(encodeURIComponent(mimeMessage)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  } else {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

    const plainText = body.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ");

    const mimeMessage = [
      ...headers,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      btoa(unescape(encodeURIComponent(plainText))),
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      btoa(unescape(encodeURIComponent(body))),
      `--${boundary}--`,
    ].join("\r\n");

    return btoa(unescape(encodeURIComponent(mimeMessage)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }
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

    const {
      to_email,
      cc_email,
      bcc_email,
      subject,
      body,
      lead_id,
      template_id,
      attachments,
    } = await req.json();

    if (!to_email || !subject || !body) {
      throw new Error(
        "Missing required fields: to_email, subject, body"
      );
    }

    // Get valid Google token
    let accessToken: string;
    try {
      accessToken = await getValidToken(user.id);
    } catch (e) {
      if ((e as Error).message === "not_connected") {
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

    // Fetch email signature from profiles
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: profileData } = await adminClient
      .from("profiles")
      .select("email_signature")
      .eq("id", user.id)
      .single();
    
    const emailSignature = profileData?.email_signature || null;
    const finalBody = emailSignature
      ? `${body}<br><br>--<br>${emailSignature}`
      : body;

    // Get sender email from Google profile
    let profileRes = await fetch(
      "https://www.googleapis.com/gmail/v1/users/me/profile",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    // If profile fetch returns 401, try refreshing token once
    if (profileRes.status === 401) {
      try {
        const adminRetry = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
        const { data: tokenRow } = await adminRetry
          .from("google_calendar_tokens")
          .select("refresh_token")
          .eq("user_id", user.id)
          .single();

        if (!tokenRow) throw new Error("TOKEN_REVOKED");

        const refreshed = await refreshAccessToken(tokenRow.refresh_token);
        const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

        await adminRetry
          .from("google_calendar_tokens")
          .update({ access_token: refreshed.access_token, expires_at: newExpiresAt })
          .eq("user_id", user.id);

        accessToken = refreshed.access_token;
        profileRes = await fetch(
          "https://www.googleapis.com/gmail/v1/users/me/profile",
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
      } catch (retryErr: unknown) {
        const msg = retryErr instanceof Error ? retryErr.message : "";
        if (msg === "TOKEN_REVOKED") throw new Error("TOKEN_REVOKED");
        throw retryErr;
      }
    }

    if (!profileRes.ok) {
      const profileErr = await profileRes.json();
      if (profileRes.status === 401) throw new Error("TOKEN_REVOKED");
      console.error("Gmail profile error:", profileRes.status, JSON.stringify(profileErr));
      throw new Error(
        `Gmail profile error [${profileRes.status}]: ${JSON.stringify(profileErr)}`
      );
    }

    const profile = await profileRes.json();
    const fromEmail = profile.emailAddress;

    // Download attachments from storage and build MIME parts
    const attachmentParts: string[] = [];

    if (attachments && attachments.length > 0) {
      // Use the outer boundary - we need to reference it
      // The boundary is created inside createMimeMessage, so we build parts with a placeholder
      for (const att of attachments as AttachmentInfo[]) {
        const { data: fileData, error: downloadError } = await adminClient
          .storage
          .from("email-attachments")
          .download(att.path);

        if (downloadError || !fileData) {
          console.error(`Failed to download attachment: ${att.path}`, downloadError);
          continue;
        }

        const buffer = await fileData.arrayBuffer();
        const base64Content = arrayBufferToBase64(buffer);
        const contentType = att.type || "application/octet-stream";
        const encodedName = `=?UTF-8?B?${btoa(
          unescape(encodeURIComponent(att.name))
        )}?=`;

        // We'll use a special marker that createMimeMessage replaces
        // Actually, let's just build the part with the boundary placeholder
        // The boundary is created in createMimeMessage... 
        // Let's refactor: pass raw attachment data instead
        attachmentParts.push(
          ``,
          `Content-Type: ${contentType}; name="${encodedName}"`,
          `Content-Disposition: attachment; filename="${encodedName}"`,
          `Content-Transfer-Encoding: base64`,
          ``,
          base64Content
        );
      }
    }

    // Format attachment parts with boundary markers
    const formattedAttachmentParts: string[] = [];
    if (attachmentParts.length > 0) {
      // We need to know the boundary... let's restructure
      // Pass attachment data to createMimeMessage
    }

    // Build MIME message
    const boundary = "boundary_" + crypto.randomUUID().replace(/-/g, "");
    const rawAttParts: string[] = [];
    const failedAttachments: string[] = [];

    if (attachments && attachments.length > 0) {
      for (const att of attachments as AttachmentInfo[]) {
        const { data: fileData, error: downloadError } = await adminClient
          .storage
          .from("email-attachments")
          .download(att.path);

        if (downloadError || !fileData) {
          console.error(`Failed to download: ${att.path}`, downloadError);
          failedAttachments.push(att.name);
          continue;
        }

        const buffer = await fileData.arrayBuffer();
        const base64Content = arrayBufferToBase64(buffer);
        const contentType = att.type || "application/octet-stream";
        const encodedName = `=?UTF-8?B?${btoa(
          unescape(encodeURIComponent(att.name))
        )}?=`;

        rawAttParts.push(
          `--${boundary}`,
          `Content-Type: ${contentType}; name="${encodedName}"`,
          `Content-Disposition: attachment; filename="${encodedName}"`,
          `Content-Transfer-Encoding: base64`,
          ``,
          base64Content
        );
      }
    }

    // Build the full MIME message directly
    const hasAttachments = rawAttParts.length > 0;
    const mimeHeaders = [`From: ${fromEmail}`, `To: ${to_email}`];
    if (cc_email) mimeHeaders.push(`Cc: ${cc_email}`);
    if (bcc_email) mimeHeaders.push(`Bcc: ${bcc_email}`);
    mimeHeaders.push(
      `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
      `MIME-Version: 1.0`
    );

    const plainText = finalBody.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ");
    let mimeMessage: string;

    if (hasAttachments) {
      const altBoundary = "alt_" + crypto.randomUUID().replace(/-/g, "");
      mimeHeaders.push(
        `Content-Type: multipart/mixed; boundary="${boundary}"`
      );

      mimeMessage = [
        ...mimeHeaders,
        ``,
        `--${boundary}`,
        `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
        ``,
        `--${altBoundary}`,
        `Content-Type: text/plain; charset=UTF-8`,
        `Content-Transfer-Encoding: base64`,
        ``,
        btoa(unescape(encodeURIComponent(plainText))),
        `--${altBoundary}`,
        `Content-Type: text/html; charset=UTF-8`,
        `Content-Transfer-Encoding: base64`,
        ``,
        btoa(unescape(encodeURIComponent(finalBody))),
        `--${altBoundary}--`,
        ...rawAttParts,
        `--${boundary}--`,
      ].join("\r\n");
    } else {
      mimeHeaders.push(
        `Content-Type: multipart/alternative; boundary="${boundary}"`
      );

      mimeMessage = [
        ...mimeHeaders,
        ``,
        `--${boundary}`,
        `Content-Type: text/plain; charset=UTF-8`,
        `Content-Transfer-Encoding: base64`,
        ``,
        btoa(unescape(encodeURIComponent(plainText))),
        `--${boundary}`,
        `Content-Type: text/html; charset=UTF-8`,
        `Content-Transfer-Encoding: base64`,
        ``,
        btoa(unescape(encodeURIComponent(finalBody))),
        `--${boundary}--`,
      ].join("\r\n");
    }

    const raw = btoa(unescape(encodeURIComponent(mimeMessage)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    // Send via Gmail API with 401 retry
    let sendRes = await fetch(
      "https://www.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
      }
    );

    // If 401, try refreshing token once and retry
    if (sendRes.status === 401) {
      try {
        const adminRetry = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
        const { data: tokenRow } = await adminRetry
          .from("google_calendar_tokens")
          .select("refresh_token")
          .eq("user_id", user.id)
          .single();

        if (!tokenRow) throw new Error("TOKEN_REVOKED");

        const refreshed = await refreshAccessToken(tokenRow.refresh_token);
        const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

        await adminRetry
          .from("google_calendar_tokens")
          .update({ access_token: refreshed.access_token, expires_at: newExpiresAt })
          .eq("user_id", user.id);

        accessToken = refreshed.access_token;

        sendRes = await fetch(
          "https://www.googleapis.com/gmail/v1/users/me/messages/send",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ raw }),
          }
        );
      } catch (retryErr: unknown) {
        const msg = retryErr instanceof Error ? retryErr.message : "";
        if (msg === "TOKEN_REVOKED") throw new Error("TOKEN_REVOKED");
        throw retryErr;
      }
    }

    if (!sendRes.ok) {
      const sendErr = await sendRes.json();
      if (sendRes.status === 401) throw new Error("TOKEN_REVOKED");
      if (sendRes.status === 403) throw new Error("gmail_scope_missing");
      throw new Error(`Gmail send failed: ${JSON.stringify(sendErr)}`);
    }

    const sendData = await sendRes.json();

    // Record in sent_emails (only if lead_id is a valid lead)
    if (lead_id) {
      try {
        await adminClient.from("sent_emails").insert({
          lead_id,
          user_id: user.id,
          template_id: template_id || null,
          to_email,
          subject,
          body,
          status: "sent",
        });

        // Build activity log description
        let description = `enviou e-mail para ${to_email}: "${subject}"`;
        if (cc_email) description += ` (CC: ${cc_email})`;
        if (bcc_email) description += ` (CCO: ${bcc_email})`;
        if (attachments && attachments.length > 0) {
          description += ` [${attachments.length} anexo(s)]`;
        }

        await adminClient.from("lead_activity_logs").insert({
          lead_id,
          user_id: user.id,
          action_type: "email_sent",
          description,
        });

        // Update lead
        const { data: leadData } = await adminClient
          .from("leads")
          .select("attempts_count")
          .eq("id", lead_id)
          .single();

        if (leadData) {
          await adminClient
            .from("leads")
            .update({
              last_contact_at: new Date().toISOString(),
              attempts_count: (leadData.attempts_count || 0) + 1,
            })
            .eq("id", lead_id);
        }
      } catch (logErr) {
        // Logging failed (e.g. lead_id is a project ID, not a lead) - email was still sent successfully
        console.warn("Email sent but logging failed:", logErr);
      }
    }

    // Cleanup attachment files from storage
    if (attachments && attachments.length > 0) {
      const paths = (attachments as AttachmentInfo[]).map((a) => a.path);
      await adminClient.storage.from("email-attachments").remove(paths);
    }

    return new Response(
      JSON.stringify({ success: true, messageId: sendData.id, failedAttachments }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-gmail error:", error);
    const status = (error as Error).message === "TOKEN_REVOKED" ? 401 : 400;
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
