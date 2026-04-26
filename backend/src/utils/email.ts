import nodemailer from 'nodemailer';
import { config } from '../config';

function stripHtmlToText(html: string): string {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function senderDomain(): string {
  const from = String(config.smtpFrom || '').trim();
  const match = from.match(/@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/);
  return (match?.[1] || 'jung-ai.ru').toLowerCase();
}

function normalizedFromHeader(): string {
  const rawFrom = String(config.smtpFrom || '').trim();
  if (!rawFrom) return 'JungAI <inbox@jung-ai.ru>';
  const normalizedBrand = rawFrom.replace(/JingAI/gi, 'JungAI');
  // Если в SMTP_FROM указан только email без имени, добавим бренд.
  if (!/[<>]/.test(normalizedBrand) && normalizedBrand.includes('@')) {
    return `JungAI <${normalizedBrand}>`;
  }
  return normalizedBrand;
}

function generateMessageId(to: string): string {
  const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const recipient = String(to || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return `<${seed}.${recipient || 'user'}@${senderDomain()}>`;
}

function buildTransporter() {
  if (!config.smtpHost || !config.smtpFrom) return null;
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPass } : undefined
  });
}

const transporter = buildTransporter();

export function isEmailTransportConfigured(): boolean {
  return Boolean(transporter);
}

export async function sendEmail(params: { to: string; subject: string; html: string; text?: string }) {
  if (!transporter) {
    throw new Error('SMTP is not configured. Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM in backend/.env');
  }
  const safeText = (params.text && params.text.trim()) ? params.text.trim() : stripHtmlToText(params.html);
  const toEmail = String(params.to || '').trim().toLowerCase();
  const mid = generateMessageId(toEmail);
  const fromDomain = senderDomain();

  await transporter.sendMail({
    from: normalizedFromHeader(),
    sender: normalizedFromHeader(),
    replyTo: normalizedFromHeader(),
    to: toEmail,
    subject: params.subject,
    html: params.html,
    text: safeText,
    messageId: mid,
    date: new Date(),
    headers: {
      'X-Auto-Response-Suppress': 'OOF, AutoReply',
      'X-Entity-Ref-ID': mid,
      'X-Mailer': 'JungAI Mailer',
      'List-Unsubscribe': `<mailto:${String(config.smtpFrom || '').replace(/^.*<|>.*$/g, '')}?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      'Feedback-ID': `jungai:transactional:${fromDomain}`
    }
  });
}

function renderCodeEmailTemplate(params: {
  title: string;
  subtitle: string;
  code: string;
  note: string;
}): string {
  const { title, subtitle, code, note } = params;
  return `
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f6fb;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:22px 26px;color:#ffffff;">
                <div style="font-size:20px;font-weight:700;letter-spacing:.2px;">JungAI</div>
                <div style="font-size:13px;opacity:.9;margin-top:4px;">Платформа аналитической психологии</div>
              </td>
            </tr>
            <tr>
              <td style="padding:26px;">
                <h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;color:#111827;">${title}</h1>
                <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#4b5563;">${subtitle}</p>
                <div style="display:inline-block;padding:14px 18px;border-radius:12px;background:#eef2ff;border:1px dashed #c7d2fe;font-size:30px;line-height:1;font-weight:800;letter-spacing:2px;color:#312e81;">
                  ${code}
                </div>
                <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">${note}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 26px 22px;">
                <div style="font-size:12px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:14px;line-height:1.55;">
                  Если это были не вы, просто проигнорируйте это письмо.<br/>
                  Это транзакционное служебное уведомление от JungAI.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();
}

export async function sendEmailVerificationCode(email: string, code: string) {
  await sendEmail({
    to: email,
    subject: 'JungAI: подтверждение email',
    text: `Ваш код подтверждения: ${code}. Код действует 15 минут.`,
    html: renderCodeEmailTemplate({
      title: 'Подтверждение email',
      subtitle: 'Введите этот код на странице регистрации, чтобы подтвердить почту.',
      code,
      note: 'Код действует 15 минут.'
    })
  });
}

export async function sendPasswordResetCode(email: string, code: string) {
  await sendEmail({
    to: email,
    subject: 'JungAI: сброс пароля',
    text: `Ваш код для сброса пароля: ${code}. Код действует 15 минут.`,
    html: renderCodeEmailTemplate({
      title: 'Сброс пароля',
      subtitle: 'Введите этот код и задайте новый пароль для аккаунта.',
      code,
      note: 'Код действует 15 минут.'
    })
  });
}
