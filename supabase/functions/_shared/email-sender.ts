const DEFAULT_SENDER = 'EZ Journey CRM <noreply@notifications.ezsoft.com.br>';
// TODO: Fazer upload da nova logo EZ Journey no bucket email-assets e atualizar a URL abaixo
const LOGO_URL = 'https://ftswdtgdvvewtaeoxpts.supabase.co/storage/v1/object/public/email-assets/ezsoft-logo-white.png';

interface SendEmailOptions {
  to: string;
  subject: string;
  bodyHtml: string;
  headerTitle?: string;
  headerGradient?: string;
}

/**
 * Wraps bodyHtml inside the standard EZ email template
 * (header with logo + gradient, white body, footer with copyright)
 */
export function buildEmailTemplate({
  bodyHtml,
  headerTitle,
  headerGradient = 'linear-gradient(135deg, #5738F9 0%, #7c5cfc 100%)',
}: {
  bodyHtml: string;
  headerTitle?: string;
  headerGradient?: string;
}): string {
  const year = new Date().getFullYear();

  return `
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
  <div style="background: ${headerGradient}; padding: 32px 24px; text-align: center;">
    <img src="${LOGO_URL}" alt="EZ Soft" style="height: 40px; margin-bottom: 12px;" />
    ${headerTitle ? `<h1 style="color: #ffffff; font-size: 20px; font-weight: 600; margin: 0;">${headerTitle}</h1>` : ''}
  </div>
  <div style="padding: 28px 24px;">
    ${bodyHtml}
  </div>
  <div style="background: #fafafa; padding: 20px; text-align: center; border-top: 1px solid #f0f0f0;">
    <p style="color: #aaa; font-size: 11px; margin: 0;">EZ Journey CRM</p>
    <p style="color: #ccc; font-size: 10px; margin: 4px 0 0;">© ${year} EZ Soft</p>
  </div>
</div>`;
}

/**
 * Build a styled card block (purple left border) for use inside email body
 */
export function buildEmailCard(innerHtml: string): string {
  return `<a style="display: block; padding: 14px 18px; margin-bottom: 8px; background: #f8f7ff; border: 1px solid #e8e5f7; border-left: 4px solid #5738F9; border-radius: 8px; text-decoration: none; color: #1a1a2e;">${innerHtml}</a>`;
}

/**
 * Build a CTA button for use inside email body
 */
export function buildEmailButton(label: string, href: string): string {
  return `<div style="text-align: center; margin-top: 24px;">
  <a href="${href}" style="display: inline-block; background: linear-gradient(135deg, #5738F9, #7c5cfc); color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; box-shadow: 0 4px 12px rgba(87,56,249,0.3);">${label}</a>
</div>`;
}

/**
 * Send an email via Resend with the standard EZ template
 */
export async function sendNotificationEmail({
  to,
  subject,
  bodyHtml,
  headerTitle,
  headerGradient,
}: SendEmailOptions): Promise<boolean> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    console.warn('RESEND_API_KEY not configured, skipping email');
    return false;
  }

  const html = buildEmailTemplate({ bodyHtml, headerTitle, headerGradient });

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: DEFAULT_SENDER,
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Resend error:', res.status, errText);
      return false;
    }

    console.log(`Email sent to ${to}`);
    return true;
  } catch (e) {
    console.error('Email send error:', e);
    return false;
  }
}
