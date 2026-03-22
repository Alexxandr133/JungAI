import type { Server as SocketIOServer } from 'socket.io';
import type { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import type { JwtUser } from '../middleware/auth';
import { userCanAccessChatRoom } from '../utils/chatAccess';

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

export function setupChatSocket(io: SocketIOServer) {
  io.on('connection', (socket) => {
    socket.on('chat:subscribe', async (data: { roomId?: string }) => {
      const user = getUserFromSocket(socket);
      if (!user) {
        socket.emit('chat:error', { message: 'Unauthorized' });
        return;
      }
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
      } catch {
        socket.emit('chat:error', { message: 'Subscribe failed' });
      }
    });

    socket.on('chat:unsubscribe', async (data: { roomId?: string }) => {
      const roomId = data?.roomId;
      if (roomId) await socket.leave(`chat:${roomId}`);
    });
  });
}
