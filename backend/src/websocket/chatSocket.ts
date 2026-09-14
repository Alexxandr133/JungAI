import type { Server as SocketIOServer } from 'socket.io';
import type { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import type { JwtUser } from '../middleware/auth';
import { userCanAccessChatRoom } from '../utils/chatAccess';
import {
  emitChatAck,
  emitChatNewMessage,
  emitChatReadReceipt,
  emitChatUnread,
  emitPresence,
  markUserOffline,
  markUserOnline
} from '../realtime/chatHub';
import { createChatMessage, getUnreadSummary, markRoomRead } from '../services/chatService';

function getUserFromSocket(socket: Socket): JwtUser | null {
  const cached = (socket.data as { user?: JwtUser }).user;
  if (cached) return cached;
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtUser;
    (socket.data as { user?: JwtUser }).user = payload;
    return payload;
  } catch {
    return null;
  }
}

async function pushUnread(socket: Socket, user: JwtUser) {
  try {
    const summary = await getUnreadSummary(user.id, user.role, user.email);
    emitChatUnread(socket, summary);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[ChatSocket] unread push failed', e);
  }
}

export function setupChatSocket(io: SocketIOServer) {
  io.on('connection', (socket) => {
    const user = getUserFromSocket(socket);
    if (!user) {
      // Voice rooms may connect without chat auth; leave socket alive for other namespaces/handlers
      socket.on('chat:subscribe', () => {
        socket.emit('chat:error', { message: 'Unauthorized' });
      });
      return;
    }

    void socket.join(`user:${user.id}`);
    const becameOnline = markUserOnline(user.id, socket.id);
    if (becameOnline) {
      emitPresence({ userId: user.id, online: true });
    }

    void pushUnread(socket, user);

    socket.on('ping', () => {
      socket.emit('pong', { t: Date.now() });
    });

    socket.on('chat:subscribe', async (data: { roomId?: string }) => {
      const roomId = data?.roomId;
      if (!roomId) {
        socket.emit('chat:error', { message: 'roomId required' });
        return;
      }
      try {
        const ok = await userCanAccessChatRoom(user, roomId);
        if (!ok) {
          socket.emit('chat:error', { message: 'Forbidden' });
          return;
        }
        await socket.join(`chat:${roomId}`);
        const subscribed = (socket.data as { rooms?: Set<string> }).rooms || new Set<string>();
        subscribed.add(roomId);
        (socket.data as { rooms?: Set<string> }).rooms = subscribed;
        socket.emit('chat:subscribed', { roomId });
      } catch {
        socket.emit('chat:error', { message: 'Subscribe failed' });
      }
    });

    socket.on('chat:unsubscribe', async (data: { roomId?: string }) => {
      const roomId = data?.roomId;
      if (roomId) {
        await socket.leave(`chat:${roomId}`);
        (socket.data as { rooms?: Set<string> }).rooms?.delete(roomId);
      }
    });

    socket.on(
      'chat:send',
      async (data: { roomId?: string; content?: string; clientMessageId?: string }) => {
        const roomId = data?.roomId;
        const content = typeof data?.content === 'string' ? data.content : '';
        const clientMessageId = data?.clientMessageId;
        if (!roomId || !content.trim()) {
          socket.emit('chat:error', { message: 'roomId and content required' });
          return;
        }
        try {
          const ok = await userCanAccessChatRoom(user, roomId);
          if (!ok) {
            socket.emit('chat:error', { message: 'Forbidden' });
            return;
          }
          const message = await createChatMessage({
            roomId,
            authorId: user.id,
            content
          });
          emitChatAck(socket, { clientMessageId, message });
          emitChatNewMessage(roomId, { ...message, clientMessageId });
        } catch (e: any) {
          socket.emit('chat:error', { message: e?.message || 'Send failed' });
        }
      }
    );

    socket.on('chat:read', async (data: { roomId?: string }) => {
      const roomId = data?.roomId;
      if (!roomId) return;
      try {
        const ok = await userCanAccessChatRoom(user, roomId);
        if (!ok) return;
        const result = await markRoomRead(user.id, roomId);
        emitChatReadReceipt(roomId, {
          roomId,
          readerId: user.id,
          readAt: result.readAt,
          messageIds: result.messageIds
        });
        await pushUnread(socket, user);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[ChatSocket] read failed', e);
      }
    });

    socket.on('disconnect', (reason) => {
      const becameOffline = markUserOffline(user.id, socket.id);
      // eslint-disable-next-line no-console
      console.log(
        `[ChatSocket] disconnected user=${user.id} socket=${socket.id} reason=${reason} becameOffline=${becameOffline}`
      );
      if (becameOffline) {
        emitPresence({ userId: user.id, online: false });
      }
    });
  });
}
