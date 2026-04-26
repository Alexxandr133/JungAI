import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { UniversalNavbar } from '../../components/UniversalNavbar';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

type PostDetails = {
  id: string;
  title: string;
  content: string;
  imageUrl?: string | null;
  createdAt: string;
  author?: { id: string; name?: string | null; email?: string | null; role?: string } | null;
  community?: { id: string; slug: string; name: string } | null;
  comments: Array<{
    id: string;
    content: string;
    createdAt: string;
    author?: { id: string; name?: string | null; email?: string | null; role?: string } | null;
  }>;
  reactionsCount: number;
  likedByMe: boolean;
};

function canComment(role?: string) {
  return role === 'psychologist' || role === 'researcher' || role === 'admin';
}

export default function PostView() {
  const { id = '' } = useParams();
  const { token, user } = useAuth();
  const [post, setPost] = useState<PostDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const canWriteComment = useMemo(() => canComment(user?.role), [user?.role]);

  async function loadPost() {
    if (!token || !id) return;
    setLoading(true);
    setError('');
    try {
      const res = await api<{ item: PostDetails }>(`/api/publications/posts/${id}`, { token });
      setPost(res.item);
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить публикацию');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPost().catch(() => undefined);
  }, [token, id]);

  async function submitComment() {
    if (!token || !id || !comment.trim() || !canWriteComment) return;
    setSaving(true);
    try {
      await api(`/api/publications/posts/${id}/comments`, {
        method: 'POST',
        token,
        body: { content: comment.trim() }
      });
      setComment('');
      await loadPost();
    } finally {
      setSaving(false);
    }
  }

  async function toggleReaction() {
    if (!token || !id) return;
    await api(`/api/publications/posts/${id}/reactions`, { method: 'POST', token, body: { type: 'like' } });
    await loadPost();
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <UniversalNavbar />
      <main style={{ padding: '24px clamp(16px, 4vw, 42px)', flex: 1 }}>
        {loading && <div className="small">Загрузка публикации...</div>}
        {error && <div className="card" style={{ padding: 12, color: '#ef4444' }}>{error}</div>}

        {post && (
          <div style={{ maxWidth: 920, marginInline: 'auto', display: 'grid', gap: 12 }}>
            <article className="card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: 28 }}>{post.title}</h1>
                  <div className="small" style={{ color: 'var(--text-muted)', marginTop: 8 }}>
                    {(post.author?.name || post.author?.email || 'Автор')} • {post.author?.role || 'user'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Link className="button secondary" to="/publications">Назад в ленту</Link>
                  {post.community?.slug && <Link className="button secondary" to={`/publications/community/${post.community.slug}`}>Сообщество</Link>}
                </div>
              </div>

              {post.imageUrl && (
                <div style={{ marginTop: 14, borderRadius: 14, overflow: 'hidden' }}>
                  <img src={post.imageUrl} alt={post.title} style={{ width: '100%', maxHeight: 420, objectFit: 'cover' }} />
                </div>
              )}

              <div style={{ marginTop: 16, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{post.content}</div>
            </article>

            <section className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontWeight: 700 }}>Реакции</div>
                <button className={post.likedByMe ? 'button' : 'button secondary'} onClick={toggleReaction}>
                  {post.likedByMe ? 'Убрать лайк' : 'Поставить лайк'} ({post.reactionsCount || 0})
                </button>
              </div>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Комментарии ({post.comments?.length || 0})</div>
              {canWriteComment ? (
                <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
                  <textarea
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Ваш комментарий к публикации..."
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="button" onClick={submitComment} disabled={saving || !comment.trim()}>
                      {saving ? 'Отправка...' : 'Отправить комментарий'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
                  Комментарии могут писать психологи, исследователи и администраторы.
                </div>
              )}

              <div style={{ display: 'grid', gap: 10 }}>
                {(post.comments || []).map((item) => (
                  <div key={item.id} style={{ padding: 10, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}>
                    <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 6 }}>
                      {(item.author?.name || item.author?.email || 'Пользователь')} • {item.author?.role || 'user'}
                    </div>
                    <div style={{ lineHeight: 1.55 }}>{item.content}</div>
                  </div>
                ))}
                {(!post.comments || post.comments.length === 0) && (
                  <div className="small" style={{ color: 'var(--text-muted)' }}>Пока нет комментариев.</div>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
