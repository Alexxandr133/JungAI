import type { MouseEvent } from 'react';
import { resolvePublicFileUrl } from '../lib/api';
import { formatExperienceYears } from '../lib/ruPlural';
import './PsychologistPublicCard.css';

export type PsychologistPublicCardData = {
  name: string;
  specialization?: string[];
  therapyMethod?: string | null;
  experience?: number;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  accentColor?: string | null;
  sessionPriceRub?: number | null;
  verified?: boolean;
  nearestSlotLabel?: string | null;
};

/** Кураторская палитра §12.2 — тёмные свотчи под белый текст CTA */
export const PROFILE_ACCENT_PRESETS = [
  '#3d6b5a',
  '#5c4a3a',
  '#3a4f6b',
  '#6b3a4f',
  '#4a5c3a',
  '#2c3e50',
  '#6b5340',
  '#1a5f5a',
] as const;

const DEFAULT_ACCENT = PROFILE_ACCENT_PRESETS[0];

type Props = {
  data: PsychologistPublicCardData;
  /** Компактнее в модалке предпросмотра */
  compact?: boolean;
  /** Показать CTA «Записаться» (якорь на #schedule) */
  showCta?: boolean;
  bookCtaLabel?: string;
  onBookClick?: () => void;
};

export function PsychologistPublicCard({
  data,
  compact,
  showCta = true,
  bookCtaLabel = 'Записаться',
  onBookClick,
}: Props) {
  const raw = data.accentColor?.trim().toLowerCase() || '';
  const accent = /^#[0-9a-f]{6}$/.test(raw) ? raw : DEFAULT_ACCENT;
  const coverSrc = data.coverUrl
    ? data.coverUrl.startsWith('blob:') || data.coverUrl.startsWith('data:') || data.coverUrl.startsWith('http')
      ? data.coverUrl
      : resolvePublicFileUrl(data.coverUrl) || data.coverUrl
    : null;
  const avatarSrc = data.avatarUrl
    ? data.avatarUrl.startsWith('blob:') || data.avatarUrl.startsWith('data:') || data.avatarUrl.startsWith('http')
      ? data.avatarUrl
      : resolvePublicFileUrl(data.avatarUrl) || data.avatarUrl
    : null;
  const method = data.therapyMethod || data.specialization?.[0] || 'Психолог';
  const priceLabel =
    data.sessionPriceRub != null
      ? `Сессия — ${data.sessionPriceRub.toLocaleString('ru-RU')} ₽`
      : 'Стоимость';

  function handleCta(e: MouseEvent) {
    if (onBookClick) {
      e.preventDefault();
      onBookClick();
    }
  }

  return (
    <article
      className={`psy-public-card${compact ? ' psy-public-card--compact' : ''}`}
      style={{ ['--psy-accent' as string]: accent }}
    >
      {/* Обложка: только изображение / дефолт-градиент — без текста (§12.1) */}
      <div className={`psy-public-card__cover${coverSrc ? '' : ' psy-public-card__cover--empty'}`} aria-hidden>
        {coverSrc ? <img src={coverSrc} alt="" /> : null}
      </div>

      <div className="psy-public-card__body">
        <div className="psy-public-card__top">
          <div className="psy-public-card__avatar">
            {avatarSrc ? (
              <img src={avatarSrc} alt="" />
            ) : (
              <span aria-hidden>{(data.name || '?').slice(0, 1)}</span>
            )}
          </div>

          <div className="psy-public-card__meta">
            <div className="psy-public-card__name-row">
              <h1 className="psy-public-card__name">{data.name || 'Без имени'}</h1>
              {data.verified ? <span className="psy-public-card__badge">Верифицирован</span> : null}
            </div>
            <p className="psy-public-card__sub">
              {method}
              {data.experience ? ` · ${formatExperienceYears(data.experience)}` : ''}
            </p>
            <p className="psy-public-card__price">{priceLabel}</p>
            {data.nearestSlotLabel ? (
              <p className="psy-public-card__nearest">Ближайшая запись: {data.nearestSlotLabel}</p>
            ) : null}
          </div>

          {showCta ? (
            <div className="psy-public-card__cta-wrap">
              <a href="#schedule" className="psy-public-card__cta" onClick={handleCta}>
                {bookCtaLabel}
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
