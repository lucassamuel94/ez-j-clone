/**
 * Converts AI-generated markdown-like feedback text into structured HTML
 * for email templates. Handles bold headers, bullet points, and paragraphs.
 */
export function formatFeedbackHtml(text: string): string {
  if (!text) return '<p style="color:#555; font-size:13px;">Não disponível</p>';

  const lines = text.split('\n').filter(l => l.trim() !== '');
  let html = '';
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect section headers like **PONTOS FORTES:** or **Recomendações:**
    const headerMatch = trimmed.match(/^\*\*(.+?)\*\*:?\s*$/);
    if (headerMatch) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<h4 style="font-size:13px; font-weight:700; color:#1a1a2e; margin:16px 0 6px; border-bottom:1px solid #eee; padding-bottom:4px;">${headerMatch[1]}</h4>`;
      continue;
    }

    // Detect bullet points: • or - at start
    const bulletMatch = trimmed.match(/^[•\-–]\s+(.+)$/);
    if (bulletMatch) {
      if (!inList) { html += '<ul style="color:#555; font-size:13px; line-height:1.7; padding-left:20px; margin:4px 0;">'; inList = true; }
      // Convert inline bold **text** to <strong>
      const content = bulletMatch[1].replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      html += `<li style="margin-bottom:4px;">${content}</li>`;
      continue;
    }

    // Numbered items: 1. or 1)
    const numberedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (numberedMatch) {
      if (!inList) { html += '<ul style="color:#555; font-size:13px; line-height:1.7; padding-left:20px; margin:4px 0; list-style-type:decimal;">'; inList = true; }
      const content = numberedMatch[1].replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      html += `<li style="margin-bottom:4px;">${content}</li>`;
      continue;
    }

    // Regular paragraph
    if (inList) { html += '</ul>'; inList = false; }
    const content = trimmed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html += `<p style="color:#555; font-size:13px; line-height:1.6; margin:6px 0;">${content}</p>`;
  }

  if (inList) html += '</ul>';
  return html;
}

/**
 * Email-safe score circle using table layout (works in Gmail, Outlook, etc.)
 */
export function buildScoreCircle(score: number, scoreColor: string): string {
  return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
  <tr>
    <td style="width:56px; height:56px; border-radius:50%; background:${scoreColor}; text-align:center; vertical-align:middle; font-size:20px; font-weight:700; color:#ffffff; mso-line-height-rule:exactly; line-height:56px;">
      ${score}
    </td>
  </tr>
</table>`;
}
