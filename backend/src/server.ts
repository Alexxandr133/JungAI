import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { existsSync } from 'fs';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config';
import { setupVoiceRoomSocket } from './websocket/voiceRoom';
import health from './routes/health';
import auth from './routes/auth';
import dreams from './routes/dreams';
import paranormal from './routes/paranormal';
import research from './routes/research';
import community from './routes/community';
import payments from './routes/payments';
import clients from './routes/clients';
import feedback from './routes/feedback';
import materials from './routes/materials';
import profile from './routes/profile';
import events from './routes/events';
import tasks from './routes/tasks';
import chat from './routes/chat';
import ai from './routes/ai';
import journal from './routes/journal';
import amplifications from './routes/amplifications';
import analytics from './routes/analytics';
import tests from './routes/tests';
import notifications from './routes/notifications';
import files from './routes/files';
import psychologist from './routes/psychologist';
import psychologists from './routes/psychologists';
import researcher from './routes/researcher';
import admin from './routes/admin';
import support from './routes/support';

const app = express();
const httpServer = createServer(app);
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.corsOrigin as any,
    credentials: Boolean((config as any).corsCredentials),
    methods: ['GET', 'POST']
  }
});

app.set('trust proxy', 1);

// Настройка Helmet с разрешением загрузки изображений
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:", "http://212.193.30.213", "https://212.193.30.213"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));

app.use(cors({
  origin: config.corsOrigin as any,
  credentials: Boolean((config as any).corsCredentials),
}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));

// Статическая раздача файлов из папки uploads с CORS заголовками
const uploadsStaticPath = path.join(process.cwd(), 'backend', 'uploads');
console.log(`[Server] Static uploads path: ${uploadsStaticPath}`);
console.log(`[Server] Uploads directory exists: ${existsSync(uploadsStaticPath)}`);

// Статическая раздача файлов из папки uploads с CORS заголовками
app.use('/uploads', (req, res, next) => {
  // Устанавливаем CORS заголовки для статических файлов
  const origin = req.headers.origin;
  const allowedOrigins = Array.isArray(config.corsOrigin) ? config.corsOrigin : (config.corsOrigin === '*' ? ['*'] : [config.corsOrigin]);
  
  if (origin) {
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      if (config.corsCredentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
    }
  } else if (allowedOrigins.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

// Отдельно настраиваем express.static для uploads
app.use('/uploads', express.static(uploadsStaticPath, {
  setHeaders: (res, filePath) => {
    // Устанавливаем правильный Content-Type для изображений
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    }
  }
}));

// Общий rate limiter (увеличен для предотвращения блокировок при перезагрузке)
const limiter = rateLimit({ 
  windowMs: 60_000, 
  max: 300, // Увеличено с 120 до 300 запросов в минуту
  message: 'Слишком много запросов, попробуйте позже',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

app.use('/api', health);
app.use('/api', auth);
app.use('/api', dreams);
app.use('/api', paranormal);
app.use('/api', research);
app.use('/api', community);
app.use('/api', payments);
app.use('/api', clients);
app.use('/api', feedback);
app.use('/api', materials);
app.use('/api', profile);
app.use('/api', events);
app.use('/api', tasks);
app.use('/api', chat);
app.use('/api', ai);
app.use('/api', journal);
app.use('/api', amplifications);
app.use('/api', analytics);
app.use('/api', tests);
app.use('/api', notifications);
app.use('/api', files);
app.use('/api/psychologist', psychologist);
app.use('/api/psychologists', psychologists);
app.use('/api/researcher', researcher);
app.use('/api/admin', admin);
app.use('/api', support);

// Catch-all для всех остальных путей (только если это не /uploads)
app.use((req, res, next) => {
  // Пропускаем /uploads, они обрабатываются выше
  if (req.path.startsWith('/uploads')) {
    return next();
  }
  res.status(404).json({ error: 'Not found', path: req.path });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: 'Internal error' });
});

// Настройка WebSocket для голосовых комнат
setupVoiceRoomSocket(io);

httpServer.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on :${config.port}`);
  // eslint-disable-next-line no-console
  console.log(`WebSocket server ready for voice rooms`);
});
