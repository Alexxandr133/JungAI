import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Mail, MoreHorizontal, Phone, RotateCw } from 'lucide-react';
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
  createdAt?: string | Date | null;
  therapyEndedAt?: string | null;
  registrationPending?: boolean;
  registrationToken?: string | null;
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
  onWrite?: (client: ClientCardData) => void;
  tagColor: (label: string) => string;
};

export function buildInviteLink(token: string | null | undefined) {
  if (!token) return null;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/register-client?token=${token}`;
}

const STATUS_LABELS: Record<ClientVisualStatus, string> = {
  registered: 'В терапии',
  pending: 'Ожидает регистрации',
  expired: 'Инвайт истёк',
  archived: 'В архиве',
};

function resolveVisualStatus(c: ClientCardData, archived: boolean): ClientVisualStatus {
  if (archived || c.registrationStatus === 'archived') return 'archived';
  if (c.platformRegistered) return 'registered';
  if (c.registrationStatus) return c.registrationStatus;
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

function formatTherapySince(value?: string | Date | null): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
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
  onWrite,
  tagColor,
}: Props) {
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const archived = Boolean(c.therapyEndedAt);
  const status = resolveVisualStatus(c, archived);
  const inviteLink = buildInviteLink(c.registrationToken);
  const showRegBox =
    clientView === 'active' &&
    inviteLink &&
    (status === 'pending' || status === 'expired');
  const canRefreshInvite =
    (status === 'pending' || status === 'expired') && Boolean(c.registrationToken);
  const hasTags = Array.isArray(c.tags) && c.tags.length > 0;
  const subtitle =
    status === 'registered' || status === 'archived'
      ? c.createdAt
        ? `В терапии с ${formatTherapySince(c.createdAt)}`
        : 'В терапии'
      : 'Не зарегистрирован';

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  function openProfile() {
    navigate(`/clients/${c.id}/profile`);
  }

  return (
    <article className={`client-card client-card--${status}`}>
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
            <div className="client-card__title-row">
              <h2 className="client-card__name">{c.name}</h2>
              <span className={`client-card__badge client-card__badge--${status}`}>
                {STATUS_LABELS[status]}
              </span>
            </div>
            <div className="client-card__subtitle">{subtitle}</div>
            {(c.city || c.age) && (
              <div className="client-card__meta">
                {c.city ? <span>{c.city}</span> : null}
                {c.city && c.age ? <span className="client-card__meta-sep">•</span> : null}
                {c.age ? <span>{c.age} лет</span> : null}
              </div>
            )}
          </div>
        </div>

        <div className="client-card__contact">
          {c.email && (
            <div className="client-card__contact-row" title={c.email}>
              <Mail size={15} strokeWidth={2} className="client-card__contact-icon" aria-hidden />
              <span className="client-card__contact-text">{c.email}</span>
            </div>
          )}
          {c.phone && (
            <div className="client-card__contact-row" title={c.phone}>
              <Phone size={15} strokeWidth={2} className="client-card__contact-icon" aria-hidden />
              <span className="client-card__contact-text">{c.phone}</span>
            </div>
          )}
        </div>

        {hasTags && (
          <div className="client-card__tags">
            {c.tags!.map((t, idx) => {
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
                    border: `1px solid color-mix(in srgb, ${hex} 40%, var(--line))`,
                  }}
                >
                  {t.label}
                </span>
              );
            })}
          </div>
        )}

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
          <div
            className="client-card__crm-row"
            role="link"
            tabIndex={0}
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/clients/${c.id}/profile?tab=tasks`);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                navigate(`/clients/${c.id}/profile?tab=tasks`);
              }
            }}
          >
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
            <div className="client-card__reg-box">
              <div className="client-card__reg-title">
                {status === 'expired' ? 'Ссылка регистрации истекла' : 'Ссылка для регистрации'}
              </div>
              <div className="client-card__reg-row">
                <input
                  readOnly
                  value={inviteLink!}
                  title={inviteLink!}
                  className="client-card__reg-input"
                />
                <button
                  type="button"
                  className="client-card__icon-btn"
                  title="Копировать ссылку"
                  onClick={() => onCopyLink(inviteLink!)}
                >
                  <Copy size={16} />
                </button>
                <button
                  type="button"
                  className={`client-card__icon-btn${refreshingLink ? ' client-card__icon-btn--spin' : ''}`}
                  title="Обновить токен регистрации"
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

        <div className="client-card__actions">
          <button type="button" className="clients-page__btn" onClick={openProfile}>
            Профиль
          </button>
          {onWrite && clientView === 'active' ? (
            <button
              type="button"
              className="clients-page__btn clients-page__btn--secondary"
              onClick={() => onWrite(c)}
            >
              Написать
            </button>
          ) : null}
          <div className="client-card__menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="client-card__menu-btn"
              aria-label="Действия"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <div className="client-card__menu" role="menu">
                <button
                  type="button"
                  className="client-card__menu-item"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit(c);
                  }}
                >
                  Изменить
                </button>
                {canRefreshInvite && (
                  <button
                    type="button"
                    className="client-card__menu-item"
                    role="menuitem"
                    disabled={refreshingLink}
                    onClick={() => {
                      setMenuOpen(false);
                      onRefreshLink(c.id);
                    }}
                  >
                    Обновить инвайт
                  </button>
                )}
                {clientView === 'active' && (
                  <button
                    type="button"
                    className="client-card__menu-item"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onEndTherapy(c.id, c.name);
                    }}
                  >
                    Завершить терапию
                  </button>
                )}
                {clientView === 'archive' && (
                  <button
                    type="button"
                    className="client-card__menu-item"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onRestoreTherapy(c.id, c.name);
                    }}
                  >
                    Вернуть в активные
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
