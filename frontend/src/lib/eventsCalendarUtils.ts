/** Допустимые шаги сетки слотов в календаре занятости / публичной записи */
export const SLOT_INTERVAL_MINUTES_OPTIONS = [15, 30, 45, 50, 55, 60, 90, 120] as const;
export type SlotIntervalMinutes = (typeof SLOT_INTERVAL_MINUTES_OPTIONS)[number];
export const SLOT_INTERVAL_MINUTES_MIN = 5;
export const SLOT_INTERVAL_MINUTES_MAX = 180;

export function clampSlotIntervalMinutes(n: unknown, fallback = 60): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return fallback;
  return Math.max(SLOT_INTERVAL_MINUTES_MIN, Math.min(SLOT_INTERVAL_MINUTES_MAX, v));
}

export function isPresetSlotInterval(n: number): boolean {
  return (SLOT_INTERVAL_MINUTES_OPTIONS as readonly number[]).includes(n);
}

export function slotIntervalLabel(m: number): string {
  if (m < 60) return `${m} мин`;
  if (m === 60) return '1 час';
  if (m === 90) return '1 ч 30 мин';
  if (m === 120) return '2 часа';
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (min === 0) return `${h} ч`;
  if (h === 1) return `1 ч ${min} мин`;
  return `${h} ч ${min} мин`;
}

export const MIN_NOTICE_HOURS_OPTIONS = [0.5, 2, 24] as const;
export const BOOKING_DAYS_AHEAD_OPTIONS = [14, 28, 56] as const;

export type TimeOffRange = {
  id: string;
  from: string;
  to: string;
  label?: string;
};

export type WeeklyBusyBlock = {
  id: string;
  weekday: number;
  startHm: string;
  endHm: string;
  from?: string;
  until?: string;
  label?: string;
};

export type CalendarPrefs = {
  workStartHour: number;
  workEndHour: number;
  slotIntervalMinutes: number;
  breakAfterEventMinutes: number;
  weekendsOff: boolean;
  lunchEnabled: boolean;
  lunchStart: string;
  lunchEnd: string;
  /** Всегда равно `slotIntervalMinutes`: минимальная длина непрерывного свободного окна для подсчёта слотов. */
  minFreeSegmentMinutes: number;
  useCustomDaysOff: boolean;
  customDaysOff: string[];
  timeOffRanges: TimeOffRange[];
  weeklyBusyBlocks: WeeklyBusyBlock[];
  minNoticeHours: number;
  bookingDaysAhead: number;
  /** Показывать слоты на публичной странице профиля (иначе — запрос на ведение без календаря) */
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
  timeOffRanges: [],
  weeklyBusyBlocks: [],
  minNoticeHours: 0.5,
  bookingDaysAhead: 14,
  bookingByLinkEnabled: true,
};

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function dayKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const APP_TIME_ZONE = 'Europe/Moscow';

const WEEKDAY_IN: Record<number, string> = {
  0: 'воскресенье',
  1: 'понедельник',
  2: 'вторник',
  3: 'среду',
  4: 'четверг',
  5: 'пятницу',
  6: 'субботу'
};

function zonedParts(d: Date, timeZone = APP_TIME_ZONE) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute)
  };
}

export function dayKeyInAppTz(d: Date): string {
  const p = zonedParts(d);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

export function minutesInAppTz(d: Date): number {
  const p = zonedParts(d);
  return p.hour * 60 + p.minute;
}

export function formatTimeInAppTz(d: Date): string {
  const p = zonedParts(d);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

export function formatDateTimeInAppTz(d: Date): string {
  return d.toLocaleString('ru-RU', {
    timeZone: APP_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function weeklyWeekdayLabel(d: Date | string): string {
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) {
    const [y, m, da] = d.slice(0, 10).split('-').map(Number);
    const noon = new Date(Date.UTC(y, m - 1, da, 12, 0, 0, 0));
    return WEEKDAY_IN[noon.getUTCDay()] || 'этот день';
  }
  const key = dayKeyInAppTz(d instanceof Date ? d : new Date(d));
  const [y, m, da] = key.split('-').map(Number);
  const noon = new Date(Date.UTC(y, m - 1, da, 12, 0, 0, 0));
  return WEEKDAY_IN[noon.getUTCDay()] || 'этот день';
}

export function weeklyBadgeText(startsAt: string | Date): string {
  return `каждую неделю в ${weeklyWeekdayLabel(startsAt)}`;
}

/** Подпись слота: naive `YYYY-MM-DDTHH:MM` — московские стенные часы; ISO с Z — абсолютный момент. */
export function formatSlotLabel(iso: string): string {
  const raw = String(iso || '').trim();
  const naive = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(raw);
  if (naive) {
    const [, y, mo, da, hh, mm] = naive;
    const dateLabel = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(da), 12)).toLocaleDateString('ru-RU', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC'
    });
    return `${dateLabel}, ${hh}:${mm}`;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return formatDateTimeInAppTz(d);
}

export function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function toWallInputValue(d: Date): string {
  const p = zonedParts(d);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}`;
}

export function addMinutesToWallInput(wall: string, minutes: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(wall);
  if (!m) return wall;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  const total = Number(m[4]) * 60 + Number(m[5]) + minutes;
  const dayDelta = Math.floor(total / (24 * 60));
  const rem = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const utc = Date.UTC(y, mo - 1, da + dayDelta);
  const nd = new Date(utc);
  return `${nd.getUTCFullYear()}-${pad2(nd.getUTCMonth() + 1)}-${pad2(nd.getUTCDate())}T${pad2(
    Math.floor(rem / 60)
  )}:${pad2(rem % 60)}`;
}

export function slotRangeWallIso(dayKey: string, startHm: string, durationMin: number) {
  const hm = /^(\d{1,2}):(\d{2})$/.exec(String(startHm || '').trim());
  const H = hm ? Number(hm[1]) : 0;
  const M = hm ? Number(hm[2]) : 0;
  const start = `${dayKey}T${pad2(H)}:${pad2(M)}`;
  return { slotStart: start, slotEnd: addMinutesToWallInput(start, durationMin) };
}

export function isCalendarDayPast(dayKey: string, now: Date = new Date()): boolean {
  return dayKey < dayKeyFromDate(now);
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

export function weekdayFromJs(jsDow: number): number {
  return jsDow === 0 ? 7 : jsDow;
}

function validDayKey(s: unknown): s is string {
  return typeof s === 'string' && DAY_KEY_RE.test(s);
}

export function newCalendarPrefId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function parseTimeOffRanges(raw: unknown): TimeOffRange[] {
  if (!Array.isArray(raw)) return [];
  const out: TimeOffRange[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const from = validDayKey(o.from) ? o.from : null;
    const to = validDayKey(o.to) ? o.to : null;
    if (!from || !to) continue;
    const a = from <= to ? from : to;
    const b = from <= to ? to : from;
    const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : `r-${a}-${b}`;
    const label = typeof o.label === 'string' && o.label.trim() ? o.label.trim().slice(0, 80) : undefined;
    out.push({ id, from: a, to: b, ...(label ? { label } : {}) });
  }
  return out;
}

export function parseWeeklyBusyBlocks(raw: unknown): WeeklyBusyBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: WeeklyBusyBlock[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const weekday = Number(o.weekday);
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) continue;
    const startHm = typeof o.startHm === 'string' ? o.startHm : '';
    const endHm = typeof o.endHm === 'string' ? o.endHm : '';
    const sm = parseTimeToMinutes(startHm);
    const em = parseTimeToMinutes(endHm);
    if (sm == null || em == null || em <= sm) continue;
    const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : `b-${weekday}-${startHm}`;
    const from = validDayKey(o.from) ? o.from : undefined;
    const until = validDayKey(o.until) ? o.until : undefined;
    const label = typeof o.label === 'string' && o.label.trim() ? o.label.trim().slice(0, 80) : undefined;
    out.push({
      id,
      weekday,
      startHm: `${pad2(Math.floor(sm / 60))}:${pad2(sm % 60)}`,
      endHm: `${pad2(Math.floor(em / 60))}:${pad2(em % 60)}`,
      ...(from ? { from } : {}),
      ...(until ? { until } : {}),
      ...(label ? { label } : {}),
    });
  }
  return out;
}

export function isTimeOffDay(prefs: CalendarPrefs, dayKey: string): boolean {
  if (prefs.useCustomDaysOff && prefs.customDaysOff?.includes(dayKey)) return true;
  return (prefs.timeOffRanges || []).some((r) => r.from <= dayKey && dayKey <= r.to);
}

export function weeklyBusyCutsForDay(prefs: CalendarPrefs, dayKey: string, jsDow: number): [number, number][] {
  const weekday = weekdayFromJs(jsDow);
  const cuts: [number, number][] = [];
  for (const b of prefs.weeklyBusyBlocks || []) {
    if (b.weekday !== weekday) continue;
    if (b.from && dayKey < b.from) continue;
    if (b.until && dayKey > b.until) continue;
    const sm = parseTimeToMinutes(b.startHm);
    const em = parseTimeToMinutes(b.endHm);
    if (sm == null || em == null || em <= sm) continue;
    cuts.push([sm, em]);
  }
  return cuts;
}

export function maxBookableDayKey(prefs: CalendarPrefs, now: Date = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + Math.max(1, prefs.bookingDaysAhead || 14) - 1);
  return dayKeyFromDate(d);
}

export type DayCalSummary = {
  hasEvents: boolean;
  hasBusyBlock: boolean;
  weekendBlocked: boolean;
  beyondHorizon: boolean;
  freeSegments: [number, number][];
  freeLabel: string;
  slotStarts: string[];
  isFullyBusy: boolean;
  isPast: boolean;
};

export type ComputeDaySummaryOpts = {
  applyBookingRules?: boolean;
};

export function computeDaySummary(
  dayKey: string,
  prefs: CalendarPrefs,
  dayEvents: any[],
  opts?: ComputeDaySummaryOpts
): DayCalSummary {
  const parts = dayKey.split('-').map(Number);
  const y = parts[0];
  const mo = parts[1];
  const da = parts[2];
  const d = new Date(y, mo - 1, da, 12, 0, 0, 0);
  const dow = d.getDay();
  const isWeekend = dow === 0 || dow === 6;
  const hasEvents = dayEvents.length > 0;
  const past = isCalendarDayPast(dayKey);
  const busyCuts = weeklyBusyCutsForDay(prefs, dayKey, dow);
  const hasBusyBlock = busyCuts.length > 0;
  const beyondHorizon = false;

  const blockedResult = (label: string, extra?: Partial<DayCalSummary>): DayCalSummary => ({
    hasEvents,
    hasBusyBlock,
    weekendBlocked: true,
    beyondHorizon,
    freeSegments: [],
    freeLabel: label,
    slotStarts: [],
    isFullyBusy: true,
    isPast: past,
    ...extra
  });

  if (past) {
    const weekendB = prefs.weekendsOff && isWeekend;
    const customB = isTimeOffDay(prefs, dayKey);
    const blocked = weekendB || customB;
    return {
      hasEvents,
      hasBusyBlock,
      weekendBlocked: blocked,
      beyondHorizon: false,
      freeSegments: [],
      freeLabel: blocked ? 'Выходной' : hasEvents ? '' : '—',
      slotStarts: [],
      isFullyBusy: false,
      isPast: true
    };
  }

  if (isTimeOffDay(prefs, dayKey)) {
    return blockedResult('Выходной');
  }

  if (prefs.weekendsOff && isWeekend) {
    return blockedResult('Выходной');
  }

  const workStart = prefs.workStartHour * 60;
  const workEnd = prefs.workEndHour * 60;

  if (workEnd <= workStart) {
    return {
      hasEvents,
      hasBusyBlock,
      weekendBlocked: false,
      beyondHorizon: false,
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
    const sMin = minutesInAppTz(sm);
    const eMin = Math.max(sMin + 1, minutesInAppTz(em));
    const pad = Math.max(0, prefs.breakAfterEventMinutes);
    busyRaw.push([Math.max(workStart, sMin), Math.min(workEnd, eMin + pad)]);
  }
  for (const [cs, ce] of busyCuts) {
    busyRaw.push([Math.max(workStart, cs), Math.min(workEnd, ce)]);
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
    : hasEvents || hasBusyBlock
      ? 'Нет свободных окон'
      : `${minutesToLabel(workStart)}–${minutesToLabel(workEnd)}`;

  const intv = prefs.slotIntervalMinutes;
  const slotStarts: string[] = [];
  const now = new Date();
  const noticeMs = opts?.applyBookingRules ? 30 * 60 * 1000 : 0;
  for (const [fs, fe] of free) {
    for (let t = fs; t + intv <= fe; t += intv) {
      const hm = minutesToLabel(Math.round(t));
      if (noticeMs > 0) {
        const [H, M] = hm.split(':').map(Number);
        const slotDate = new Date(y, mo - 1, da, H, M, 0, 0);
        if (slotDate.getTime() < now.getTime() + noticeMs) continue;
      }
      slotStarts.push(hm);
    }
  }

  const isFullyBusy = (hasEvents || hasBusyBlock) && free.length === 0;

  return {
    hasEvents,
    hasBusyBlock,
    weekendBlocked: false,
    beyondHorizon: false,
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
      ? [...new Set(p.customDaysOff.filter((x): x is string => typeof x === 'string' && DAY_KEY_RE.test(x)))].sort()
      : DEFAULT_CALENDAR_PREFS.customDaysOff;
    const slotIntervalMinutes = clampSlotIntervalMinutes(
      p.slotIntervalMinutes,
      DEFAULT_CALENDAR_PREFS.slotIntervalMinutes
    );
    const notice = Number(p.minNoticeHours);
    const ahead = Number(p.bookingDaysAhead);
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
      customDaysOff,
      timeOffRanges: parseTimeOffRanges(p.timeOffRanges),
      weeklyBusyBlocks: parseWeeklyBusyBlocks(p.weeklyBusyBlocks),
      minNoticeHours: (MIN_NOTICE_HOURS_OPTIONS as readonly number[]).includes(notice)
        ? notice
        : DEFAULT_CALENDAR_PREFS.minNoticeHours,
      bookingDaysAhead: (BOOKING_DAYS_AHEAD_OPTIONS as readonly number[]).includes(ahead)
        ? ahead
        : DEFAULT_CALENDAR_PREFS.bookingDaysAhead,
      bookingByLinkEnabled:
        typeof p.bookingByLinkEnabled === 'boolean'
          ? p.bookingByLinkEnabled
          : DEFAULT_CALENDAR_PREFS.bookingByLinkEnabled,
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
  if (typeof p.slotIntervalMinutes === 'number' || typeof p.slotIntervalMinutes === 'string') {
    const slot = clampSlotIntervalMinutes(p.slotIntervalMinutes, DEFAULT_CALENDAR_PREFS.slotIntervalMinutes);
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
    out.customDaysOff = p.customDaysOff.filter((x): x is string => typeof x === 'string' && DAY_KEY_RE.test(x));
  }
  out.timeOffRanges = parseTimeOffRanges(p.timeOffRanges);
  out.weeklyBusyBlocks = parseWeeklyBusyBlocks(p.weeklyBusyBlocks);
  const notice = Number(p.minNoticeHours);
  if ((MIN_NOTICE_HOURS_OPTIONS as readonly number[]).includes(notice)) out.minNoticeHours = notice;
  const ahead = Number(p.bookingDaysAhead);
  if ((BOOKING_DAYS_AHEAD_OPTIONS as readonly number[]).includes(ahead)) out.bookingDaysAhead = ahead;
  if (typeof p.bookingByLinkEnabled === 'boolean') out.bookingByLinkEnabled = p.bookingByLinkEnabled;
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

export const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Понедельник' },
  { value: 2, label: 'Вторник' },
  { value: 3, label: 'Среда' },
  { value: 4, label: 'Четверг' },
  { value: 5, label: 'Пятница' },
  { value: 6, label: 'Суббота' },
  { value: 7, label: 'Воскресенье' }
] as const;
