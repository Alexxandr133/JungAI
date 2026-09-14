import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { getApiBaseUrl } from '../lib/api';

export type ChatSocketMessage = {
  id: string;
  roomId: string;
  authorId: string;
  content: string;
  createdAt: string;
  readAt?: string | null;
  clientMessageId?: string;
};

type UnreadState = { total: number; byRoom: Record<string, number> };

type ChatSocketContextValue = {
  connected: boolean;
  unread: UnreadState;
  onlineUsers: Set<string>;
  subscribeRoom: (roomId: string) => void;
  unsubscribeRoom: (roomId: string) => void;
  sendMessage: (roomId: string, content: string, clientMessageId?: string) => void;
  markRead: (roomId: string) => void;
  onMessage: (handler: (msg: ChatSocketMessage) => void) => () => void;
  onAck: (handler: (payload: { clientMessageId?: string; message: ChatSocketMessage }) => void) => () => void;
  onReadReceipt: (
    handler: (payload: { roomId: string; readerId: string; readAt: string; messageIds: string[] }) => void
  ) => () => void;
};

const ChatSocketContext = createContext<ChatSocketContextValue | null>(null);

/** Module singleton — survives StrictMode remount; one socket per browser tab session */
const socketSingleton: {
  socket: Socket | null;
  token: string | null;
  rooms: Set<string>;
} = {
  socket: null,
  token: null,
  rooms: new Set()
};

const HEARTBEAT_MS = 25_000;

function ensureSocket(token: string): Socket {
  if (socketSingleton.socket && socketSingleton.token === token) {
    return socketSingleton.socket;
  }
  if (socketSingleton.socket) {
    socketSingleton.socket.removeAllListeners();
    socketSingleton.socket.disconnect();
    socketSingleton.socket = null;
  }
  const base = getApiBaseUrl();
  const socket = io(base, {
    auth: { token },
    transports: ['websocket', 'polling'],
    path: '/socket.io/',
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    randomizationFactor: 0.5
  });
  socketSingleton.socket = socket;
  socketSingleton.token = token;
  return socket;
}

function teardownSocket() {
  if (socketSingleton.socket) {
    socketSingleton.socket.removeAllListeners();
    socketSingleton.socket.disconnect();
    socketSingleton.socket = null;
  }
  socketSingleton.token = null;
  socketSingleton.rooms.clear();
}

function resubscribeAll(socket: Socket) {
  for (const roomId of socketSingleton.rooms) {
    socket.emit('chat:subscribe', { roomId });
  }
}

export function ChatSocketProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [unread, setUnread] = useState<UnreadState>({ total: 0, byRoom: {} });
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(() => new Set());
  const messageHandlers = useRef(new Set<(msg: ChatSocketMessage) => void>());
  const ackHandlers = useRef(
    new Set<(payload: { clientMessageId?: string; message: ChatSocketMessage }) => void>()
  );
  const readHandlers = useRef(
    new Set<(payload: { roomId: string; readerId: string; readAt: string; messageIds: string[] }) => void>()
  );
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roleOk = user?.role === 'client' || user?.role === 'psychologist' || user?.role === 'admin';

  useEffect(() => {
    if (!token || !roleOk) {
      teardownSocket();
      setConnected(false);
      setUnread({ total: 0, byRoom: {} });
      setOnlineUsers(new Set());
      return;
    }

    const socket = ensureSocket(token);

    const onConnect = () => {
      setConnected(true);
      resubscribeAll(socket);
    };
    const onDisconnect = (_reason: string) => {
      setConnected(false);
    };
    const onReconnect = (_attempt: number) => {
      resubscribeAll(socket);
    };
    const onUnread = (payload: UnreadState) => {
      if (!payload) return;
      setUnread({
        total: payload.total || 0,
        byRoom: payload.byRoom || {}
      });
    };
    const onPresence = (payload: { userId?: string; online?: boolean }) => {
      if (!payload?.userId) return;
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (payload.online) next.add(payload.userId!);
        else next.delete(payload.userId!);
        return next;
      });
    };
    const onMessage = (msg: ChatSocketMessage) => {
      messageHandlers.current.forEach((h) => h(msg));
    };
    const onAck = (payload: { clientMessageId?: string; message: ChatSocketMessage }) => {
      ackHandlers.current.forEach((h) => h(payload));
    };
    const onRead = (payload: {
      roomId: string;
      readerId: string;
      readAt: string;
      messageIds: string[];
    }) => {
      readHandlers.current.forEach((h) => h(payload));
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect', onReconnect);
    socket.on('chat:unread', onUnread);
    socket.on('chat:presence', onPresence);
    socket.on('chat:message', onMessage);
    socket.on('chat:ack', onAck);
    socket.on('chat:read-receipt', onRead);

    if (socket.connected) onConnect();

    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(() => {
      if (socket.connected) socket.emit('ping');
    }, HEARTBEAT_MS);

    return () => {
      // StrictMode guard: do NOT disconnect socket — only detach this provider's listeners
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect', onReconnect);
      socket.off('chat:unread', onUnread);
      socket.off('chat:presence', onPresence);
      socket.off('chat:message', onMessage);
      socket.off('chat:ack', onAck);
      socket.off('chat:read-receipt', onRead);
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [token, roleOk]);

  // Tear down only on logout / role change away
  useEffect(() => {
    if (!token || !roleOk) teardownSocket();
  }, [token, roleOk]);

  const subscribeRoom = useCallback((roomId: string) => {
    if (!roomId) return;
    socketSingleton.rooms.add(roomId);
    socketSingleton.socket?.emit('chat:subscribe', { roomId });
  }, []);

  const unsubscribeRoom = useCallback((roomId: string) => {
    if (!roomId) return;
    socketSingleton.rooms.delete(roomId);
    socketSingleton.socket?.emit('chat:unsubscribe', { roomId });
  }, []);

  const sendMessage = useCallback((roomId: string, content: string, clientMessageId?: string) => {
    socketSingleton.socket?.emit('chat:send', { roomId, content, clientMessageId });
  }, []);

  const markRead = useCallback((roomId: string) => {
    socketSingleton.socket?.emit('chat:read', { roomId });
  }, []);

  const onMessage = useCallback((handler: (msg: ChatSocketMessage) => void) => {
    messageHandlers.current.add(handler);
    return () => {
      messageHandlers.current.delete(handler);
    };
  }, []);

  const onAck = useCallback(
    (handler: (payload: { clientMessageId?: string; message: ChatSocketMessage }) => void) => {
      ackHandlers.current.add(handler);
      return () => {
        ackHandlers.current.delete(handler);
      };
    },
    []
  );

  const onReadReceipt = useCallback(
    (
      handler: (payload: { roomId: string; readerId: string; readAt: string; messageIds: string[] }) => void
    ) => {
      readHandlers.current.add(handler);
      return () => {
        readHandlers.current.delete(handler);
      };
    },
    []
  );

  const value = useMemo(
    () => ({
      connected,
      unread,
      onlineUsers,
      subscribeRoom,
      unsubscribeRoom,
      sendMessage,
      markRead,
      onMessage,
      onAck,
      onReadReceipt
    }),
    [
      connected,
      unread,
      onlineUsers,
      subscribeRoom,
      unsubscribeRoom,
      sendMessage,
      markRead,
      onMessage,
      onAck,
      onReadReceipt
    ]
  );

  return <ChatSocketContext.Provider value={value}>{children}</ChatSocketContext.Provider>;
}

export function useChatSocket() {
  const ctx = useContext(ChatSocketContext);
  if (!ctx) throw new Error('useChatSocket must be used within ChatSocketProvider');
  return ctx;
}

export function useChatSocketOptional() {
  return useContext(ChatSocketContext);
}
