import { Router } from 'express';
import { requireAuth, AuthedRequest, requireRole } from '../middleware/auth';
import { prisma } from '../db/prisma';
import {
  ensureDefaultMailTemplates,
  normalizeEmail,
  isValidEmail,
  MAIL_CAMPAIGN_MAX_RECIPIENTS,
  unsubscribeUrlFor,
  renderMailTemplate,
  wrapCampaignHtml,
} from '../utils/mailCampaign';
import { isEmailTransportConfigured, sendEmail } from '../utils/email';

const router = Router();

router.use(requireAuth);
router.use((req: AuthedRequest, res, next) => requireRole(['admin'])(req, res, next));

router.get('/mail/status', async (_req, res) => {
  await ensureDefaultMailTemplates();
  res.json({
    smtpConfigured: isEmailTransportConfigured(),
    smtpHostSet: Boolean(process.env.SMTP_HOST),
    smtpFromSet: Boolean(process.env.SMTP_FROM || process.env.SMTP_USER),
    maxRecipients: MAIL_CAMPAIGN_MAX_RECIPIENTS,
    checklist: [
      { id: 'spf', label: 'SPF-запись для домена отправителя', done: null },
      { id: 'dkim', label: 'DKIM подпись на SMTP', done: null },
      { id: 'dmarc', label: 'DMARC (хотя бы p=none)', done: null },
      { id: 'unsub', label: 'Отписка в каждом письме (включено автоматически)', done: true },
      { id: 'throttle', label: 'Троттлинг ~2.5с между письмами, лимит 500/кампания', done: true },
    ],
  });
});

/** Одно тестовое письмо на email админа (или указанный to) */
router.post('/mail/test-send', async (req: AuthedRequest, res) => {
  try {
    if (!isEmailTransportConfigured()) {
      return res.status(400).json({ error: 'SMTP не настроен в backend/.env (SMTP_HOST + SMTP_FROM)' });
    }
    const subject = String(req.body?.subject || 'Тест рассылки JungAI').trim();
    const bodyHtml = String(req.body?.bodyHtml || '<p>Это тестовое письмо из админки JungAI.</p>').trim();
    let to = normalizeEmail(String(req.body?.to || req.user?.email || ''));
    if (!isValidEmail(to)) {
      return res.status(400).json({ error: 'Укажите корректный email получателя' });
    }
    const unsubUrl = unsubscribeUrlFor(to);
    const html = wrapCampaignHtml(
      renderMailTemplate(bodyHtml, { name: 'Тест', email: to, unsubscribeUrl: unsubUrl })
    );
    await sendEmail({
      to,
      subject: `[тест] ${subject}`,
      html,
      listUnsubscribeUrl: unsubUrl,
      feedbackId: 'jungai:campaign:test',
      attachBrandLogo: false,
    });
    res.json({ ok: true, to });
  } catch (e: any) {
    console.error('[mail/test-send]', e);
    res.status(500).json({ error: e.message || 'Не удалось отправить тест' });
  }
});

// —— Groups ——
router.get('/mail/groups', async (_req, res) => {
  try {
    await ensureDefaultMailTemplates();
    const items = await prisma.mailGroup.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { members: true } } },
    });
    res.json({
      items: items.map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        memberCount: g._count.members,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to list groups' });
  }
});

router.post('/mail/groups', async (req: AuthedRequest, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Укажите название группы' });
    const description = req.body?.description != null ? String(req.body.description).trim() : null;
    const g = await prisma.mailGroup.create({ data: { name, description } });
    res.status(201).json(g);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create group' });
  }
});

router.patch('/mail/groups/:id', async (req: AuthedRequest, res) => {
  try {
    const data: any = {};
    if (req.body?.name != null) data.name = String(req.body.name).trim();
    if (req.body?.description !== undefined) {
      data.description = req.body.description == null ? null : String(req.body.description).trim();
    }
    const g = await prisma.mailGroup.update({ where: { id: req.params.id }, data });
    res.json(g);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to update group' });
  }
});

router.delete('/mail/groups/:id', async (req: AuthedRequest, res) => {
  try {
    await prisma.mailGroup.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to delete group' });
  }
});

router.get('/mail/groups/:id/members', async (req: AuthedRequest, res) => {
  try {
    const items = await prisma.mailGroupMember.findMany({
      where: { groupId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to list members' });
  }
});

router.post('/mail/groups/:id/members/manual', async (req: AuthedRequest, res) => {
  try {
    const groupId = req.params.id;
    const group = await prisma.mailGroup.findUnique({ where: { id: groupId } });
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const raw = String(req.body?.emails || req.body?.text || '');
    const emails = raw
      .split(/[\s,;]+/)
      .map(normalizeEmail)
      .filter(isValidEmail);
    const unique = Array.from(new Set(emails));
    let added = 0;
    for (const email of unique) {
      try {
        await prisma.mailGroupMember.create({
          data: { groupId, email, source: 'manual' },
        });
        added += 1;
      } catch {
        // unique constraint — skip
      }
    }
    res.json({ added, totalSubmitted: unique.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to add members' });
  }
});

router.post('/mail/groups/:id/members/from-platform', async (req: AuthedRequest, res) => {
  try {
    const groupId = req.params.id;
    const group = await prisma.mailGroup.findUnique({ where: { id: groupId } });
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const role = typeof req.body?.role === 'string' ? req.body.role.trim() : '';
    const userIds: string[] = Array.isArray(req.body?.userIds)
      ? req.body.userIds.map(String)
      : [];

    const where: any = {};
    if (userIds.length) where.id = { in: userIds };
    if (role) where.role = role;

    const users = await prisma.user.findMany({
      where,
      select: { id: true, email: true },
      take: 5000,
    });

    let added = 0;
    for (const u of users) {
      const email = normalizeEmail(u.email);
      if (!isValidEmail(email)) continue;
      try {
        await prisma.mailGroupMember.create({
          data: { groupId, email, userId: u.id, source: 'platform' },
        });
        added += 1;
      } catch {
        // skip duplicates
      }
    }
    res.json({ added, scanned: users.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to import members' });
  }
});

router.delete('/mail/groups/:id/members/:memberId', async (req: AuthedRequest, res) => {
  try {
    await prisma.mailGroupMember.deleteMany({
      where: { id: req.params.memberId, groupId: req.params.id },
    });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to remove member' });
  }
});

// —— Templates ——
router.get('/mail/templates', async (_req, res) => {
  try {
    await ensureDefaultMailTemplates();
    const items = await prisma.mailTemplate.findMany({ orderBy: { updatedAt: 'desc' } });
    res.json({ items });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to list templates' });
  }
});

router.post('/mail/templates', async (req: AuthedRequest, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const subject = String(req.body?.subject || '').trim();
    const bodyHtml = String(req.body?.bodyHtml || '').trim();
    if (!name || !subject || !bodyHtml) {
      return res.status(400).json({ error: 'Укажите name, subject и bodyHtml' });
    }
    const t = await prisma.mailTemplate.create({ data: { name, subject, bodyHtml } });
    res.status(201).json(t);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create template' });
  }
});

router.patch('/mail/templates/:id', async (req: AuthedRequest, res) => {
  try {
    const data: any = {};
    if (req.body?.name != null) data.name = String(req.body.name).trim();
    if (req.body?.subject != null) data.subject = String(req.body.subject).trim();
    if (req.body?.bodyHtml != null) data.bodyHtml = String(req.body.bodyHtml);
    const t = await prisma.mailTemplate.update({ where: { id: req.params.id }, data });
    res.json(t);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to update template' });
  }
});

router.delete('/mail/templates/:id', async (req: AuthedRequest, res) => {
  try {
    await prisma.mailTemplate.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to delete template' });
  }
});

// —— Campaigns ——
router.get('/mail/campaigns', async (_req, res) => {
  try {
    const items = await prisma.mailCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { group: { select: { id: true, name: true } } },
    });
    res.json({ items });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to list campaigns' });
  }
});

router.get('/mail/campaigns/:id', async (req: AuthedRequest, res) => {
  try {
    const campaign = await prisma.mailCampaign.findUnique({
      where: { id: req.params.id },
      include: {
        group: { select: { id: true, name: true } },
        recipients: { orderBy: { createdAt: 'asc' }, take: 200 },
      },
    });
    if (!campaign) return res.status(404).json({ error: 'Not found' });
    res.json(campaign);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to get campaign' });
  }
});

router.post('/mail/campaigns/preview', async (req: AuthedRequest, res) => {
  try {
    const groupId = String(req.body?.groupId || '');
    const subject = String(req.body?.subject || '').trim();
    const bodyHtml = String(req.body?.bodyHtml || '').trim();
    if (!groupId) return res.status(400).json({ error: 'Укажите groupId' });

    const members = await prisma.mailGroupMember.findMany({ where: { groupId } });
    const emails = Array.from(new Set(members.map((m) => normalizeEmail(m.email)).filter(isValidEmail)));
    const unsubscribed = await prisma.mailUnsubscribe.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    });
    const unsubSet = new Set(unsubscribed.map((u) => u.email));
    const deliverable = emails.filter((e) => !unsubSet.has(e));
    const capped = deliverable.slice(0, MAIL_CAMPAIGN_MAX_RECIPIENTS);

    const sampleEmail = capped[0] || 'example@jung-ai.ru';
    const unsubUrl = unsubscribeUrlFor(sampleEmail);
    const previewBody = renderMailTemplate(bodyHtml || '<p>Пустое письмо</p>', {
      name: 'Иван',
      email: sampleEmail,
      unsubscribeUrl: unsubUrl,
    });

    res.json({
      memberCount: emails.length,
      unsubscribedCount: unsubSet.size,
      deliverableCount: deliverable.length,
      willSendCount: capped.length,
      capped: deliverable.length > MAIL_CAMPAIGN_MAX_RECIPIENTS,
      maxRecipients: MAIL_CAMPAIGN_MAX_RECIPIENTS,
      subject,
      previewHtml: wrapCampaignHtml(previewBody),
      smtpConfigured: isEmailTransportConfigured(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to preview' });
  }
});

router.post('/mail/campaigns', async (req: AuthedRequest, res) => {
  try {
    const groupId = String(req.body?.groupId || '');
    const subject = String(req.body?.subject || '').trim();
    const bodyHtml = String(req.body?.bodyHtml || '').trim();
    const start = Boolean(req.body?.start);
    if (!groupId || !subject || !bodyHtml) {
      return res.status(400).json({ error: 'Укажите groupId, subject и bodyHtml' });
    }
    if (!isEmailTransportConfigured() && start) {
      return res.status(400).json({ error: 'SMTP не настроен — нельзя отправить рассылку' });
    }

    const group = await prisma.mailGroup.findUnique({ where: { id: groupId } });
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const members = await prisma.mailGroupMember.findMany({ where: { groupId } });
    const byEmail = new Map<string, { email: string; name: string | null }>();
    for (const m of members) {
      const email = normalizeEmail(m.email);
      if (!isValidEmail(email)) continue;
      byEmail.set(email, { email, name: null });
    }

    // Enrich names from profiles when userId present
    const withUsers = members.filter((m) => m.userId);
    if (withUsers.length) {
      const profiles = await prisma.profile.findMany({
        where: { userId: { in: withUsers.map((m) => m.userId!).filter(Boolean) } },
        select: { userId: true, name: true },
      });
      const nameByUser = new Map(profiles.map((p) => [p.userId, p.name]));
      for (const m of withUsers) {
        const email = normalizeEmail(m.email);
        const entry = byEmail.get(email);
        if (entry && m.userId) entry.name = nameByUser.get(m.userId) || null;
      }
    }

    const emails = Array.from(byEmail.keys());
    const unsubscribed = await prisma.mailUnsubscribe.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    });
    const unsubSet = new Set(unsubscribed.map((u) => u.email));
    const deliverable = emails.filter((e) => !unsubSet.has(e)).slice(0, MAIL_CAMPAIGN_MAX_RECIPIENTS);
    if (!deliverable.length) {
      return res.status(400).json({ error: 'Нет получателей для отправки (пустая группа или все отписались)' });
    }

    const campaign = await prisma.mailCampaign.create({
      data: {
        subject,
        bodyHtml,
        groupId,
        createdBy: req.user!.id,
        status: start ? 'queued' : 'draft',
        totalCount: deliverable.length,
        startedAt: start ? new Date() : null,
        recipients: {
          create: deliverable.map((email) => ({
            email,
            name: byEmail.get(email)?.name || null,
            status: 'pending',
          })),
        },
      },
      include: { group: { select: { id: true, name: true } } },
    });

    // Mark skipped unsubscribed at create time for transparency
    const skipped = emails.filter((e) => unsubSet.has(e));
    if (skipped.length) {
      await prisma.mailCampaign.update({
        where: { id: campaign.id },
        data: { skippedCount: skipped.length },
      });
    }

    res.status(201).json(campaign);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create campaign' });
  }
});

router.post('/mail/campaigns/:id/start', async (req: AuthedRequest, res) => {
  try {
    if (!isEmailTransportConfigured()) {
      return res.status(400).json({ error: 'SMTP не настроен' });
    }
    const campaign = await prisma.mailCampaign.findUnique({ where: { id: req.params.id } });
    if (!campaign) return res.status(404).json({ error: 'Not found' });
    if (!['draft', 'failed', 'cancelled'].includes(campaign.status)) {
      return res.status(400).json({ error: `Кампания уже в статусе ${campaign.status}` });
    }
    const pending = await prisma.mailCampaignRecipient.count({
      where: { campaignId: campaign.id, status: 'pending' },
    });
    if (!pending) return res.status(400).json({ error: 'Нет pending получателей' });

    const updated = await prisma.mailCampaign.update({
      where: { id: campaign.id },
      data: { status: 'queued', startedAt: new Date(), finishedAt: null },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to start campaign' });
  }
});

router.post('/mail/campaigns/:id/cancel', async (req: AuthedRequest, res) => {
  try {
    const campaign = await prisma.mailCampaign.findUnique({ where: { id: req.params.id } });
    if (!campaign) return res.status(404).json({ error: 'Not found' });
    if (!['queued', 'sending', 'draft'].includes(campaign.status)) {
      return res.status(400).json({ error: 'Нельзя отменить эту кампанию' });
    }
    const updated = await prisma.mailCampaign.update({
      where: { id: campaign.id },
      data: { status: 'cancelled', finishedAt: new Date() },
    });
    await prisma.mailCampaignRecipient.updateMany({
      where: { campaignId: campaign.id, status: 'pending' },
      data: { status: 'skipped', error: 'cancelled' },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to cancel' });
  }
});

export default router;
