/** Упрощённый расчёт свободных слотов (зеркало frontend eventsCalendarUtils). */

export type CalendarPrefs = {
  workStartHour: number;
  workEndHour: number;
  slotIntervalMinutes: number;
  breakAfterEventMinutes: number;
  weekendsOff: boolean;
  lunchEnabled: boolean;
  lunchStart: string;
  lunchEnd: string;
  minFreeSegmentMinutes?: number;
  useCustomDaysOff: boolean;
  customDaysOff: string[];
  bookingByLinkEnabled: boolean;
};

export const DEFAULT_CALENDAR_PREFS: CalendarPrefs = {
  workStartHour: 9,
  workEndHour: 21,
  slotIntervalMinutes: 60,
  breakAfterEventMinutes: 10,
  weekendsOff: true,
  lunchEnabled: true,
  lunchStart: '13:00',
  lunchEnd: '14:00',
  minFreeSegmentMinutes: 60,
  useCustomDaysOff: false,
  customDaysOff: [],
  bookingByLinkEnabled: true,
};

export function dayKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function parseTimeToMinutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return h * 60 + mi;
}

function minutesToLabel(total: number) {
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

function mergeIntervals(raw: [number, number][]): [number, number][] {
  if (!raw.length) return [];
  const sorted = [...raw].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [[sorted[0][0], sorted[0][1]]];
  for (let i = 1; i < sorted.length; i++) {
    const [s, e] = sorted[i];
    const last = out[out.length - 1];
    if (s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

function subtractIntervals(base: [number, number][], cuts: [number, number][]): [number, number][] {
  let cur = base;
  for (const [cs, ce] of cuts) {
    const next: [number, number][] = [];
    for (const [bs, be] of cur) {
      if (ce <= bs || cs >= be) {
        next.push([bs, be]);
        continue;
      }
      if (cs > bs) next.push([bs, Math.min(cs, be)]);
      if (ce < be) next.push([Math.max(ce, bs), be]);
    }
    cur = next.filter(([a, b]) => b - a >= 1);
  }
  return cur;
}

export function mergeCalendarPrefs(raw: unknown): CalendarPrefs {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CALENDAR_PREFS };
  const o = raw as Record<string, unknown>;
  const interval = Number(o.slotIntervalMinutes);
  return {
    ...DEFAULT_CALENDAR_PREFS,
    workStartHour: Number.isFinite(Number(o.workStartHour)) ? Number(o.workStartHour) : DEFAULT_CALENDAR_PREFS.workStartHour,
    workEndHour: Number.isFinite(Number(o.workEndHour)) ? Number(o.workEndHour) : DEFAULT_CALENDAR_PREFS.workEndHour,
    slotIntervalMinutes: [15, 30, 45, 60, 90, 120].includes(interval) ? interval : DEFAULT_CALENDAR_PREFS.slotIntervalMinutes,
    breakAfterEventMinutes: Number.isFinite(Number(o.breakAfterEventMinutes))
      ? Number(o.breakAfterEventMinutes)
      : DEFAULT_CALENDAR_PREFS.breakAfterEventMinutes,
    weekendsOff: o.weekendsOff !== false,
    lunchEnabled: Boolean(o.lunchEnabled),
    lunchStart: typeof o.lunchStart === 'string' ? o.lunchStart : DEFAULT_CALENDAR_PREFS.lunchStart,
    lunchEnd: typeof o.lunchEnd === 'string' ? o.lunchEnd : DEFAULT_CALENDAR_PREFS.lunchEnd,
    useCustomDaysOff: Boolean(o.useCustomDaysOff),
    customDaysOff: Array.isArray(o.customDaysOff) ? o.customDaysOff.map(String) : [],
    bookingByLinkEnabled: o.bookingByLinkEnabled !== false,
  };
}

function slotStartsForDay(dayKey: string, prefs: CalendarPrefs, dayEvents: Array<{ startsAt: Date; endsAt: Date | null }>): string[] {
  const parts = dayKey.split('-').map(Number);
  const y = parts[0];
  const mo = parts[1];
  const da = parts[2];
  const d = new Date(y, mo - 1, da, 12, 0, 0, 0);
  const dow = d.getDay();
  const todayKey = dayKeyFromDate(new Date());
  if (dayKey < todayKey) return [];
  if (prefs.useCustomDaysOff && prefs.customDaysOff.includes(dayKey)) return [];
  if (prefs.weekendsOff && (dow === 0 || dow === 6)) return [];

  const workStart = prefs.workStartHour * 60;
  const workEnd = prefs.workEndHour * 60;
  if (workEnd <= workStart) return [];

  const base: [number, number][] = [[workStart, workEnd]];
  const dayStart = new Date(y, mo - 1, da, 0, 0, 0, 0).getTime();
  const dayEnd = new Date(y, mo - 1, da + 1, 0, 0, 0, 0).getTime();
  const busyRaw: [number, number][] = [];
  for (const ev of dayEvents) {
    const startMs = new Date(ev.startsAt).getTime();
    const endMsRaw = ev.endsAt ? new Date(ev.endsAt).getTime() : startMs + 60 * 60 * 1000;
    const endMs = endMsRaw > startMs ? endMsRaw : startMs + 60 * 60 * 1000;
    const clipS = Math.max(startMs, dayStart);
    const clipE = Math.min(endMs, dayEnd);
    if (clipE <= clipS) continue;
    const sm = new Date(clipS);
    const em = new Date(clipE);
    const sMin = Math.floor(sm.getHours() * 60 + sm.getMinutes());
    const eMin = Math.ceil(em.getHours() * 60 + em.getMinutes());
    const pad = Math.max(0, prefs.breakAfterEventMinutes);
    busyRaw.push([Math.max(workStart, sMin), Math.min(workEnd, eMin + pad)]);
  }
  let free = subtractIntervals(base, mergeIntervals(busyRaw));
  if (prefs.lunchEnabled) {
    const ls = parseTimeToMinutes(prefs.lunchStart);
    const le = parseTimeToMinutes(prefs.lunchEnd);
    if (ls != null && le != null && le > ls) {
      free = subtractIntervals(free, [[Math.max(ls, workStart), Math.min(le, workEnd)]]);
    }
  }
  free = free.filter(([a, b]) => b - a >= prefs.slotIntervalMinutes);
  const intv = prefs.slotIntervalMinutes;
  const slotStarts: string[] = [];
  const now = new Date();
  for (const [fs, fe] of free) {
    for (let t = fs; t + intv <= fe; t += intv) {
      const hm = minutesToLabel(Math.round(t));
      if (dayKey === todayKey) {
        const [H, M] = hm.split(':').map(Number);
        const slotDate = new Date(y, mo - 1, da, H, M, 0, 0);
        if (slotDate.getTime() < now.getTime() + 30 * 60 * 1000) continue;
      }
      slotStarts.push(hm);
    }
  }
  return slotStarts;
}

export type FreeSlot = { dayKey: string; startHm: string; slotStart: string; slotEnd: string };

function localSlotIso(dayKey: string, startHm: string, durationMin: number) {
  const [H, M] = startHm.split(':').map(Number);
  const [y, mo, da] = dayKey.split('-').map(Number);
  const start = new Date(y, mo - 1, da, H, M, 0, 0);
  const end = new Date(start.getTime() + durationMin * 60000);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return { slotStart: iso(start), slotEnd: iso(end), startDate: start, endDate: end };
}

export function listFreeSlots(opts: {
  prefs: CalendarPrefs;
  events: Array<{ startsAt: Date; endsAt: Date | null }>;
  daysAhead?: number;
  limit?: number;
}): FreeSlot[] {
  const daysAhead = opts.daysAhead ?? 14;
  const limit = opts.limit ?? 40;
  const byDay = new Map<string, Array<{ startsAt: Date; endsAt: Date | null }>>();
  for (const ev of opts.events) {
    const k = dayKeyFromDate(new Date(ev.startsAt));
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(ev);
  }
  const out: FreeSlot[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dayKey = dayKeyFromDate(d);
    const starts = slotStartsForDay(dayKey, opts.prefs, byDay.get(dayKey) || []);
    for (const startHm of starts) {
      const { slotStart, slotEnd } = localSlotIso(dayKey, startHm, opts.prefs.slotIntervalMinutes);
      out.push({ dayKey, startHm, slotStart, slotEnd });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export function dayPartFromDate(d: Date): 'morning' | 'day' | 'evening' {
  const h = d.getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'day';
  return 'evening';
}
