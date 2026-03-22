import { prisma } from '../db/prisma';
import type { JwtUser } from '../middleware/auth';

/** Проверка доступа к комнате: психолог — по списку своих клиентов (имя = name комнаты); клиент — по CRM-записи или истории сообщений */
export async function userCanAccessChatRoom(user: JwtUser, roomId: string): Promise<boolean> {
  const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
  if (!room) return false;
  const roomName = (room.name ?? '').trim();
  if (!roomName) return false;

  if (user.role === 'admin') return true;

  if (user.role === 'psychologist') {
    const match = await prisma.client.findFirst({
      where: { psychologistId: user.id, name: roomName }
    });
    return !!match;
  }

  if (user.role === 'client') {
    const client = await prisma.client.findFirst({ where: { email: user.email } });
    if (client && client.name.trim() === roomName) return true;
    const ownMessage = await prisma.chatMessage.findFirst({
      where: { roomId, authorId: user.id }
    });
    return !!ownMessage;
  }

  return false;
}

/** ID комнат, доступных клиенту: где он писал + все комнаты с name = его Client.name */
export async function getClientVisibleChatRoomIds(userId: string, userEmail: string): Promise<string[]> {
  const ids = new Set<string>();

  const fromMessages = await prisma.chatMessage.findMany({
    where: { authorId: userId },
    select: { roomId: true },
    distinct: ['roomId']
  });
  for (const m of fromMessages) ids.add(m.roomId);

  const client = await prisma.client.findFirst({ where: { email: userEmail } });
  if (client?.name) {
    const byName = await prisma.chatRoom.findMany({
      where: { name: client.name },
      select: { id: true }
    });
    for (const r of byName) ids.add(r.id);
  }

  return [...ids];
}
