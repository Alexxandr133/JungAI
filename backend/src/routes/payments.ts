import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.get('/payments/plans', (_req, res) => {
  res.json({ plans: [
    { id: 'free', name: 'Free', price: 0 },
    { id: 'pro', name: 'Pro Psychologist', price: 29 },
    { id: 'research', name: 'Research Suite', price: 49 }
  ] });
});

router.post('/payments/subscribe', requireAuth, requireRole(['psychologist', 'researcher', 'admin']), (req, res) => {
  const { planId } = req.body ?? {};
  res.json({ status: 'subscribed', planId });
});

export default router;
