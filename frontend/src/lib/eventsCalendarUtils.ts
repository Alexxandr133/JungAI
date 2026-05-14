/** Допустимые шаги сетки слотов в календаре занятости / публичной записи */
export const SLOT_INTERVAL_MINUTES_OPTIONS = [15, 30, 45, 60, 90, 120] as const;
export type SlotIntervalMinutes = (typeof SLOT_INTERVAL_MINUTES_OPTIONS)[number];

export type CalendarPrefs = {
  workStartHour: number;
  workEndHour: number;
  slotIntervalMinutes: SlotIntervalMinutes;
  breakAfterEventMinutes: number;
  weekendsOff: boolean;
  lunchEnabled: boolean;
  lunchStart: string;
  lunchEnd: string;
  /** Всегда равно `slotIntervalMinutes`: минимальная длина непрерывного свободного окна для подсчёта слотов. */
  minFreeSegmentMinutes: number;
  useCustomDaysOff: boolean;
  customDaysOff: string[];
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
  customDaysOff: []
};

export function dayKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isCalendarDayPast(dayKey: string, now: Date = new Date()): boolean {
  return dayKey < dayKeyFromDate(now);
}

export function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function parseTimeToMinutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return h * 60 + mi;
}

export function minutesToLabel(total: number) {
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

export function mergeIntervals(raw: [number, number][]): [number, number][] {
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

export function subtractIntervals(base: [number, number][], cuts: [number, number][]): [number, number][] {
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

export type DayCalSummary = {
  hasEvents: boolean;
  weekendBlocked: boolean;
  freeSegments: [number, number][];
  freeLabel: string;
  slotStarts: string[];
  isFullyBusy: boolean;
  isPast: boolean;
};

function customDayOff(prefs: CalendarPrefs, dayKey: string): boolean {
  return Boolean(prefs.useCustomDaysOff && prefs.customDaysOff?.includes(dayKey));
}

export function computeDaySummary(dayKey: string, prefs: CalendarPrefs, dayEvents: any[]): DayCalSummary {
  const parts = dayKey.split('-').map(Number);
  const y = parts[0];
  const mo = parts[1];
  const da = parts[2];
  const d = new Date(y, mo - 1, da, 12, 0, 0, 0);
  const dow = d.getDay();
  const isWeekend = dow === 0 || dow === 6;
  const hasEvents = dayEvents.length > 0;
  const past = isCalendarDayPast(dayKey);

  if (past) {
    const weekendB = prefs.weekendsOff && isWeekend;
    const customB = customDayOff(prefs, dayKey);
    const blocked = weekendB || customB;
    return {
      hasEvents,
      weekendBlocked: blocked,
      freeSegments: [],
      freeLabel: blocked ? 'Выходной' : hasEvents ? '' : '—',
      slotStarts: [],
      isFullyBusy: false,
      isPast: true
    };
  }

  if (customDayOff(prefs, dayKey)) {
    return {
      hasEvents,
      weekendBlocked: true,
      freeSegments: [],
      freeLabel: 'Выходной',
      slotStarts: [],
      isFullyBusy: true,
      isPast: false
    };
  }

  if (prefs.weekendsOff && isWeekend) {
    return {
      hasEvents,
      weekendBlocked: true,
      freeSegments: [],
      freeLabel: 'Выходной',
      slotStarts: [],
      isFullyBusy: true,
      isPast: false
    };
  }

  const workStart = prefs.workStartHour * 60;
  const workEnd = prefs.workEndHour * 60;

  if (workEnd <= workStart) {
    return {
      hasEvents,
      weekendBlocked: false,
      freeSegments: [],
      freeLabel: 'Проверьте рабочие часы',
      slotStarts: [],
      isFullyBusy: true,
      isPast: false
    };
  }

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
    const sMin = Math.floor(sm.getHours() * 60 + sm.getMinutes() + sm.getSeconds() / 60);
    const eMin = Math.ceil(em.getHours() * 60 + em.getMinutes() + em.getSeconds() / 60);
    const pad = Math.max(0, prefs.breakAfterEventMinutes);
    busyRaw.push([Math.max(workStart, sMin), Math.min(workEnd, eMin + pad)]);
  }

  const busy = mergeIntervals(busyRaw);
  let free = subtractIntervals(base, busy);

  if (prefs.lunchEnabled) {
    const ls = parseTimeToMinutes(prefs.lunchStart);
    const le = parseTimeToMinutes(prefs.lunchEnd);
    if (ls != null && le != null && le > ls) {
      free = subtractIntervals(free, [[Math.max(ls, workStart), Math.min(le, workEnd)]]);
    }
  }

  free = free.filter(([a, b]) => b - a >= prefs.slotIntervalMinutes);

  const freeLabel = free.length
    ? free.map(([a, b]) => `${minutesToLabel(a)}–${minutesToLabel(b)}`).join(', ')
    : hasEvents
      ? 'Нет свободных окон'
      : `${minutesToLabel(workStart)}–${minutesToLabel(workEnd)}`;

  const intv = prefs.slotIntervalMinutes;
  const slotStarts: string[] = [];
  for (const [fs, fe] of free) {
    for (let t = fs; t + intv <= fe; t += intv) {
      slotStarts.push(minutesToLabel(Math.round(t)));
    }
  }

  const isFullyBusy = hasEvents && free.length === 0;

  return {
    hasEvents,
    weekendBlocked: false,
    freeSegments: free,
    freeLabel,
    slotStarts,
    isFullyBusy,
    isPast: false
  };
}

export const CALENDAR_PREFS_KEY = 'jingai-events-calendar-prefs-v1';

export function clampInt(n: unknown, lo: number, hi: number, fallback: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

export function loadCalendarPrefs(): CalendarPrefs {
  if (typeof window === 'undefined') return DEFAULT_CALENDAR_PREFS;
  try {
    const raw = window.localStorage.getItem(CALENDAR_PREFS_KEY);
    if (!raw) return DEFAULT_CALENDAR_PREFS;
    const p = JSON.parse(raw) as Partial<CalendarPrefs>;
    const customDaysOff = Array.isArray(p.customDaysOff)
      ? [...new Set(p.customDaysOff.filter((x): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)))].sort()
      : DEFAULT_CALENDAR_PREFS.customDaysOff;
    const slotIntervalMinutes = (SLOT_INTERVAL_MINUTES_OPTIONS as readonly number[]).includes(p.slotIntervalMinutes as number)
      ? (p.slotIntervalMinutes as CalendarPrefs['slotIntervalMinutes'])
      : DEFAULT_CALENDAR_PREFS.slotIntervalMinutes;
    return {
      ...DEFAULT_CALENDAR_PREFS,
      ...p,
      workStartHour: clampInt(p.workStartHour, 0, 23, DEFAULT_CALENDAR_PREFS.workStartHour),
      workEndHour: clampInt(p.workEndHour, 1, 24, DEFAULT_CALENDAR_PREFS.workEndHour),
      breakAfterEventMinutes: clampInt(p.breakAfterEventMinutes, 0, 180, DEFAULT_CALENDAR_PREFS.breakAfterEventMinutes),
      slotIntervalMinutes,
      minFreeSegmentMinutes: slotIntervalMinutes,
      weekendsOff: typeof p.weekendsOff === 'boolean' ? p.weekendsOff : DEFAULT_CALENDAR_PREFS.weekendsOff,
      lunchEnabled: typeof p.lunchEnabled === 'boolean' ? p.lunchEnabled : DEFAULT_CALENDAR_PREFS.lunchEnabled,
      lunchStart: typeof p.lunchStart === 'string' ? p.lunchStart : DEFAULT_CALENDAR_PREFS.lunchStart,
      lunchEnd: typeof p.lunchEnd === 'string' ? p.lunchEnd : DEFAULT_CALENDAR_PREFS.lunchEnd,
      useCustomDaysOff: typeof p.useCustomDaysOff === 'boolean' ? p.useCustomDaysOff : DEFAULT_CALENDAR_PREFS.useCustomDaysOff,
      customDaysOff
    };
  } catch {
    return DEFAULT_CALENDAR_PREFS;
  }
}

export function mergeCalendarPrefsFromServer(raw: unknown): Partial<CalendarPrefs> {
  if (!raw || typeof raw !== 'object') return {};
  const p = raw as Record<string, unknown>;
  const out: Partial<CalendarPrefs> = {};
  if (typeof p.workStartHour === 'number') out.workStartHour = p.workStartHour;
  if (typeof p.workEndHour === 'number') out.workEndHour = p.workEndHour;
  if ((SLOT_INTERVAL_MINUTES_OPTIONS as readonly number[]).includes(p.slotIntervalMinutes as number)) {
    const slot = p.slotIntervalMinutes as CalendarPrefs['slotIntervalMinutes'];
    out.slotIntervalMinutes = slot;
    out.minFreeSegmentMinutes = slot;
  }
  if (typeof p.breakAfterEventMinutes === 'number') out.breakAfterEventMinutes = p.breakAfterEventMinutes;
  if (typeof p.weekendsOff === 'boolean') out.weekendsOff = p.weekendsOff;
  if (typeof p.lunchEnabled === 'boolean') out.lunchEnabled = p.lunchEnabled;
  if (typeof p.lunchStart === 'string') out.lunchStart = p.lunchStart;
  if (typeof p.lunchEnd === 'string') out.lunchEnd = p.lunchEnd;
  if (typeof p.useCustomDaysOff === 'boolean') out.useCustomDaysOff = p.useCustomDaysOff;
  if (Array.isArray(p.customDaysOff)) {
    out.customDaysOff = p.customDaysOff.filter((x): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x));
  }
  return out;
}

export function calendarCells(year: number, month: number): { d: Date; inMonth: boolean }[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - startOffset);
  const cells: { d: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const cell = new Date(start);
    cell.setDate(start.getDate() + i);
    cells.push({ d: cell, inMonth: cell.getMonth() === month });
  }
  return cells;
}
