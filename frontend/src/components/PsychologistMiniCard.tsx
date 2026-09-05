import { useState } from 'react';
import { Link } from 'react-router-dom';
import { resolvePublicFileUrl } from '../lib/api';
import { formatSlotLabel } from '../lib/eventsCalendarUtils';
import './PsychologistMiniCard.css';

export type PsychologistMiniCardData = {
  id: string;
  name: string;
  bio?: string | null;
  therapyMethod?: string | null;
  specialization?: string[];
  experience?: number;
  avatarUrl?: string | null;
  worksWith?: string[];
  sessionPriceRub?: number | null;
  nearestSlot?: { slotStart: string; startHm?: string } | null;
  verified?: boolean;
  rating?: number | null;
  reviewsCount?: number | null;
  /** Строка прозрачности: «Совпадение: темы · формат · бюджет» */
  matchLine?: string | null;
  reasons?: string[];
};

type Props = {
  data: PsychologistMiniCardData;
  /** Теги из анкеты — подсветка совпадений */
  highlightTags?: string[];
  /** CTA подписи */
  profileCtaLabel?: string;
  profileTo?: string;
  onWrite?: () => void;
  showWrite?: boolean;
  compact?: boolean;
};

function slotWithinDays(slotStart: string, days: number): boolean {
  const t = new Date(slotStart).getTime();
  if (Number.isNaN(t)) return false;
  const max = Date.now() + days * 24 * 60 * 60 * 1000;
  return t >= Date.now() - 60_000 && t <= max;
}

function formatSlot(slotStart: string): string {
  return formatSlotLabel(slotStart);
}

/** Общая карточка каталога и результатов подбора (§14–15). */
export function PsychologistMiniCard({
  data,
  highlightTags = [],
  profileCtaLabel = 'Профиль',
  profileTo,
  onWrite,
  showWrite = false,
  compact,
}: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const href = profileTo || `/psychologists/${data.id}`;
  const method = data.therapyMethod || data.specialization?.[0] || 'Психолог';
  const avatarSrc =
    !imgFailed && data.avatarUrl
      ? data.avatarUrl.startsWith('blob:') || data.avatarUrl.startsWith('http')
        ? data.avatarUrl
        : resolvePublicFileUrl(data.avatarUrl) || data.avatarUrl
      : null;
  const letter = (data.name || '?').trim().charAt(0).toUpperCase();
  const tags = (data.worksWith || []).slice(0, 3);
  const extraTags = Math.max(0, (data.worksWith || []).length - 3);
  const highlightSet = new Set(highlightTags.map((t) => t.toLowerCase()));
  const price =
    data.sessionPriceRub != null && data.sessionPriceRub > 0
      ? `Сессия — ${data.sessionPriceRub.toLocaleString('ru-RU')} ₽`
      : null;
  const slot =
    data.nearestSlot?.slotStart && slotWithinDays(data.nearestSlot.slotStart, 7)
      ? formatSlot(data.nearestSlot.slotStart)
      : null;
  const reviewsCount = data.reviewsCount ?? 0;
  const showRating = reviewsCount >= 1 && data.rating != null && data.rating > 0;
  const matchLine =
    data.matchLine ||
    (data.reasons?.length
      ? `Совпадение: ${data.reasons.filter((r) => /тем|формат|бюджет|пар|индивид|дет|сесс/i.test(r)).slice(0, 3).join(' · ') || data.reasons.slice(0, 3).join(' · ')}`
      : null);

  return (
    <article className={`psy-mini${compact ? ' psy-mini--compact' : ''}`}>
      <Link to={href} className="psy-mini__hit" aria-label={`${data.name} — профиль`}>
        <span className="psy-mini__sr-only">{data.name}</span>
      </Link>

      <div className="psy-mini__top">
        <div className="psy-mini__avatar" aria-hidden>
          {avatarSrc ? (
            <img src={avatarSrc} alt="" onError={() => setImgFailed(true)} />
          ) : (
            <span>{letter}</span>
          )}
        </div>
        <div className="psy-mini__head">
          <div className="psy-mini__name-row">
            <h3 className="psy-mini__name">{data.name}</h3>
            {data.verified !== false ? (
              <span className="psy-mini__badge">Верифицирован</span>
            ) : null}
          </div>
          <p className="psy-mini__sub">
            {method}
            {data.experience && data.experience > 0 ? ` · ${formatExperienceYears(data.experience)}` : ''}
          </p>
          {showRating ? (
            <p className="psy-mini__rating">
              Рейтинг {Number(data.rating).toFixed(1)} · {reviewsCount}{' '}
              {reviewsCount === 1 ? 'отзыв' : reviewsCount < 5 ? 'отзыва' : 'отзывов'}
            </p>
          ) : null}
        </div>
      </div>

      {data.bio?.trim() ? <p className="psy-mini__bio">{data.bio.trim()}</p> : null}

      {tags.length ? (
        <div className="psy-mini__tags">
          {tags.map((t) => {
            const on = highlightSet.has(t.toLowerCase()) ||
              [...highlightSet].some((h) => t.toLowerCase().includes(h) || h.includes(t.toLowerCase()));
            return (
              <span key={t} className={`psy-mini__tag${on ? ' is-match' : ''}`}>
                {t}
              </span>
            );
          })}
          {extraTags > 0 ? <span className="psy-mini__tag psy-mini__tag--more">+{extraTags}</span> : null}
        </div>
      ) : null}

      <div className="psy-mini__meta">
        {price ? <div className="psy-mini__price">{price}</div> : null}
        {slot ? (
          <div className="psy-mini__slot">
            <span className="psy-mini__slot-dot" aria-hidden />
            Ближайшая запись: {slot}
          </div>
        ) : null}
      </div>

      {matchLine ? <p className="psy-mini__match">{matchLine}</p> : null}

      <div className="psy-mini__actions">
        <Link to={href} className="landing-btn landing-btn--primary psy-mini__cta" onClick={(e) => e.stopPropagation()}>
          {profileCtaLabel}
        </Link>
        {showWrite && onWrite ? (
          <button
            type="button"
            className="landing-btn landing-btn--secondary psy-mini__write"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onWrite();
            }}
          >
            Написать
          </button>
        ) : null}
      </div>
    </article>
  );
}
