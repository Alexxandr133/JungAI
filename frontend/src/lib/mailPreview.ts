/** Зеркало backend wrapCampaignHtml — для живого превью в админке */
export function wrapCampaignEmailPreview(bodyHtml: string): string {
  return `
<!doctype html>
<html lang="ru">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>JungAI</title></head>
<body style="margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:20px 24px;color:#fff;">
            <div style="font-size:20px;font-weight:700;letter-spacing:.2px;">JungAI</div>
            <div style="font-size:12px;opacity:.9;margin-top:4px;">Платформа аналитической психологии</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;font-size:14px;line-height:1.65;color:#111827;">
            ${bodyHtml || '<p style="color:#9ca3af">Текст письма…</p>'}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 24px 22px;background:#fafafa;border-top:1px solid #f3f4f6;">
            <div style="font-size:12px;line-height:1.55;color:#6b7280;">
              С уважением,<br/>команда <strong style="color:#4f46e5;">JungAI</strong>
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

export function renderMailVarsPreview(
  html: string,
  vars: { name?: string; email?: string; unsubscribeUrl?: string } = {}
): string {
  const name = (vars.name || 'Иван').trim();
  const email = vars.email || 'user@example.com';
  const unsubscribeUrl = vars.unsubscribeUrl || '#unsubscribe';
  let out = String(html || '');
  out = out.replace(/\{\{#name\}\}([\s\S]*?)\{\{\/name\}\}/g, (_m, inner) => (name ? String(inner) : ''));
  out = out.replace(/\{\{name\}\}/g, name);
  out = out.replace(/\{\{email\}\}/g, email);
  out = out.replace(/\{\{unsubscribeUrl\}\}/g, unsubscribeUrl);
  return out;
}
