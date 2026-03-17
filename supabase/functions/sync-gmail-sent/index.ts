import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface TokenRow {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  gmail_last_sync_at: string | null;
}

interface GmailHeader {
  name: string;
  value: string;
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

async function getValidToken(
  adminClient: ReturnType<typeof createClient>,
  tokenRow: TokenRow
): Promise<string> {
  const now = new Date();
  const expiresAt = new Date(tokenRow.expires_at);

  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(tokenRow.refresh_token);
    const newExpiresAt = new Date(
      Date.now() + refreshed.expires_in * 1000
    ).toISOString();

    await (adminClient
      .from("google_calendar_tokens") as any)
      .update({
        access_token: refreshed.access_token,
        expires_at: newExpiresAt,
      })
      .eq("user_id", tokenRow.user_id);

    return refreshed.access_token;
  }

  return tokenRow.access_token;
}

function extractEmails(headerValue: string): string[] {
  // Extract email addresses from header like "Name <email@x.com>, other@x.com"
  const emails: string[] = [];
  const regex = /[\w.+-]+@[\w.-]+\.\w+/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(headerValue)) !== null) {
    emails.push(match[0].toLowerCase());
  }
  return emails;
}

async function syncUserSentEmails(
  adminClient: any,
  tokenRow: TokenRow
): Promise<{ synced: number; errors: number }> {
  let synced = 0;
  let errors = 0;

  let accessToken: string;
  try {
    accessToken = await getValidToken(adminClient, tokenRow);
  } catch (e) {
    console.warn(`Skipping user ${tokenRow.user_id}: ${(e as Error).message}`);
    return { synced: 0, errors: 1 };
  }

  // Determine time window: last sync or 70 minutes ago (small overlap for safety)
  const sinceDate = tokenRow.gmail_last_sync_at
    ? new Date(new Date(tokenRow.gmail_last_sync_at).getTime() - 5 * 60 * 1000)
    : new Date(Date.now() - 70 * 60 * 1000);

  const afterEpoch = Math.floor(sinceDate.getTime() / 1000);

  // List sent messages
  const listUrl = new URL("https://www.googleapis.com/gmail/v1/users/me/messages");
  listUrl.searchParams.set("q", `in:sent after:${afterEpoch}`);
  listUrl.searchParams.set("maxResults", "50");

  const listRes = await fetch(listUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (listRes.status === 401) {
    console.warn(`Token revoked for user ${tokenRow.user_id}`);
    return { synced: 0, errors: 1 };
  }

  const listData = await listRes.json();
  if (!listRes.ok) {
    console.error(`Gmail list error for ${tokenRow.user_id}:`, JSON.stringify(listData));
    return { synced: 0, errors: 1 };
  }

  const messages = listData.messages || [];
  if (messages.length === 0) {
    // Update sync timestamp even if no messages
    await (adminClient
      .from("google_calendar_tokens") as any)
      .update({ gmail_last_sync_at: new Date().toISOString() })
      .eq("user_id", tokenRow.user_id);
    return { synced: 0, errors: 0 };
  }

  // Check which gmail_message_ids already exist to avoid re-fetching
  const messageIds = messages.map((m: { id: string }) => m.id);
  const { data: existingEmails } = await adminClient
    .from("sent_emails")
    .select("gmail_message_id")
    .in("gmail_message_id", messageIds);

  const existingIds = new Set(
    (existingEmails || []).map((e: { gmail_message_id: string }) => e.gmail_message_id)
  );

  const newMessageIds = messageIds.filter((id: string) => !existingIds.has(id));

  if (newMessageIds.length === 0) {
    await (adminClient
      .from("google_calendar_tokens") as any)
      .update({ gmail_last_sync_at: new Date().toISOString() })
      .eq("user_id", tokenRow.user_id);
    return { synced: 0, errors: 0 };
  }

  // Pre-fetch all lead emails and lead_contacts emails for matching
  const { data: leadsWithEmail } = await adminClient
    .from("leads")
    .select("id, email, owner_user_id, attempts_count") as { data: Array<{ id: string; email: string | null; owner_user_id: string | null; attempts_count: number | null }> | null };

  const { data: leadContacts } = await adminClient
    .from("lead_contacts")
    .select("lead_id, email") as { data: Array<{ lead_id: string; email: string | null }> | null };

  // Build email→lead_id lookup (case-insensitive)
  const emailToLeadMap = new Map<string, { lead_id: string; attempts_count: number }>();

  for (const lead of leadsWithEmail || []) {
    if (lead.email) {
      emailToLeadMap.set(lead.email.toLowerCase(), {
        lead_id: lead.id,
        attempts_count: lead.attempts_count || 0,
      });
    }
  }

  for (const contact of leadContacts || []) {
    if (contact.email && !emailToLeadMap.has(contact.email.toLowerCase())) {
      const parentLead = (leadsWithEmail || []).find((l: any) => l.id === contact.lead_id);
      emailToLeadMap.set(contact.email.toLowerCase(), {
        lead_id: contact.lead_id,
        attempts_count: parentLead?.attempts_count || 0,
      });
    }
  }

  // Process each new message
  for (const msgId of newMessageIds) {
    try {
      const msgRes = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=metadata&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!msgRes.ok) {
        const errBody = await msgRes.text();
        console.warn(`Failed to fetch message ${msgId}:`, errBody);
        errors++;
        continue;
      }

      const msgData = await msgRes.json();
      const headers: GmailHeader[] = msgData.payload?.headers || [];

      const toHeader = headers.find((h) => h.name.toLowerCase() === "to")?.value || "";
      const ccHeader = headers.find((h) => h.name.toLowerCase() === "cc")?.value || "";
      const subject = headers.find((h) => h.name.toLowerCase() === "subject")?.value || "(sem assunto)";

      const allRecipients = [
        ...extractEmails(toHeader),
        ...extractEmails(ccHeader),
      ];

      // Find matching leads
      const matchedLeads = new Set<string>();
      for (const recipientEmail of allRecipients) {
        const match = emailToLeadMap.get(recipientEmail);
        if (match) {
          matchedLeads.add(match.lead_id);
        }
      }

      if (matchedLeads.size === 0) continue;

      // Register activity for each matched lead
      for (const leadId of matchedLeads) {
        const leadInfo = [...emailToLeadMap.values()].find((v) => v.lead_id === leadId);

        // Insert sent_email record
        const { error: insertError } = await (adminClient
          .from("sent_emails") as any)
          .insert({
            lead_id: leadId,
            user_id: tokenRow.user_id,
            to_email: toHeader,
            subject,
            body: "", // Not syncing body for quota savings
            status: "sent",
            gmail_message_id: msgId,
          });

        if (insertError) {
          // Likely duplicate — skip
          if (insertError.code === "23505") continue;
          console.warn(`Insert sent_email error for ${msgId}:`, insertError.message);
          errors++;
          continue;
        }

        // Log activity
        let description = `enviou e-mail (Gmail) para ${toHeader}: "${subject}"`;
        if (ccHeader) description += ` (CC: ${ccHeader})`;

        await (adminClient.from("lead_activity_logs") as any).insert({
          lead_id: leadId,
          user_id: tokenRow.user_id,
          action_type: "email_sent",
          description,
        });

        // Update lead engagement
        await (adminClient.from("leads") as any)
          .update({
            last_contact_at: new Date().toISOString(),
            attempts_count: (leadInfo?.attempts_count || 0) + 1,
          })
          .eq("id", leadId);

        synced++;
      }
    } catch (err) {
      console.error(`Error processing message ${msgId}:`, err);
      errors++;
    }
  }

  // Update sync timestamp
  await (adminClient.from("google_calendar_tokens") as any)
    .update({ gmail_last_sync_at: new Date().toISOString() })
    .eq("user_id", tokenRow.user_id);

  return { synced, errors };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Fetch all users with Google tokens
    const { data: tokenRows, error: tokensError } = await adminClient
      .from("google_calendar_tokens")
      .select("user_id, access_token, refresh_token, expires_at, gmail_last_sync_at");

    if (tokensError) throw tokensError;
    if (!tokenRows || tokenRows.length === 0) {
      return new Response(
        JSON.stringify({ message: "No connected users", synced: 0, errors: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalSynced = 0;
    let totalErrors = 0;

    // Process users sequentially to avoid rate limits
    for (const tokenRow of tokenRows as TokenRow[]) {
      const result = await syncUserSentEmails(adminClient, tokenRow);
      totalSynced += result.synced;
      totalErrors += result.errors;
    }

    console.log(`Gmail sync complete: ${totalSynced} synced, ${totalErrors} errors, ${tokenRows.length} users`);

    return new Response(
      JSON.stringify({
        message: "Sync complete",
        users_processed: tokenRows.length,
        synced: totalSynced,
        errors: totalErrors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("sync-gmail-sent error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
