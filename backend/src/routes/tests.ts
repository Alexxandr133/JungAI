import { Router } from 'express';
import { requireAuth, requireRole, requireVerification, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';

const router = Router();

// Сохранить результат теста
router.post('/tests/results', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { testType, result, clientId } = req.body ?? {};
    
    if (!testType || !result) {
      return res.status(400).json({ error: 'testType and result are required' });
    }

    let finalClientId = clientId;
    
    // Если клиент сохраняет свой тест
    if (!finalClientId && req.user!.role === 'client') {
      const client = await (prisma as any).client.findFirst({
        where: { email: req.user!.email }
      });
      if (client) {
        finalClientId = client.id;
      }
    }
    
    // Если психолог сохраняет тест для клиента
    if (finalClientId && (req.user!.role === 'psychologist' || req.user!.role === 'admin')) {
      const client = await (prisma as any).client.findUnique({
        where: { id: finalClientId }
      });
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }
      if (req.user!.role !== 'admin' && client.psychologistId !== req.user!.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    if (!finalClientId) {
      return res.status(400).json({ error: 'clientId is required' });
    }

    const testResult = await (prisma as any).testResult.create({
      data: {
        clientId: finalClientId,
        testType,
        result: typeof result === 'string' ? JSON.parse(result) : result
      }
    });

    res.status(201).json(testResult);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to save test result' });
  }
});

// Получить результаты тестов клиента
router.get('/tests/results/:clientId', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const clientId = req.params.clientId;
    
    const client = await (prisma as any).client.findUnique({
      where: { id: clientId }
    });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (req.user!.role !== 'admin' && client.psychologistId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const results = await (prisma as any).testResult.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ items: results });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get test results' });
  }
});

// Получить свои результаты тестов (для клиента)
router.get('/tests/my-results', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const client = await (prisma as any).client.findFirst({
      where: { email: req.user!.email }
    });
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const results = await (prisma as any).testResult.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ items: results });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get test results' });
  }
});

export default router;

