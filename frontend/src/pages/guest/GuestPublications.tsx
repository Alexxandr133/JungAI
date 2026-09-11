import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GuestNavbar } from '../../components/GuestNavbar';
import { api, resolvePublicFileUrl } from '../../lib/api';
import { ThreadCard } from '../publications/ThreadCard';
import type { ForumCommunity, ForumPost } from '../publications/forumUtils';
import '../publications/communities.css';

export default function GuestPublications() {
  const navigate = useNavigate();
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [communities, setCommunities] = useState<ForumCommunity[]>([]);

  useEffect(() => {
    api<{ items: ForumPost[]; communities: ForumCommunity[] }>('/api/public/publications/discovery')
      .then((res) => {
        setPosts(res.items || []);
        setCommunities(res.communities || []);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="forum">
      <GuestNavbar />
      <main className="forum__main forum__main--hub">
        <div className="forum__page forum__page--bleed">
          <header className="forum__hub-top">
            <h1 className="forum__h1 forum__h1--hub">Сообщества</h1>
            <p className="forum__lead forum__lead--hub">Чтение открыто без регистрации. Подписка и комментарии — после входа.</p>
          </header>
          <div className="forum__layout forum__layout--community">
            <section className="forum__feed">
              {posts.map((post) => (
                <ThreadCard key={post.id} post={post} />
              ))}
            </section>
            <aside className="forum__rail forum__rail--flush">
              <h3 className="forum__rail-label">Сообщества</h3>
              <div className="forum__nav-list">
                {communities.map((community) => (
                  <div key={community.id} className="forum__nav-row">
                    <span className="forum__nav-link" style={{ cursor: 'default' }}>
                      <span className="forum__nav-avatar">
                        {resolvePublicFileUrl(community.avatarUrl) ? (
                          <img src={resolvePublicFileUrl(community.avatarUrl) || ''} alt="" />
                        ) : (
                          community.name.slice(0, 1)
                        )}
                      </span>
                      <span className="forum__nav-name">{community.name}</span>
                    </span>
                    <button type="button" className="forum__text-btn" onClick={() => setShowRegisterModal(true)}>
                      Подписка
                    </button>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </main>
      {showRegisterModal && (
        <div className="forum__modal-backdrop" onClick={() => setShowRegisterModal(false)}>
          <div className="forum__modal" onClick={(e) => e.stopPropagation()}>
            <div className="forum__modal-title">Нужна регистрация</div>
            <p className="forum__muted">Подписка и комментарии доступны после входа.</p>
            <div className="forum__actions">
              <button className="forum__text-btn" type="button" onClick={() => setShowRegisterModal(false)}>
                Отмена
              </button>
              <button className="forum__new-post" type="button" onClick={() => navigate('/login')}>
                Войти
              </button>
              <button className="forum__new-post" type="button" onClick={() => navigate('/register')}>
                Зарегистрироваться
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
