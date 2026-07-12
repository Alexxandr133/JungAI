/** Событие: JWT истёк или недействителен (401 с Bearer-токеном). */
export const AUTH_SESSION_EXPIRED_EVENT = 'jingai:auth-session-expired';

/** localhost / 127.0.0.1 — не показываем «сессия истекла» при разработке */
export function isLocalDevHost(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
}

export function notifySessionExpired(): void {
  if (typeof window === 'undefined') return;
  if (isLocalDevHost()) return;
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));
}

export function isUnauthorizedError(error: unknown): boolean {
  const e = error as { status?: number; message?: string };
  if (e?.status === 401) return true;
  const msg = String(e?.message || '').toLowerCase();
  return msg.includes('unauthorized') || msg.includes('jwt expired') || msg.includes('token expired');
}
