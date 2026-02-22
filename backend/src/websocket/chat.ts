import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../db/prisma';

export function setupChatSocket(io: SocketIOServer) {
  io.on('connection', (socket) => {
    // Присоединение к комнате чата
    socket.on('join-chat-room', async (data: { roomId: string; userId: string }) => {
      const { roomId, userId } = data;
      
      if (!roomId || !userId) {
        return;
      }

        // Проверяем доступ к комнате
        try {
          const room = await prisma.chatRoom.findUnique({
            where: { id: roomId },
            select: { psychologistId: true, clientId: true }
          });

          if (!room) {
            return;
          }

          // Проверяем доступ: психолог комнаты
          if (room.psychologistId === userId) {
            socket.join(`chat-room-${roomId}`);
            return;
          }

          // Проверяем, является ли пользователь клиентом этой комнаты
          if (!room.clientId) {
            return;
          }

          const client = await prisma.client.findUnique({
            where: { id: room.clientId },
            select: { email: true }
          });

          if (client && client.email) {
            const user = await prisma.user.findFirst({
              where: { 
                id: userId,
                email: client.email
              }
            });

            if (user) {
              socket.join(`chat-room-${roomId}`);
            }
          }
        } catch (error) {
          // Игнорируем ошибки
        }
    });

    // Отключение от комнаты
    socket.on('leave-chat-room', (data: { roomId: string }) => {
      if (data.roomId) {
        socket.leave(`chat-room-${data.roomId}`);
      }
    });

    socket.on('disconnect', () => {
      // Очистка при отключении
    });
  });
}

