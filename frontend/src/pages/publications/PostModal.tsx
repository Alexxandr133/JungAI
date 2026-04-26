import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { PlatformIcon } from '../../components/icons';

type PostDetails = {
  id: string;
  title: string;
  content: string;
  imageUrl?: string | null;
  authorMode?: string;
  createdAt: string;
  author?: { id: string; name?: string | null; email?: string | null; role?: string } | null;
  community?: { id: string; slug: string; name: string } | null;
  comments: Array<{
    id: string;
    content: string;
    createdAt: string;
    author?: { id: string; name?: string | null; email?: string | null; role?: string; avatarUrl?: string | null } | null;
  }>;
  reactionsCount: number;
  likedByMe: boolean;
};

function canComment(role?: string) {
  return role === 'psychologist' || role === 'researcher' || role === 'admin';
}

export function PostModal({ postId, onClose }: { postId: string; onClose: () => void }) {
  const { token, user } = useAuth();
  const [post, setPost] = useState<PostDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const canWriteComment = useMemo(() => canComment(user?.role), [user?.role]);

  async function loadPost() {
    if (!token || !postId) return;
    setLoading(true);
    try {
      const res = await api<{ item: PostDetails }>(`/api/publications/posts/${postId}`, { token });
      setPost(res.item);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPost().catch(() => undefined);
  }, [token, postId]);

  async function submitComment() {
    if (!token || !postId || !comment.trim() || !canWriteComment) return;
    setSaving(true);
    try {
      await api(`/api/publications/posts/${postId}/comments`, {
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
    if (!token || !postId) return;
    await api(`/api/publications/posts/${postId}/reactions`, { method: 'POST', token, body: { type: 'like' } });
    await loadPost();
  }

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', zIndex: 2000, padding: 12 }}
    >
      <div className="card" style={{ width: 'min(1120px, 96vw)', height: 'min(92vh, 760px)', overflow: 'hidden', display: 'grid', gridTemplateColumns: '58% 42%' }}>
        <div style={{ background: '#0b1020', display: 'grid', placeItems: 'center', minHeight: 0 }}>
          {post?.imageUrl ? (
            <img src={post.imageUrl} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', padding: 24 }}>
              В этой публикации нет изображения
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateRows: 'auto auto 1fr auto', minHeight: 0 }}>
          <div style={{ padding: 14, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 700 }}>{post?.title || (loading ? 'Загрузка...' : '')}</div>
              {post && (
                <div className="small" style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                  {post.authorMode === 'community' && post.community ? `${post.community.name} (сообщество)` : (post.author?.name || post.author?.email || 'Автор')}
                </div>
              )}
            </div>
            <button className="button secondary" onClick={onClose}>Закрыть</button>
          </div>

          <div style={{ padding: 14, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: post?.content || '' }} />
          </div>

          <div style={{ padding: 14, overflowY: 'auto', minHeight: 0, display: 'grid', gap: 8 }}>
            {(post?.comments || []).map((item) => (
              <div key={item.id} style={{ padding: 10, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, display: 'flex', gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.1)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  {item.author?.avatarUrl ? (
                    <img src={item.author.avatarUrl} alt={item.author?.name || item.author?.email || 'U'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 12 }}>{(item.author?.name || item.author?.email || 'U').slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 4 }}>
                  {item.author?.name || item.author?.email || 'Пользователь'}
                </div>
                <div style={{ lineHeight: 1.55 }}>{item.content}</div>
                </div>
              </div>
            ))}
            {!loading && (!post?.comments || post.comments.length === 0) && (
              <div className="small" style={{ color: 'var(--text-muted)' }}>Пока нет комментариев.</div>
            )}
          </div>

          <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={toggleReaction}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: post?.likedByMe ? '#ef4444' : 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <PlatformIcon name="heart" size={18} strokeWidth={2} />
                <span className="small">{post?.reactionsCount || 0}</span>
              </button>
            </div>
            {canWriteComment && (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Напишите комментарий..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.14)', background: 'var(--surface-2)', color: 'var(--text)' }}
                />
                <button className="button" style={{ minWidth: 110, fontSize: 12, padding: '8px 12px' }} onClick={submitComment} disabled={saving || !comment.trim()}>
                  {saving ? 'Отправка...' : 'Отправить'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
