import { Server as SocketIOServer } from 'socket.io';

interface VoiceRoomUser {
  userId: string;
  socketId: string;
  roomId: string;
  name?: string;
  muted?: boolean;
}

// Хранилище пользователей в комнатах
const roomUsers = new Map<string, Map<string, VoiceRoomUser>>();

// Хранилище событий для уведомления об удалении
const eventRoomMap = new Map<string, string>(); // eventId -> roomId

export function setupVoiceRoomSocket(io: SocketIOServer) {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Присоединение к комнате
    socket.on('join-room', async (data: { roomId: string; userId: string; name?: string }) => {
      const { roomId, userId, name } = data;
      
      if (!roomId || !userId) {
        socket.emit('error', { message: 'Room ID and User ID are required' });
        return;
      }

      // Добавляем пользователя в комнату
      if (!roomUsers.has(roomId)) {
        roomUsers.set(roomId, new Map());
      }

      const room = roomUsers.get(roomId)!;
      room.set(socket.id, { userId, socketId: socket.id, roomId, name, muted: false });

      // Присоединяемся к Socket.io комнате
      socket.join(roomId);

      // Уведомляем других участников о новом пользователе
      socket.to(roomId).emit('user-joined', {
        socketId: socket.id,
        userId,
        name,
        muted: false
      });

      // Отправляем список существующих участников новому пользователю
      const existingUsers = Array.from(room.values())
        .filter(user => user.socketId !== socket.id)
        .map(user => ({
          socketId: user.socketId,
          userId: user.userId,
          name: user.name,
          muted: user.muted || false
        }));

      socket.emit('existing-users', existingUsers);

      console.log(`User ${userId} joined room ${roomId}, total users: ${room.size}`);
    });

    // WebRTC сигналинг: отправка offer
    socket.on('offer', (data: { offer: RTCSessionDescriptionInit; targetSocketId: string; roomId: string }) => {
      const { offer, targetSocketId } = data;
      socket.to(targetSocketId).emit('offer', {
        offer,
        senderSocketId: socket.id
      });
    });

    // WebRTC сигналинг: отправка answer
    socket.on('answer', (data: { answer: RTCSessionDescriptionInit; targetSocketId: string; roomId: string }) => {
      const { answer, targetSocketId } = data;
      socket.to(targetSocketId).emit('answer', {
        answer,
        senderSocketId: socket.id
      });
    });

    // WebRTC сигналинг: отправка ICE candidate
    socket.on('ice-candidate', (data: { candidate: RTCIceCandidateInit; targetSocketId: string; roomId: string }) => {
      const { candidate, targetSocketId } = data;
      socket.to(targetSocketId).emit('ice-candidate', {
        candidate,
        senderSocketId: socket.id
      });
    });

    // Отключение микрофона
    socket.on('toggle-mute', (data: { roomId: string; muted: boolean }) => {
      const { roomId, muted } = data;
      const room = roomUsers.get(roomId);
      if (room && room.has(socket.id)) {
        const user = room.get(socket.id)!;
        user.muted = muted;
        room.set(socket.id, user);
      }
      socket.to(roomId).emit('user-mute-changed', {
        socketId: socket.id,
        muted
      });
    });

    // Отключение от комнаты
    socket.on('leave-room', (data: { roomId: string }) => {
      const { roomId } = data;
      const room = roomUsers.get(roomId);
      
      if (room) {
        room.delete(socket.id);
        if (room.size === 0) {
          roomUsers.delete(roomId);
        }
      }

      socket.leave(roomId);
      socket.to(roomId).emit('user-left', {
        socketId: socket.id
      });

      console.log(`User left room ${roomId}, remaining users: ${room?.size || 0}`);
    });

    // Обработка отключения
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      
      // Удаляем пользователя из всех комнат
      for (const [roomId, room] of roomUsers.entries()) {
        if (room.has(socket.id)) {
          room.delete(socket.id);
          if (room.size === 0) {
            roomUsers.delete(roomId);
          }
          socket.to(roomId).emit('user-left', {
            socketId: socket.id
          });
          console.log(`User ${socket.id} removed from room ${roomId}, remaining: ${room.size}`);
        }
      }
    });
  });
}

// Функция для уведомления об удалении события
export function notifyEventDeleted(io: SocketIOServer, roomId: string) {
  io.to(roomId).emit('event-deleted', { roomId });
}
