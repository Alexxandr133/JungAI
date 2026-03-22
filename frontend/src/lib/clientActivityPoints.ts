import { api } from './api';

/** Начисления за действия (один раз на сущность / на реплику в ИИ) */
export const POINTS = {
  OWN_DREAM: 12,
  JOURNAL_ENTRY: 8,
  THERAPIST_CHAT_MESSAGE: 4,
  AI_ASSISTANT_USER_MESSAGE: 3,
  /** Прошедшая запланированная сессия (событие уже началось по времени) */
  SESSION_HELD: 18
} as const;

const LEDGER_KEY = 'client_activity_ledger_v1';
const RANK_KEY = 'client_rank_data';
const AI_HISTORY_KEY = 'client_chat_history';

type DreamItem = { id: string; userId?: string | null };
type JournalItem = { id: string };
type ChatMsg = { id: string; authorId: string };

export type ActivityLedger = {
  v: 1;
  dreamIds: string[];
  journalIds: string[];
  chatMessageIds: string[];
  aiUserMessagesRewarded: number;
  sessionEventIds: string[];
};

function loadLedger(): ActivityLedger {
  try {
    const raw = localStorage.getItem(LEDGER_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && p.v === 1 && Array.isArray(p.dreamIds) && Array.isArray(p.journalIds) && Array.isArray(p.chatMessageIds)) {
        return {
          v: 1,
          dreamIds: p.dreamIds,
          journalIds: p.journalIds,
          chatMessageIds: p.chatMessageIds,
          aiUserMessagesRewarded: typeof p.aiUserMessagesRewarded === 'number' ? p.aiUserMessagesRewarded : 0,
          sessionEventIds: Array.isArray(p.sessionEventIds) ? p.sessionEventIds : []
        };
      }
    }
  } catch {
    /* ignore */
  }
  return {
    v: 1,
    dreamIds: [],
    journalIds: [],
    chatMessageIds: [],
    aiUserMessagesRewarded: 0,
    sessionEventIds: []
  };
}

function saveLedger(L: ActivityLedger) {
  localStorage.setItem(LEDGER_KEY, JSON.stringify(L));
}

function loadRankPoints(): number {
  try {
    const raw = localStorage.getItem(RANK_KEY);
    if (!raw) return 0;
    const p = JSON.parse(raw);
    return typeof p.points === 'number' ? p.points : 0;
  } catch {
    return 0;
  }
}

function saveRankPoints(points: number) {
  let extra: Record<string, unknown> = {};
  try {
    const raw = localStorage.getItem(RANK_KEY);
    if (raw) extra = JSON.parse(raw);
  } catch {
    /* ignore */
  }
  localStorage.setItem(RANK_KEY, JSON.stringify({ ...extra, points }));
}

function filterOwnDreams(items: DreamItem[], clientUserId: string): DreamItem[] {
  return items.filter(d => d.userId === clientUserId);
}

function countAiUserMessages(): number {
  try {
    const raw = localStorage.getItem(AI_HISTORY_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return 0;
    return parsed.filter((m: { role?: string }) => m?.role === 'user').length;
  } catch {
    return 0;
  }
}

export type SyncResult = {
  pointsTotal: number;
  delta: number;
  ownDreamCount: number;
  journalCount: number;
  therapistMessagesCount: number;
  aiUserMessages: number;
  /** Сессии, время которых уже наступило (считаем как состоявшиеся) */
  sessionsHeldCount: number;
};

/**
 * Синхронизирует «книгу» начислений с данными API и локальным чатом ИИ,
 * обновляет client_rank_data.points.
 */
export async function syncClientActivityPoints(token: string, userId: string): Promise<SyncResult> {
  const ledger = loadLedger();
  let delta = 0;

  const [dreamsRes, journalRes, roomsRes, eventsRes] = await Promise.all([
    api<{ items: DreamItem[] }>('/api/dreams', { token }).catch(() => ({ items: [] as DreamItem[] })),
    api<{ items: JournalItem[] }>('/api/journal/entries', { token }).catch(() => ({ items: [] as JournalItem[] })),
    api<{ items: { id: string }[] }>('/api/chat/rooms', { token }).catch(() => ({ items: [] as { id: string }[] })),
    api<{ items: { id: string; startsAt: string }[] }>('/api/my-events', { token }).catch(() => ({
      items: [] as { id: string; startsAt: string }[]
    }))
  ]);

  const ownDreams = filterOwnDreams(dreamsRes.items || [], userId);
  const dreamSet = new Set(ledger.dreamIds);
  for (const d of ownDreams) {
    if (!dreamSet.has(d.id)) {
      dreamSet.add(d.id);
      delta += POINTS.OWN_DREAM;
    }
  }
  ledger.dreamIds = Array.from(dreamSet);

  const journalSet = new Set(ledger.journalIds);
  for (const e of journalRes.items || []) {
    if (e.id && !journalSet.has(e.id)) {
      journalSet.add(e.id);
      delta += POINTS.JOURNAL_ENTRY;
    }
  }
  ledger.journalIds = Array.from(journalSet);

  const chatSet = new Set(ledger.chatMessageIds);
  const rooms = roomsRes.items || [];
  for (const room of rooms) {
    try {
      const msgRes = await api<{ items: ChatMsg[] }>(`/api/chat/rooms/${room.id}/messages`, { token });
      for (const m of msgRes.items || []) {
        if (m.authorId === userId && m.id && !chatSet.has(m.id)) {
          chatSet.add(m.id);
          delta += POINTS.THERAPIST_CHAT_MESSAGE;
        }
      }
    } catch {
      /* skip room */
    }
  }
  ledger.chatMessageIds = Array.from(chatSet);

  const now = Date.now();
  const sessionSet = new Set(ledger.sessionEventIds);
  let sessionsHeld = 0;
  for (const ev of eventsRes.items || []) {
    if (!ev.id || !ev.startsAt) continue;
    const t = new Date(ev.startsAt).getTime();
    if (t > now) continue;
    sessionsHeld++;
    if (!sessionSet.has(ev.id)) {
      sessionSet.add(ev.id);
      delta += POINTS.SESSION_HELD;
    }
  }
  ledger.sessionEventIds = Array.from(sessionSet);

  const aiUserTotal = countAiUserMessages();
  if (aiUserTotal > ledger.aiUserMessagesRewarded) {
    const add = aiUserTotal - ledger.aiUserMessagesRewarded;
    delta += add * POINTS.AI_ASSISTANT_USER_MESSAGE;
    ledger.aiUserMessagesRewarded = aiUserTotal;
  }

  const prevPoints = loadRankPoints();
  const pointsTotal = prevPoints + delta;
  saveLedger(ledger);
  if (delta !== 0) {
    saveRankPoints(pointsTotal);
  }

  return {
    pointsTotal: delta !== 0 ? pointsTotal : prevPoints,
    delta,
    ownDreamCount: ownDreams.length,
    journalCount: (journalRes.items || []).length,
    therapistMessagesCount: ledger.chatMessageIds.length,
    aiUserMessages: aiUserTotal,
    sessionsHeldCount: sessionsHeld
  };
}

export function readLedgerPointsBreakdown(): {
  fromDreams: number;
  fromJournal: number;
  fromChat: number;
  fromAi: number;
  fromSessions: number;
} {
  const L = loadLedger();
  return {
    fromDreams: L.dreamIds.length * POINTS.OWN_DREAM,
    fromJournal: L.journalIds.length * POINTS.JOURNAL_ENTRY,
    fromChat: L.chatMessageIds.length * POINTS.THERAPIST_CHAT_MESSAGE,
    fromAi: L.aiUserMessagesRewarded * POINTS.AI_ASSISTANT_USER_MESSAGE,
    fromSessions: L.sessionEventIds.length * POINTS.SESSION_HELD
  };
}
