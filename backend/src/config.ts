import dotenv from 'dotenv';
import path from 'path';
import { existsSync } from 'fs';

// Загружаем .env из директории backend
// Если запускается из корня монорепо (через PM2), ищем backend/.env
// Если запускается из backend/, ищем .env
const envPath = path.resolve(process.cwd(), 'backend', '.env');
const fallbackPath = path.resolve(process.cwd(), '.env');
const finalEnvPath = existsSync(envPath) ? envPath : fallbackPath;
console.log(`[Config] Loading .env from: ${finalEnvPath}`);
console.log(`[Config] process.cwd(): ${process.cwd()}`);
dotenv.config({ path: finalEnvPath });

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
  // Frontend URL для генерации ссылок регистрации
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  // Allow comma-separated origins, fallback to '*'
  corsOrigin: (process.env.CORS_ORIGIN || '*').includes(',')
    ? (process.env.CORS_ORIGIN || '*')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : (process.env.CORS_ORIGIN || '*'),
  corsCredentials: String(process.env.CORS_CREDENTIALS || '').toLowerCase() === 'true'
};

// Логирование для отладки (только первые символы токена для безопасности)
if (config.hfToken) {
  console.log(`[Config] HF_TOKEN loaded: ${config.hfToken.substring(0, 10)}... (length: ${config.hfToken.length})`);
} else {
  console.warn('[Config] ⚠️  HF_TOKEN is empty or not set!');
}
