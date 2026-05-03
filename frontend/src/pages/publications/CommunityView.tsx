import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { UniversalNavbar } from '../../components/UniversalNavbar';
import { useIsNarrowViewport } from '../../hooks/useIsNarrowViewport';
import { useAuth } from '../../context/AuthContext';
import { api, resolvePublicFileUrl } from '../../lib/api';
import { PostModal } from './PostModal';

type Community = {
  id: string;
  slug: string;
  name: string;
  description: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  ownerId: string;
  postsCount: number;
  membersCount: number;
  isSubscribed?: boolean;
  currentRole?: string | null;
};

type Post = {
  id: string;
  title: string;
  content: string;
  imageUrl?: string | null;
  createdAt: string;
  author?: { name?: string | null; email?: string | null; role?: string };
};

export default function CommunityView() {
  const { slug = '' } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const narrow = useIsNarrowViewport();
  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [members, setMembers] = useState<Array<{ id: string; userId: string; role: string; user?: { name?: string | null; email?: string | null; avatarUrl?: string | null } | null }>>([]);
  const [editing, setEditing] = useState(false);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAvatarUrl, setFormAvatarUrl] = useState('');
  const [formCoverUrl, setFormCoverUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const fieldStyle: any = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'var(--surface-2)',
    color: 'var(--text)'
  };

  async function fileToDataUrl(file: File | null): Promise<string> {
    if (!file) return '';
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  useEffect(() => {
    if (!token || !slug) return;
    setLoading(true);
    api<{ community: Community; members: any[]; posts: Post[] }>(`/api/communities/${slug}`, { token })
      .then((res) => {
        setCommunity(res.community);
        setMembers(res.members || []);
        setPosts(res.posts || []);
        setFormName(res.community?.name || '');
        setFormDescription(res.community?.description || '');
        setFormAvatarUrl(res.community?.avatarUrl || '');
        setFormCoverUrl(res.community?.coverUrl || '');
      })
      .catch((e: any) => setError(e?.message || 'Не удалось загрузить сообщество'))
      .finally(() => setLoading(false));
  }, [token, slug]);

  const canManage = !!community && (community.currentRole === 'owner' || community.currentRole === 'moderator' || user?.role === 'admin');

  async function toggleSubscription() {
    if (!token || !community) return;
    await api(`/api/communities/${community.id}/subscription`, { method: 'POST', token });
    if (community?.slug) {
      const res = await api<{ community: Community; members: any[]; posts: Post[] }>(`/api/communities/${community.slug}`, { token });
      setCommunity(res.community);
      setMembers(res.members || []);
    }
  }

  async function saveCommunity() {
    if (!token || !community || !canManage) return;
    setSaving(true);
    try {
      const res = await api<{ item: Community }>(`/api/communities/${community.id}`, {
        method: 'PATCH',
        token,
        body: {
          name: formName,
          description: formDescription,
          avatarUrl: formAvatarUrl || null,
          coverUrl: formCoverUrl || null
        }
      });
      setCommunity((prev) => (prev ? { ...prev, ...res.item } : prev));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function deleteCommunity() {
    if (!token || !community || !canManage) return;
    if (!window.confirm('Точно удалить сообщество? Это удалит посты и подписки.')) return;
    await api(`/api/communities/${community.id}`, { method: 'DELETE', token });
    navigate('/feed');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <UniversalNavbar />
      <main style={{ padding: narrow ? '16px 12px' : '24px clamp(16px, 4vw, 42px)', flex: 1, overflowX: 'hidden' }}>
        <div className="card" style={{ padding: 0, marginBottom: 14, overflow: 'hidden' }}>
          <div
            style={{
              height: 160,
              backgroundImage: community?.coverUrl
                ? `url(${resolvePublicFileUrl(community.coverUrl) || community.coverUrl})`
                : 'linear-gradient(135deg, rgba(124,58,237,0.4), rgba(59,130,246,0.4))',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />
          <div style={{ padding: narrow ? 14 : 18 }}>
          <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: '1 1 240px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    display: 'grid',
                    placeItems: 'center',
                    background: 'rgba(255,255,255,0.1)'
                  }}
                >
                  {resolvePublicFileUrl(community?.avatarUrl) ? (
                    <img src={resolvePublicFileUrl(community?.avatarUrl) || ''} alt={community.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontWeight: 700 }}>{(community?.name || 'C').slice(0, 1)}</span>
                  )}
                </div>
              </div>
              <h1 style={{ margin: 0, fontSize: narrow ? 22 : undefined, lineHeight: 1.2 }}>{community?.name || 'Сообщество'}</h1>
              <div className="small" style={{ color: 'var(--text-muted)', marginTop: 6 }}>
                {community?.description || 'Описание сообщества'}
              </div>
              {community && (
                <div className="small" style={{ color: 'var(--text-muted)', marginTop: 8 }}>
                  {community.membersCount} участников • {community.postsCount} публикаций
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: narrow ? 'flex-start' : 'flex-end', flex: narrow ? '1 1 100%' : undefined }}>
              <Link className="button secondary" to="/feed">Назад в ленту</Link>
              <button className="button secondary" onClick={toggleSubscription}>
                {community?.isSubscribed ? 'Отписаться' : 'Подписаться'}
              </button>
              {canManage && community && (
                <button className="button" onClick={() => setEditing(true)}>Управление</button>
              )}
            </div>
          </div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : 'minmax(260px, 320px) minmax(0, 1fr)',
            gap: 12,
            alignItems: 'start'
          }}
        >
          <aside className="card" style={{ padding: 12, alignSelf: 'start', order: narrow ? 1 : undefined, width: '100%', minWidth: 0 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Подписчики</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {(showAllMembers ? members : members.slice(0, 12)).map((item) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.08)', display: 'grid', placeItems: 'center' }}>
                    {resolvePublicFileUrl(item.user?.avatarUrl) ? (
                      <img src={resolvePublicFileUrl(item.user?.avatarUrl) || ''} alt={item.user?.name || item.user?.email || 'U'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 12 }}>{(item.user?.name || item.user?.email || 'U').slice(0, 1).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="small">
                  {(item.user?.name || item.user?.email || 'Пользователь')} ({item.role === 'owner' ? 'Владелец' : item.role})
                  </div>
                </div>
              ))}
              {members.length > 12 && (
                <button className="button secondary" onClick={() => setShowAllMembers((v) => !v)}>
                  {showAllMembers ? 'Скрыть часть' : `Показать всех (${members.length})`}
                </button>
              )}
              {!members.length && <div className="small" style={{ color: 'var(--text-muted)' }}>Пока нет подписчиков.</div>}
            </div>
          </aside>

          <section style={{ order: narrow ? -1 : undefined, minWidth: 0, width: '100%' }}>
            {loading && <div className="small">Загрузка...</div>}
            {error && <div className="card" style={{ padding: 12, color: '#ef4444' }}>{error}</div>}
            <div style={{ display: 'grid', gap: 10 }}>
          {posts.map((post) => (
            <article
              key={post.id}
              className="card"
              style={{ padding: 14, cursor: narrow ? 'default' : 'pointer' }}
              onClick={narrow ? undefined : () => setSelectedPostId(post.id)}
            >
              {narrow ? (
                <Link to={`/publications/post/${post.id}`} style={{ color: 'inherit', textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{post.title}</div>
                </Link>
              ) : (
                <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{post.title}</div>
              )}
              <div className="small" style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                {(post.author?.name || post.author?.email || 'Автор')} • {post.author?.role || 'user'}
              </div>
              {post.imageUrl && (
                <div style={{ marginTop: 10, borderRadius: 10, overflow: 'hidden' }}>
                  <img src={resolvePublicFileUrl(post.imageUrl) || post.imageUrl || ''} alt={post.title} style={{ width: '100%', maxHeight: 260, objectFit: 'cover' }} />
                </div>
              )}
              <div style={{ marginTop: 10, lineHeight: 1.6, overflowWrap: 'anywhere', direction: 'ltr', textAlign: 'left', unicodeBidi: 'plaintext' }} dangerouslySetInnerHTML={{ __html: post.content }} />
            </article>
          ))}
          {!loading && !posts.length && <div className="card" style={{ padding: 16 }}>Пока нет публикаций.</div>}
            </div>
          </section>
        </div>
      </main>

      {editing && canManage && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 1200 }}>
          <div className="card" style={{ width: 'min(720px, 95vw)', padding: 16, display: 'grid', gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Настройки сообщества</div>
            <input style={fieldStyle} value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Название" />
            <textarea style={fieldStyle} value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} placeholder="Описание" />
            <input style={fieldStyle} value={community?.slug || ''} readOnly placeholder="Slug сообщества" />
            <div style={{ display: 'grid', gap: 6 }}>
              <label className="small">Аватар сообщества</label>
              <input
                type="file"
                accept="image/*"
                style={fieldStyle}
                onChange={async (e) => setFormAvatarUrl(await fileToDataUrl(e.target.files?.[0] || null))}
              />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <label className="small">Баннер сообщества</label>
              <input
                type="file"
                accept="image/*"
                style={fieldStyle}
                onChange={async (e) => setFormCoverUrl(await fileToDataUrl(e.target.files?.[0] || null))}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="button secondary" onClick={deleteCommunity}>Удалить сообщество</button>
              <button className="button secondary" onClick={() => setEditing(false)}>Закрыть</button>
              <button className="button" onClick={saveCommunity} disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить'}</button>
            </div>
          </div>
        </div>
      )}
      {selectedPostId && <PostModal postId={selectedPostId} onClose={() => setSelectedPostId(null)} />}
    </div>
  );
}
