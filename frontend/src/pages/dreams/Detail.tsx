import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { UniversalNavbar } from '../../components/UniversalNavbar';
import { StarfieldBackground } from '../../components/visuals';

type Dream = {
  id: string;
  title: string;
  content?: string;
  symbols?: string[];
  createdAt: string;
  userId?: string;
  clientId?: string;
  discussOnSession?: boolean;
  client?: { id: string; name?: string; email?: string };
};

function workspaceClientId(dream: Dream): string {
  return dream.client?.id || dream.clientId || '';
}

export default function DreamDetail() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, user } = useAuth();
  const [dream, setDream] = useState<Dream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [discussSaving, setDiscussSaving] = useState(false);
  const [editing, setEditing] = useState(searchParams.get('edit') === '1');
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  const canEdit = Boolean(token && dream && (user?.role === 'client' || user?.role === 'psychologist' || user?.role === 'admin'));
  const canToggleDiscuss = Boolean(token && user?.role === 'client' && dream);
  const workClientId = dream ? workspaceClientId(dream) : '';

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (!id) throw new Error('Нет идентификатора');
        if (!token) {
          setError('Нужно войти, чтобы открыть сон');
          setDream(null);
          return;
        }
        const res = await api<Dream>(`/api/dreams/${id}`, { token });
        setDream(res);
        setEditTitle(res.title || '');
        setEditContent(res.content || '');
      } catch (e: any) {
        setDream(null);
        setError(e.message || 'Не удалось загрузить');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, token]);

  function formatDateTime(iso?: string) {
    if (!iso) return '';
    const d = new Date(iso);
    const date = d.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
    const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return `${date} · ${time}`;
  }

  function startEdit() {
    if (!dream) return;
    setEditTitle(dream.title || '');
    setEditContent(dream.content || '');
    setEditing(true);
    const next = new URLSearchParams(searchParams);
    next.set('edit', '1');
    setSearchParams(next, { replace: true });
  }

  function cancelEdit() {
    if (dream) {
      setEditTitle(dream.title || '');
      setEditContent(dream.content || '');
    }
    setEditing(false);
    const next = new URLSearchParams(searchParams);
    next.delete('edit');
    setSearchParams(next, { replace: true });
  }

  async function saveEdit() {
    if (!dream || !token) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api<Dream>(`/api/dreams/${dream.id}`, {
        token,
        method: 'PUT',
        body: {
          title: editTitle.trim() || 'Без названия',
          content: editContent,
        },
      });
      setDream({ ...dream, ...updated, title: updated.title ?? editTitle, content: updated.content ?? editContent });
      setEditing(false);
      const next = new URLSearchParams(searchParams);
      next.delete('edit');
      setSearchParams(next, { replace: true });
    } catch (e: any) {
      setError(e?.message || 'Не удалось сохранить сон');
    } finally {
      setSaving(false);
    }
  }

  async function toggleDiscussOnSession() {
    if (!dream || !token || !canToggleDiscuss) return;
    const next = !dream.discussOnSession;
    setDiscussSaving(true);
    try {
      const updated = await api<Dream>(`/api/dreams/${dream.id}`, {
        token,
        method: 'PUT',
        body: { discussOnSession: next },
      });
      setDream({ ...dream, discussOnSession: updated.discussOnSession ?? next });
    } catch (e: any) {
      setError(e?.message || 'Не удалось обновить флаг');
    } finally {
      setDiscussSaving(false);
    }
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <StarfieldBackground opacity={1} />
      <UniversalNavbar />
      <main
        style={{
          flex: 1,
          padding: '24px clamp(16px, 5vw, 48px)',
          maxWidth: '100%',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>Сон</h1>
            {dream && (
              <span className="small" style={{ color: 'var(--text-muted)' }}>
                · {formatDateTime(dream.createdAt)}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to="/dreams" className="button secondary" style={{ padding: '8px 14px', fontSize: 13 }}>
              Назад к снам
            </Link>
            {canEdit && !editing && (
              <button type="button" className="button" style={{ padding: '8px 14px', fontSize: 13 }} onClick={startEdit}>
                Изменить
              </button>
            )}
          </div>
        </div>

        {loading && (
          <div className="card" style={{ padding: 18 }}>
            <div className="small" style={{ opacity: 0.8 }}>Загрузка…</div>
          </div>
        )}
        {error && (
          <div className="card" style={{ padding: 18, border: '1px solid rgba(255,0,0,0.3)' }}>
            <div className="small" style={{ color: '#ff7b7b' }}>Ошибка: {error}</div>
          </div>
        )}
        {dream && !loading && (
          <div className="card" style={{ padding: 18, display: 'grid', gap: 14 }}>
            {editing ? (
              <>
                <label style={{ display: 'grid', gap: 8, fontWeight: 600, fontSize: 14 }}>
                  Название
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: '1px solid var(--line, rgba(255,255,255,0.12))',
                      background: 'var(--surface-2)',
                      color: 'var(--text)',
                      fontSize: 16,
                      fontWeight: 700,
                      fontFamily: 'inherit',
                    }}
                  />
                </label>
                <label style={{ display: 'grid', gap: 8, fontWeight: 600, fontSize: 14 }}>
                  Текст сна
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={12}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: '1px solid var(--line, rgba(255,255,255,0.12))',
                      background: 'var(--surface-2)',
                      color: 'var(--text)',
                      fontSize: 15,
                      lineHeight: 1.7,
                      fontFamily: "'Lora', Georgia, serif",
                      resize: 'vertical',
                    }}
                  />
                </label>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" className="button secondary" onClick={cancelEdit} disabled={saving}>
                    Отмена
                  </button>
                  <button type="button" className="button" onClick={() => void saveEdit()} disabled={saving}>
                    {saving ? 'Сохраняю…' : 'Сохранить'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 800, fontSize: 20 }}>{dream.title || 'Без названия'}</div>
                {dream.client?.name && user?.role !== 'client' && (
                  <div className="small" style={{ color: 'var(--text-muted)' }}>
                    Клиент: {dream.client.name}
                  </div>
                )}
                {dream.symbols && dream.symbols.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {dream.symbols.map((s) => (
                      <span
                        key={s}
                        className="small"
                        style={{
                          background: 'var(--surface-2)',
                          border: '1px solid var(--line, rgba(255,255,255,0.08))',
                          padding: '2px 8px',
                          borderRadius: 999,
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontFamily: "'Lora', Georgia, serif" }}>
                  {dream.content || '—'}
                </div>
              </>
            )}
            {canToggleDiscuss && !editing && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line, rgba(255,255,255,0.1))',
                  cursor: discussSaving ? 'wait' : 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                <input
                  type="checkbox"
                  checked={Boolean(dream.discussOnSession)}
                  disabled={discussSaving}
                  onChange={() => void toggleDiscussOnSession()}
                />
                Обсудить на сессии
              </label>
            )}
            {workClientId && user?.role !== 'client' && !editing && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Link
                  className="button secondary"
                  to={`/psychologist/work-area?client=${encodeURIComponent(workClientId)}`}
                  style={{ padding: '8px 14px', fontSize: 13 }}
                >
                  К рабочей области клиента
                </Link>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
