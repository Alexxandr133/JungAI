import { config } from '../config';

function offsetMs(): number {
  return (Number(config.eventTimezoneOffsetMinutes) || 180) * 60 * 1000;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** Гражданская дата/минуты в поясе приложения (фиксированный offset, без DST). */
export function dayKeyInAppTz(d: Date): string {
  const shifted = new Date(d.getTime() + offsetMs());
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}

export function minutesInAppTz(d: Date): number {
  const shifted = new Date(d.getTime() + offsetMs());
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

export function addDaysToDayKey(dayKey: string, days: number): string {
  const [y, m, da] = dayKey.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, da + days);
  const x = new Date(utc);
  return `${x.getUTCFullYear()}-${pad2(x.getUTCMonth() + 1)}-${pad2(x.getUTCDate())}`;
}

export function slotRangeWallIso(dayKey: string, startHm: string, durationMin: number): {
  slotStart: string;
  slotEnd: string;
} {
  const hm = /^(\d{1,2}):(\d{2})$/.exec(String(startHm || '').trim());
  const H = hm ? Number(hm[1]) : 0;
  const M = hm ? Number(hm[2]) : 0;
  const slotStart = `${dayKey}T${pad2(H)}:${pad2(M)}`;
  const total = H * 60 + M + Math.max(0, durationMin);
  const dayDelta = Math.floor(total / (24 * 60));
  const rem = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const endKey = addDaysToDayKey(dayKey, dayDelta);
  const slotEnd = `${endKey}T${pad2(Math.floor(rem / 60))}:${pad2(rem % 60)}`;
  return { slotStart, slotEnd };
}

/**
 * Naive `YYYY-MM-DDTHH:MM` — стенные часы Москвы.
 * ISO с Z / offset — абсолютный момент.
 */
export function parseEventDateInput(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;

  const localMatch = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/
  );
  if (localMatch) {
    const [, y, m, d, hh, mm, ss] = localMatch;
    const utcMs =
      Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss || '0')) -
      offsetMs();
    const result = new Date(utcMs);
    return Number.isNaN(result.getTime()) ? null : result;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
