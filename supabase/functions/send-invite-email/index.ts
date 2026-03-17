import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface InviteEmailRequest {
  email: string;
  role: string;
  invitedByName: string;
  signupUrl: string;
}

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gestor',
  sdr: 'SDR',
  closer: 'Closer',
  head_pos_venda: 'Head Pós-Venda',
  ux_po: 'UX/PO',
  dev_chatbot: 'Dev Chatbot',
  treinamento: 'Treinamento',
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, role, invitedByName, signupUrl }: InviteEmailRequest = await req.json();

    // Validate required fields
    if (!email || !role || !signupUrl) {
      throw new Error("Missing required fields");
    }

    // Validate signupUrl is a safe HTTPS URL (prevent injection)
    try {
      const parsed = new URL(signupUrl);
      if (parsed.protocol !== 'https:') {
        throw new Error("signupUrl must use HTTPS");
      }
    } catch {
      throw new Error("Invalid signupUrl");
    }

    const roleLabel = roleLabels[role] || role;

    const emailResponse = await resend.emails.send({
      from: "EZ Journey CRM <noreply@notifications.ezsoft.com.br>",
      to: [email],
      subject: "Você foi convidado para o EZ Journey CRM",
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
              <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">
                🎉 Você foi convidado!
              </h1>
            </div>
            
            <!-- Content -->
            <div style="padding: 32px 24px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Olá!
              </p>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                <strong>${invitedByName || 'Um administrador'}</strong> convidou você para fazer parte do 
                <strong>EZ Journey CRM</strong> como <strong>${roleLabel}</strong>.
              </p>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 28px;">
                Clique no botão abaixo para criar sua conta e começar a usar a plataforma:
              </p>
              
              <!-- Button -->
              <div style="text-align: center; margin: 28px 0;">
                <a href="${signupUrl}" 
                   style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Criar minha conta
                </a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0; text-align: center;">
                Este convite expira em 7 dias.
              </p>
            </div>
            
            <!-- Footer -->
            <div style="background: #f9fafb; padding: 20px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                EZ Journey CRM
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0;">
                Se você não solicitou este convite, pode ignorar este email.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Invite email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-invite-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
