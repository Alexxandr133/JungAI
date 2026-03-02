import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import type { UserRole } from '../middleware/auth';
import { prisma } from '../db/prisma';

const router = Router();

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
  const login = username || email; // Поддержка и логина, и email
  
  if (!login || !password) {
    return res.status(400).json({ error: 'Логин и пароль обязательны' });
  }

  // Проверяем тестовые аккаунты (только если они уже существуют в БД)
  const demoUser = demoUsers.find(u => u.email === login && u.password === password);
  if (demoUser) {
    // Ищем пользователя в БД, не создаем автоматически
    const existingUser = await prisma.user.findUnique({
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
  let user = null;
  if (login.includes('@')) {
    user = await prisma.user.findUnique({
      where: { email: login }
    });
  } else {
    // Ищем по email, который может быть в формате username@jungai.local
    user = await prisma.user.findFirst({
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

  // Проверяем пароль
  const bcrypt = require('bcryptjs');
  const isValidPassword = bcrypt.compareSync(password, user.password) || user.password === password; // Поддержка старых паролей
  
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, config.jwtSecret, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});

router.get('/auth/demo', async (_req, res) => {
  // Создаём всех демо-пользователей в базе данных
  for (const user of demoUsers) {
    await prisma.user.upsert({
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
      await prisma.user.upsert({
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
    const user = await prisma.user.findUnique({
      where: { id: me.id },
      select: { id: true, email: true, role: true, isVerified: true }
    });
    
    // Возвращаем информацию о пользователе
    if (user) {
      return res.json({ 
        id: user.id, 
        email: user.email, 
        role: user.role,
        isVerified: user.isVerified 
      });
    }
    
    // Если пользователь не найден в БД, возвращаем данные из токена (для демо-пользователей)
    // Для психологов по умолчанию не верифицирован
    return res.json({ 
      id: me.id, 
      email: me.email, 
      role: me.role,
      isVerified: me.role === 'admin' ? true : false
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
    
    // Формируем email из username
    const userEmail = email || `${username}@jungai.local`;
    
    // Проверяем, не зарегистрирован ли уже клиент
    const existingUser = await prisma.user.findUnique({
      where: { email: userEmail }
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким логином уже существует' });
    }
    
    // Хешируем пароль
    const bcrypt = require('bcryptjs');
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    // Создаём пользователя
    const user = await prisma.user.create({
      data: {
        email: userEmail,
        password: hashedPassword,
        role: 'client'
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
    
    // Генерируем JWT токен
    const jwtToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: '30d' }
    );
    
    res.json({
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
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
    const { username, password, role } = req.body ?? {};
    
    if (!username || username.length < 3) {
      return res.status(400).json({ error: 'Логин должен содержать минимум 3 символа' });
    }
    
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
    }
    
    if (!role || !['psychologist', 'researcher', 'client'].includes(role)) {
      return res.status(400).json({ error: 'Неверная роль. Доступны: psychologist, researcher, client' });
    }
    
    // Проверяем, не существует ли уже пользователь с таким email (используем username как email)
    const email = `${username}@jungai.local`;
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким логином уже существует' });
    }
    
    // Хешируем пароль
    const bcrypt = require('bcryptjs');
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    // Создаём пользователя
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: role as UserRole
      }
    });
    
    // Если регистрируется клиент, создаём запись Client (без психолога)
    if (role === 'client') {
      // Проверяем, нет ли уже записи Client с таким email
      const existingClient = await prisma.client.findFirst({
        where: { email }
      });
      
      if (!existingClient) {
        // Создаём Client с временным psychologistId (клиент сам выберет психолога позже)
        // Используем временный ID, который будет заменён при назначении психолога
        const tempPsychologistId = 'temp-' + user.id;
        await prisma.client.create({
          data: {
            name: username, // Временное имя, можно будет обновить в профиле
            email,
            psychologistId: tempPsychologistId // Временный ID, будет заменён при назначении психолога
          }
        });
      }
      
      // Создаём профиль клиента
      await prisma.profile.upsert({
        where: { userId: user.id },
        update: {
          name: username
        },
        create: {
          userId: user.id,
          name: username,
          interests: []
        }
      });
    }
    
    // Генерируем JWT токен
    const jwtToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: '30d' }
    );
    
    res.json({
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
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
    const existingUser = await prisma.user.findUnique({
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

export default router;
