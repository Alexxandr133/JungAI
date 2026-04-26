import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { requireAuth, type AuthedRequest, type UserRole } from '../middleware/auth';
import { prisma } from '../db/prisma';
import { sendEmailVerificationCode, sendPasswordResetCode } from '../utils/email';

const router = Router();

const bcrypt = require('bcryptjs');
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TRUSTED_EMAIL_DOMAINS = ['example.com', 'jung-ai.ru', 'demo.jung'];

function makeSixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeCode(input: string): string {
  return String(input || '').replace(/\D/g, '').slice(0, 6);
}

function formatCodeForHuman(code: string): string {
  const digits = normalizeCode(code);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}`;
}

function verificationExpiryDate(): Date {
  return new Date(Date.now() + 15 * 60 * 1000);
}

function isTrustedEmailDomain(email: string): boolean {
  const domain = String(email || '').trim().toLowerCase().split('@')[1] || '';
  return (
    domain === 'example.com' ||
    domain === 'jung-ai.ru' ||
    domain === 'demo.jung' ||
    domain.endsWith('.jung-ai.ru') ||
    domain.endsWith('.demo.jung') ||
    domain.includes('jung-ai')
  );
}

function parseStoredEmailChange(raw: string | null | undefined): { code: string; pendingEmail: string | null } {
  const value = String(raw || '').trim();
  if (!value) return { code: '', pendingEmail: null };
  const parts = value.split('|');
  if (parts.length >= 2) {
    return { code: normalizeCode(parts[0]), pendingEmail: String(parts.slice(1).join('|') || '').trim().toLowerCase() || null };
  }
  return { code: normalizeCode(value), pendingEmail: null };
}

type DemoUser = {
  id: string;
  email: string;
  password: string; // плейнтекст для демо
  role: UserRole;
};

const demoUsers: DemoUser[] = [
  { id: 'u1', email: 'psy@example.com', password: 'demo', role: 'psychologist' },
  { id: 'u2', email: 'client@example.com', password: 'demo', role: 'client' },
  { id: 'u3', email: 'res@example.com', password: 'demo', role: 'researcher' },
  { id: 'admin', email: 'admin@example.com', password: 'demo', role: 'admin' }
];

router.post('/auth/login', async (req, res) => {
  const { username, password, email } = req.body ?? {};
  const rawLogin = username || email;
  // Логин без учёта регистра; пробелы по краям не учитываем.
  const login = String(rawLogin ?? '')
    .trim()
    .toLowerCase();
  // Пароль с учётом регистра; ведущие пробелы не считаются частью пароля.
  const passwordNorm = String(password ?? '').replace(/^\s+/, '');

  if (!login || passwordNorm === '') {
    return res.status(400).json({ error: 'Логин и пароль обязательны' });
  }

  // Проверяем тестовые аккаунты (только если они уже существуют в БД)
  const demoUser = demoUsers.find(u => u.email === login && u.password === passwordNorm);
  if (demoUser) {
    // Ищем пользователя в БД, не создаем автоматически
    const existingUser = await (prisma as any).user.findUnique({
      where: { id: demoUser.id }
    });
    
    if (existingUser) {
      const token = jwt.sign({ id: existingUser.id, email: existingUser.email, role: existingUser.role }, config.jwtSecret, { expiresIn: '30d' });
      return res.json({ token, user: { id: existingUser.id, email: existingUser.email, role: existingUser.role } });
    }
    // Если тестовый аккаунт не найден, продолжаем обычную проверку
  }

  // Ищем пользователя в БД по email
  // Если login не содержит @, ищем по email, который начинается с login@
  let user = null as any;
  if (login.includes('@')) {
    user = await (prisma as any).user.findFirst({
      where: { email: login },
      orderBy: { createdAt: 'desc' }
    });
    if (!user) return res.status(401).json({ error: 'Неверный логин или пароль' });
    const isValidPassword =
      bcrypt.compareSync(passwordNorm, user.password) || user.password === passwordNorm;
    if (!isValidPassword) return res.status(401).json({ error: 'Неверный логин или пароль' });
  } else {
    // Ищем по email, который может быть в формате username@jungai.local
    user = await (prisma as any).user.findFirst({
      where: {
        OR: [
          { email: login },
          { email: { startsWith: `${login}@` } }
        ]
      }
    });
  }

  if (!user) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  if (!login.includes('@')) {
    const isValidPassword =
      bcrypt.compareSync(passwordNorm, user.password) || user.password === passwordNorm;
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }
  }

  if (!user.emailVerified && !isTrustedEmailDomain(user.email)) {
    return res.status(403).json({
      error: 'Почта не подтверждена. Подтвердите email перед входом.',
      code: 'EMAIL_NOT_VERIFIED'
    });
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, config.jwtSecret, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, emailVerified: Boolean(user.emailVerified) } });
});

router.get('/auth/demo', async (_req, res) => {
  // Создаём всех демо-пользователей в базе данных
  for (const user of demoUsers) {
    await (prisma as any).user.upsert({
      where: { id: user.id },
      update: {
        email: user.email,
        role: user.role,
        password: user.password
      },
      create: {
        id: user.id,
        email: user.email,
        role: user.role,
        password: user.password
      }
    });
  }
  
  const tokens = demoUsers.reduce((acc, u) => {
    acc[u.role] = jwt.sign({ id: u.id, email: u.email, role: u.role }, config.jwtSecret, { expiresIn: '12h' });
    return acc;
  }, {} as Record<UserRole, string>);
  res.json(tokens);
});

router.get('/auth/me', async (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const me = jwt.verify(token, config.jwtSecret) as { id: string; email: string; role: string };
    
    // Создаём или обновляем пользователя в базе данных, если его нет
    const demoUser = demoUsers.find(u => u.id === me.id);
    if (demoUser) {
      await (prisma as any).user.upsert({
        where: { id: me.id },
        update: {
          email: me.email,
          role: me.role as UserRole,
          password: demoUser.password
        },
        create: {
          id: me.id,
          email: me.email,
          role: me.role as UserRole,
          password: demoUser.password
        }
      });
    }
    
    // Получаем информацию о пользователе из БД, включая isVerified
    const user = await (prisma as any).user.findUnique({
      where: { id: me.id },
      select: { id: true, email: true, role: true, isVerified: true, emailVerified: true }
    });
    
    // Возвращаем информацию о пользователе
    if (user) {
      return res.json({ 
        id: user.id, 
        email: user.email, 
        role: user.role,
        isVerified: user.isVerified,
        emailVerified: Boolean((user as any).emailVerified)
      });
    }
    
    // Если пользователь не найден в БД, возвращаем данные из токена (для демо-пользователей)
    // Для психологов по умолчанию не верифицирован
    return res.json({ 
      id: me.id, 
      email: me.email, 
      role: me.role,
      isVerified: me.role === 'admin' ? true : false,
      emailVerified: true
    });
    
    // Автоматически создаём связь клиента с демо-психологом
    if (me.role === 'client' && me.id === 'u2') {
      // Проверяем, есть ли уже Client запись для этого демо-клиента
      const existingClient = await prisma.client.findFirst({
        where: { email: me.email }
      });
      
      if (!existingClient) {
        // Создаём Client запись, связанную с демо-психологом (u1)
        const client = await prisma.client.create({
          data: {
            name: 'Демо Клиент',
            email: me.email,
            phone: '+7 900 000-00-00',
            psychologistId: 'u1' // ID демо-психолога
          }
        });
        
        // Создаём несколько демо-снов для клиента
        const demoDreams = [
          {
            title: 'Лечу над горящим городом',
            content: 'Город в огне, но нет страха. Чувство свободы и силы. Я парю высоко над пламенем, вижу всё сверху.',
            symbols: ['огонь', 'полёт', 'город', 'свобода'],
            userId: me.id
          },
          {
            title: 'Красная дверь и коридор',
            content: 'Длинный коридор, красная дверь слева, за ней слышу звук воды. Хочу открыть, но что-то удерживает.',
            symbols: ['дверь', 'вода', 'коридор', 'красный'],
            userId: me.id
          },
          {
            title: 'Темный лес и зеркало',
            content: 'Иду по лесу и вижу зеркало, в котором другой я. Он смотрит на меня с улыбкой, но я чувствую тревогу.',
            symbols: ['лес', 'зеркало', 'тень', 'двойник'],
            userId: me.id
          }
        ];
        
        // Проверяем, есть ли уже сны у этого клиента
        const existingDreams = await prisma.dream.findMany({
          where: { userId: me.id }
        });
        
        if (existingDreams.length === 0) {
          await prisma.dream.createMany({
            data: demoDreams
          });
        }
      }
    }
    
    res.json(me);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Регистрация клиента по токену
router.post('/auth/register-client', async (req, res) => {
  try {
    const { token, password, name, email, phone, age, gender, username } = req.body ?? {};
    
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }
    
    if (!username || username.length < 3) {
      return res.status(400).json({ error: 'Логин обязателен и должен содержать минимум 3 символа' });
    }
    
    // Находим клиента по токену
    const client = await prisma.client.findUnique({
      where: { registrationToken: token },
      include: { dreams: true, journalEntries: true, therapySessions: true }
    });
    
    if (!client) {
      return res.status(404).json({ error: 'Invalid or expired registration token' });
    }
    
    // Проверяем срок действия токена
    if (client.tokenExpiresAt && new Date() > client.tokenExpiresAt) {
      return res.status(400).json({ error: 'Registration token has expired' });
    }
    
    const userEmail = String(email ?? '').trim().toLowerCase();
    if (!EMAIL_REGEX.test(userEmail)) {
      return res.status(400).json({ error: 'Укажите реальную почту для регистрации' });
    }
    
    // Проверяем, не зарегистрирован ли уже клиент
    const existingUsersCount = await (prisma as any).user.count({
      where: { email: userEmail }
    });
    
    if (existingUsersCount >= 1) {
      return res.status(400).json({ error: 'На один email можно создать только 1 аккаунт' });
    }
    
    // Хешируем пароль
    const bcrypt = require('bcryptjs');
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    // Создаём пользователя
    const trustedEmail = isTrustedEmailDomain(userEmail);
    const user = await (prisma as any).user.create({
      data: {
        email: userEmail,
        password: hashedPassword,
        role: 'client',
        emailVerified: trustedEmail,
        emailVerificationCode: trustedEmail ? null : makeSixDigitCode(),
        emailVerificationExpiresAt: trustedEmail ? null : verificationExpiryDate()
      }
    });
    
    // Обновляем клиента: очищаем токен и обновляем данные
    await prisma.client.update({
      where: { id: client.id },
      data: {
        registrationToken: null,
        tokenExpiresAt: null,
        name: name || client.name,
        email: userEmail,
        phone: phone || client.phone
      }
    });
    
    // Создаём профиль клиента
    await prisma.profile.upsert({
      where: { userId: user.id },
      update: {
        name: name || client.name,
        phone: phone || client.phone,
        age: age ? parseInt(age) : null,
        gender: gender || null
      },
      create: {
        userId: user.id,
        name: name || client.name,
        phone: phone || client.phone,
        age: age ? parseInt(age) : null,
        gender: gender || null,
        interests: []
      }
    });
    
    if (!trustedEmail) {
      await sendEmailVerificationCode(userEmail, formatCodeForHuman(user.emailVerificationCode!));
      return res.json({
        requiresEmailVerification: true,
        email: userEmail,
        client: {
          id: client.id,
          name: client.name,
          email: userEmail
        }
      });
    }

    const jwtToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: '30d' }
    );
    res.json({
      token: jwtToken,
      user: { id: user.id, email: user.email, role: user.role },
      requiresEmailVerification: false,
      email: userEmail,
      client: {
        id: client.id,
        name: client.name,
        email: userEmail
      }
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message || 'Failed to register client' });
  }
});

// Регистрация нового пользователя
router.post('/auth/register', async (req, res) => {
  try {
    const { email, password, role, name } = req.body ?? {};
    const normalizedEmail = String(email ?? '').trim().toLowerCase();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Укажите корректный email' });
    }
    
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
    }
    
    if (!role || !['psychologist', 'researcher', 'client'].includes(role)) {
      return res.status(400).json({ error: 'Неверная роль. Доступны: psychologist, researcher, client' });
    }
    
    const existingUsersCount = await (prisma as any).user.count({
      where: { email: normalizedEmail }
    });
    
    if (existingUsersCount >= 1) {
      return res.status(400).json({ error: 'На один email можно создать только 1 аккаунт' });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    const trustedEmail = isTrustedEmailDomain(normalizedEmail);
    const verifyCode = trustedEmail ? null : makeSixDigitCode();
    const verifyExpiresAt = trustedEmail ? null : verificationExpiryDate();
    
    const user = await (prisma as any).user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        role: role as UserRole,
        emailVerified: trustedEmail,
        emailVerificationCode: verifyCode,
        emailVerificationExpiresAt: verifyExpiresAt
      }
    });
    
    if (role === 'client') {
      const existingClient = await prisma.client.findFirst({
        where: { email: normalizedEmail }
      });
      
      if (!existingClient) {
        const tempPsychologistId = 'temp-' + user.id;
        await prisma.client.create({
          data: {
            name: String(name || normalizedEmail.split('@')[0] || 'Клиент'),
            email: normalizedEmail,
            psychologistId: tempPsychologistId
          }
        });
      }
      
      await prisma.profile.upsert({
        where: { userId: user.id },
        update: {
          name: String(name || normalizedEmail.split('@')[0] || 'Клиент')
        },
        create: {
          userId: user.id,
          name: String(name || normalizedEmail.split('@')[0] || 'Клиент'),
          interests: []
        }
      });
    }

    if (!trustedEmail && verifyCode) {
      await sendEmailVerificationCode(normalizedEmail, formatCodeForHuman(verifyCode));
      return res.json({
        requiresEmailVerification: true,
        email: normalizedEmail,
        message: 'Код подтверждения отправлен на почту'
      });
    }

    const jwtToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: '30d' }
    );
    res.json({
      token: jwtToken,
      user: { id: user.id, email: user.email, role: user.role },
      requiresEmailVerification: false,
      email: normalizedEmail
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message || 'Failed to register' });
  }
});

// Проверка токена регистрации
router.get('/auth/check-registration-token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const client = await prisma.client.findUnique({
      where: { registrationToken: token },
      select: { id: true, name: true, email: true, tokenExpiresAt: true }
    });
    
    if (!client) {
      return res.status(404).json({ error: 'Invalid registration token' });
    }
    
    if (client.tokenExpiresAt && new Date() > client.tokenExpiresAt) {
      return res.status(400).json({ error: 'Registration token has expired' });
    }
    
    // Проверяем, не зарегистрирован ли уже
    const existingUser = await (prisma as any).user.findUnique({
      where: { email: client.email || '' }
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'Client already registered' });
    }
    
    res.json({
      valid: true,
      client: {
        name: client.name,
        email: client.email
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to check token' });
  }
});

router.post('/auth/verify-email', async (req, res) => {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const code = normalizeCode(String(req.body?.code ?? ''));
    if (!EMAIL_REGEX.test(email) || code.length !== 6) {
      return res.status(400).json({ error: 'Email и код обязательны' });
    }
    const user = await (prisma as any).user.findFirst({ where: { email } });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (user.emailVerified) {
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, config.jwtSecret, { expiresIn: '30d' });
      return res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
    }
    if (!user.emailVerificationCode || normalizeCode(user.emailVerificationCode) !== code) {
      return res.status(400).json({ error: 'Неверный код подтверждения' });
    }
    if (!user.emailVerificationExpiresAt || new Date() > user.emailVerificationExpiresAt) {
      return res.status(400).json({ error: 'Код истёк. Запросите новый код.' });
    }

    const updated = await (prisma as any).user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationCode: null,
        emailVerificationExpiresAt: null
      }
    });
    const token = jwt.sign({ id: updated.id, email: updated.email, role: updated.role }, config.jwtSecret, { expiresIn: '30d' });
    res.json({ token, user: { id: updated.id, email: updated.email, role: updated.role } });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to verify email' });
  }
});

router.post('/auth/resend-verification', async (req, res) => {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) return res.status(400).json({ error: 'Укажите корректный email' });
    const user = await (prisma as any).user.findFirst({ where: { email } });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (isTrustedEmailDomain(email)) {
      await (prisma as any).user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerificationCode: null,
          emailVerificationExpiresAt: null
        }
      });
      return res.json({ ok: true, message: 'Для этого домена подтверждение не требуется' });
    }
    if (user.emailVerified) return res.json({ ok: true, message: 'Почта уже подтверждена' });
    const code = makeSixDigitCode();
    await (prisma as any).user.update({
      where: { id: user.id },
      data: {
        emailVerificationCode: code,
        emailVerificationExpiresAt: verificationExpiryDate()
      }
    });
    await sendEmailVerificationCode(email, formatCodeForHuman(code));
    res.json({ ok: true, message: 'Новый код отправлен' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to resend verification code' });
  }
});

router.post('/auth/change-email/request', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const nextEmail = String(req.body?.email ?? '').trim().toLowerCase();
    if (!EMAIL_REGEX.test(nextEmail)) {
      return res.status(400).json({ error: 'Укажите корректный email' });
    }
    if (isTrustedEmailDomain(nextEmail)) {
      return res.status(400).json({ error: 'Укажите реальный email (не demo/example/jung)' });
    }

    const me = await (prisma as any).user.findUnique({ where: { id: userId } });
    if (!me) return res.status(404).json({ error: 'Пользователь не найден' });
    if (String(me.email).toLowerCase() === nextEmail) {
      return res.status(400).json({ error: 'Этот email уже установлен' });
    }

    const sameEmailCount = await (prisma as any).user.count({ where: { email: nextEmail } });
    if (sameEmailCount >= 1) {
      return res.status(400).json({ error: 'На один email можно создать только 1 аккаунт' });
    }

    const code = makeSixDigitCode();
    await (prisma as any).user.update({
      where: { id: userId },
      data: {
        emailVerificationCode: `${code}|${nextEmail}`,
        emailVerificationExpiresAt: verificationExpiryDate()
      }
    });
    await sendEmailVerificationCode(nextEmail, formatCodeForHuman(code));
    res.json({ ok: true, message: 'Код подтверждения отправлен на новую почту' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to request email change' });
  }
});

router.post('/auth/change-email/verify', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const code = normalizeCode(String(req.body?.code ?? ''));
    if (code.length !== 6) return res.status(400).json({ error: 'Введите код из 6 цифр' });

    const user = await (prisma as any).user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const stored = parseStoredEmailChange(user.emailVerificationCode);
    if (!stored.pendingEmail) {
      return res.status(400).json({ error: 'Запрос на смену email не найден. Запросите код заново.' });
    }
    if (stored.code !== code) return res.status(400).json({ error: 'Неверный код подтверждения' });
    if (!user.emailVerificationExpiresAt || new Date() > user.emailVerificationExpiresAt) {
      return res.status(400).json({ error: 'Код истёк. Запросите новый код.' });
    }

    const sameEmailCount = await (prisma as any).user.count({ where: { email: stored.pendingEmail } });
    if (sameEmailCount >= 1) {
      return res.status(400).json({ error: 'На один email можно создать только 1 аккаунт' });
    }

    const previousEmail = String(user.email).toLowerCase();
    const updated = await (prisma as any).user.update({
      where: { id: userId },
      data: {
        email: stored.pendingEmail,
        emailVerified: true,
        emailVerificationCode: null,
        emailVerificationExpiresAt: null
      }
    });

    if (updated.role === 'client') {
      await (prisma as any).client.updateMany({
        where: { email: previousEmail },
        data: { email: stored.pendingEmail }
      });
    }

    const token = jwt.sign({ id: updated.id, email: updated.email, role: updated.role }, config.jwtSecret, { expiresIn: '30d' });
    res.json({ ok: true, token, user: { id: updated.id, email: updated.email, role: updated.role } });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to verify email change' });
  }
});

router.post('/auth/forgot-password', async (req, res) => {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const userId = String(req.body?.userId ?? '').trim();
    if (!EMAIL_REGEX.test(email)) {
      return res.json({ ok: true, message: 'Если почта существует, выберите аккаунт', accounts: [] });
    }

    const users = await (prisma as any).user.findMany({
      where: { email },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, email: true, createdAt: true }
    });
    if (!users.length) {
      return res.json({ ok: true, message: 'Если почта существует, выберите аккаунт', accounts: [] });
    }

    const profiles = await (prisma as any).profile.findMany({
      where: { userId: { in: users.map((u: any) => u.id) } },
      select: { userId: true, name: true }
    });
    const profileByUserId = new Map((profiles || []).map((p: any) => [p.userId, p.name]));

    const accounts = users.map((u: any) => ({
      id: u.id,
      role: u.role,
      email: u.email,
      name: profileByUserId.get(u.id) || null,
      createdAt: new Date(u.createdAt).toISOString()
    }));

    // Шаг 1: пользователь ввел email — возвращаем список аккаунтов для выбора
    if (!userId) {
      return res.json({
        ok: true,
        message: 'Выберите аккаунт для восстановления',
        accounts
      });
    }

    // Шаг 2: пользователь выбрал аккаунт — отправляем код
    const user = users.find((u: any) => String(u.id) === userId);
    if (!user) {
      return res.status(400).json({ error: 'Выбранный аккаунт не найден для указанной почты' });
    }

    const code = makeSixDigitCode();
    await (prisma as any).user.update({
      where: { id: userId },
      data: {
        passwordResetCode: code,
        passwordResetExpiresAt: verificationExpiryDate()
      }
    });
    await sendPasswordResetCode(email, formatCodeForHuman(code));
    res.json({
      ok: true,
      message: 'Код отправлен на почту',
      account: accounts.find((a: any) => a.id === userId) || null
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to start password reset' });
  }
});

router.post('/auth/verify-reset-code', async (req, res) => {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const userId = String(req.body?.userId ?? '').trim();
    const code = normalizeCode(String(req.body?.code ?? ''));
    if (!EMAIL_REGEX.test(email) || !userId || code.length !== 6) {
      return res.status(400).json({ error: 'Проверьте email, аккаунт и код' });
    }
    const user = await (prisma as any).user.findFirst({ where: { id: userId, email } });
    if (!user || !user.passwordResetCode || normalizeCode(user.passwordResetCode) !== code) {
      return res.status(400).json({ error: 'Неверный email или код' });
    }
    if (!user.passwordResetExpiresAt || new Date() > user.passwordResetExpiresAt) {
      return res.status(400).json({ error: 'Код истёк. Запросите новый.' });
    }
    return res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to verify reset code' });
  }
});

router.post('/auth/reset-password', async (req, res) => {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const userId = String(req.body?.userId ?? '').trim();
    const code = normalizeCode(String(req.body?.code ?? ''));
    const newPassword = String(req.body?.newPassword ?? '');
    if (!EMAIL_REGEX.test(email) || !userId || code.length !== 6 || newPassword.length < 6) {
      return res.status(400).json({ error: 'Проверьте email, код и новый пароль (минимум 6 символов)' });
    }
    const user = await (prisma as any).user.findFirst({ where: { id: userId, email } });
    if (!user) return res.status(400).json({ error: 'Неверный email или код' });
    if (!user.passwordResetCode || normalizeCode(user.passwordResetCode) !== code) {
      return res.status(400).json({ error: 'Неверный email или код' });
    }
    if (!user.passwordResetExpiresAt || new Date() > user.passwordResetExpiresAt) {
      return res.status(400).json({ error: 'Код истёк. Запросите новый.' });
    }
    await (prisma as any).user.update({
      where: { id: user.id },
      data: {
        password: bcrypt.hashSync(newPassword, 10),
        passwordResetCode: null,
        passwordResetExpiresAt: null
      }
    });
    res.json({ ok: true, message: 'Пароль обновлён. Можно входить.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to reset password' });
  }
});

export default router;
