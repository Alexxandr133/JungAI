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
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openRouterSiteUrl: process.env.OPENROUTER_SITE_URL || '',
  openRouterSiteName: process.env.OPENROUTER_SITE_NAME || '',
  aiModelDefault: process.env.AI_MODEL_DEFAULT || 'deepseek/deepseek-chat-v3-0324',
  /** Модель OpenRouter для запросов с изображениями (vision) */
  aiVisionModel: process.env.AI_VISION_MODEL || 'openai/gpt-4o-mini',
  /** STT: модели через запятую для /audio/transcriptions */
  aiTranscriptionModels: process.env.AI_TRANSCRIPTION_MODEL || '',
  /** Запасной режим: chat/completions + input_audio */
  aiTranscriptionChatModels: process.env.AI_TRANSCRIPTION_CHAT_MODEL || '',
  aiAllowedModels: (process.env.AI_ALLOWED_MODELS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  agoraAppId: process.env.AGORA_APP_ID || '36524043ba1c4297bc6f950f5f81cc09',
  agoraAppCertificate: process.env.AGORA_APP_CERTIFICATE || '',
  // Временный токен из консоли Agora (для тестирования, если App Certificate не настроен)
  agoraTempToken: process.env.AGORA_TEMP_TOKEN || '007eJxTYGgX6WJftaN9balw/5OuWapn61yv7646W8USprtAS7Xm5A8FBmMzUyMTAxPjpETDZBMjS/OkZLM0S1ODNNM0C8PkZANLL43AzIZARgbuqd6MjAwQCOIzMhgzMAAArc0cMQ==',
  livekitUrl: process.env.LIVEKIT_URL || (process.env.NODE_ENV === 'development' ? 'ws://127.0.0.1:7880' : ''),
  livekitApiKey: process.env.LIVEKIT_API_KEY || (process.env.NODE_ENV === 'development' ? 'devkey' : ''),
  livekitApiSecret: process.env.LIVEKIT_API_SECRET || (process.env.NODE_ENV === 'development' ? 'supersecret' : ''),
  livekitTokenTtlSec: Number(process.env.LIVEKIT_TOKEN_TTL_SEC || 3600),
  appTimeZone: process.env.APP_TIME_ZONE || 'Europe/Moscow',
  eventTimezoneOffsetMinutes: Number(process.env.EVENT_TIMEZONE_OFFSET_MINUTES || 180),
  // Frontend URL для генерации ссылок регистрации
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || process.env.SMTP_USER || '',
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
if (config.openRouterApiKey) {
  console.log(`[Config] OPENROUTER_API_KEY loaded: ${config.openRouterApiKey.substring(0, 10)}... (length: ${config.openRouterApiKey.length})`);
} else if (config.hfToken) {
  // Backward compatibility during migration
  console.log(`[Config] HF_TOKEN loaded: ${config.hfToken.substring(0, 10)}... (length: ${config.hfToken.length})`);
} else {
  console.warn('[Config] ⚠️  OPENROUTER_API_KEY / HF_TOKEN are empty or not set!');
}
