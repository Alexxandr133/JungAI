import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { MessageCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useChatSocketOptional } from '../context/ChatSocketContext';
import { useMessengerUi } from '../context/MessengerUiContext';
import { MessengerPanel } from './MessengerPanel';
import './Messenger.css';

const WIDTH_KEY = 'jungai_msg_drawer_width';
const MIN_W = 360;
const MAX_W_CAP = 720;
const DEFAULT_W = 460;

function clampWidth(w: number) {
  const max = Math.min(MAX_W_CAP, typeof window !== 'undefined' ? window.innerWidth - 24 : MAX_W_CAP);
  return Math.max(MIN_W, Math.min(max, Math.round(w)));
}

/** Публичные/маркетинговые маршруты — пузырь чата здесь не показываем */
function isPublicSurfacePath(pathname: string) {
  if (pathname === '/') return true;
  return (
    pathname.startsWith('/for-') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/match') ||
    pathname.startsWith('/book') ||
    pathname.startsWith('/psychologists') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/personal-data') ||
    pathname.startsWith('/contacts') ||
    pathname.startsWith('/guest') ||
    pathname.startsWith('/room')
  );
}

export function MessengerHost() {
  const { user } = useAuth();
  const location = useLocation();
  const { open, roomId, clientName, openMessenger, closeMessenger, setRoomId } = useMessengerUi();
  const chat = useChatSocketOptional();
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  const [width, setWidth] = useState(() => {
    try {
      const raw = localStorage.getItem(WIDTH_KEY);
      const n = raw ? Number(raw) : DEFAULT_W;
      return Number.isFinite(n) ? clampWidth(n) : DEFAULT_W;
    } catch {
      return DEFAULT_W;
    }
  });

  // Только кабинет психолога (не лендинги / каталог / клиент / исследователь)
  const inPsychCabinet =
    user?.role === 'psychologist' && !isPublicSurfacePath(location.pathname);
  const onFullMessages = location.pathname === '/messages' || location.pathname === '/chat';

  useEffect(() => {
    if (!inPsychCabinet && open) closeMessenger();
  }, [inPsychCabinet, open, closeMessenger]);

  useEffect(() => {
    try {
      localStorage.setItem(WIDTH_KEY, String(width));
    } catch {
      /* ignore */
    }
  }, [width]);

  const onResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      dragRef.current = { startX: e.clientX, startW: width };
    },
    [width]
  );

  const onResizePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const delta = dragRef.current.startX - e.clientX;
    setWidth(clampWidth(dragRef.current.startW + delta));
  }, []);

  const onResizePointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  if (!inPsychCabinet || onFullMessages) return null;

  const unread = chat?.unread.total || 0;
  const drawerStyle: CSSProperties | undefined =
    typeof window !== 'undefined' && window.innerWidth <= 768
      ? undefined
      : { width: `${width}px`, maxWidth: '100vw' };

  return (
    <>
      {!open ? (
        <button
          type="button"
          className="msg-bubble"
          aria-label="Сообщения"
          onClick={() => openMessenger()}
        >
          <MessageCircle size={24} />
          {unread > 0 ? (
            <span className="msg-bubble__badge">{unread > 99 ? '99+' : unread}</span>
          ) : null}
        </button>
      ) : null}

      {open ? (
        <>
          <div className="msg-drawer-backdrop" onClick={closeMessenger} />
          <div className="msg-drawer" role="dialog" aria-label="Мессенджер" style={drawerStyle}>
            <div
              className="msg-drawer__resize"
              role="separator"
              aria-orientation="vertical"
              aria-label="Изменить ширину"
              onPointerDown={onResizePointerDown}
              onPointerMove={onResizePointerMove}
              onPointerUp={onResizePointerUp}
              onPointerCancel={onResizePointerUp}
            />
            <MessengerPanel
              mode="drawer"
              initialRoomId={roomId}
              initialClientName={clientName}
              onRoomChange={setRoomId}
              onClose={closeMessenger}
            />
          </div>
        </>
      ) : null}
    </>
  );
}
