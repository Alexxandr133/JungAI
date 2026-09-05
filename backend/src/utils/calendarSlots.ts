import { dayKeyInAppTz, minutesInAppTz, addDaysToDayKey, slotRangeWallIso, parseEventDateInput } from './eventDate';

/** Упрощённый расчёт свободных слотов (зеркало frontend eventsCalendarUtils). */

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
  minFreeSegmentMinutes?: number;
  useCustomDaysOff: boolean;
  customDaysOff: string[];
  timeOffRanges: TimeOffRange[];
  weeklyBusyBlocks: WeeklyBusyBlock[];
  minNoticeHours: number;
  bookingDaysAhead: number;
  /** Показывать слоты на публичной странице профиля */
  bookingByLinkEnabled: boolean;
};

export const MIN_NOTICE_HOURS_OPTIONS = [0.5, 2, 24] as const;
export const BOOKING_DAYS_AHEAD_OPTIONS = [14, 28, 56] as const;
const SLOT_INTERVAL_MIN = 5;
const SLOT_INTERVAL_MAX = 180;

function clampSlotInterval(n: number, fallback = 60): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(SLOT_INTERVAL_MIN, Math.min(SLOT_INTERVAL_MAX, Math.round(n)));
}

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
const HM_RE = /^(\d{1,2}):(\d{2})$/;

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
  const m = HM_RE.exec(String(t || '').trim());
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

export function weekdayFromJs(jsDow: number): number {
  return jsDow === 0 ? 7 : jsDow;
}

function validDayKey(s: unknown): s is string {
  return typeof s === 'string' && DAY_KEY_RE.test(s);
}

function parseTimeOffRanges(raw: unknown): TimeOffRange[] {
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

function parseWeeklyBusyBlocks(raw: unknown): WeeklyBusyBlock[] {
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
  if (prefs.useCustomDaysOff && prefs.customDaysOff.includes(dayKey)) return true;
  return prefs.timeOffRanges.some((r) => r.from <= dayKey && dayKey <= r.to);
}

export function weeklyBusyCutsForDay(prefs: CalendarPrefs, dayKey: string, jsDow: number): [number, number][] {
  const weekday = weekdayFromJs(jsDow);
  const cuts: [number, number][] = [];
  for (const b of prefs.weeklyBusyBlocks) {
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

export function mergeCalendarPrefs(raw: unknown): CalendarPrefs {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CALENDAR_PREFS };
  const o = raw as Record<string, unknown>;
  const interval = Number(o.slotIntervalMinutes);
  const notice = Number(o.minNoticeHours);
  const ahead = Number(o.bookingDaysAhead);
  const timeOffRanges = parseTimeOffRanges(o.timeOffRanges);
  const weeklyBusyBlocks = parseWeeklyBusyBlocks(o.weeklyBusyBlocks);
  const customDaysOff = Array.isArray(o.customDaysOff) ? o.customDaysOff.map(String).filter(validDayKey) : [];
  const useCustomDaysOff = Boolean(o.useCustomDaysOff) || timeOffRanges.length > 0 || customDaysOff.length > 0;
  return {
    ...DEFAULT_CALENDAR_PREFS,
    workStartHour: Number.isFinite(Number(o.workStartHour)) ? Number(o.workStartHour) : DEFAULT_CALENDAR_PREFS.workStartHour,
    workEndHour: Number.isFinite(Number(o.workEndHour)) ? Number(o.workEndHour) : DEFAULT_CALENDAR_PREFS.workEndHour,
    slotIntervalMinutes: clampSlotInterval(interval),
    breakAfterEventMinutes: Number.isFinite(Number(o.breakAfterEventMinutes))
      ? Number(o.breakAfterEventMinutes)
      : DEFAULT_CALENDAR_PREFS.breakAfterEventMinutes,
    weekendsOff: o.weekendsOff !== false,
    lunchEnabled: Boolean(o.lunchEnabled),
    lunchStart: typeof o.lunchStart === 'string' ? o.lunchStart : DEFAULT_CALENDAR_PREFS.lunchStart,
    lunchEnd: typeof o.lunchEnd === 'string' ? o.lunchEnd : DEFAULT_CALENDAR_PREFS.lunchEnd,
    useCustomDaysOff,
    customDaysOff,
    timeOffRanges,
    weeklyBusyBlocks,
    minNoticeHours: (MIN_NOTICE_HOURS_OPTIONS as readonly number[]).includes(notice)
      ? notice
      : DEFAULT_CALENDAR_PREFS.minNoticeHours,
    bookingDaysAhead: (BOOKING_DAYS_AHEAD_OPTIONS as readonly number[]).includes(ahead)
      ? ahead
      : DEFAULT_CALENDAR_PREFS.bookingDaysAhead,
    bookingByLinkEnabled: o.bookingByLinkEnabled !== false,
  };
}

function jsDowFromDayKey(dayKey: string): number {
  const [y, mo, da] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, da, 12, 0, 0, 0)).getUTCDay();
}

function slotStartsForDay(dayKey: string, prefs: CalendarPrefs, dayEvents: Array<{ startsAt: Date; endsAt: Date | null }>): string[] {
  const dow = jsDowFromDayKey(dayKey);
  const todayKey = dayKeyInAppTz(new Date());
  if (dayKey < todayKey) return [];
  if (isTimeOffDay(prefs, dayKey)) return [];
  if (prefs.weekendsOff && (dow === 0 || dow === 6)) return [];

  const workStart = prefs.workStartHour * 60;
  const workEnd = prefs.workEndHour * 60;
  if (workEnd <= workStart) return [];

  const base: [number, number][] = [[workStart, workEnd]];
  const busyRaw: [number, number][] = [];
  for (const ev of dayEvents) {
    const sm = new Date(ev.startsAt);
    const em = ev.endsAt ? new Date(ev.endsAt) : new Date(sm.getTime() + 60 * 60 * 1000);
    const sMin = minutesInAppTz(sm);
    const eMin = Math.max(sMin + 1, minutesInAppTz(em));
    const pad = Math.max(0, prefs.breakAfterEventMinutes);
    busyRaw.push([Math.max(workStart, sMin), Math.min(workEnd, eMin + pad)]);
  }
  for (const [cs, ce] of weeklyBusyCutsForDay(prefs, dayKey, dow)) {
    busyRaw.push([Math.max(workStart, cs), Math.min(workEnd, ce)]);
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
  const noticeMs = 30 * 60 * 1000;
  for (const [fs, fe] of free) {
    for (let t = fs; t + intv <= fe; t += intv) {
      const hm = minutesToLabel(Math.round(t));
      const slotDate = parseEventDateInput(`${dayKey}T${hm}`);
      if (!slotDate || slotDate.getTime() < now.getTime() + noticeMs) continue;
      slotStarts.push(hm);
    }
  }
  return slotStarts;
}

export type FreeSlot = { dayKey: string; startHm: string; slotStart: string; slotEnd: string };

function localSlotIso(dayKey: string, startHm: string, durationMin: number) {
  return slotRangeWallIso(dayKey, startHm, durationMin);
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
    const k = dayKeyInAppTz(new Date(ev.startsAt));
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(ev);
  }
  const out: FreeSlot[] = [];
  const todayKey = dayKeyInAppTz(new Date());
  for (let i = 0; i < daysAhead; i++) {
    const dayKey = addDaysToDayKey(todayKey, i);
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
  const h = Math.floor(minutesInAppTz(d) / 60);
  if (h < 12) return 'morning';
  if (h < 17) return 'day';
  return 'evening';
}
