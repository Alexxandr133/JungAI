import crypto from 'crypto';
import { prisma } from '../db/prisma';
import { config } from '../config';
import { sendEmail, isEmailTransportConfigured } from '../utils/email';

export const MAIL_CAMPAIGN_MAX_RECIPIENTS = 500;
export const MAIL_SEND_DELAY_MS = 2500;
export const MAIL_BATCH_SIZE = 50;

const DEFAULT_TEMPLATES = [
  {
    name: 'Обновление платформы JungAI',
    subject: 'Что нового на JungAI',
    bodyHtml: `<p>Здравствуйте{{#name}}, {{name}}{{/name}}!</p>
<p>Мы обновили платформу JungAI: улучшили рабочие инструменты психолога и кабинет клиента.</p>
<p>Зайдите в аккаунт, чтобы посмотреть изменения.</p>
<p style="margin-top:24px;font-size:12px;color:#6b7280;">Если письма больше не нужны — <a href="{{unsubscribeUrl}}">отписаться</a>.</p>`,
  },
  {
    name: 'Приглашение психологам',
    subject: 'JungAI — пространство для аналитической практики',
    bodyHtml: `<p>Здравствуйте{{#name}}, {{name}}{{/name}}!</p>
<p>Приглашаем вас на JungAI — платформу для ведения клиентов, работы со снами и ИИ-ассистентом в юнгианском контексте.</p>
<p>Зарегистрируйтесь как психолог и пройдите верификацию, чтобы открыть полный функционал.</p>
<p style="margin-top:24px;font-size:12px;color:#6b7280;"><a href="{{unsubscribeUrl}}">Отписаться от рассылки</a></p>`,
  },
  {
    name: 'Новости и предложения для пользователей',
    subject: 'Предложения и новости JungAI',
    bodyHtml: `<p>Здравствуйте{{#name}}, {{name}}{{/name}}!</p>
<p>Делимся короткими новостями платформы и полезными предложениями для вашей работы и практики самонаблюдения.</p>
<p>Ваш email: {{email}}</p>
<p style="margin-top:24px;font-size:12px;color:#6b7280;"><a href="{{unsubscribeUrl}}">Отписаться</a></p>`,
  },
];

export async function ensureDefaultMailTemplates() {
  const count = await prisma.mailTemplate.count();
  if (count > 0) return;
  await prisma.mailTemplate.createMany({ data: DEFAULT_TEMPLATES });
}

export function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(normalizeEmail(email));
}

export async function getOrCreateUnsubscribeToken(email: string): Promise<string> {
  const normalized = normalizeEmail(email);
  const existing = await prisma.mailUnsubscribe.findUnique({ where: { email: normalized } });
  if (existing) return existing.token;
  // Soft token for future unsubscribe (not yet unsubscribed — store token separately via campaign flow)
  // We create token only when sending; for URL building we use MailUnsubscribe if exists,
  // otherwise generate deterministic-ish token stored on first send via ensureUnsubscribeLink.
  const token = crypto.randomBytes(24).toString('hex');
  return token;
}

/** Ensures a reusable unsubscribe token row that does NOT mean unsubscribed yet.
 *  We use MailUnsubscribe only for actual unsubscribes. Tokens live in a lightweight map via campaign recipient flow.
 *  For MVP: store pending tokens in MailUnsubscribe with a sentinel? Better: separate approach —
 *  use HMAC token in URL without DB until they click.
 */
export function buildUnsubscribeToken(email: string): string {
  const secret = config.jwtSecret || 'dev-secret';
  return crypto.createHmac('sha256', secret).update(`unsub:${normalizeEmail(email)}`).digest('hex').slice(0, 48);
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = buildUnsubscribeToken(email);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(token || '')));
  } catch {
    return false;
  }
}

export function unsubscribeUrlFor(email: string): string {
  const token = buildUnsubscribeToken(email);
  const backendOrigin =
    process.env.API_PUBLIC_URL ||
    (config.nodeEnv === 'production' ? 'https://jung-ai.ru' : `http://localhost:${config.port || 4000}`);
  return `${String(backendOrigin).replace(/\/$/, '')}/api/mail/unsubscribe?email=${encodeURIComponent(normalizeEmail(email))}&token=${token}`;
}

export function renderMailTemplate(
  html: string,
  vars: { name?: string | null; email: string; unsubscribeUrl: string }
): string {
  let out = String(html || '');
  const name = (vars.name || '').trim();
  // Simple {{#name}}...{{/name}} optional block
  out = out.replace(/\{\{#name\}\}([\s\S]*?)\{\{\/name\}\}/g, (_m, inner) => (name ? String(inner) : ''));
  out = out.replace(/\{\{name\}\}/g, name);
  out = out.replace(/\{\{email\}\}/g, vars.email);
  out = out.replace(/\{\{unsubscribeUrl\}\}/g, vars.unsubscribeUrl);
  if (!out.includes(vars.unsubscribeUrl)) {
    out += `<p style="margin-top:24px;font-size:12px;color:#6b7280;"><a href="${vars.unsubscribeUrl}">Отписаться от рассылки</a></p>`;
  }
  return out;
}

export function wrapCampaignHtml(bodyHtml: string): string {
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
            ${bodyHtml}
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

let workerRunning = false;

export function startMailCampaignWorker() {
  if (workerRunning) return;
  workerRunning = true;
  const tick = async () => {
    try {
      await processMailQueueTick();
    } catch (e) {
      console.error('[mail-worker]', e);
    } finally {
      setTimeout(tick, MAIL_SEND_DELAY_MS);
    }
  };
  setTimeout(tick, 3000);
}

async function processMailQueueTick() {
  if (!isEmailTransportConfigured()) return;

  const campaign = await prisma.mailCampaign.findFirst({
    where: { status: { in: ['queued', 'sending'] } },
    orderBy: { createdAt: 'asc' },
  });
  if (!campaign) return;

  if (campaign.status === 'queued') {
    await prisma.mailCampaign.update({
      where: { id: campaign.id },
      data: { status: 'sending', startedAt: campaign.startedAt || new Date() },
    });
  }

  const pending = await prisma.mailCampaignRecipient.findMany({
    where: { campaignId: campaign.id, status: 'pending' },
    take: 1,
    orderBy: { createdAt: 'asc' },
  });

  if (!pending.length) {
    const left = await prisma.mailCampaignRecipient.count({
      where: { campaignId: campaign.id, status: 'pending' },
    });
    if (left === 0) {
      await prisma.mailCampaign.update({
        where: { id: campaign.id },
        data: { status: 'sent', finishedAt: new Date() },
      });
    }
    return;
  }

  const recipient = pending[0];
  const email = normalizeEmail(recipient.email);
  const unsub = await prisma.mailUnsubscribe.findUnique({ where: { email } });
  if (unsub) {
    await prisma.mailCampaignRecipient.update({
      where: { id: recipient.id },
      data: { status: 'skipped', error: 'unsubscribed' },
    });
    await prisma.mailCampaign.update({
      where: { id: campaign.id },
      data: { skippedCount: { increment: 1 } },
    });
    return;
  }

  const unsubUrl = unsubscribeUrlFor(email);
  const body = renderMailTemplate(campaign.bodyHtml, {
    name: recipient.name,
    email,
    unsubscribeUrl: unsubUrl,
  });
  const html = wrapCampaignHtml(body);

  try {
    await sendEmail({
      to: email,
      subject: campaign.subject,
      html,
      listUnsubscribeUrl: unsubUrl,
      feedbackId: `jungai:campaign:${campaign.id}`,
      attachBrandLogo: false,
    });
    await prisma.mailCampaignRecipient.update({
      where: { id: recipient.id },
      data: { status: 'sent', sentAt: new Date() },
    });
    await prisma.mailCampaign.update({
      where: { id: campaign.id },
      data: { sentCount: { increment: 1 } },
    });
  } catch (err: any) {
    await prisma.mailCampaignRecipient.update({
      where: { id: recipient.id },
      data: { status: 'failed', error: String(err?.message || err).slice(0, 500) },
    });
    await prisma.mailCampaign.update({
      where: { id: campaign.id },
      data: { failedCount: { increment: 1 } },
    });
  }
}
