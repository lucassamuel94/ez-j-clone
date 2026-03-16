import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MeetingInviteRequest {
  emails: string[];
  meetingTitle: string;
  meetingDate: string;
  meetingTime: string;
  executiveName: string;
  companyName: string;
  sdrName: string;
  meetLink?: string;
}

const LOGO_URL = "https://ftswdtgdvvewtaeoxpts.supabase.co/storage/v1/object/public/email-assets/ezsoft-logo-white.png";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      emails,
      meetingTitle,
      meetingDate,
      meetingTime,
      executiveName,
      companyName,
      sdrName,
      meetLink,
    }: MeetingInviteRequest = await req.json();

    if (!emails?.length || !meetingTitle) {
      throw new Error("Missing required fields: emails and meetingTitle");
    }

    const emailResponse = await resend.emails.send({
      from: "EZ Journey CRM <noreply@notifications.ezsoft.com.br>",
      to: emails,
      subject: `Reunião Agendada: ${meetingTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
          <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); padding: 32px 24px; text-align: center;">
              <img src="${LOGO_URL}" alt="EZ Soft" style="height: 36px; margin-bottom: 16px;" />
              <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 600;">
                Reunião Agendada
              </h1>
            </div>
            
            <!-- Content -->
            <div style="padding: 32px 24px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Olá!
              </p>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                Uma reunião foi agendada com os seguintes detalhes:
              </p>
              
              <!-- Meeting Details Card -->
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;">Título:</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${meetingTitle}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Data:</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${meetingDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Horário:</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${meetingTime}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Executivo:</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${executiveName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Empresa:</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${companyName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Agendado por:</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${sdrName}</td>
                  </tr>
                </table>
                ${meetLink ? `
                <div style="margin-top: 20px; text-align: center;">
                  <a href="${meetLink}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 15px; font-weight: 600;">
                    Entrar na reunião (Google Meet)
                  </a>
                  <p style="margin: 8px 0 0; font-size: 12px; color: #6b7280;">${meetLink}</p>
                </div>
                ` : ''}
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background: #f9fafb; padding: 20px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                EZ Softwares Ltda
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Meeting invite email sent:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-meeting-invite:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
