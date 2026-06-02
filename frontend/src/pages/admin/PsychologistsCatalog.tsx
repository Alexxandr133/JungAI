import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAppearance } from '../../context/AppearanceContext';
import { api } from '../../lib/api';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';

type CatalogItem = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  specialization: string | null;
  isVerified: boolean;
  sortOrder: number;
  hidden: boolean;
  visibleOnSite: boolean;
};

function reindex(items: CatalogItem[]): CatalogItem[] {
  return items.map((it, index) => ({ ...it, sortOrder: index }));
}

export default function AdminPsychologistsCatalog() {
  const { token } = useAuth();
  const { appearance } = useAppearance();
  const isLight = appearance.colorMode === 'light';
  const border = isLight ? '1px solid rgba(15, 23, 42, 0.1)' : '1px solid rgba(255, 255, 255, 0.1)';

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ items: CatalogItem[] }>('/api/admin/psychologists-catalog', { token });
      setItems(reindex(res.items || []));
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить каталог');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  function moveItem(id: string, direction: -1 | 1) {
    setItems(prev => {
      const index = prev.findIndex(p => p.id === id);
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
    setItems(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        const hidden = !p.hidden;
        return { ...p, hidden, visibleOnSite: p.isVerified && !hidden };
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
        hidden: p.hidden
      }));
      await api('/api/admin/psychologists-catalog', {
        method: 'PUT',
        token,
        body: { items: payload }
      });
      setSavedHint(true);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  }

  const visibleCount = items.filter(p => p.isVerified && !p.hidden).length;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PsychologistNavbar />
      <main style={{ flex: 1, padding: '24px 32px 40px', maxWidth: 920, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <Link to="/admin" className="small" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
              ← Админ-панель
            </Link>
            <h1 style={{ margin: '8px 0 6px', fontSize: 26, fontWeight: 800 }}>Каталог психологов</h1>
            <p className="small" style={{ color: 'var(--text-muted)', margin: 0, lineHeight: 1.5, maxWidth: 560 }}>
              Порядок карточек на странице «Психологи» для гостей и клиентов. В каталоге показываются только верифицированные и не скрытые.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="button secondary" onClick={() => load()} disabled={loading || saving} style={{ padding: '8px 14px', fontSize: 13 }}>
              Обновить
            </button>
            <button type="button" className="button" onClick={save} disabled={loading || saving} style={{ padding: '8px 16px', fontSize: 13 }}>
              {saving ? 'Сохранение…' : 'Сохранить порядок'}
            </button>
          </div>
        </div>

        {error && <div style={{ color: '#ef4444', marginBottom: 12 }}>{error}</div>}
        {savedHint && !error && (
          <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)', fontSize: 13 }}>
            Сохранено. На сайте сейчас {visibleCount} психолог(ов) в публичном списке.
          </div>
        )}

        <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
          В публичном списке: <strong style={{ color: 'var(--text)' }}>{visibleCount}</strong> из {items.length}
        </div>

        {loading ? (
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>Загрузка…</div>
        ) : items.length === 0 ? (
          <div className="card" style={{ padding: 24 }}>Нет учётных записей с ролью «психолог».</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((p, index) => (
              <div
                key={p.id}
                className="card"
                style={{
                  padding: '12px 14px',
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  gap: 12,
                  alignItems: 'center',
                  border,
                  opacity: p.hidden || !p.isVerified ? 0.72 : 1
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'var(--surface-2)',
                    border,
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                    fontSize: 15,
                    color: 'var(--primary)',
                    flexShrink: 0
                  }}
                >
                  {index + 1}
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                  <div className="small" style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.email}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {p.isVerified ? (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                        Верифицирован
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(245, 158, 11, 0.15)', color: '#d97706' }}>
                        Не в каталоге (нет верификации)
                      </span>
                    )}
                    {p.hidden && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(148, 163, 184, 0.2)', color: 'var(--text-muted)' }}>
                        Скрыт
                      </span>
                    )}
                    {p.visibleOnSite && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                        На сайте
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    className="button secondary"
                    title="Выше"
                    disabled={index === 0}
                    onClick={() => moveItem(p.id, -1)}
                    style={{ padding: '6px 10px', fontSize: 14 }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    title="Ниже"
                    disabled={index === items.length - 1}
                    onClick={() => moveItem(p.id, 1)}
                    style={{ padding: '6px 10px', fontSize: 14 }}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={p.hidden ? 'button' : 'button secondary'}
                    onClick={() => toggleHidden(p.id)}
                    style={{ padding: '6px 12px', fontSize: 12, whiteSpace: 'nowrap' }}
                  >
                    {p.hidden ? 'Показать' : 'Скрыть'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="small" style={{ color: 'var(--text-muted)', marginTop: 16, lineHeight: 1.5 }}>
          Подсказка: измените порядок стрелками ↑↓ и нажмите «Сохранить порядок». Скрытые психологи не отображаются на{' '}
          <Link to="/psychologists" style={{ color: 'var(--primary)' }}>/psychologists</Link>.
        </p>
      </main>
    </div>
  );
}
