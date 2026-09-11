import { prisma } from '../db/prisma';
import { getClientVisibleChatRoomIds, userCanAccessChatRoom } from '../utils/chatAccess';
import { isUserOnline } from '../realtime/chatHub';

function extractRoomIdFromDescription(description: string | null | undefined): string | null {
  const match = String(description || '').match(/\[chatRoomId:([^\]]+)\]/);
  return match?.[1] || null;
}

export type VisibleRoom = {
  id: string;
  name: string | null;
  createdAt: Date;
  displayName: string;
  peerUserId: string | null;
  peerClientId: string | null;
  peerAvatarUrl: string | null;
  lastMessage: {
    id: string;
    content: string;
    authorId: string;
    createdAt: string;
    readAt: string | null;
  } | null;
  unreadCount: number;
  peerOnline: boolean;
};

export async function getVisibleRoomsForUser(user: { id: string; email: string; role: string }) {
  if (user.role === 'psychologist' || user.role === 'admin') {
    const attachedClients = await prisma.client.findMany({
      where: { psychologistId: user.id },
      select: { id: true, name: true, email: true }
    });
    const attachedClientNames = attachedClients.map((c) => c.name).filter(Boolean);
    const clientByName = new Map(attachedClients.map((c) => [c.name.trim().toLowerCase(), c]));

    const requestItems = await prisma.supportRequest.findMany({
      where: { psychologistId: user.id, clientId: { not: null } },
      select: {
        description: true,
        client: { select: { id: true, name: true, email: true } }
      }
    });

    const requestRoomIdToClient = new Map<
      string,
      { id: string | null; name: string; email: string | null; avatarUrl: string | null }
    >();
    for (const req of requestItems) {
      const roomId = extractRoomIdFromDescription(req.description);
      if (roomId) {
        requestRoomIdToClient.set(roomId, {
          id: req.client?.id || null,
          name: req.client?.name || 'Клиент',
          email: req.client?.email || null,
          avatarUrl: null
        });
      }
    }

    const requestRoomIds = Array.from(requestRoomIdToClient.keys());
    const roomWhere =
      attachedClientNames.length > 0 || requestRoomIds.length > 0
        ? {
            OR: [
              ...(attachedClientNames.length > 0 ? [{ name: { in: attachedClientNames } }] : []),
              ...(requestRoomIds.length > 0 ? [{ id: { in: requestRoomIds } }] : [])
            ]
          }
        : null;

    const rooms = roomWhere
      ? await prisma.chatRoom.findMany({ where: roomWhere as any, orderBy: { createdAt: 'desc' } })
      : [];

    return rooms.map((room) => {
      const fromRequest = requestRoomIdToClient.get(room.id);
      const fromAttached = room.name ? clientByName.get(room.name.trim().toLowerCase()) : undefined;
      const peerMeta = fromRequest || (fromAttached
        ? {
            id: fromAttached.id,
            name: fromAttached.name,
            email: fromAttached.email,
            avatarUrl: null as string | null
          }
        : null);
      return {
        ...room,
        displayName: peerMeta?.name || room.name || 'Чат',
        peerEmail: peerMeta?.email || null,
        peerAvatarUrl: peerMeta?.avatarUrl || null,
        peerClientId: peerMeta?.id || null
      };
    });
  }

  if (user.role === 'client') {
    const visibleIds = new Set<string>(await getClientVisibleChatRoomIds(user.id, user.email));
    const client = await prisma.client.findFirst({
      where: { email: user.email },
      select: { id: true, name: true, psychologistId: true }
    });

    const requestItems = client
      ? await prisma.supportRequest.findMany({
          where: { clientId: client.id },
          select: { description: true, psychologistId: true }
        })
      : [];

    const psychologistIds = Array.from(
      new Set(
        [
          ...requestItems.map((r) => r.psychologistId).filter(Boolean),
          client?.psychologistId && !String(client.psychologistId).startsWith('temp-')
            ? client.psychologistId
            : null
        ].filter(Boolean) as string[]
      )
    );
    const psychologists = psychologistIds.length
      ? await prisma.user.findMany({
          where: { id: { in: psychologistIds } },
          select: { id: true, email: true }
        })
      : [];
    const profiles = psychologistIds.length
      ? await prisma.profile.findMany({
          where: { userId: { in: psychologistIds } },
          select: { userId: true, name: true, avatarUrl: true }
        })
      : [];
    const profileByUser = new Map(profiles.map((p) => [p.userId, p]));
    const psychById = new Map(
      psychologists.map((p) => {
        const profile = profileByUser.get(p.id);
        return [
          p.id,
          {
            id: p.id,
            name: profile?.name || p.email?.split('@')[0] || 'Психолог',
            avatarUrl: profile?.avatarUrl || null
          }
        ] as const;
      })
    );

    const requestRoomIdToPsych = new Map<string, { id: string; name: string; avatarUrl: string | null }>();
    for (const req of requestItems) {
      const roomId = extractRoomIdFromDescription(req.description);
      if (!roomId) continue;
      visibleIds.add(roomId);
      const psych = psychById.get(req.psychologistId);
      if (psych) requestRoomIdToPsych.set(roomId, psych);
    }

    const attachedPsych =
      client?.psychologistId && !String(client.psychologistId).startsWith('temp-')
        ? psychById.get(client.psychologistId) || null
        : null;
    const clientNameKey = client?.name?.trim().toLowerCase() || '';

    const roomIds = Array.from(visibleIds);
    const rooms =
      roomIds.length > 0
        ? await prisma.chatRoom.findMany({
            where: { id: { in: roomIds } },
            orderBy: { createdAt: 'desc' }
          })
        : [];

    return rooms.map((room) => {
      const roomNameKey = (room.name || '').trim().toLowerCase();
      // Комната психолога↔клиента обычно названа именем клиента — для клиента это не заголовок.
      const isSelfNamedRoom = Boolean(clientNameKey && roomNameKey === clientNameKey);
      const psych = requestRoomIdToPsych.get(room.id) || attachedPsych;
      const fallbackTitle = isSelfNamedRoom ? 'Психолог' : room.name || 'Чат';
      return {
        ...room,
        displayName: psych?.name || fallbackTitle,
        peerUserId: psych?.id || null,
        peerClientId: null as string | null,
        peerAvatarUrl: psych?.avatarUrl || null,
        peerEmail: null as string | null
      };
    });
  }

  const rooms = await prisma.chatRoom.findMany({ orderBy: { createdAt: 'desc' } });
  return rooms.map((room) => ({
    ...room,
    displayName: room.name || 'Чат',
    peerUserId: null as string | null,
    peerClientId: null as string | null,
    peerAvatarUrl: null as string | null,
    peerEmail: null as string | null
  }));
}

async function resolvePeerUserId(
  room: { peerUserId?: string | null; peerEmail?: string | null },
  selfId: string
): Promise<string | null> {
  if (room.peerUserId) return room.peerUserId;
  if (room.peerEmail) {
    const u = await prisma.user.findFirst({
      where: { email: room.peerEmail },
      select: { id: true }
    });
    if (u) return u.id;
  }
  const other = await prisma.chatMessage.findFirst({
    where: { roomId: (room as any).id, authorId: { not: selfId } },
    select: { authorId: true },
    orderBy: { createdAt: 'desc' }
  });
  return other?.authorId || null;
}

export async function getUnreadSummary(userId: string, role: string, email: string) {
  const rooms = await getVisibleRoomsForUser({ id: userId, email, role });
  const reads = await prisma.chatRoomRead.findMany({
    where: { userId, roomId: { in: rooms.map((r) => r.id) } }
  });
  const readMap = new Map(reads.map((r) => [r.roomId, r.lastReadAt]));

  const byRoom: Record<string, number> = {};
  let total = 0;

  for (const room of rooms) {
    const lastRead = readMap.get(room.id);
    const count = await prisma.chatMessage.count({
      where: {
        roomId: room.id,
        authorId: { not: userId },
        ...(lastRead ? { createdAt: { gt: lastRead } } : {})
      }
    });
    // If never opened: count all messages from others (server-truth unread)
    byRoom[room.id] = count;
    total += count;
  }

  return { total, byRoom };
}

export async function markRoomRead(userId: string, roomId: string) {
  const now = new Date();
  await prisma.chatRoomRead.upsert({
    where: { userId_roomId: { userId, roomId } },
    create: { userId, roomId, lastReadAt: now },
    update: { lastReadAt: now }
  });

  // Only mark peer messages as read — author's re-open must not flip own ✓ → ✓✓
  const updated = await prisma.chatMessage.updateMany({
    where: {
      roomId,
      authorId: { not: userId },
      readAt: null
    },
    data: { readAt: now }
  });

  const messages = await prisma.chatMessage.findMany({
    where: { roomId, authorId: { not: userId }, readAt: now },
    select: { id: true }
  });

  return {
    readAt: now.toISOString(),
    messageIds: messages.map((m) => m.id),
    updatedCount: updated.count
  };
}

export async function enrichRoomsForClient(
  user: { id: string; email: string; role: string }
): Promise<VisibleRoom[]> {
  const rooms = await getVisibleRoomsForUser(user);
  const unread = await getUnreadSummary(user.id, user.role, user.email);

  const enriched: VisibleRoom[] = [];
  for (const room of rooms) {
    const last = await prisma.chatMessage.findFirst({
      where: { roomId: room.id },
      orderBy: { createdAt: 'desc' }
    });
    const peerUserId = await resolvePeerUserId(room as any, user.id);
    enriched.push({
      id: room.id,
      name: room.name,
      createdAt: room.createdAt,
      displayName: (room as any).displayName || room.name || 'Чат',
      peerUserId,
      peerClientId: (room as any).peerClientId || null,
      peerAvatarUrl: (room as any).peerAvatarUrl || null,
      lastMessage: last
        ? {
            id: last.id,
            content: last.content,
            authorId: last.authorId,
            createdAt: last.createdAt.toISOString(),
            readAt: last.readAt ? last.readAt.toISOString() : null
          }
        : null,
      unreadCount: unread.byRoom[room.id] || 0,
      peerOnline: peerUserId ? isUserOnline(peerUserId) : false
    });
  }

  enriched.sort((a, b) => {
    const at = a.lastMessage?.createdAt || a.createdAt.toISOString();
    const bt = b.lastMessage?.createdAt || b.createdAt.toISOString();
    return bt.localeCompare(at);
  });

  return enriched;
}

export async function createChatMessage(params: {
  roomId: string;
  authorId: string;
  content: string;
}) {
  const content = params.content.trim();
  if (!content) throw new Error('Message content is required');
  const m = await prisma.chatMessage.create({
    data: {
      roomId: params.roomId,
      authorId: params.authorId,
      content
    }
  });
  return {
    id: m.id,
    roomId: m.roomId,
    authorId: m.authorId,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
    readAt: null as string | null
  };
}

/** One room per pair (by room name = client display name for psychologist chats). */
export async function findOrCreateChatRoom(
  user: { id: string; email: string; role: string },
  name: string
): Promise<{ room: { id: string; name: string | null; createdAt: Date }; created: boolean }> {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Name is required');
  const key = trimmed.toLowerCase();

  const visible = await getVisibleRoomsForUser(user);
  const existingVisible = visible.find((r) => {
    const n = (r.name || '').trim().toLowerCase();
    const d = String((r as any).displayName || '')
      .trim()
      .toLowerCase();
    return n === key || d === key;
  });
  if (existingVisible) {
    return {
      room: { id: existingVisible.id, name: existingVisible.name, createdAt: existingVisible.createdAt },
      created: false
    };
  }

  const candidates = await prisma.chatRoom.findMany({
    where: { name: { not: null } },
    orderBy: { createdAt: 'asc' }
  });
  for (const r of candidates) {
    if ((r.name || '').trim().toLowerCase() !== key) continue;
    if (await userCanAccessChatRoom(user as any, r.id)) {
      return { room: r, created: false };
    }
  }

  const room = await prisma.chatRoom.create({ data: { name: trimmed } });
  return { room, created: true };
}
