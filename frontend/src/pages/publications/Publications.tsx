import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { UniversalNavbar } from '../../components/UniversalNavbar';
import { PlatformIcon } from '../../components/icons';
import { PostModal } from './PostModal';

type Community = {
  id: string;
  slug: string;
  name: string;
  description: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  ownerId: string;
};
type Author = { id: string; email: string; role: string; name?: string | null; avatarUrl?: string | null };
type FeedPost = {
  id: string;
  title: string;
  content: string;
  imageUrl?: string | null;
  authorId: string;
  communityId?: string | null;
  createdAt: string;
  commentsCount: number;
  status?: string;
  authorMode?: string;
  author: Author | null;
  community?: { id: string; slug: string; name: string; avatarUrl?: string | null } | null;
};
const fieldStyle: any = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'var(--surface-2)',
  color: 'var(--text)'
};

function canCreate(role?: string) {
  return role === 'psychologist' || role === 'researcher' || role === 'admin';
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const diffHours = Math.floor((Date.now() - d.getTime()) / 3600000);
  if (diffHours < 1) return 'только что';
  if (diffHours < 24) return `${diffHours} ч назад`;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' });
}

export default function PublicationsPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const isCreator = canCreate(user?.role);

  const [communities, setCommunities] = useState<Community[]>([]);
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCommunityModal, setShowCommunityModal] = useState(false);
  const [newCommunityName, setNewCommunityName] = useState('');
  const [newCommunityDescription, setNewCommunityDescription] = useState('');
  const [newCommunityAvatarUrl, setNewCommunityAvatarUrl] = useState('');
  const [newCommunityCoverUrl, setNewCommunityCoverUrl] = useState('');
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [authorMode, setAuthorMode] = useState<'account' | 'community'>('account');
  const [postCommunityId, setPostCommunityId] = useState('');
  const [editorHtml, setEditorHtml] = useState('');
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  async function loadFeed() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await api<{ posts: FeedPost[]; communities: Community[] }>('/api/publications/me', { token });
      setFeed(res.posts || []);
      setCommunities(res.communities || []);
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить ленту');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFeed().catch(() => undefined);
  }, [token]);

  async function fileToDataUrl(file: File | null): Promise<string> {
    if (!file) return '';
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function createCommunity() {
    if (!token || !isCreator) return;
    if (!newCommunityName.trim() || !newCommunityDescription.trim()) return;
    setPending((s) => ({ ...s, community: true }));
    try {
      await api('/api/communities', {
        method: 'POST',
        token,
        body: {
          name: newCommunityName.trim(),
          description: newCommunityDescription.trim(),
          avatarUrl: newCommunityAvatarUrl.trim() || null,
          coverUrl: newCommunityCoverUrl.trim() || null
        }
      });
      setShowCommunityModal(false);
      setNewCommunityName('');
      setNewCommunityDescription('');
      setNewCommunityAvatarUrl('');
      setNewCommunityCoverUrl('');
      await loadFeed();
    } finally {
      setPending((s) => ({ ...s, community: false }));
    }
  }

  async function createPost() {
    if (!token || !isCreator) return;
    if (!title.trim() || !editorHtml.trim()) return;
    if (authorMode === 'community' && !postCommunityId) return;
    setPending((s) => ({ ...s, post: true }));
    try {
      await api('/api/publications/posts', {
        method: 'POST',
        token,
        body: {
          title: title.trim(),
          content: editorHtml.trim(),
          imageUrl: imageUrl.trim() || null,
          communityId: authorMode === 'community' ? postCommunityId : null,
          authorMode,
          status: 'draft'
        }
      });
      setTitle('');
      setEditorHtml('');
      if (editorRef.current) editorRef.current.innerHTML = '';
      setImageUrl('');
      setAuthorMode('account');
      setPostCommunityId('');
      await loadFeed();
    } finally {
      setPending((s) => ({ ...s, post: false }));
    }
  }

  async function publishPost(postId: string) {
    if (!token) return;
    await api(`/api/publications/posts/${postId}/publish`, { method: 'POST', token });
    await loadFeed();
  }

  async function deletePost(postId: string) {
    if (!token) return;
    if (!window.confirm('Точно удалить публикацию? Это действие нельзя отменить.')) return;
    await api(`/api/publications/posts/${postId}`, { method: 'DELETE', token });
    await loadFeed();
  }

  async function savePost(post: FeedPost) {
    if (!token) return;
    await api(`/api/publications/posts/${post.id}`, {
      method: 'PATCH',
      token,
      body: { title: post.title, content: post.content, imageUrl: post.imageUrl || null }
    });
    setEditingPostId(null);
    await loadFeed();
  }

  function applyEditorCommand(command: string, value?: string) {
    document.execCommand(command, false, value);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <UniversalNavbar />
      <main style={{ flex: 1, padding: '24px clamp(16px, 4vw, 42px)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', gap: 16 }}>
          <aside className="card" style={{ padding: 16, alignSelf: 'start' }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Мой профиль</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 10, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'grid', placeItems: 'center', fontWeight: 700 }}>
                {(user?.email || 'U').slice(0, 1).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, lineHeight: 1.2 }}>{user?.email || 'Пользователь'}</div>
                <div className="small" style={{ color: 'var(--text-muted)' }}>{user?.role || 'role'}</div>
              </div>
            </div>

            <div style={{ fontWeight: 800, marginBottom: 12 }}>Мои сообщества</div>
            {isCreator && (
              <div
                onClick={() => setShowCommunityModal(true)}
                style={{
                  border: '1px dashed rgba(124,58,237,0.45)',
                  background: 'linear-gradient(135deg, rgba(124,58,237,0.14), rgba(59,130,246,0.1))',
                  borderRadius: 14,
                  padding: 14,
                  cursor: 'pointer',
                  marginBottom: 12
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                  <PlatformIcon name="plus" size={15} strokeWidth={2} />
                  Создать сообщество
                </div>
                <div className="small" style={{ color: 'var(--text-muted)', marginTop: 6 }}>
                  Отдельный блок для создания, не как карточка сообщества
                </div>
              </div>
            )}
            <div style={{ display: 'grid', gap: 10, maxHeight: '65vh', overflowY: 'auto' }}>
              {communities.map((community) => (
                <div
                  key={community.id}
                  onClick={() => navigate(`/publications/community/${community.slug}`)}
                  style={{
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 14,
                    cursor: 'pointer',
                    background: 'var(--surface-2)'
                  }}
                >
                  <div style={{ display: 'flex', gap: 10, padding: 10 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        flexShrink: 0,
                        background: 'rgba(255,255,255,0.08)',
                        display: 'grid',
                        placeItems: 'center'
                      }}
                    >
                      {community.avatarUrl ? (
                        <img src={community.avatarUrl} alt={community.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <PlatformIcon name="users" size={16} strokeWidth={2} />
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, lineHeight: 1.2 }}>{community.name}</div>
                      <div className="small" style={{ color: 'var(--text-muted)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {community.description}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <section>
            <div className="card" style={{ padding: 18, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: 28 }}>Публикации</h1>
                  <div className="small" style={{ color: 'var(--text-muted)', marginTop: 6 }}>
                    Ваши публикации, комментарии и реакции
                  </div>
                </div>
              </div>
            </div>

            {isCreator && (
              <div className="card" style={{ padding: 16, marginBottom: 16, display: 'grid', gap: 10 }}>
                <input style={fieldStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Заголовок публикации" />
                <div style={{ display: 'grid', gap: 6 }}>
                  <label className="small">Фото публикации</label>
                  <input
                    type="file"
                    accept="image/*"
                    style={fieldStyle}
                    onChange={async (e) => setImageUrl(await fileToDataUrl(e.target.files?.[0] || null))}
                  />
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  <label className="small">Публиковать от лица</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className={authorMode === 'account' ? 'button' : 'button secondary'} type="button" onClick={() => { setAuthorMode('account'); setPostCommunityId(''); }}>
                      Аккаунта
                    </button>
                    {communities.map((c) => (
                      <button
                        key={c.id}
                        className={authorMode === 'community' && postCommunityId === c.id ? 'button' : 'button secondary'}
                        type="button"
                        onClick={() => { setAuthorMode('community'); setPostCommunityId(c.id); }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="button secondary" type="button" onClick={() => applyEditorCommand('bold')}>Ж</button>
                  <button className="button secondary" type="button" onClick={() => applyEditorCommand('italic')}>К</button>
                  <button className="button secondary" type="button" onClick={() => applyEditorCommand('underline')}>Ч</button>
                  <button className="button secondary" type="button" onClick={() => applyEditorCommand('insertUnorderedList')}>Список</button>
                  <button className="button secondary" type="button" onClick={() => applyEditorCommand('formatBlock', 'h2')}>H2</button>
                </div>
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => setEditorHtml((e.target as HTMLDivElement).innerHTML)}
                  style={{ ...fieldStyle, minHeight: 220, lineHeight: 1.6, direction: 'ltr', textAlign: 'left', unicodeBidi: 'plaintext' }}
                />
                {!editorHtml.trim() && (
                  <div className="small" style={{ color: 'var(--text-muted)', marginTop: -6 }}>
                    Поделитесь опытом, методикой или кейсом...
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div className="small" style={{ color: 'var(--text-muted)' }}>
                    Публикация создается как черновик
                  </div>
                  <button className="button" disabled={pending.post || !title.trim() || !editorHtml.trim() || (authorMode === 'community' && !postCommunityId)} onClick={createPost}>
                    {pending.post ? 'Создание...' : 'Создать'}
                  </button>
                </div>
              </div>
            )}

            {error && <div className="card" style={{ padding: 12, marginBottom: 12, color: '#ef4444' }}>{error}</div>}
            {loading && <div className="small" style={{ color: 'var(--text-muted)' }}>Загрузка ленты...</div>}

            <div style={{ display: 'grid', gap: 12 }}>
              {feed.map((post) => (
                <article
                  key={post.id}
                  className="card"
                  style={{ padding: 16, cursor: 'pointer', overflow: 'hidden' }}
                  onClick={() => setSelectedPostId(post.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8, minWidth: 0 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{post.title}</div>
                      <div className="small" style={{ color: 'var(--text-muted)', marginTop: 4, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                        {post.authorMode === 'community' && post.community
                          ? `${post.community.name} (сообщество)`
                          : (post.author?.name || post.author?.email || 'Автор')} • {post.author?.role || 'user'} • {formatDate(post.createdAt)}
                      </div>
                      <div className="small" style={{ color: post.status === 'draft' ? '#f59e0b' : 'var(--text-muted)', marginTop: 4 }}>
                        {post.status === 'draft' ? 'Черновик' : 'Опубликовано'}
                      </div>
                    </div>
                    {post.community?.slug && (
                      <button
                        className="button secondary"
                        style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/publications/community/${post.community?.slug}`);
                        }}
                      >
                        {post.community.name}
                      </button>
                    )}
                  </div>
                  {post.imageUrl && (
                    <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
                      <img src={post.imageUrl} alt={post.title} style={{ width: '100%', maxHeight: 340, objectFit: 'cover' }} />
                    </div>
                  )}
                  {editingPostId === post.id ? (
                    <div style={{ display: 'grid', gap: 8, marginBottom: 12 }} onClick={(e) => e.stopPropagation()}>
                      <input
                        style={fieldStyle}
                        value={post.title}
                        onChange={(e) => setFeed((s) => s.map((x) => (x.id === post.id ? { ...x, title: e.target.value } : x)))}
                      />
                      <textarea
                        style={fieldStyle}
                        rows={4}
                        value={post.content}
                        onChange={(e) => setFeed((s) => s.map((x) => (x.id === post.id ? { ...x, content: e.target.value } : x)))}
                      />
                    </div>
                  ) : (
                    <div style={{ lineHeight: 1.6, marginBottom: 12, direction: 'ltr', textAlign: 'left', unicodeBidi: 'plaintext', maxWidth: '100%', overflowWrap: 'anywhere', wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: post.content }} />
                  )}
                  <div className="small" style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <PlatformIcon name="message" size={14} strokeWidth={2} /> {post.commentsCount} комментариев • Открыть статью
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
                    {editingPostId === post.id ? (
                      <>
                        <button className="button" onClick={() => savePost(post)}>Сохранить</button>
                        <button className="button secondary" onClick={() => setEditingPostId(null)}>Отмена</button>
                      </>
                    ) : (
                      <>
                        <button className="button secondary" onClick={() => setEditingPostId(post.id)}>Редактировать</button>
                        {post.status === 'draft' && <button className="button" onClick={() => publishPost(post.id)}>Опубликовать</button>}
                        <button className="button secondary" onClick={() => deletePost(post.id)}>Удалить</button>
                      </>
                    )}
                  </div>
                </article>
              ))}
              {!loading && feed.length === 0 && (
                <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Лента пока пустая. Создайте первое сообщество и публикацию.
                </div>
              )}
            </div>
          </section>

        </div>
      </main>

      {showCommunityModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: 'min(560px, 95vw)', padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Новое сообщество</div>
            <input style={fieldStyle} value={newCommunityName} onChange={(e) => setNewCommunityName(e.target.value)} placeholder="Название сообщества" />
            <textarea
              style={fieldStyle}
              value={newCommunityDescription}
              onChange={(e) => setNewCommunityDescription(e.target.value)}
              rows={4}
              placeholder="Описание и цель сообщества"
            />
            <div style={{ display: 'grid', gap: 6 }}>
              <label className="small">Аватар сообщества</label>
              <input
                type="file"
                accept="image/*"
                style={fieldStyle}
                onChange={async (e) => setNewCommunityAvatarUrl(await fileToDataUrl(e.target.files?.[0] || null))}
              />
              {newCommunityAvatarUrl && (
                <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 10, background: 'var(--surface-2)' }}>
                  <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 8 }}>Предпросмотр аватарки</div>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
                    <img src={newCommunityAvatarUrl} alt="avatar-preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <label className="small">Обложка сообщества</label>
              <input
                type="file"
                accept="image/*"
                style={fieldStyle}
                onChange={async (e) => setNewCommunityCoverUrl(await fileToDataUrl(e.target.files?.[0] || null))}
              />
              {newCommunityCoverUrl && (
                <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 10, background: 'var(--surface-2)' }}>
                  <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 8 }}>Предпросмотр обложки</div>
                  <div style={{ width: '100%', maxHeight: 160, borderRadius: 10, overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
                    <img src={newCommunityCoverUrl} alt="cover-preview" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }} />
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="button secondary" onClick={() => setShowCommunityModal(false)}>
                Отмена
              </button>
              <button className="button" disabled={pending.community} onClick={createCommunity}>
                {pending.community ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
      {selectedPostId && <PostModal postId={selectedPostId} onClose={() => setSelectedPostId(null)} />}
    </div>
  );
}

