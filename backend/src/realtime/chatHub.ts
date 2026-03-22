import type { Server as SocketIOServer } from 'socket.io';

let ioRef: SocketIOServer | null = null;

export function setChatIo(io: SocketIOServer) {
  ioRef = io;
}

export type ChatMessagePayload = {
  id: string;
  roomId: string;
  authorId: string;
  content: string;
  createdAt: string;
};

export function emitChatNewMessage(roomId: string, message: ChatMessagePayload) {
  ioRef?.to(`chat:${roomId}`).emit('chat:message', message);
}
