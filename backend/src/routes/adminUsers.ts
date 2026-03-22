import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';

const router = Router();
router.use(requireAuth);
router.use((req: AuthedRequest, res, next) => requireRole(['admin'])(req, res, next));

/** Список пользователей (поиск, фильтр по роли) */
router.get('/users', async (req: AuthedRequest, res) => {
  try {
    const role = typeof req.query.role === 'string' ? req.query.role : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const users = await prisma.user.findMany({
      where: {
        ...(role && ['psychologist', 'client', 'researcher', 'admin', 'guest'].includes(role) ? { role } : {}),
        ...(q
          ? {
              OR: [{ email: { contains: q } }, { id: { contains: q } }]
            }
          : {})
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        isVerified: true,
        createdAt: true
      },
      take: 200
    });

    const userIds = users.map(u => u.id);
    const profiles = await prisma.profile.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, name: true }
    });
    const profileMap = new Map(profiles.map(p => [p.userId, p.name]));

    const clientCounts = await prisma.client.groupBy({
      by: ['psychologistId'],
      _count: { id: true }
    });
    const countByPsych = new Map(clientCounts.map(c => [c.psychologistId, c._count.id]));

    const emails = users.filter(u => u.role === 'client').map(u => u.email);
    const clientRows =
      emails.length > 0
        ? await prisma.client.findMany({
            where: { email: { in: emails } },
            select: { id: true, email: true, psychologistId: true, name: true }
          })
        : [];
    const clientByEmail = new Map(clientRows.map(c => [c.email!, c]));

    const items = users.map(u => ({
      id: u.id,
      email: u.email,
      role: u.role,
      isVerified: u.isVerified,
      createdAt: u.createdAt.toISOString(),
      profileName: profileMap.get(u.id) ?? null,
      clientCount: u.role === 'psychologist' || u.role === 'admin' ? countByPsych.get(u.id) ?? 0 : undefined,
      linkedClient:
        u.role === 'client'
          ? clientByEmail.get(u.email)
            ? {
                id: clientByEmail.get(u.email)!.id,
                name: clientByEmail.get(u.email)!.name,
                psychologistId: clientByEmail.get(u.email)!.psychologistId
              }
            : null
          : undefined
    }));

    res.json({ items });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to list users' });
  }
});

/** Психологи для выпадающих списков */
router.get('/users/psychologists-options', async (_req: AuthedRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: { in: ['psychologist', 'admin'] } },
      orderBy: { email: 'asc' },
      select: { id: true, email: true, isVerified: true }
    });
    const profiles = await prisma.profile.findMany({
      where: { userId: { in: users.map(u => u.id) } },
      select: { userId: true, name: true }
    });
    const pmap = new Map(profiles.map(p => [p.userId, p.name]));
    res.json({
      items: users.map(u => ({
        id: u.id,
        email: u.email,
        name: pmap.get(u.id) || u.email.split('@')[0],
        isVerified: u.isVerified
      }))
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to list psychologists' });
  }
});

/** CRM-клиенты; ?psychologistId= — только у этого психолога */
router.get('/users/clients-crm', async (req: AuthedRequest, res) => {
  try {
    const psychId = typeof req.query.psychologistId === 'string' ? req.query.psychologistId : undefined;
    const clients = await prisma.client.findMany({
      where: psychId ? { psychologistId: psychId } : undefined,
      orderBy: { name: 'asc' },
      take: 500,
      select: { id: true, name: true, email: true, psychologistId: true, createdAt: true }
    });
    const psychIds = [...new Set(clients.map(c => c.psychologistId))];
    const psychs = await prisma.user.findMany({
      where: { id: { in: psychIds } },
      select: { id: true, email: true }
    });
    const profiles = await prisma.profile.findMany({
      where: { userId: { in: psychIds } },
      select: { userId: true, name: true }
    });
    const em = new Map(psychs.map(p => [p.id, p.email]));
    const nm = new Map(profiles.map(p => [p.userId, p.name]));
    res.json({
      items: clients.map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        psychologistId: c.psychologistId,
        psychologistEmail: em.get(c.psychologistId) ?? null,
        psychologistName: nm.get(c.psychologistId) ?? null,
        createdAt: c.createdAt.toISOString()
      }))
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to list clients' });
  }
});

/** Назначить клиента другому психологу */
router.patch('/users/clients-crm/:clientId/psychologist', async (req: AuthedRequest, res) => {
  try {
    const { clientId } = req.params;
    const { psychologistId } = req.body ?? {};
    if (!psychologistId || typeof psychologistId !== 'string') {
      return res.status(400).json({ error: 'psychologistId обязателен' });
    }
    const target = await prisma.user.findFirst({
      where: { id: psychologistId, role: { in: ['psychologist', 'admin'] } }
    });
    if (!target) {
      return res.status(400).json({ error: 'Психолог не найден' });
    }
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return res.status(404).json({ error: 'Клиент не найден' });
    }
    const prevPsych = client.psychologistId;

    await prisma.$transaction(async tx => {
      await tx.client.update({
        where: { id: clientId },
        data: { psychologistId }
      });
      await tx.clientTabs.updateMany({
        where: { clientId },
        data: { psychologistId }
      });
      await tx.clientDocument.updateMany({
        where: { clientId, psychologistId: prevPsych },
        data: { psychologistId }
      });
    });

    res.json({ success: true, clientId, psychologistId });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to reassign client' });
  }
});

/** Смена пароля */
router.patch('/users/:id/password', async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body ?? {};
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Пароль не короче 8 символов' });
    }
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (user.role === 'admin' && user.id !== req.user!.id) {
      // разрешаем менять пароль любому админу только если не последний — опционально; оставляем смену
    }
    const hashed = bcrypt.hashSync(password, 10);
    await prisma.user.update({ where: { id }, data: { password: hashed } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to update password' });
  }
});

/** Снять верификацию психолога */
router.post('/users/:id/revoke-verification', async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (user.role !== 'psychologist' && user.role !== 'admin') {
      return res.status(400).json({ error: 'Верификация только у психологов' });
    }
    await prisma.user.update({ where: { id }, data: { isVerified: false } });
    const vr = await prisma.verificationRequest.findUnique({ where: { userId: id } });
    if (vr) {
      await prisma.verificationRequest.update({
        where: { userId: id },
        data: {
          status: 'rejected',
          reviewedBy: req.user!.id,
          reviewedAt: new Date(),
          comment: 'Верификация снята администратором'
        }
      });
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to revoke verification' });
  }
});

async function deletePsychologistUser(psychId: string, transferClientsTo?: string) {
  const clientCount = await prisma.client.count({ where: { psychologistId: psychId } });
  if (clientCount > 0) {
    if (!transferClientsTo) {
      const err = new Error('TRANSFER_REQUIRED') as Error & { code: string; count: number };
      err.code = 'TRANSFER_REQUIRED';
      (err as any).count = clientCount;
      throw err;
    }
    const target = await prisma.user.findFirst({
      where: { id: transferClientsTo, role: { in: ['psychologist', 'admin'] } }
    });
    if (!target || target.id === psychId) {
      throw new Error('INVALID_TRANSFER_TARGET');
    }
    const clients = await prisma.client.findMany({
      where: { psychologistId: psychId },
      select: { id: true }
    });
    const ids = clients.map(c => c.id);
    await prisma.$transaction(async tx => {
      await tx.client.updateMany({ where: { psychologistId: psychId }, data: { psychologistId: transferClientsTo } });
      await tx.clientTabs.updateMany({
        where: { clientId: { in: ids } },
        data: { psychologistId: transferClientsTo }
      });
      await tx.clientDocument.updateMany({
        where: { clientId: { in: ids }, psychologistId: psychId },
        data: { psychologistId: transferClientsTo }
      });
    });
  }

  await prisma.$transaction(async tx => {
    await tx.dreamAmplification.deleteMany({ where: { addedBy: psychId } });
    await tx.dreamFeedback.deleteMany({ where: { psychologistId: psychId } });
    await tx.event.deleteMany({ where: { createdBy: psychId } });
    await tx.task.deleteMany({ where: { ownerId: psychId } });
    await tx.aIChat.deleteMany({ where: { psychologistId: psychId } });
    await tx.aIChatFolder.deleteMany({ where: { psychologistId: psychId } });
    await tx.aIChatShortcut.deleteMany({ where: { psychologistId: psychId } });
    await tx.supportRequest.deleteMany({ where: { psychologistId: psychId } });
    await tx.notification.deleteMany({ where: { userId: psychId } });
    await tx.chatMessage.deleteMany({ where: { authorId: psychId } });
    await tx.dream.deleteMany({ where: { userId: psychId } });
    await tx.material.updateMany({ where: { authorId: psychId }, data: { authorId: null } });
    await tx.paranormalCase.deleteMany({ where: { userId: psychId } });
    await tx.fileAttachment.deleteMany({ where: { uploadedBy: psychId } });
    await tx.clientNote.deleteMany({ where: { authorId: psychId } });
    await tx.amplification.updateMany({ where: { authorId: psychId }, data: { authorId: null } });
    await tx.user.delete({ where: { id: psychId } });
  });
}

async function deleteResearcherUser(userId: string) {
  await prisma.$transaction(async tx => {
    await tx.task.deleteMany({ where: { ownerId: userId } });
    await tx.notification.deleteMany({ where: { userId: userId } });
    await tx.chatMessage.deleteMany({ where: { authorId: userId } });
    await tx.dream.deleteMany({ where: { userId: userId } });
    await tx.material.updateMany({ where: { authorId: userId }, data: { authorId: null } });
    await tx.paranormalCase.deleteMany({ where: { userId: userId } });
    await tx.fileAttachment.deleteMany({ where: { uploadedBy: userId } });
    await tx.amplification.updateMany({ where: { authorId: userId }, data: { authorId: null } });
    await tx.user.delete({ where: { id: userId } });
  });
}

/** Удаление пользователя */
router.delete('/users/:id', async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const transferClientsTo =
      typeof req.body?.transferClientsTo === 'string'
        ? req.body.transferClientsTo
        : typeof req.query.transferClientsTo === 'string'
          ? req.query.transferClientsTo
          : undefined;

    if (id === req.user!.id) {
      return res.status(400).json({ error: 'Нельзя удалить свою учётную запись' });
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return res.status(404).json({ error: 'Пользователь не найден' });

    if (target.role === 'admin') {
      const admins = await prisma.user.count({ where: { role: 'admin' } });
      if (admins <= 1) {
        return res.status(400).json({ error: 'Нельзя удалить последнего администратора' });
      }
    }

    if (target.role === 'psychologist' || target.role === 'admin') {
      try {
        await deletePsychologistUser(id, transferClientsTo);
      } catch (e: any) {
        if (e.message === 'TRANSFER_REQUIRED') {
          return res.status(400).json({
            error: 'Сначала переназначьте клиентов другому психологу',
            code: 'TRANSFER_REQUIRED',
            clientCount: e.count
          });
        }
        if (e.message === 'INVALID_TRANSFER_TARGET') {
          return res.status(400).json({ error: 'Некорректный психолог для переноса клиентов' });
        }
        throw e;
      }
      return res.json({ success: true });
    }

    if (target.role === 'client') {
      const crm = await prisma.client.findFirst({ where: { email: target.email } });
      if (crm) {
        await prisma.client.delete({ where: { id: crm.id } });
      }
      await prisma.user.delete({ where: { id } });
      return res.json({ success: true });
    }

    if (target.role === 'researcher') {
      await deleteResearcherUser(id);
      return res.json({ success: true });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to delete user' });
  }
});

export default router;
