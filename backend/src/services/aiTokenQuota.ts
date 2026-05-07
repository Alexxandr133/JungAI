import { prisma } from '../db/prisma';

export type AiTokenPlan = 'standard' | 'medium' | 'large';

export const AI_PLAN_LIMITS: Record<AiTokenPlan, number> = {
  // Стандарт: ежедневная рабочая нагрузка
  standard: 350_000,
  // Средний: активная практика с частым анализом
  medium: 1_200_000,
  // Большой: исследовательская нагрузка
  large: 4_000_000,
};

export type AiQuotaStatus = {
  plan: AiTokenPlan;
  limit: number;
  used: number;
  remaining: number;
  percentageUsed: number;
  resetAt: string;
};

function nextMonthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

function normalizePlan(raw: string | null | undefined): AiTokenPlan {
  if (raw === 'medium' || raw === 'large' || raw === 'standard') return raw;
  return 'standard';
}

function estimateTokensFromText(...texts: Array<string | undefined | null>): number {
  const joined = texts.filter(Boolean).join('\n');
  if (!joined) return 0;
  // Грубая оценка для языковых моделей: ~4 символа на токен
  return Math.max(1, Math.ceil(joined.length / 4));
}

async function ensurePeriod(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, aiTokenPlan: true, aiTokensUsed: true, aiTokensResetAt: true }
  });
  if (!user) throw new Error('User not found');

  const now = new Date();
  let resetAt = user.aiTokensResetAt ?? nextMonthStart(now);
  let used = user.aiTokensUsed ?? 0;
  if (resetAt <= now) {
    used = 0;
    resetAt = nextMonthStart(now);
    await prisma.user.update({
      where: { id: userId },
      data: { aiTokensUsed: 0, aiTokensResetAt: resetAt }
    });
  }

  return {
    id: user.id,
    plan: normalizePlan(user.aiTokenPlan),
    used,
    resetAt
  };
}

export async function getAiQuotaStatus(userId: string): Promise<AiQuotaStatus> {
  const u = await ensurePeriod(userId);
  const limit = AI_PLAN_LIMITS[u.plan];
  const used = Math.max(0, u.used);
  const remaining = Math.max(0, limit - used);
  const percentageUsed = Math.min(100, Math.round((used / limit) * 100));
  return {
    plan: u.plan,
    limit,
    used,
    remaining,
    percentageUsed,
    resetAt: u.resetAt.toISOString()
  };
}

export async function assertAiQuotaAvailable(userId: string): Promise<AiQuotaStatus> {
  const status = await getAiQuotaStatus(userId);
  if (status.remaining <= 0) {
    const err = new Error('AI token quota exceeded') as Error & { status?: number; quota?: AiQuotaStatus };
    err.status = 402;
    err.quota = status;
    throw err;
  }
  return status;
}

export async function consumeAiTokens(
  userId: string,
  input: { usageTotal?: number | null; promptText?: string; completionText?: string }
): Promise<AiQuotaStatus> {
  const statusBefore = await getAiQuotaStatus(userId);
  const actual =
    typeof input.usageTotal === 'number' && Number.isFinite(input.usageTotal) && input.usageTotal > 0
      ? Math.round(input.usageTotal)
      : estimateTokensFromText(input.promptText, input.completionText);

  if (actual <= 0) return statusBefore;

  const nextUsed = statusBefore.used + actual;
  await prisma.user.update({
    where: { id: userId },
    data: { aiTokensUsed: nextUsed }
  });
  return getAiQuotaStatus(userId);
}

