import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { AdminNavbar } from '../../components/AdminNavbar';
import { PsychologistMiniCard } from '../../components/PsychologistMiniCard';
import '../../styles/landing-tokens.css';
import '../psychologists/Catalog.css';
import './admin.css';

type CatalogItem = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  bio?: string | null;
  therapyMethod?: string | null;
  specialization?: string[] | string | null;
  worksWith?: string[];
  experience?: number;
  sessionPriceRub?: number | null;
  rating?: number | null;
  reviewsCount?: number;
  isVerified: boolean;
  sortOrder: number;
  hidden: boolean;
  acceptingClients?: boolean;
  visibleOnSite: boolean;
};

function asSpecArray(v: CatalogItem['specialization']): string[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

function reindex(items: CatalogItem[]): CatalogItem[] {
  return items.map((it, index) => ({ ...it, sortOrder: index }));
}

export default function AdminPsychologistsCatalog() {
  const { token } = useAuth();

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState(false);
  const [filter, setFilter] = useState<'all' | 'visible' | 'hidden'>('all');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ items: CatalogItem[] }>('/api/admin/psychologists-catalog', { token });
      setItems(reindex(res.items || []));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить каталог');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  function moveItem(id: string, direction: -1 | 1) {
    setItems((prev) => {
      const index = prev.findIndex((p) => p.id === id);
      if (index < 0) return prev;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const copy = [...prev];
      const [removed] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, removed);
      return reindex(copy);
    });
    setSavedHint(false);
  }

  function toggleHidden(id: string) {
    setItems((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const hidden = !p.hidden;
        return {
          ...p,
          hidden,
          visibleOnSite: p.isVerified && !hidden && p.acceptingClients !== false,
        };
      })
    );
    setSavedHint(false);
  }

  async function save() {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const payload = reindex(items).map((p, index) => ({
        id: p.id,
        sortOrder: index,
        hidden: p.hidden,
      }));
      await api('/api/admin/psychologists-catalog', {
        method: 'PUT',
        token,
        body: { items: payload },
      });
      setSavedHint(true);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  }

  const visibleCount = items.filter((p) => p.isVerified && !p.hidden && p.acceptingClients !== false).length;
  const shown = items.filter((p) => {
    if (filter === 'visible') return p.visibleOnSite;
    if (filter === 'hidden') return p.hidden || !p.isVerified || p.acceptingClients === false;
    return true;
  });

  return (
    <div className="admin-shell">
      <AdminNavbar />
      <main className="admin-main" style={{ maxWidth: 1120 }}>
        <header className="admin-head">
          <div>
            <p className="admin-head__eyebrow">Люди</p>
            <h1 className="admin-head__title">Каталог психологов</h1>
            <p className="admin-head__lead">
              Тот же вид, что на /psychologists — можно менять порядок и скрывать из публичного списка. На сайте:{' '}
              {visibleCount} из {items.length}
            </p>
          </div>
          <div className="admin-head__actions">
            <Link to="/psychologists" className="button secondary" target="_blank" rel="noreferrer">
              Открыть каталог
            </Link>
            <button type="button" className="button secondary" onClick={() => void load()} disabled={loading || saving}>
              Обновить
            </button>
            <button type="button" className="button" onClick={() => void save()} disabled={loading || saving}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </header>

        {error ? <div className="admin-alert admin-alert--err">{error}</div> : null}
        {savedHint && !error ? (
          <div className="admin-alert admin-alert--ok">
            Сохранено. На сайте сейчас {visibleCount} психолог(ов) в публичном списке.
          </div>
        ) : null}

        <div className="admin-periods" style={{ marginBottom: 16 }}>
          {(
            [
              ['all', 'Все'],
              ['visible', 'На сайте'],
              ['hidden', 'Скрытые / не в списке'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={filter === id ? 'is-on' : undefined}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="admin-loading">Загрузка…</div>
        ) : items.length === 0 ? (
          <div className="admin-panel admin-empty">Нет учётных записей с ролью «психолог».</div>
        ) : shown.length === 0 ? (
          <div className="admin-panel admin-empty">Нет карточек в этом фильтре.</div>
        ) : (
          <div className="psy-catalog__grid admin-catalog-grid">
            {shown.map((p) => {
              const index = items.findIndex((x) => x.id === p.id);
              return (
                <div
                  key={p.id}
                  className={`admin-catalog-card${!p.visibleOnSite ? ' is-offsite' : ''}${p.hidden ? ' is-hidden' : ''}`}
                >
                  <div className="admin-catalog-card__order" title="Позиция в каталоге">
                    #{index + 1}
                  </div>
                  <PsychologistMiniCard
                    data={{
                      id: p.id,
                      name: p.name,
                      bio: p.bio,
                      therapyMethod: p.therapyMethod,
                      specialization: asSpecArray(p.specialization),
                      worksWith: p.worksWith,
                      experience: p.experience,
                      avatarUrl: p.avatarUrl,
                      sessionPriceRub: p.sessionPriceRub,
                      verified: p.isVerified,
                      rating: p.rating,
                      reviewsCount: p.reviewsCount,
                    }}
                    profileCtaLabel="Профиль"
                    showWrite={false}
                  />
                  <div className="admin-catalog-card__controls">
                    <div className="admin-catalog-card__status">
                      {p.visibleOnSite ? (
                        <span className="admin-badge admin-badge--ok">На сайте</span>
                      ) : null}
                      {!p.isVerified ? (
                        <span className="admin-badge admin-badge--warn">Нет верификации</span>
                      ) : null}
                      {p.hidden ? <span className="admin-badge admin-badge--muted">Скрыт</span> : null}
                      {p.acceptingClients === false ? (
                        <span className="admin-badge admin-badge--muted">Поиск выключен</span>
                      ) : null}
                      <span className="admin-catalog-card__email">{p.email}</span>
                    </div>
                    <div className="admin-catalog-card__actions">
                      <button
                        type="button"
                        className="button secondary"
                        title="Выше"
                        disabled={index <= 0}
                        onClick={() => moveItem(p.id, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        title="Ниже"
                        disabled={index < 0 || index >= items.length - 1}
                        onClick={() => moveItem(p.id, 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className={p.hidden ? 'button' : 'button secondary'}
                        onClick={() => toggleHidden(p.id)}
                      >
                        {p.hidden ? 'Вернуть в каталог' : 'Скрыть из каталога'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="small" style={{ color: 'var(--text-muted)', marginTop: 16, lineHeight: 1.5 }}>
          Измените порядок стрелками и нажмите «Сохранить». Скрытые психологи не показываются на{' '}
          <Link to="/psychologists" style={{ color: 'var(--brand)' }}>
            /psychologists
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
