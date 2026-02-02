import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../db/prisma';

export type UserRole = 'psychologist' | 'client' | 'researcher' | 'admin' | 'guest';

export interface JwtUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthedRequest extends Request {
  user?: JwtUser;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtUser;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRole(roles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// Проверка верификации для психологов (кроме админов)
export async function requireVerification(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  // Админы всегда имеют доступ
  if (req.user.role === 'admin') {
    return next();
  }
  
  // Для психологов проверяем верификацию
  if (req.user.role === 'psychologist') {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { isVerified: true }
      });
      
      if (!user || !user.isVerified) {
        return res.status(403).json({ 
          error: 'Verification required',
          message: 'Для доступа к этому функционалу необходимо пройти верификацию администратором'
        });
      }
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to check verification' });
    }
  }
  
  next();
}
