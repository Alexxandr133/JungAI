import dotenv from 'dotenv';
import path from 'path';

// Загружаем .env из директории backend (где запускается сервер)
// process.cwd() возвращает директорию, откуда запущен процесс
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  hfToken: process.env.HF_TOKEN || '',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  agoraAppId: process.env.AGORA_APP_ID || '36524043ba1c4297bc6f950f5f81cc09',
  agoraAppCertificate: process.env.AGORA_APP_CERTIFICATE || '',
  // Временный токен из консоли Agora (для тестирования, если App Certificate не настроен)
  agoraTempToken: process.env.AGORA_TEMP_TOKEN || '007eJxTYGgX6WJftaN9balw/5OuWapn61yv7646W8USprtAS7Xm5A8FBmMzUyMTAxPjpETDZBMjS/OkZLM0S1ODNNM0C8PkZANLL43AzIZARgbuqd6MjAwQCOIzMhgzMAAArc0cMQ==',
  // Allow comma-separated origins, fallback to '*'
  corsOrigin: (process.env.CORS_ORIGIN || '*').includes(',')
    ? (process.env.CORS_ORIGIN || '*')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : (process.env.CORS_ORIGIN || '*'),
  corsCredentials: String(process.env.CORS_CREDENTIALS || '').toLowerCase() === 'true'
};
