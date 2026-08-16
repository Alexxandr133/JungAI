import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { requireAuth, requireRole, requireVerification, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';
import { randomBytes } from 'crypto';
import { notifyEventDeleted } from '../websocket/voiceRoom';
import { io } from '../server';
import { RtcTokenBuilder, RtcRole } from 'agora-token';
import { AccessToken } from 'livekit-server-sdk';
import { config } from '../config';
import { sendPublicBookingAcceptedEmail, sendPublicBookingDeclinedEmail, isEmailTransportConfigured } from '../utils/email';
import { mergeCalendarPrefs } from '../utils/calendarSlots';

const router = Router();

let firstMeetingSchemaReady: Promise<void> | null = null;

async function ensureFirstMeetingColumns() {
  if (!firstMeetingSchemaReady) {
    firstMeetingSchemaReady = (async () => {
      const cols = async (table: string, col: string, ddl: string) => {
        try {
          const rows = (await prisma.$queryRawUnsafe<any[]>(`PRAGMA table_info("${table}")`)) as any[];
          if (!rows.some((r) => r.name === col)) {
            await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN ${ddl}`);
          }
        } catch (e) {
          console.warn(`[events] ensure column ${table}.${col}:`, (e as Error)?.message || e);
        }
      };
      await cols('Event', 'isFirstMeeting', '"isFirstMeeting" BOOLEAN NOT NULL DEFAULT 0');
      await cols('Event', 'guestName', '"guestName" TEXT');
      await cols('Event', 'guestEmail', '"guestEmail" TEXT');
      await cols('Event', 'guestPhone', '"guestPhone" TEXT');
      await cols('Event', 'guestQuestionnaire', '"guestQuestionnaire" TEXT');
      await cols('CalendarPublicBookingRequest', 'questionnaire', '"questionnaire" TEXT');
      await cols('CalendarPublicBookingRequest', 'source', `"source" TEXT NOT NULL DEFAULT 'slot'`);
    })();
  }
  await firstMeetingSchemaReady;
}

// Agora App ID и App Certificate
const AGORA_APP_ID = config.agoraAppId;
const AGORA_APP_CERTIFICATE = config.agoraAppCertificate;

// Функция для генерации уникального ID комнаты
function generateRoomId(): string {
  return randomBytes(16).toString('hex');
}

// Функция для генерации URL комнаты
function generateRoomUrl(roomId: string): string {
  // Relative path only — clients assemble absolute URL from window.location.origin
  return `/room/${roomId}`;
}

function eventEffectiveEnd(startsAt: Date, endsAt: Date | null | undefined): Date {
  if (endsAt && endsAt.getTime() > startsAt.getTime()) return endsAt;
  return new Date(startsAt.getTime() + 3600000);
}

function slotOverlapsExisting(
  slotStart: Date,
  slotEnd: Date,
  rows: Array<{ startsAt: Date; endsAt: Date | null }>
): boolean {
  for (const ex of rows) {
    const exStart = new Date(ex.startsAt);
    const exEnd = eventEffectiveEnd(exStart, ex.endsAt);
    if (slotStart.getTime() < exEnd.getTime() && exStart.getTime() < slotEnd.getTime()) return true;
  }
  return false;
}

function parseEventDateInput(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;

  // datetime-local приходит без таймзоны: 2026-05-07T18:00
  // На проде (UTC) это нельзя парсить через new Date(raw), иначе будет сдвиг.
  const localMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (localMatch) {
    const [, y, m, d, hh, mm, ss] = localMatch;
    const year = Number(y);
    const month = Number(m) - 1;
    const day = Number(d);
    const hour = Number(hh);
    const minute = Number(mm);
    const second = Number(ss || '0');
    const utcMs = Date.UTC(year, month, day, hour, minute, second) - (config.eventTimezoneOffsetMinutes * 60 * 1000);
    const result = new Date(utcMs);
    return Number.isNaN(result.getTime()) ? null : result;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function isGuestAccessibleType(eventType: string | null | undefined): boolean {
  return eventType === 'video' || eventType === 'call';
}

async function canUserAccessEvent(event: any, user: { id: string; role: string; email: string }): Promise<boolean> {
  if (!event) return false;
  if (user.role === 'admin') return true;
  if (event.createdBy === user.id) return true;
  if (event.type !== 'session') return true;
  const eventClientId = (event as any).clientId as string | null | undefined;
  if (!eventClientId) return false;
  const client = await prisma.client.findUnique({
    where: { id: eventClientId },
    select: { id: true, psychologistId: true, email: true }
  });
  if (!client) return false;
  if (client.psychologistId === user.id) return true;
  return Boolean(client.email && user.email && client.email.toLowerCase() === user.email.toLowerCase());
}

const CAL_SHARE_TOKEN_EXPIRES_IN = '30d';

function calendarPrefsNonEmpty(raw: unknown): boolean {
  return Boolean(raw && typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw as object).length > 0);
}

async function loadMergedCalendarPrefs(userId: string, jwtFallback?: unknown) {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { calendarPrefs: true }
  });
  const stored = profile?.calendarPrefs;
  if (calendarPrefsNonEmpty(stored)) return mergeCalendarPrefs(stored);
  if (calendarPrefsNonEmpty(jwtFallback)) return mergeCalendarPrefs(jwtFallback);
  return mergeCalendarPrefs(stored ?? jwtFallback ?? null);
}

async function persistCalendarPrefs(userId: string, prefsRaw: unknown) {
  const prefs = mergeCalendarPrefs(prefsRaw);
  await prisma.profile.upsert({
    where: { userId },
    update: { calendarPrefs: prefs as any },
    create: { userId, interests: [], calendarPrefs: prefs as any }
  });
  return prefs;
}


router.post('/events/calendar-share', requireAuth, requireRole(['psychologist', 'researcher', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const bodyPrefs = req.body?.prefs;
    // Persist prefs when provided; slot calc on public-calendar prefers Profile
    if (bodyPrefs && typeof bodyPrefs === 'object') {
      try {
        await persistCalendarPrefs(req.user!.id, bodyPrefs);
      } catch (e) {
        console.warn('Failed to persist calendarPrefs', e);
      }
    }
    const shareToken = jwt.sign(
      {
        typ: 'cal_share_v1',
        pid: req.user!.id
        // prefs omitted from JWT; Profile.calendarPrefs is source of truth
      },
      config.jwtSecret,
      { expiresIn: CAL_SHARE_TOKEN_EXPIRES_IN }
    );
    const base = String(config.frontendUrl || '').replace(/\/$/, '');
    // Return token only for clients to assemble URL from their origin; url kept for backwards compat
    res.json({
      token: shareToken,
      url: `${base}/book/calendar?t=${encodeURIComponent(shareToken)}`
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to create link' });
  }
});

router.get('/events/calendar-prefs', requireAuth, requireRole(['psychologist', 'researcher', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const prefs = await loadMergedCalendarPrefs(req.user!.id);
    res.json({ prefs });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to load calendar prefs' });
  }
});

router.put('/events/calendar-prefs', requireAuth, requireRole(['psychologist', 'researcher', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const bodyPrefs = req.body?.prefs;
    if (bodyPrefs === undefined || bodyPrefs === null || typeof bodyPrefs !== 'object' || Array.isArray(bodyPrefs)) {
      return res.status(400).json({ error: 'prefs object required' });
    }
    const prefs = await persistCalendarPrefs(req.user!.id, bodyPrefs);
    res.json({ prefs });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to save calendar prefs' });
  }
});

router.get('/events/public-calendar', async (req, res) => {
  const raw = typeof req.query.t === 'string' ? req.query.t : typeof req.query.token === 'string' ? req.query.token : '';
  if (!raw) return res.status(400).json({ error: 'Missing token' });
  try {
    const decoded = jwt.verify(raw, config.jwtSecret) as jwt.JwtPayload & { typ?: string; pid?: string; prefs?: unknown };
    if (decoded.typ !== 'cal_share_v1' || !decoded.pid || typeof decoded.pid !== 'string') {
      return res.status(403).json({ error: 'Invalid calendar link' });
    }
    const since = new Date(Date.now() - 120 * 86400000);
    const items = await prisma.event.findMany({
      where: { createdBy: decoded.pid, startsAt: { gte: since } },
      orderBy: { startsAt: 'asc' },
      select: {
        id: true,
        title: true,
        type: true,
        startsAt: true,
        endsAt: true
      }
    });
    const prefs = await loadMergedCalendarPrefs(decoded.pid, decoded.prefs);
    if (!prefs.bookingByLinkEnabled) {
      return res.status(403).json({
        error: 'Запись по ссылке временно отключена специалистом',
        bookingByLinkEnabled: false,
        prefs,
      });
    }
    const hostUser = await prisma.user.findUnique({
      where: { id: decoded.pid },
      select: {
        isVerified: true,
        profile: {
          select: {
            name: true,
            avatarUrl: true,
            therapyMethod: true,
            sessionPriceRub: true
          }
        }
      }
    });
    const hostName =
      hostUser?.profile?.name ||
      null;
    res.json({
      items,
      prefs,
      host: {
        name: hostName || 'Специалист',
        avatarUrl: hostUser?.profile?.avatarUrl || null,
        therapyMethod: hostUser?.profile?.therapyMethod || null,
        sessionPriceRub: hostUser?.profile?.sessionPriceRub ?? null,
        isVerified: Boolean(hostUser?.isVerified)
      }
    });
  } catch {
    return res.status(403).json({ error: 'Invalid or expired calendar link' });
  }
});

router.post('/events/public-calendar/book', async (req, res) => {
  const { token, slotStart, slotEnd, contactName, contactEmail, contactPhone, message } = req.body ?? {};
  if (!token || typeof token !== 'string') return res.status(400).json({ error: 'Missing token' });
  const nameOk = typeof contactName === 'string' && contactName.trim().length >= 2;
  const emailOk = typeof contactEmail === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim());
  if (!nameOk || !emailOk) {
    return res.status(400).json({ error: 'Укажите имя и корректный email' });
  }
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload & { typ?: string; pid?: string };
    if (decoded.typ !== 'cal_share_v1' || !decoded.pid || typeof decoded.pid !== 'string') {
      return res.status(403).json({ error: 'Invalid calendar link' });
    }
    const prefs = await loadMergedCalendarPrefs(decoded.pid);
    if (!prefs.bookingByLinkEnabled) {
      return res.status(403).json({ error: 'Запись по ссылке временно отключена специалистом' });
    }
    const parsedStart = parseEventDateInput(slotStart);
    if (!parsedStart) return res.status(400).json({ error: 'Invalid slotStart' });
    const parsedEnd = slotEnd ? parseEventDateInput(slotEnd) : null;
    if (slotEnd && !parsedEnd) return res.status(400).json({ error: 'Invalid slotEnd' });

    const row = await prisma.calendarPublicBookingRequest.create({
      data: {
        psychologistId: decoded.pid,
        slotStart: parsedStart,
        slotEnd: parsedEnd,
        contactName: String(contactName).trim().slice(0, 200),
        contactEmail: String(contactEmail).trim().slice(0, 320),
        contactPhone: typeof contactPhone === 'string' ? contactPhone.trim().slice(0, 40) || null : null,
        message: typeof message === 'string' ? message.trim().slice(0, 2000) || null : null,
        status: 'pending'
      }
    });
    res.json({ ok: true, id: row.id });
  } catch {
    return res.status(403).json({ error: 'Invalid or expired calendar link' });
  }
});

router.get('/events/psychologist-calendar-for-client', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const client = await prisma.client.findFirst({
      where: { email: req.user!.email },
      select: { id: true, name: true, psychologistId: true }
    });
    if (!client) return res.status(404).json({ error: 'Профиль клиента не найден' });
    if (!client.psychologistId || client.psychologistId.startsWith('temp-')) {
      return res.status(400).json({ error: 'У вас ещё не назначен психолог' });
    }
    const psychologist = await prisma.user.findFirst({
      where: { id: client.psychologistId, role: { in: ['psychologist', 'admin'] } },
      include: { profile: { select: { name: true } } }
    });
    if (!psychologist) return res.status(404).json({ error: 'Психолог не найден' });
    const since = new Date(Date.now() - 120 * 86400000);
    const items = await prisma.event.findMany({
      where: { createdBy: psychologist.id, startsAt: { gte: since } },
      orderBy: { startsAt: 'asc' },
      select: {
        id: true,
        title: true,
        type: true,
        startsAt: true,
        endsAt: true
      }
    });
    const prefs = await loadMergedCalendarPrefs(psychologist.id);
    res.json({
      items,
      prefs,
      psychologistName: psychologist.profile?.name || psychologist.email?.split('@')[0] || 'Специалист'
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Не удалось загрузить календарь' });
  }
});

router.post('/events/client-book-session-slot', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const { slotStart, slotEnd } = req.body ?? {};
    const parsedStart = parseEventDateInput(slotStart);
    if (!parsedStart) return res.status(400).json({ error: 'Некорректное время начала' });
    const parsedEnd = slotEnd ? parseEventDateInput(slotEnd) : null;
    if (slotEnd && !parsedEnd) return res.status(400).json({ error: 'Некорректное время окончания' });
    const endsAtResolved = parsedEnd && parsedEnd.getTime() > parsedStart.getTime() ? parsedEnd : new Date(parsedStart.getTime() + 3600000);

    if (parsedStart.getTime() < Date.now() - 30_000) {
      return res.status(400).json({ error: 'Нельзя записаться на прошедшее время' });
    }

    const client = await prisma.client.findFirst({
      where: { email: req.user!.email }
    });
    if (!client) return res.status(404).json({ error: 'Профиль клиента не найден' });
    if (!client.psychologistId || client.psychologistId.startsWith('temp-')) {
      return res.status(400).json({ error: 'У вас ещё не назначен психолог' });
    }

    const psychologist = await prisma.user.findFirst({
      where: { id: client.psychologistId, role: { in: ['psychologist', 'admin'] } }
    });
    if (!psychologist) return res.status(404).json({ error: 'Психолог не найден' });

    const existing = await prisma.event.findMany({
      where: {
        createdBy: psychologist.id,
        startsAt: { lt: endsAtResolved, gte: new Date(parsedStart.getTime() - 72 * 3600000) }
      },
      select: { startsAt: true, endsAt: true }
    });
    if (slotOverlapsExisting(parsedStart, endsAtResolved, existing)) {
      return res.status(409).json({ error: 'Это время уже занято. Выберите другой слот.' });
    }

    const roomId = generateRoomId();
    const roomUrl = generateRoomUrl(roomId);
    const title = `Сессия: ${client.name}`;

    const event = await prisma.event.create({
      data: {
        title,
        type: 'session',
        description: null,
        startsAt: parsedStart,
        endsAt: endsAtResolved,
        createdBy: psychologist.id,
        clientId: client.id,
        sessionStatus: 'pending',
        clientRequestedSession: true,
        voiceRoom: {
          create: {
            roomId,
            roomUrl
          }
        }
      } as any,
      include: {
        voiceRoom: true
      }
    });

    try {
      await prisma.therapySession.create({
        data: {
          clientId: client.id,
          date: parsedStart,
          summary: title,
          videoUrl: null,
          eventId: event.id
        }
      });
    } catch (err: any) {
      console.error('client self-book therapy session failed', err);
    }

    try {
      await (prisma as any).notification.create({
        data: {
          userId: psychologist.id,
          type: 'session_booked_by_client',
          title: 'Клиент записался на сессию',
          message: `${client.name} выбрал(а) время: ${parsedStart.toLocaleString('ru-RU', { timeZone: config.appTimeZone })}`,
          entityType: 'event',
          entityId: event.id,
          read: false
        }
      });
    } catch (err: any) {
      console.error('client self-book psychologist notification failed', err);
    }

    res.status(201).json(event);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Не удалось записаться' });
  }
});

router.get('/events/calendar-booking-requests', requireAuth, requireRole(['psychologist', 'researcher', 'admin']), async (req: AuthedRequest, res) => {
  await ensureFirstMeetingColumns();
  const items = await prisma.calendarPublicBookingRequest.findMany({
    where: { psychologistId: req.user!.id, status: 'pending' },
    orderBy: { createdAt: 'asc' }
  });
  const mapped = items.map((row: any) => {
    let questionnaire = row.questionnaire ?? null;
    if (typeof questionnaire === 'string') {
      try {
        questionnaire = JSON.parse(questionnaire);
      } catch {
        questionnaire = null;
      }
    }
    const source = row.source === 'match' || questionnaire ? 'match' : 'slot';
    return {
      ...row,
      questionnaire,
      source,
      kind: source === 'match' ? 'match' : 'slot',
      canWrite: false
    };
  });
  res.json({ items: mapped });
});

/** Единый список заявок: слот календаря + legacy SupportRequest из подбора */
router.get('/events/incoming-requests', requireAuth, requireRole(['psychologist', 'researcher', 'admin']), async (req: AuthedRequest, res) => {
  try {
    await ensureFirstMeetingColumns();
    const bookings = await prisma.calendarPublicBookingRequest.findMany({
      where: { psychologistId: req.user!.id, status: 'pending' },
      orderBy: { createdAt: 'asc' }
    });

    const bookingEmails = new Set(bookings.map((b) => b.contactEmail.toLowerCase()));

    const supportRows = await prisma.supportRequest.findMany({
      where: {
        psychologistId: req.user!.id,
        clientId: { not: null },
        status: 'open'
      },
      orderBy: { createdAt: 'asc' },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } }
      }
    });

    const bookingItems = bookings.map((row: any) => {
      let questionnaire = row.questionnaire ?? null;
      if (typeof questionnaire === 'string') {
        try {
          questionnaire = JSON.parse(questionnaire);
        } catch {
          questionnaire = null;
        }
      }
      const source = row.source === 'match' || Boolean(questionnaire) ? 'match' : 'slot';
      return {
        id: `booking:${row.id}`,
        bookingId: row.id,
        supportRequestId: null as string | null,
        kind: source === 'match' ? 'match' : 'slot',
        source,
        contactName: row.contactName,
        contactEmail: row.contactEmail,
        contactPhone: row.contactPhone,
        slotStart: row.slotStart,
        slotEnd: row.slotEnd,
        message: row.message,
        questionnaire,
        createdAt: row.createdAt,
        canWrite: false,
        clientId: null as string | null
      };
    });

    const supportItems = [];
    for (const r of supportRows) {
      const email = (r.client?.email || '').toLowerCase();
      if (email && bookingEmails.has(email)) continue; // уже в calendar booking

      let questionnaire: any = (r as any).questionnaire ?? null;
      if (!questionnaire) {
        try {
          const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT "questionnaire" FROM "SupportRequest" WHERE "id" = ? LIMIT 1`,
            r.id
          );
          const raw = rows?.[0]?.questionnaire;
          if (raw) questionnaire = typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch {
          /* ignore */
        }
      } else if (typeof questionnaire === 'string') {
        try {
          questionnaire = JSON.parse(questionnaire);
        } catch {
          /* keep */
        }
      }

      const slotStart =
        questionnaire?.slotStart || questionnaire?.preferredSlotStart || r.createdAt;
      const slotEnd = questionnaire?.slotEnd || questionnaire?.preferredSlotEnd || null;

      supportItems.push({
        id: `support:${r.id}`,
        bookingId: null as string | null,
        supportRequestId: r.id,
        kind: 'match' as const,
        source: 'match',
        contactName: r.client?.name || questionnaire?.contactName || 'Клиент',
        contactEmail: r.client?.email || questionnaire?.contactEmail || '',
        contactPhone: r.client?.phone || questionnaire?.contactPhone || null,
        slotStart,
        slotEnd,
        message: r.description,
        questionnaire,
        createdAt: r.createdAt,
        canWrite: Boolean(r.clientId),
        clientId: r.clientId
      });
    }

    const items = [...bookingItems, ...supportItems].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    res.json({ items, total: items.length });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Не удалось загрузить заявки' });
  }
});

router.post(
  '/events/:id/attach-client',
  requireAuth,
  requireRole(['psychologist', 'admin']),
  requireVerification,
  async (req: AuthedRequest, res) => {
    await ensureFirstMeetingColumns();
    const eventId = String(req.params.id);
    const clientId = typeof req.body?.clientId === 'string' ? req.body.clientId.trim() : '';
    if (!clientId) return res.status(400).json({ error: 'Укажите clientId' });

    const event = await prisma.event.findFirst({
      where: { id: eventId, createdBy: req.user!.id }
    });
    if (!event) return res.status(404).json({ error: 'Событие не найдено' });

    const client = await prisma.client.findFirst({
      where: { id: clientId, psychologistId: req.user!.id }
    });
    if (!client) return res.status(404).json({ error: 'Клиент не найден' });

    const updated = await prisma.event.update({
      where: { id: eventId },
      data: {
        clientId: client.id,
        isFirstMeeting: false
      } as any,
      include: { voiceRoom: true }
    });
    res.json(updated);
  }
);

router.post(
  '/events/calendar-booking-requests/:id/accept',
  requireAuth,
  requireRole(['psychologist', 'researcher', 'admin']),
  requireVerification,
  async (req: AuthedRequest, res) => {
    await ensureFirstMeetingColumns();
    const id = String(req.params.id);
    const reqRow = await prisma.calendarPublicBookingRequest.findFirst({
      where: { id, psychologistId: req.user!.id, status: 'pending' }
    });
    if (!reqRow) return res.status(404).json({ error: 'Заявка не найдена или уже обработана' });
    const endsAtResolved = reqRow.slotEnd ?? new Date(reqRow.slotStart.getTime() + 3600000);
    const roomId = generateRoomId();
    const roomUrl = generateRoomUrl(roomId);
    const title = `Встреча: ${reqRow.contactName}`;
    let questionnaire: any = (reqRow as any).questionnaire ?? null;
    if (typeof questionnaire === 'string') {
      try {
        questionnaire = JSON.parse(questionnaire);
      } catch {
        questionnaire = null;
      }
    }
    const description = [reqRow.message, reqRow.contactPhone ? `Тел: ${reqRow.contactPhone}` : null]
      .filter(Boolean)
      .join('\n');
    try {
      const event = await prisma.event.create({
        data: {
          title,
          type: 'video',
          description: description || null,
          startsAt: reqRow.slotStart,
          endsAt: endsAtResolved,
          createdBy: req.user!.id,
          clientId: null,
          sessionStatus: null,
          isFirstMeeting: true,
          guestName: reqRow.contactName,
          guestEmail: reqRow.contactEmail,
          guestPhone: reqRow.contactPhone || null,
          guestQuestionnaire: questionnaire || undefined,
          voiceRoom: {
            create: {
              roomId,
              roomUrl
            }
          }
        } as any,
        include: {
          voiceRoom: true
        }
      });
      await prisma.calendarPublicBookingRequest.update({
        where: { id },
        data: {
          status: 'accepted',
          decidedAt: new Date(),
          eventId: event.id,
          declineReason: null
        }
      });
      // Закрыть связанные open SupportRequest по тому же email (legacy match flow)
      try {
        const linked = await prisma.supportRequest.findMany({
          where: {
            psychologistId: req.user!.id,
            status: 'open',
            client: { email: reqRow.contactEmail }
          },
          select: { id: true }
        });
        if (linked.length) {
          await prisma.supportRequest.updateMany({
            where: { id: { in: linked.map((x) => x.id) } },
            data: { status: 'resolved', adminResponse: 'Принято как первая встреча', respondedAt: new Date() }
          });
        }
      } catch {
        /* ignore */
      }
      const psych = await prisma.user.findUnique({
        where: { id: req.user!.id },
        include: { profile: true }
      });
      const psychName = psych?.profile?.name || psych?.email || 'Специалист';
      const whenLabel = reqRow.slotStart.toLocaleString('ru-RU', {
        timeZone: config.appTimeZone,
        dateStyle: 'long',
        timeStyle: 'short'
      });
      const frontendBase = String(config.frontendUrl || '').replace(/\/$/, '');
      const guestJoinUrl = `${frontendBase}/room/${roomId}?guest=1`;
      let emailSent = false;
      try {
        if (guestJoinUrl && isEmailTransportConfigured()) {
          await sendPublicBookingAcceptedEmail({
            to: reqRow.contactEmail,
            psychologistName: psychName,
            whenLabel,
            guestJoinUrl
          });
          emailSent = true;
        }
      } catch (mailErr: any) {
        console.error('calendar booking accept email failed', mailErr);
      }
      res.json({ ok: true, event, emailSent });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Не удалось создать встречу' });
    }
  }
);

router.post(
  '/events/calendar-booking-requests/:id/decline',
  requireAuth,
  requireRole(['psychologist', 'researcher', 'admin']),
  requireVerification,
  async (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (reason.length < 3) {
      return res.status(400).json({ error: 'Укажите причину отклонения (не менее 3 символов).' });
    }
    const reqRow = await prisma.calendarPublicBookingRequest.findFirst({
      where: { id, psychologistId: req.user!.id, status: 'pending' }
    });
    if (!reqRow) return res.status(404).json({ error: 'Заявка не найдена или уже обработана' });
    await prisma.calendarPublicBookingRequest.update({
      where: { id },
      data: {
        status: 'declined',
        declineReason: reason.slice(0, 2000),
        decidedAt: new Date()
      }
    });
    const psych = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { profile: true }
    });
    const psychName = psych?.profile?.name || psych?.email || 'Специалист';
    let emailSent = false;
    try {
      if (isEmailTransportConfigured()) {
        await sendPublicBookingDeclinedEmail({
          to: reqRow.contactEmail,
          psychologistName: psychName,
          reason
        });
        emailSent = true;
      }
    } catch (mailErr: any) {
      console.error('calendar booking decline email failed', mailErr);
    }
    res.json({ ok: true, emailSent });
  }
);

router.get('/events', requireAuth, async (req: AuthedRequest, res) => {
  await ensureFirstMeetingColumns();
  const where: any = {};
  if (req.user?.role === 'psychologist' || req.user?.role === 'researcher') {
    where.createdBy = req.user.id;
  }
  const items = await prisma.event.findMany({
    where,
    orderBy: { startsAt: 'asc' },
    include: {
      voiceRoom: true
    }
  });
  res.json({ items });
});

router.post('/events/instant-call', requireAuth, requireRole(['psychologist', 'researcher', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const { title } = req.body ?? {};
    const now = new Date();
    const endsAt = new Date(now.getTime() + 2 * 3600000);
    const roomId = generateRoomId();
    const roomUrl = generateRoomUrl(roomId);

    const event = await prisma.event.create({
      data: {
        title: typeof title === 'string' && title.trim() ? title.trim() : 'Быстрый звонок',
        type: 'call',
        description: 'Мгновенный звонок без привязки к сессии',
        startsAt: now,
        endsAt,
        createdBy: req.user!.id,
        clientId: null,
        voiceRoom: {
          create: { roomId, roomUrl }
        }
      } as any,
      include: { voiceRoom: true }
    });

    res.status(201).json(event);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create instant call' });
  }
});

router.post('/events', requireAuth, requireRole(['psychologist', 'researcher', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  const { title, type, description, startsAt, endsAt, clientId } = req.body ?? {};
  const parsedStartsAt = parseEventDateInput(startsAt);
  const parsedEndsAt = endsAt ? parseEventDateInput(endsAt) : null;
  if (!parsedStartsAt) {
    return res.status(400).json({ error: 'Invalid startsAt format' });
  }
  if (endsAt && !parsedEndsAt) {
    return res.status(400).json({ error: 'Invalid endsAt format' });
  }
  
  // Если указан клиент — проверяем доступ (для любого типа встречи)
  let client = null;
  if (clientId) {
    client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    if (req.user!.role !== 'admin' && client.psychologistId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  
  // Генерируем данные для голосовой комнаты
  const roomId = generateRoomId();
  const roomUrl = generateRoomUrl(roomId);
  
  // Создаем событие с голосовой комнатой
  const event = await prisma.event.create({ 
    data: { 
      title, 
      type, 
      description, 
      startsAt: parsedStartsAt,
      endsAt: parsedEndsAt,
      createdBy: req.user!.id,
      clientId: clientId || null,
      sessionStatus: clientId ? 'pending' : null,
      voiceRoom: {
        create: {
          roomId,
          roomUrl
        }
      }
    } as any,
    include: {
      voiceRoom: true
    }
  });

  // Если это сессия с клиентом, создаем TherapySession и уведомление
  if (clientId && client) {
    try {
      if (type === 'session') {
      // Создаем сессию
      await prisma.therapySession.create({
        data: {
          clientId: clientId,
          date: parsedStartsAt,
          summary: description || title,
          videoUrl: null,
          eventId: event.id
        }
      });
      }
      // Получаем информацию о психологе для уведомления
      const psychologist = await prisma.user.findUnique({
        where: { id: req.user!.id },
        include: { profile: true }
      });

      const psychologistName = psychologist?.profile?.name || psychologist?.email || 'Психолог';

      // Создаем уведомление для клиента
      // Находим User ID клиента по email (если клиент зарегистрирован)
      try {
        if (client.email) {
          const clientUser = await prisma.user.findFirst({
            where: { email: client.email }
          });
          
          if (clientUser) {
            await (prisma as any).notification.create({
              data: {
                userId: clientUser.id,
                type: 'session_invitation',
                title: 'Приглашение на сессию',
                message: `${psychologistName} приглашает вас на сессию "${title}" ${parsedStartsAt.toLocaleString('ru-RU', { timeZone: config.appTimeZone })}`,
                entityType: 'event',
                entityId: event.id,
                read: false
              }
            });
          } else {
            // Клиент еще не зарегистрирован, уведомление будет создано при регистрации или показано на странице сессий
            console.log(`Client ${client.email} is not registered yet, notification will be shown on sessions page`);
          }
        }
      } catch (notifError: any) {
        console.error('Failed to create notification:', notifError);
        // Не прерываем создание события, если не удалось создать уведомление
      }
    } catch (error: any) {
      console.error('Failed to create therapy session:', error);
      // Не прерываем создание события, если не удалось создать сессию
    }
  }

  res.status(201).json(event);
});

// Начать сессию раньше (только для создателя события)
router.post('/events/:id/start-early', requireAuth, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);

  try {
    const event = await prisma.event.findUnique({ 
      where: { id },
      include: { voiceRoom: true }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Проверяем, что пользователь является создателем события
    if (event.createdBy !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only event creator can start the session early' });
    }

    // Проверяем, что сессия еще не началась по расписанию
    const now = new Date();
    const scheduledStart = new Date(event.startsAt);
    
    if (now >= scheduledStart) {
      return res.status(400).json({ error: 'Session has already started or passed' });
    }

    // Устанавливаем фактическое время начала
    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        actualStartTime: now
      } as any,
      include: {
        voiceRoom: true
      }
    });

    res.json(updatedEvent);
  } catch (e: any) {
    console.error('Error starting session early:', e);
    res.status(500).json({ error: e.message || 'Failed to start session early' });
  }
});

// Принять или отклонить сессию: клиент отвечает на приглашение психолога; психолог — на самозапись клиента
router.put('/events/:id/session-status', requireAuth, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const { status, comment } = req.body ?? {};

  if (!status || !['accepted', 'declined'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be "accepted" or "declined"' });
  }

  try {
    const event = await prisma.event.findUnique({
      where: { id },
      include: { voiceRoom: true }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.type !== 'session') {
      return res.status(400).json({ error: 'This event is not a session' });
    }

    const eventClientId = (event as { clientId?: string | null }).clientId;
    if (!eventClientId) {
      return res.status(400).json({ error: 'This session has no client assigned' });
    }

    if (event.sessionStatus !== 'pending') {
      return res.status(400).json({ error: 'Сессия уже обработана' });
    }

    const clientRequested = Boolean((event as { clientRequestedSession?: boolean }).clientRequestedSession);

    const client = await prisma.client.findUnique({ where: { id: eventClientId } });
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const isAdmin = req.user!.role === 'admin';
    const isPsychCreator =
      (req.user!.role === 'psychologist' || req.user!.role === 'researcher' || req.user!.role === 'admin') &&
      event.createdBy === req.user!.id;
    const clientUserMatches =
      (req.user!.role === 'client' || req.user!.role === 'admin') &&
      Boolean(client.email && req.user!.email && client.email.toLowerCase() === req.user!.email.toLowerCase());

    if (clientRequested) {
      if (!isPsychCreator && !isAdmin) {
        return res.status(403).json({ error: 'Только специалист может подтвердить или отклонить эту запись' });
      }
    } else {
      if (!clientUserMatches && !isAdmin) {
        return res.status(403).json({ error: 'Только клиент может ответить на это приглашение' });
      }
    }

    const declineComment =
      status === 'declined' && typeof comment === 'string' ? comment.trim().slice(0, 2000) || null : null;

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        sessionStatus: status,
        sessionDeclineComment: declineComment
      } as any,
      include: {
        voiceRoom: true
      }
    });

    if (clientRequested) {
      try {
        if (client.email) {
          const clientUser = await prisma.user.findFirst({
            where: { email: client.email, role: 'client' }
          });
          if (clientUser) {
            await (prisma as any).notification.create({
              data: {
                userId: clientUser.id,
                type: status === 'accepted' ? 'session_confirmed_by_psych' : 'session_declined_by_psych',
                title: status === 'accepted' ? 'Сессия подтверждена' : 'Запись отклонена',
                message:
                  status === 'accepted'
                    ? `Специалист подтвердил сессию «${event.title}»`
                    : `Специалист отклонил вашу запись «${event.title}»${declineComment ? `. Комментарий: ${declineComment}` : ''}`,
                entityType: 'event',
                entityId: event.id,
                read: false
              }
            });
          }
        }
      } catch (notifErr: any) {
        console.error('Failed to notify client about session decision:', notifErr);
      }
    } else {
      try {
        await (prisma as any).notification.create({
          data: {
            userId: client.psychologistId,
            type: status === 'accepted' ? 'session_accepted' : 'session_declined',
            title: status === 'accepted' ? 'Сессия принята' : 'Сессия отклонена',
            message:
              status === 'accepted'
                ? `Клиент ${client.name} принял приглашение на сессию "${event.title}"`
                : `Клиент ${client.name} отклонил приглашение на сессию "${event.title}"${declineComment ? `: ${declineComment}` : ''}`,
            entityType: 'event',
            entityId: event.id,
            read: false
          }
        });
      } catch (notifError: any) {
        console.error('Failed to create notification for psychologist:', notifError);
      }
    }

    res.json(updatedEvent);
  } catch (e: any) {
    console.error('Error updating session status:', e);
    res.status(500).json({ error: e.message || 'Failed to update session status' });
  }
});

// Получить событие по roomId
async function eventWithHostMeta(event: any) {
  const creator = await prisma.user.findUnique({
    where: { id: event.createdBy },
    include: { profile: { select: { name: true } } }
  });
  const hostName =
    creator?.profile?.name ||
    (creator?.email ? String(creator.email).split('@')[0] : null) ||
    null;
  return { ...event, hostName };
}

router.get('/events/by-room/:roomId', requireAuth, async (req: AuthedRequest, res) => {
  const roomId = String(req.params.roomId);
  
  try {
    const voiceRoom = await prisma.voiceRoom.findUnique({
      where: { roomId },
      include: {
        event: true
      }
    });

    if (!voiceRoom || !voiceRoom.event) {
      return res.status(404).json({ error: 'Room or event not found' });
    }

    const allowed = await canUserAccessEvent(voiceRoom.event as any, req.user!);
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });

    res.json({ event: await eventWithHostMeta(voiceRoom.event), voiceRoom });
  } catch (e: any) {
    console.error('Error getting event by roomId:', e);
    res.status(500).json({ error: e.message || 'Failed to get event' });
  }
});

router.get('/events/public-room/:roomId', async (req, res) => {
  const roomId = String(req.params.roomId || '');
  try {
    const voiceRoom = await prisma.voiceRoom.findUnique({
      where: { roomId },
      include: { event: true }
    });
    if (!voiceRoom || !voiceRoom.event) {
      return res.status(404).json({ error: 'Room or event not found' });
    }
    if (!isGuestAccessibleType((voiceRoom.event as any).type)) {
      return res.status(403).json({ error: 'Guest access is allowed only for video meetings' });
    }
    res.json({
      event: await eventWithHostMeta(voiceRoom.event),
      voiceRoom
    });
  } catch (e: any) {
    console.error('Error getting public event by roomId:', e);
    res.status(500).json({ error: e.message || 'Failed to get event' });
  }
});

router.get('/events/room/:roomId/livekit-token', requireAuth, async (req: AuthedRequest, res) => {
  const roomId = String(req.params.roomId || '');
  try {
    if (!config.livekitUrl || !config.livekitApiKey || !config.livekitApiSecret) {
      return res.status(500).json({ error: 'LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET.' });
    }

    const voiceRoom = await prisma.voiceRoom.findUnique({
      where: { roomId },
      include: { event: true }
    });
    if (!voiceRoom || !voiceRoom.event) {
      return res.status(404).json({ error: 'Room or event not found' });
    }

    const allowed = await canUserAccessEvent(voiceRoom.event as any, req.user!);
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });

    const identity = req.user!.id;
    const profile = await (prisma as any).profile.findUnique({
      where: { userId: identity },
      select: { name: true, avatarUrl: true }
    });
    const displayName = profile?.name || req.user!.email || `user-${identity.slice(0, 8)}`;
    const at = new AccessToken(config.livekitApiKey, config.livekitApiSecret, {
      identity,
      name: displayName,
      metadata: JSON.stringify({
        userId: identity,
        displayName,
        avatarUrl: profile?.avatarUrl || null
      }),
      ttl: `${Math.max(300, config.livekitTokenTtlSec)}s`
    });
    at.addGrant({
      room: roomId,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true
    });

    const token = await at.toJwt();
    res.json({
      token,
      url: config.livekitUrl,
      roomName: roomId,
      identity,
      name: displayName
    });
  } catch (e: any) {
    console.error('Error generating LiveKit token:', e);
    res.status(500).json({ error: e.message || 'Failed to generate LiveKit token' });
  }
});

router.post('/events/room/:roomId/guest-livekit-token', async (req, res) => {
  const roomId = String(req.params.roomId || '');
  const requestedName = String(req.body?.displayName || '').trim();
  const displayName = requestedName.slice(0, 60) || 'Гость';

  try {
    if (!config.livekitUrl || !config.livekitApiKey || !config.livekitApiSecret) {
      return res.status(500).json({ error: 'LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET.' });
    }

    const voiceRoom = await prisma.voiceRoom.findUnique({
      where: { roomId },
      include: { event: true }
    });
    if (!voiceRoom || !voiceRoom.event) {
      return res.status(404).json({ error: 'Room or event not found' });
    }
    if (!isGuestAccessibleType((voiceRoom.event as any).type)) {
      return res.status(403).json({ error: 'Guest access is allowed only for video meetings' });
    }

    const identity = `guest-${randomBytes(8).toString('hex')}`;
    const at = new AccessToken(config.livekitApiKey, config.livekitApiSecret, {
      identity,
      name: displayName,
      metadata: JSON.stringify({
        isGuest: true,
        displayName
      }),
      ttl: `${Math.max(300, config.livekitTokenTtlSec)}s`
    });
    at.addGrant({
      room: roomId,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true
    });

    const token = await at.toJwt();
    res.json({
      token,
      url: config.livekitUrl,
      roomName: roomId,
      identity,
      name: displayName
    });
  } catch (e: any) {
    console.error('Error generating guest LiveKit token:', e);
    res.status(500).json({ error: e.message || 'Failed to generate guest LiveKit token' });
  }
});

// Генерация токена Agora по roomId
router.get('/events/room/:roomId/agora-token', requireAuth, async (req: AuthedRequest, res) => {
  const roomId = String(req.params.roomId);
  const { uid } = req.query;

  try {
    const voiceRoom = await prisma.voiceRoom.findUnique({
      where: { roomId },
      include: { event: true }
    });

    if (!voiceRoom) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const channelName = roomId;
    const userId = uid ? parseInt(uid as string, 10) : getUid(req.user!.id);

    // Если App Certificate не настроен, проверяем временный токен
    if (!AGORA_APP_CERTIFICATE) {
      const tempToken = config.agoraTempToken;
      if (tempToken) {
        // Используем временный токен из консоли Agora
        console.log('Using temporary Agora token from environment');
        return res.json({ token: tempToken, appId: AGORA_APP_ID, channel: channelName, uid: userId });
      }
      
      console.warn('AGORA_APP_CERTIFICATE not set. Token generation will fail.');
      return res.status(500).json({ 
        error: 'Agora App Certificate not configured. Please set AGORA_APP_CERTIFICATE in .env file or use temporary token from Agora console.',
        hint: 'You can generate a temporary token at: https://console.agora.io/projects > Your Project > Edit > Features > Generate temp token. Then set AGORA_TEMP_TOKEN in .env'
      });
    }

    // Генерируем токен (действителен 24 часа)
    // ВАЖНО: токен должен быть сгенерирован с правильным именем канала (channelName)
    const expirationTimeInSeconds = Math.floor(Date.now() / 1000) + (24 * 3600);
    const role = RtcRole.PUBLISHER; // Пользователь может публиковать аудио

    let token: string;
    try {
      token = RtcTokenBuilder.buildTokenWithUid(
        AGORA_APP_ID,
        AGORA_APP_CERTIFICATE,
        channelName, // КРИТИЧЕСКИ ВАЖНО: правильное имя канала!
        userId,
        role,
        expirationTimeInSeconds,
        expirationTimeInSeconds // privilegeExpire
      );
    } catch (tokenError: any) {
      console.error('Error building Agora token:', tokenError);
      return res.status(500).json({ 
        error: 'Failed to generate Agora token',
        details: tokenError.message 
      });
    }

    console.log(`Generated Agora token for channel: ${channelName}, uid: ${userId}`);
    res.json({ token, appId: AGORA_APP_ID, channel: channelName, uid: userId });
  } catch (e: any) {
    console.error('Error generating Agora token:', e);
    res.status(500).json({ error: e.message || 'Failed to generate token' });
  }
});

// Генерация токена Agora для подключения к голосовой комнате (по event ID)
router.get('/events/:id/agora-token', requireAuth, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const { channel, uid } = req.query;

  try {
    const event = await prisma.event.findUnique({
      where: { id },
      include: { voiceRoom: true }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Используем roomId как channel - ВАЖНО: токен должен быть сгенерирован с правильным именем канала!
    const channelName = (channel as string) || event.voiceRoom?.roomId || 'default';
    const userId = uid ? parseInt(uid as string, 10) : getUid(req.user!.id);

    // Если App Certificate не настроен, проверяем временный токен
    if (!AGORA_APP_CERTIFICATE) {
      const tempToken = config.agoraTempToken;
      if (tempToken) {
        // Используем временный токен из консоли Agora
        console.log('Using temporary Agora token from environment');
        return res.json({ token: tempToken, appId: AGORA_APP_ID, channel: channelName, uid: userId });
      }
      
      console.warn('AGORA_APP_CERTIFICATE not set. Token generation will fail.');
      return res.status(500).json({ 
        error: 'Agora App Certificate not configured. Please set AGORA_APP_CERTIFICATE in .env file or use temporary token from Agora console.',
        hint: 'You can generate a temporary token at: https://console.agora.io/projects > Your Project > Edit > Features > Generate temp token. Then set AGORA_TEMP_TOKEN in .env'
      });
    }

    // Генерируем токен (действителен 24 часа)
    // ВАЖНО: токен должен быть сгенерирован с правильным именем канала (channelName)
    const expirationTimeInSeconds = Math.floor(Date.now() / 1000) + (24 * 3600);
    const role = RtcRole.PUBLISHER; // Пользователь может публиковать аудио

    let token: string;
    try {
      token = RtcTokenBuilder.buildTokenWithUid(
        AGORA_APP_ID,
        AGORA_APP_CERTIFICATE,
        channelName, // КРИТИЧЕСКИ ВАЖНО: правильное имя канала!
        userId,
        role,
        expirationTimeInSeconds,
        expirationTimeInSeconds // privilegeExpire
      );
    } catch (tokenError: any) {
      console.error('Error building Agora token:', tokenError);
      return res.status(500).json({ 
        error: 'Failed to generate Agora token',
        details: tokenError.message 
      });
    }

    console.log(`Generated Agora token for channel: ${channelName}, uid: ${userId}`);
    res.json({ token, appId: AGORA_APP_ID, channel: channelName, uid: userId });
  } catch (e: any) {
    console.error('Error generating Agora token:', e);
    res.status(500).json({ error: e.message || 'Failed to generate token' });
  }
});

// Вспомогательная функция для преобразования строкового ID в число
function getUid(id: string): number {
  const numId = parseInt(id, 10);
  if (!isNaN(numId)) return numId;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

router.put('/events/:id', requireAuth, requireRole(['psychologist', 'researcher', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  try {
    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (req.user!.role !== 'admin' && existing.createdBy !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { title, type, description, startsAt, endsAt, clientId } = req.body ?? {};
    const data: Record<string, unknown> = {};

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'Invalid title' });
      data.title = title.trim();
    }
    if (type !== undefined) {
      if (typeof type !== 'string' || !type.trim()) return res.status(400).json({ error: 'Invalid type' });
      data.type = type.trim();
    }
    if (description !== undefined) {
      data.description = description === null ? null : String(description);
    }
    if (startsAt !== undefined) {
      const parsedStartsAt = parseEventDateInput(startsAt);
      if (!parsedStartsAt) return res.status(400).json({ error: 'Invalid startsAt format' });
      data.startsAt = parsedStartsAt;
    }
    if (endsAt !== undefined) {
      if (endsAt === null || endsAt === '') {
        data.endsAt = null;
      } else {
        const parsedEndsAt = parseEventDateInput(endsAt);
        if (!parsedEndsAt) return res.status(400).json({ error: 'Invalid endsAt format' });
        data.endsAt = parsedEndsAt;
      }
    }
    if (clientId !== undefined) {
      const nextType = (data.type as string | undefined) ?? existing.type;
      if (clientId === null || clientId === '') {
        data.clientId = null;
      } else {
        const client = await prisma.client.findUnique({ where: { id: String(clientId) } });
        if (!client) return res.status(404).json({ error: 'Client not found' });
        if (req.user!.role !== 'admin' && client.psychologistId !== req.user!.id) {
          return res.status(403).json({ error: 'Forbidden' });
        }
        data.clientId = client.id;
      }
      if (nextType !== 'session') {
        data.clientId = null;
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const event = await prisma.event.update({
      where: { id },
      data: data as any,
      include: { voiceRoom: true }
    });

    // Keep linked TherapySession date in sync when rescheduling a session
    const eventClientId = (event as any).clientId as string | null | undefined;
    if (event.type === 'session' && eventClientId && data.startsAt instanceof Date) {
      try {
        let sessions: Array<{ id: string }> = [];
        try {
          sessions = await prisma.therapySession.findMany({
            where: { clientId: eventClientId, eventId: event.id }
          });
        } catch {
          const prevDate = new Date(existing.startsAt);
          const oneMinute = 60 * 1000;
          sessions = await prisma.therapySession.findMany({
            where: {
              clientId: eventClientId,
              date: {
                gte: new Date(prevDate.getTime() - oneMinute),
                lte: new Date(prevDate.getTime() + oneMinute)
              }
            }
          });
        }
        for (const session of sessions) {
          const summaryUpdate: Record<string, unknown> = { date: event.startsAt };
          if (typeof data.description === 'string' || data.description === null) {
            summaryUpdate.summary = (data.description as string | null) || (typeof data.title === 'string' ? data.title : event.title);
          } else if (typeof data.title === 'string') {
            summaryUpdate.summary = data.title;
          }
          await prisma.therapySession.update({
            where: { id: session.id },
            data: summaryUpdate as any
          });
        }
      } catch (e) {
        console.warn('Failed to sync TherapySession on event reschedule', e);
      }
    }

    res.json(event);
  } catch (e: any) {
    console.error('Error updating event:', e);
    res.status(500).json({ error: e?.message || 'Failed to update event' });
  }
});

router.delete('/events/:id', requireAuth, requireRole(['psychologist', 'researcher', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  try {
    // Получаем событие перед удалением
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Если это сессия с клиентом, нужно найти и удалить соответствующую TherapySession
    const eventWithClientId = event as typeof event & { clientId?: string | null };
    if (eventWithClientId.type === 'session' && eventWithClientId.clientId) {
      try {
        // Проверяем, что клиент принадлежит психологу (для безопасности)
        const client = await prisma.client.findUnique({ where: { id: eventWithClientId.clientId } });
        if (client && (req.user!.role === 'admin' || client.psychologistId === req.user!.id)) {
          // Ищем TherapySession по clientId и дате (с небольшой погрешностью в 1 минуту)
          const eventDate = new Date(eventWithClientId.startsAt);
          const oneMinute = 60 * 1000; // 1 минута в миллисекундах

          const sessions = await prisma.therapySession.findMany({
            where: {
              clientId: eventWithClientId.clientId,
              date: {
                gte: new Date(eventDate.getTime() - oneMinute),
                lte: new Date(eventDate.getTime() + oneMinute)
              }
            }
          });

          // Удаляем найденные сессии
          for (const session of sessions) {
            await prisma.therapySession.delete({ where: { id: session.id } });
          }
        }
      } catch (error: any) {
        console.error('Failed to delete therapy session:', error);
        // Продолжаем удаление события даже если не удалось удалить сессию
      }
    }

    // Получаем roomId перед удалением для уведомления
    const eventWithRoom = await prisma.event.findUnique({
      where: { id },
      include: { voiceRoom: true }
    });
    
    const roomId = eventWithRoom?.voiceRoom?.roomId;
    
    // Удаляем событие
    await prisma.event.delete({ where: { id } });
    
    // Уведомляем всех участников комнаты об удалении события
    if (roomId) {
      notifyEventDeleted(io, roomId);
    }
    
    res.status(204).end();
  } catch (e) {
    console.error('Error deleting event:', e);
    res.status(404).json({ error: 'Not found' });
  }
});

export default router;
