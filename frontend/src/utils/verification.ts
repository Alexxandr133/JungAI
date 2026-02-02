import { api } from '../lib/api';

export type VerificationStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface VerificationCheckResult {
  isVerified: boolean | null;
  status: VerificationStatus | null;
}

// Кэш для результатов проверки верификации (TTL: 5 минут)
const VERIFICATION_CACHE_KEY = 'verification_cache';
const VERIFICATION_CACHE_TTL = 5 * 60 * 1000; // 5 минут

interface CachedVerification {
  result: VerificationCheckResult;
  timestamp: number;
  tokenHash: string; // Хэш токена для безопасности
}

function getTokenHash(token: string): string {
  // Простой хэш для идентификации токена (первые 10 символов)
  return token.substring(0, 10);
}

function getCachedVerification(token: string): VerificationCheckResult | null {
  try {
    const cached = localStorage.getItem(VERIFICATION_CACHE_KEY);
    if (!cached) return null;
    
    const parsed: CachedVerification = JSON.parse(cached);
    const now = Date.now();
    const tokenHash = getTokenHash(token);
    
    // Проверяем, что кэш не устарел и токен совпадает
    if (now - parsed.timestamp < VERIFICATION_CACHE_TTL && parsed.tokenHash === tokenHash) {
      return parsed.result;
    }
    
    // Кэш устарел, удаляем
    localStorage.removeItem(VERIFICATION_CACHE_KEY);
    return null;
  } catch {
    return null;
  }
}

function setCachedVerification(token: string, result: VerificationCheckResult): void {
  try {
    const cached: CachedVerification = {
      result,
      timestamp: Date.now(),
      tokenHash: getTokenHash(token)
    };
    localStorage.setItem(VERIFICATION_CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Игнорируем ошибки записи в localStorage
  }
}

/**
 * Очищает кэш верификации (например, при выходе из системы или изменении статуса)
 */
export function clearVerificationCache(): void {
  try {
    localStorage.removeItem(VERIFICATION_CACHE_KEY);
  } catch {
    // Игнорируем ошибки
  }
}

/**
 * Проверяет статус верификации психолога с кэшированием
 */
export async function checkVerification(token: string | null, forceRefresh = false): Promise<VerificationCheckResult> {
  if (!token) {
    return { isVerified: null, status: null };
  }

  // Проверяем кэш, если не требуется принудительное обновление
  if (!forceRefresh) {
    const cached = getCachedVerification(token);
    if (cached !== null) {
      return cached;
    }
  }

  try {
    // Проверяем статус верификации через API
    const userRes = await api<{ isVerified?: boolean; role?: string }>('/api/auth/me', { token });
    
    // Проверяем только для психологов
    if (userRes.role === 'psychologist') {
      let result: VerificationCheckResult;
      
      if (userRes.isVerified !== undefined) {
        result = { isVerified: userRes.isVerified, status: userRes.isVerified ? 'approved' : null };
      } else {
        // Если нет поля isVerified, проверяем через статус верификации
        try {
          const statusRes = await api<{ status: string }>('/api/psychologist/verification/status', { token });
          const status = statusRes.status as VerificationStatus;
          result = { isVerified: status === 'approved', status };
        } catch {
          result = { isVerified: false, status: null };
        }
      }
      
      // Сохраняем в кэш
      setCachedVerification(token, result);
      return result;
    } else {
      // Для админов всегда разрешено
      const result = { isVerified: true, status: 'approved' as VerificationStatus };
      setCachedVerification(token, result);
      return result;
    }
  } catch (error: any) {
    // Если ошибка 403 с сообщением о верификации
    if (error.message?.includes('Verification required')) {
      const result = { isVerified: false, status: null };
      setCachedVerification(token, result);
      return result;
    } else if (error.message?.includes('too many') || error.message?.includes('rate limit')) {
      // Если rate limit, используем кэш, даже если он устарел
      const cached = getCachedVerification(token);
      if (cached !== null) {
        console.warn('Rate limit hit, using cached verification status');
        return cached;
      }
      // Если кэша нет, возвращаем false
      return { isVerified: false, status: null };
    } else {
      console.error('Failed to check verification:', error);
      return { isVerified: false, status: null };
    }
  }
}

