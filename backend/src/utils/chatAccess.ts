import { prisma } from '../db/prisma';
import type { JwtUser } from '../middleware/auth';

function extractRoomIdFromDescription(description: string | null | undefined): string | null {
  const match = String(description || '').match(/\[chatRoomId:([^\]]+)\]/);
  return match?.[1] || null;
}

/** Проверка доступа к комнате: психолог — по списку своих клиентов (имя = name комнаты); клиент — по CRM-записи или истории сообщений */
export async function userCanAccessChatRoom(user: JwtUser, roomId: string): Promise<boolean> {
  const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
  if (!room) return false;
  const roomName = (room.name ?? '').trim();

  if (user.role === 'admin') return true;

  if (user.role === 'psychologist') {
    const attachedClientMatch = await prisma.client.findFirst({
      where: { psychologistId: user.id, name: roomName }
    });
    if (attachedClientMatch) return true;

    // Доступ к чатам по входящим клиентским заявкам, даже если клиент еще не прикреплен.
    const requests = await prisma.supportRequest.findMany({
      where: { psychologistId: user.id, clientId: { not: null } },
      select: { description: true }
    });
    return requests.some(r => extractRoomIdFromDescription(r.description) === roomId);
  }

  if (user.role === 'client') {
    const client = await prisma.client.findFirst({ where: { email: user.email } });
    if (client && roomName && client.name.trim() === roomName) return true;

    // Доступ к чатам, созданным по заявке клиента конкретному психологу.
    if (client) {
      const requests = await prisma.supportRequest.findMany({
        where: { clientId: client.id },
        select: { description: true }
      });
      if (requests.some(r => extractRoomIdFromDescription(r.description) === roomId)) {
        return true;
      }
    }

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

  if (client) {
    const requests = await prisma.supportRequest.findMany({
      where: { clientId: client.id },
      select: { description: true }
    });
    for (const request of requests) {
      const roomId = extractRoomIdFromDescription(request.description);
      if (roomId) ids.add(roomId);
    }
  }

  return [...ids];
}
