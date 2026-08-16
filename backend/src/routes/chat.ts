import { Router } from 'express';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';
import { userCanAccessChatRoom } from '../utils/chatAccess';
import { emitChatNewMessage, emitUnreadToUser } from '../realtime/chatHub';
import {
  createChatMessage,
  enrichRoomsForClient,
  findOrCreateChatRoom,
  getUnreadSummary,
  markRoomRead
} from '../services/chatService';

const router = Router();

router.get('/chat/rooms', requireAuth, requireRole(['client', 'psychologist', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const items = await enrichRoomsForClient(req.user!);
    res.json({ items });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get rooms' });
  }
});

router.post('/chat/rooms', requireAuth, requireRole(['client', 'psychologist', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const { name } = req.body ?? {};
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) return res.status(400).json({ error: 'Name is required' });
    const { room, created } = await findOrCreateChatRoom(req.user!, trimmed);
    res.status(created ? 201 : 200).json({ ...room, created });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create room' });
  }
});

router.get('/chat/rooms/:id/messages', requireAuth, requireRole(['client', 'psychologist', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const allowed = await userCanAccessChatRoom(req.user!, id);
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });
    const items = await prisma.chatMessage.findMany({
      where: { roomId: id },
      orderBy: { createdAt: 'asc' }
    });
    type ChatMsgRow = {
      id: string;
      roomId: string;
      authorId: string;
      content: string;
      createdAt: Date;
      readAt: Date | null;
    };
    res.json({
      items: (items as ChatMsgRow[]).map((m) => ({
        id: m.id,
        roomId: m.roomId,
        authorId: m.authorId,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
        readAt: m.readAt ? m.readAt.toISOString() : null
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get messages' });
  }
});

router.post('/chat/rooms/:id/messages', requireAuth, requireRole(['client', 'psychologist', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body ?? {};

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const allowed = await userCanAccessChatRoom(req.user!, id);
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const payload = await createChatMessage({
      roomId: id,
      authorId: req.user!.id,
      content
    });
    emitChatNewMessage(id, payload);
    res.status(201).json(payload);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

router.delete('/chat/rooms/:id', requireAuth, requireRole(['client', 'psychologist', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const allowed = await userCanAccessChatRoom(req.user!, id);
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });

    await prisma.chatMessage.deleteMany({ where: { roomId: id } });
    await prisma.$executeRaw`DELETE FROM "ChatRoomRead" WHERE "roomId" = ${id}`;
    await prisma.chatRoom.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete room' });
  }
});

router.post('/chat/rooms/:id/read', requireAuth, requireRole(['client', 'psychologist', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const allowed = await userCanAccessChatRoom(req.user!, id);
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });
    const result = await markRoomRead(req.user!.id, id);
    const summary = await getUnreadSummary(req.user!.id, req.user!.role, req.user!.email);
    emitUnreadToUser(req.user!.id, summary);
    res.json({ success: true, ...result, unread: summary });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to mark as read' });
  }
});

router.get('/chat/unread-count', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const summary = await getUnreadSummary(req.user!.id, req.user!.role, req.user!.email);
    res.json({ unreadCount: summary.total, byRoom: summary.byRoom });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get unread count' });
  }
});

export default router;
