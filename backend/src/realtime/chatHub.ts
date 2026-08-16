import type { Server as SocketIOServer, Socket } from 'socket.io';

let ioRef: SocketIOServer | null = null;

/** userId → set of socket ids (presence) */
const onlineSockets = new Map<string, Set<string>>();

export function setChatIo(io: SocketIOServer) {
  ioRef = io;
}

export function getChatIo(): SocketIOServer | null {
  return ioRef;
}

export type ChatMessagePayload = {
  id: string;
  roomId: string;
  authorId: string;
  content: string;
  createdAt: string;
  readAt?: string | null;
  clientMessageId?: string;
};

export function markUserOnline(userId: string, socketId: string) {
  let set = onlineSockets.get(userId);
  if (!set) {
    set = new Set();
    onlineSockets.set(userId, set);
  }
  const wasOffline = set.size === 0;
  set.add(socketId);
  return wasOffline;
}

export function markUserOffline(userId: string, socketId: string) {
  const set = onlineSockets.get(userId);
  if (!set) return true;
  set.delete(socketId);
  if (set.size === 0) {
    onlineSockets.delete(userId);
    return true;
  }
  return false;
}

export function isUserOnline(userId: string): boolean {
  return (onlineSockets.get(userId)?.size ?? 0) > 0;
}

export function getOnlineUserIds(): string[] {
  return Array.from(onlineSockets.keys());
}

export function emitChatNewMessage(roomId: string, message: ChatMessagePayload) {
  ioRef?.to(`chat:${roomId}`).emit('chat:message', message);
}

export function emitChatAck(socket: Socket, payload: { clientMessageId?: string; message: ChatMessagePayload }) {
  socket.emit('chat:ack', payload);
}

export function emitChatReadReceipt(roomId: string, payload: { roomId: string; readerId: string; readAt: string; messageIds: string[] }) {
  ioRef?.to(`chat:${roomId}`).emit('chat:read-receipt', payload);
}

export function emitChatUnread(socket: Socket, payload: { total: number; byRoom: Record<string, number> }) {
  socket.emit('chat:unread', payload);
}

export function emitPresence(payload: { userId: string; online: boolean }) {
  ioRef?.emit('chat:presence', payload);
}

export function emitUnreadToUser(userId: string, payload: { total: number; byRoom: Record<string, number> }) {
  ioRef?.to(`user:${userId}`).emit('chat:unread', payload);
}
