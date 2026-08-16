export type ChatRoomItem = {
  id: string;
  name?: string | null;
  displayName?: string;
  peerUserId?: string | null;
  peerClientId?: string | null;
  peerAvatarUrl?: string | null;
  peerOnline?: boolean;
  unreadCount?: number;
  lastMessage?: {
    id: string;
    content: string;
    authorId: string;
    createdAt: string;
    readAt?: string | null;
  } | null;
  createdAt?: string;
};

export type ChatMessageItem = {
  id: string;
  roomId?: string;
  authorId: string;
  content: string;
  createdAt: string;
  readAt?: string | null;
  pending?: boolean;
  clientMessageId?: string;
};

export function formatMsgTime(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function formatListTime(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return formatMsgTime(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function resolveAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const env = (import.meta as any).env || {};
  let baseOrigin: string = env.VITE_API_ORIGIN || env.VITE_API_URL || '';
  if (
    !baseOrigin &&
    env.DEV &&
    typeof window !== 'undefined' &&
    window.location.hostname === 'localhost' &&
    window.location.port !== '4000'
  ) {
    baseOrigin = 'http://localhost:4000';
  }
  if (!baseOrigin && typeof window !== 'undefined') {
    baseOrigin = window.location.origin;
  }
  return `${baseOrigin}${url}`;
}
