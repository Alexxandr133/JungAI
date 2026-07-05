import type { ContextUsage } from '../lib/aiContextTypes';

type Props = {
  usage: ContextUsage | null;
  loading?: boolean;
  size?: number;
};

function pct(usage: ContextUsage): number {
  if (!usage.contextWindowTokens) return 0;
  return Math.min(100, (usage.estimatedPromptTokens / usage.contextWindowTokens) * 100);
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

export function AiContextRing({ usage, loading, size = 36 }: Props) {
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = usage ? pct(usage) : 0;
  const offset = c - (p / 100) * c;
  const color =
    p >= 90 ? '#ef4444' : p >= 70 ? '#f59e0b' : p >= 45 ? '#eab308' : 'var(--primary)';

  const title = usage
    ? `Контекст чата: ~${formatTokens(usage.estimatedPromptTokens)} / ${formatTokens(usage.contextWindowTokens)} токенов` +
      `\nСообщений в истории: ${usage.historyMessageCount}` +
      (usage.dataContextIncluded ? '\nСны и данные клиента включены в запрос' : '\nСны и данные из истории диалога (не дублируются)') +
      `\nМодель: ${usage.model}` +
      `\nСистема: ~${formatTokens(usage.breakdown.system)} · История: ~${formatTokens(usage.breakdown.history)}` +
      (usage.dataContextIncluded ? ` · Данные: ~${formatTokens(usage.breakdown.data)}` : '') +
      ` · Сообщение: ~${formatTokens(usage.breakdown.message)}`
    : 'Контекст чата';

  return (
    <div
      title={title}
      aria-label={title}
      style={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        cursor: 'default',
      }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={loading ? 'var(--text-muted)' : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={loading ? c * 0.75 : offset}
          style={{ transition: 'stroke-dashoffset 0.35s ease, stroke 0.2s ease' }}
        />
      </svg>
      <span
        style={{
          position: 'absolute',
          fontSize: size <= 32 ? 8 : 9,
          fontWeight: 700,
          color: 'var(--text-muted)',
          lineHeight: 1,
          pointerEvents: 'none',
        }}
      >
        {usage ? `${Math.round(p)}%` : '—'}
      </span>
    </div>
  );
}
