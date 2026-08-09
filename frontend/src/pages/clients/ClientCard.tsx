import { useNavigate } from 'react-router-dom';
import type { KeyboardEvent } from 'react';
import { Copy, Mail, Pencil, Phone, RotateCw } from 'lucide-react';
import './ClientsList.css';

type ClientTag = { label: string; color?: string };

export type ClientCardData = {
  id: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  age?: number | null;
  city?: string | null;
  tags?: ClientTag[];
  therapyEndedAt?: string | null;
  registrationPending?: boolean;
  registrationLink?: string | null;
  tokenExpiresAt?: string | null;
  platformRegistered?: boolean;
  registrationStatus?: 'registered' | 'pending' | 'expired' | 'archived';
  avatarUrl?: string | null;
  profile?: { avatarUrl?: string | null } | null;
  nextSessionAt?: string | Date | null;
  nextSessionTitle?: string | null;
  lastContactAt?: string | Date | null;
  openTasksCount?: number;
};

type ClientVisualStatus = 'registered' | 'pending' | 'expired' | 'archived';

type Props = {
  client: ClientCardData;
  clientView: 'active' | 'archive';
  avatarUrl: string | null;
  tokenExpiryLabel: string | null;
  refreshingLink: boolean;
  onCopyLink: (link: string) => void;
  onRefreshLink: (id: string) => void;
  onEdit: (client: ClientCardData) => void;
  onEndTherapy: (id: string, name?: string) => void;
  onRestoreTherapy: (id: string, name?: string) => void;
  tagColor: (label: string) => string;
};

function resolveVisualStatus(c: ClientCardData, archived: boolean): ClientVisualStatus {
  if (archived || c.registrationStatus === 'archived') return 'archived';
  if (c.registrationStatus) return c.registrationStatus;
  if (c.platformRegistered && !c.registrationPending) return 'registered';
  const expiresAt = c.tokenExpiresAt ? new Date(c.tokenExpiresAt).getTime() : NaN;
  const isExpired = c.registrationPending && Number.isFinite(expiresAt) && expiresAt < Date.now();
  if (isExpired) return 'expired';
  if (c.registrationPending) return 'pending';
  return 'registered';
}

function formatShortDate(value?: string | Date | null): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ClientCard({
  client: c,
  clientView,
  avatarUrl,
  tokenExpiryLabel,
  refreshingLink,
  onCopyLink,
  onRefreshLink,
  onEdit,
  onEndTherapy,
  onRestoreTherapy,
  tagColor,
}: Props) {
  const navigate = useNavigate();
  const archived = Boolean(c.therapyEndedAt);
  const status = resolveVisualStatus(c, archived);
  const showRegBox =
    clientView === 'active' &&
    c.registrationLink &&
    (status === 'pending' || status === 'expired');

  function openProfile() {
    navigate(`/clients/${c.id}/profile`);
  }

  function onCardKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openProfile();
    }
  }

  return (
    <article
      className={`client-card client-card--${status}`}
      role="link"
      tabIndex={0}
      onClick={openProfile}
      onKeyDown={onCardKeyDown}
      aria-label={`Профиль клиента ${c.name || ''}`}
    >
      <div className="client-card__stripe" aria-hidden />
      <div className="client-card__body">
        <div className="client-card__head">
          <div className="client-card__avatar-wrap">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="client-card__avatar" />
            ) : (
              <div className="client-card__avatar-fallback">
                {(c.name || '?').trim().charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="client-card__identity">
            <h2 className="client-card__name">{c.name}</h2>
            <div className="client-card__meta">
              {c.city ? <span>{c.city}</span> : null}
              {c.city && c.age ? <span className="client-card__meta-sep">•</span> : null}
              {c.age ? <span>{c.age} лет</span> : null}
              {!c.city && !c.age ? <span>Клиент</span> : null}
            </div>
          </div>
          <button
            type="button"
            className="client-card__edit-btn"
            title="Изменить карточку"
            aria-label="Изменить карточку клиента"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(c);
            }}
          >
            <Pencil size={17} strokeWidth={2} />
          </button>
        </div>

        <div className="client-card__contact">
          <div className="client-card__contact-row" title={c.email || undefined}>
            <Mail size={15} strokeWidth={2} className="client-card__contact-icon" aria-hidden />
            <span className={`client-card__contact-text${!c.email ? ' is-empty' : ''}`}>
              {c.email || 'Email не указан'}
            </span>
          </div>
          <div className="client-card__contact-row" title={c.phone || undefined}>
            <Phone size={15} strokeWidth={2} className="client-card__contact-icon" aria-hidden />
            <span className={`client-card__contact-text${!c.phone ? ' is-empty' : ''}`}>
              {c.phone || 'Телефон не указан'}
            </span>
          </div>
        </div>

        <div className="client-card__tags">
          {Array.isArray(c.tags) && c.tags.length > 0 ? (
            c.tags.map((t, idx) => {
              const hex =
                typeof t.color === 'string' && t.color.startsWith('#')
                  ? t.color
                  : tagColor(String(t.label));
              return (
                <span
                  key={idx}
                  className="client-card__tag"
                  style={{
                    background: `color-mix(in srgb, ${hex} 18%, var(--surface-2))`,
                    border: `1px solid color-mix(in srgb, ${hex} 40%, var(--navbar-edge))`,
                  }}
                >
                  {t.label}
                </span>
              );
            })
          ) : (
            <span className="client-card__tags-empty">Без тегов</span>
          )}
        </div>

        <div className="client-card__crm">
          <div className="client-card__crm-row">
            <span className="client-card__crm-label">Следующая сессия</span>
            <span className="client-card__crm-value">
              {formatShortDate(c.nextSessionAt) || 'не запланирована'}
            </span>
          </div>
          <div className="client-card__crm-row">
            <span className="client-card__crm-label">Последний контакт</span>
            <span className="client-card__crm-value">
              {formatShortDate(c.lastContactAt) || '—'}
            </span>
          </div>
          <div className="client-card__crm-row">
            <span className="client-card__crm-label">Задачи</span>
            <span className="client-card__crm-value">
              {(c.openTasksCount ?? 0) > 0
                ? `${c.openTasksCount} ${c.openTasksCount === 1 ? 'задача' : (c.openTasksCount ?? 0) < 5 ? 'задачи' : 'задач'}`
                : 'нет задач'}
            </span>
          </div>
        </div>

        <div className="client-card__extra">
          {showRegBox && (
            <div
              className="client-card__reg-box"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="client-card__reg-title">
                {status === 'expired' ? 'Ссылка регистрации истекла' : 'Ссылка для регистрации'}
              </div>
              <div className="client-card__reg-row">
                <input
                  readOnly
                  value={c.registrationLink!}
                  title={c.registrationLink!}
                  className="client-card__reg-input"
                />
                <button
                  type="button"
                  className="client-card__icon-btn"
                  title="Копировать ссылку"
                  onClick={() => onCopyLink(c.registrationLink!)}
                >
                  <Copy size={16} />
                </button>
                <button
                  type="button"
                  className={`client-card__icon-btn${refreshingLink ? ' client-card__icon-btn--spin' : ''}`}
                  title="Нажав на эту кнопку, вы обновите токен регистрации"
                  disabled={refreshingLink}
                  onClick={() => onRefreshLink(c.id)}
                >
                  <RotateCw size={16} />
                </button>
              </div>
              {tokenExpiryLabel && status === 'pending' && (
                <div className="client-card__reg-expiry">Действует до {tokenExpiryLabel}</div>
              )}
            </div>
          )}

          {clientView === 'archive' && c.therapyEndedAt && (
            <div className="client-card__archive-date">
              Терапия завершена: {new Date(c.therapyEndedAt).toLocaleDateString('ru-RU')}
            </div>
          )}
        </div>

        <div className="client-card__actions" onClick={(e) => e.stopPropagation()}>
          {clientView === 'active' && (
            <button
              type="button"
              className="button"
              onClick={() => navigate(`/psychologist/work-area?client=${c.id}`)}
            >
              Рабочая область
            </button>
          )}
          {clientView === 'active' ? (
            <button
              type="button"
              onClick={() => onEndTherapy(c.id, c.name)}
              className="button secondary client-card__actions-end"
            >
              Завершить терапию
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onRestoreTherapy(c.id, c.name)}
              className="button client-card__actions-end"
            >
              Вернуть в активные
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
