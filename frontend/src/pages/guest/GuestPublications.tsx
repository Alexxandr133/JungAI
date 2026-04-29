import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GuestNavbar } from '../../components/GuestNavbar';
import { api } from '../../lib/api';
import { PlatformIcon } from '../../components/icons';

export default function GuestPublications() {
  const navigate = useNavigate();
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [communities, setCommunities] = useState<any[]>([]);
  const [authors, setAuthors] = useState<any[]>([]);
  const [modalPost, setModalPost] = useState<any | null>(null);

  useEffect(() => {
    api<{ items: any[]; communities: any[]; authors: any[] }>('/api/public/publications/discovery')
      .then((res) => {
        setPosts(res.items || []);
        setCommunities(res.communities || []);
        setAuthors(res.authors || []);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!selectedPostId) return;
    api<{ item: any }>(`/api/public/publications/posts/${selectedPostId}`)
      .then((res) => setModalPost(res.item))
      .catch(() => setModalPost(null));
  }, [selectedPostId]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <GuestNavbar />
      <main style={{ flex: 1, padding: '24px clamp(16px, 4vw, 42px)' }}>
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <h1 style={{ margin: 0 }}>Лента</h1>
          <div className="small" style={{ color: 'var(--text-muted)', marginTop: 6 }}>
            Просмотр доступен без регистрации. Подписка и комментарии — после регистрации.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr) 280px', gap: 14 }}>
          <aside className="card" style={{ padding: 14, alignSelf: 'start' }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Сообщества</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {communities.map((community) => (
                <div key={community.id} style={{ display: 'grid', gap: 6, padding: 9, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.08)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      {community.avatarUrl ? (
                        <img src={community.avatarUrl} alt={community.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <PlatformIcon name="users" size={12} strokeWidth={2} />
                      )}
                    </div>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{community.name}</div>
                  </div>
                  <div className="small" style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{community.description}</div>
                  <button className="button secondary" onClick={() => setShowRegisterModal(true)}>Подписаться</button>
                </div>
              ))}
            </div>
          </aside>
          <section style={{ display: 'grid', gap: 12 }}>
            {posts.map((post) => (
              <article key={post.id} className="card" style={{ padding: 16, cursor: 'pointer' }} onClick={() => setSelectedPostId(post.id)}>
                <div style={{ fontWeight: 700 }}>{post.title}</div>
                <div className="small" style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                  {post.authorMode === 'community' && post.community?.name
                    ? `${post.community.name} • сообщество`
                    : `${post.author?.name || post.author?.email || 'Автор'} • ${post.author?.role || 'user'}`}
                </div>
                {post.imageUrl && (
                  <div style={{ marginTop: 10, borderRadius: 10, overflow: 'hidden' }}>
                    <img src={post.imageUrl} alt={post.title} style={{ width: '100%', maxHeight: 280, objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{ marginTop: 10, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: post.content }} />
                <div className="small" style={{ color: 'var(--text-muted)', marginTop: 8 }}>
                  {post.commentsCount || 0} комментариев
                </div>
              </article>
            ))}
          </section>
          <aside className="card" style={{ padding: 14, alignSelf: 'start' }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Авторы</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {authors.map((author) => (
                <div key={author.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 8, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}>
                  <PlatformIcon name="user" size={14} strokeWidth={2} />
                  <div className="small">{author.name || author.email}</div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </main>

      {selectedPostId && (
        <div onClick={() => { setSelectedPostId(null); setModalPost(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'grid', placeItems: 'center', zIndex: 1100 }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: 'min(900px,95vw)', maxHeight: '90vh', overflow: 'auto', padding: 16 }}>
            {modalPost ? (
              <>
                <div style={{ fontWeight: 700, fontSize: 20 }}>{modalPost.title}</div>
                <div className="small" style={{ color: 'var(--text-muted)', marginTop: 6 }}>{modalPost.author?.name || modalPost.author?.email || 'Автор'}</div>
                {modalPost.imageUrl && (
                  <div style={{ marginTop: 12, borderRadius: 12, overflow: 'hidden' }}>
                    <img src={modalPost.imageUrl} alt={modalPost.title} style={{ width: '100%', maxHeight: 360, objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{ marginTop: 12 }} dangerouslySetInnerHTML={{ __html: modalPost.content }} />
                <div style={{ marginTop: 12 }}>
                  <button className="button secondary" onClick={() => setShowRegisterModal(true)}>Комментировать (нужна регистрация)</button>
                </div>
              </>
            ) : (
              <div>Загрузка...</div>
            )}
          </div>
        </div>
      )}

      {/* Register Modal */}
      {showRegisterModal && (
        <div onClick={() => setShowRegisterModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', padding: 12, zIndex: 50 }}>
          <div className="card" onClick={e => e.stopPropagation()} style={{ maxWidth: 500, padding: 24 }}>
            <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 16 }}>Регистрация необходима</div>
            <p style={{ marginBottom: 24, color: 'var(--text-muted)' }}>
              Для подписки и комментариев необходимо зарегистрироваться на платформе.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="button secondary" onClick={() => setShowRegisterModal(false)} style={{ padding: '10px 20px' }}>
                Отмена
              </button>
              <button className="button" onClick={() => navigate('/login')} style={{ padding: '10px 20px' }}>
                Войти
              </button>
              <button className="button" onClick={() => navigate('/register')} style={{ padding: '10px 20px' }}>
                Зарегистрироваться
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

