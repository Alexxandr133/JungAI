/** Событие: JWT истёк или недействителен (401 с Bearer-токеном). */
export const AUTH_SESSION_EXPIRED_EVENT = 'jingai:auth-session-expired';

/** localhost / 127.0.0.1 — не показываем «сессия истекла» при разработке */
export function isLocalDevHost(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
}

/** Гостевая / публичная комната — не блокируем звонок модалкой «сессия истекла». */
export function isPublicRoomPath(pathname?: string): boolean {
  const path = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  return /^\/room\/[^/]+/.test(path);
}

/** JWT в localStorage может быть просрочен — для комнаты считаем его отсутствующим. */
export function isJwtExpired(token: string | null | undefined): boolean {
  if (!token) return true;
  try {
    const part = token.split('.')[1];
    if (!part) return true;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    if (typeof payload.exp !== 'number') return false;
    return payload.exp * 1000 <= Date.now() + 15_000;
  } catch {
    return true;
  }
}

export function notifySessionExpired(): void {
  if (typeof window === 'undefined') return;
  if (isLocalDevHost()) return;
  if (isPublicRoomPath()) return;
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));
}

export function isUnauthorizedError(error: unknown): boolean {
  const e = error as { status?: number; message?: string };
  if (e?.status === 401) return true;
  const msg = String(e?.message || '').toLowerCase();
  return msg.includes('unauthorized') || msg.includes('jwt expired') || msg.includes('token expired');
}
