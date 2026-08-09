import { Router } from 'express';
import { prisma } from '../db/prisma';
import { normalizeEmail, verifyUnsubscribeToken } from '../utils/mailCampaign';

const router = Router();

async function handleUnsubscribe(req: any, res: any) {
  try {
    const email = normalizeEmail(String(req.query.email || req.body?.email || ''));
    const token = String(req.query.token || req.body?.token || '');
    if (!email || !token || !verifyUnsubscribeToken(email, token)) {
      return res.status(400).send(htmlPage('Ошибка', 'Недействительная ссылка отписки.'));
    }
    await prisma.mailUnsubscribe.upsert({
      where: { email },
      create: { email, token },
      update: {},
    });
    // One-click POST from Gmail expects 200 OK quickly
    if (req.method === 'POST' && req.get('Content-Type')?.includes('application/x-www-form-urlencoded')) {
      return res.status(200).send('OK');
    }
    return res.status(200).send(htmlPage('Готово', `Адрес ${email} отписан от рассылок JungAI.`));
  } catch (e: any) {
    return res.status(500).send(htmlPage('Ошибка', e.message || 'Не удалось отписаться'));
  }
}

function htmlPage(title: string, message: string) {
  return `<!doctype html><html lang="ru"><head><meta charset="UTF-8"/><title>${title}</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f6fb;padding:40px;color:#111827;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e5e7eb;">
    <h1 style="margin:0 0 12px;font-size:20px;">${title}</h1>
    <p style="margin:0;line-height:1.5;">${message}</p>
  </div>
</body></html>`;
}

router.get('/mail/unsubscribe', handleUnsubscribe);
router.post('/mail/unsubscribe', handleUnsubscribe);

export default router;
