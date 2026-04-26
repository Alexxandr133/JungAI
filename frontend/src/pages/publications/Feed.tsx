import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UniversalNavbar } from '../../components/UniversalNavbar';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { PlatformIcon } from '../../components/icons';
import { PostModal } from './PostModal';

type Author = { id: string; email: string; role: string; name?: string | null; avatarUrl?: string | null };
type Community = { id: string; slug: string; name: string; description: string; avatarUrl?: string | null };
type Post = {
  id: string;
  title: string;
  content: string;
  imageUrl?: string | null;
  createdAt: string;
  commentsCount: number;
  author?: Author | null;
  community?: Community | null;
};

export default function FeedPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api<{ items: Post[]; communities: Community[]; authors: Author[] }>('/api/publications/discovery', { token })
      .then((res) => {
        setPosts(res.items || []);
        setCommunities(res.communities || []);
        setAuthors(res.authors || []);
      })
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <UniversalNavbar />
      <main style={{ flex: 1, padding: '24px clamp(16px, 4vw, 42px)' }}>
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ margin: 0 }}>Лента</h1>
              <div className="small" style={{ color: 'var(--text-muted)', marginTop: 6 }}>
                Все публикации, сообщества и авторы без фильтра по одному сообществу
              </div>
            </div>
            <Link to="/publications" className="button secondary">Мои публикации</Link>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr) 280px', gap: 14, maxWidth: '100%', overflow: 'hidden' }}>
          <aside className="card" style={{ padding: 14, alignSelf: 'start' }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Сообщества</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {communities.map((community) => (
                <div
                  key={community.id}
                  onClick={() => navigate(`/publications/community/${community.slug}`)}
                  style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 9, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, cursor: 'pointer', overflow: 'hidden' }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.08)', display: 'grid', placeItems: 'center' }}>
                    {community.avatarUrl ? <img src={community.avatarUrl} alt={community.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <PlatformIcon name="users" size={14} strokeWidth={2} />}
                  </div>
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{community.name}</div>
                    <div className="small" style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{community.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <section style={{ display: 'grid', gap: 12, minWidth: 0 }}>
            {loading && <div className="small">Загрузка...</div>}
            {posts.map((post) => (
              <article key={post.id} className="card" style={{ padding: 16, cursor: 'pointer', minWidth: 0, overflow: 'hidden' }} onClick={() => setSelectedPostId(post.id)}>
                <div style={{ fontWeight: 700 }}>{post.title}</div>
                <div className="small" style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                  {(post.author?.name || post.author?.email || 'Автор')} • {post.author?.role || 'user'}
                </div>
                {post.imageUrl && (
                  <div style={{ marginTop: 10, borderRadius: 12, overflow: 'hidden' }}>
                    <img src={post.imageUrl} alt={post.title} style={{ width: '100%', maxHeight: 320, objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{ marginTop: 10, lineHeight: 1.6, overflow: 'hidden', textOverflow: 'ellipsis', direction: 'ltr', textAlign: 'left', unicodeBidi: 'plaintext' }} dangerouslySetInnerHTML={{ __html: post.content }} />
                <div className="small" style={{ color: 'var(--text-muted)', marginTop: 10 }}>
                  {post.community?.name ? `Сообщество: ${post.community.name}` : 'Личная публикация'} • {post.commentsCount} комментариев
                </div>
              </article>
            ))}
          </section>

          <aside className="card" style={{ padding: 14, alignSelf: 'start' }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Авторы</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {authors.map((author) => (
                <div key={author.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 8, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.08)', display: 'grid', placeItems: 'center' }}>
                    {author.avatarUrl ? <img src={author.avatarUrl} alt={author.name || author.email} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <PlatformIcon name="user" size={14} strokeWidth={2} />}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, lineHeight: 1.2 }}>{author.name || author.email}</div>
                    <div className="small" style={{ color: 'var(--text-muted)' }}>{author.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </main>
      {selectedPostId && <PostModal postId={selectedPostId} onClose={() => setSelectedPostId(null)} />}
    </div>
  );
}
