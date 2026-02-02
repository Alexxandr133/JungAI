import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ClientNavbar } from '../../components/ClientNavbar';

type Post = {
  id: string;
  title: string;
  content: string;
  author: string;
  authorRank: string;
  topic: string;
  createdAt: string;
  likes: number;
  replies: number;
  views: number;
};

type Topic = {
  id: string;
  name: string;
  description: string;
  postsCount: number;
  icon: string;
};

export default function ClientCommunity() {
  const { user } = useAuth();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');

  useEffect(() => {
    const demoTopics: Topic[] = [
      { id: 't1', name: 'Как пережить развод?', description: 'Поддержка и советы', postsCount: 24, icon: '💔' },
      { id: 't2', name: 'Страх близости', description: 'Обсуждение проблем в отношениях', postsCount: 18, icon: '💑' },
      { id: 't3', name: 'Кризис среднего возраста', description: 'Поиск смысла и направления', postsCount: 31, icon: '🎯' },
      { id: 't4', name: 'Работа с Тенью', description: 'Интеграция скрытых аспектов', postsCount: 42, icon: '🌑' },
      { id: 't5', name: 'Интерпретация снов', description: 'Обмен опытом и символами', postsCount: 67, icon: '💭' },
      { id: 't6', name: 'Архетипы и мифы', description: 'Изучение архетипических паттернов', postsCount: 19, icon: '🎭' }
    ];
    setTopics(demoTopics);

    const demoPosts: Post[] = [
      { id: 'p1', title: 'Мой опыт работы с Тенью', content: 'Хочу поделиться тем, как я начал работать со своей Тенью...', author: 'Алексей', authorRank: 'Искатель', topic: 't4', createdAt: new Date(Date.now() - 3600000).toISOString(), likes: 12, replies: 5, views: 89 },
      { id: 'p2', title: 'Сон о красной двери', content: 'Приснилась красная дверь в длинном коридоре. Что это может означать?', author: 'Мария', authorRank: 'Путник', topic: 't5', createdAt: new Date(Date.now() - 7200000).toISOString(), likes: 8, replies: 12, views: 156 },
      { id: 'p3', title: 'Как справиться с тревогой?', content: 'Постоянно чувствую тревогу, особенно перед сном...', author: 'Дмитрий', authorRank: 'Начинающий Герой', topic: 't1', createdAt: new Date(Date.now() - 10800000).toISOString(), likes: 15, replies: 9, views: 203 }
    ];
    setPosts(demoPosts);
  }, []);

  function formatDate(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'только что';
    if (hours < 24) return `${hours} ч назад`;
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  }

  function createPost() {
    if (!newPostTitle.trim() || !newPostContent.trim() || !selectedTopic) return;
    if (!user) {
      // Показываем модальное окно регистрации через событие
      window.dispatchEvent(new CustomEvent('show-register-modal', { detail: { reason: 'create-post' } }));
      return;
    }
    
    const newPost: Post = {
      id: `p-${Date.now()}`,
      title: newPostTitle,
      content: newPostContent,
      author: user?.email?.split('@')[0] || 'Пользователь',
      authorRank: 'Начинающий Герой',
      topic: selectedTopic,
      createdAt: new Date().toISOString(),
      likes: 0,
      replies: 0,
      views: 0
    };
    
    setPosts([newPost, ...posts]);
    setShowNewPost(false);
    setNewPostTitle('');
    setNewPostContent('');
  }

  const filteredPosts = selectedTopic ? posts.filter(p => p.topic === selectedTopic) : posts;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ClientNavbar />
      <main style={{ flex: 1, padding: '32px 48px', maxWidth: '100%', overflowX: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>Сообщество</h1>
          {user && (
            <button className="button" onClick={() => setShowNewPost(true)} style={{ padding: '10px 20px' }}>+ Новый пост</button>
          )}
        </div>

        {/* Topics */}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Темы</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            <div 
              className={`card ${!selectedTopic ? 'card-hover-shimmer' : ''}`}
              onClick={() => setSelectedTopic(null)}
              style={{ 
                padding: 14, 
                cursor: 'pointer',
                border: !selectedTopic ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)'
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
              <div style={{ fontWeight: 700 }}>Все темы</div>
            </div>
            {topics.map(topic => (
              <div 
                key={topic.id}
                className={`card ${selectedTopic === topic.id ? 'card-hover-shimmer' : ''}`}
                onClick={() => setSelectedTopic(topic.id)}
                style={{ 
                  padding: 14, 
                  cursor: 'pointer',
                  border: selectedTopic === topic.id ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 8 }}>{topic.icon}</div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{topic.name}</div>
                <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{topic.description}</div>
                <div className="small" style={{ color: 'var(--text-muted)' }}>{topic.postsCount} постов</div>
              </div>
            ))}
          </div>
        </div>

        {/* Posts */}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Посты {selectedTopic && `(${topics.find(t => t.id === selectedTopic)?.name})`}</div>
          <div style={{ display: 'grid', gap: 12 }}>
            {filteredPosts.length === 0 ? (
              <div className="card" style={{ padding: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
                <div style={{ fontWeight: 600 }}>Нет постов</div>
                <div className="small" style={{ color: 'var(--text-muted)', marginTop: 4 }}>Создайте первый пост в этой теме!</div>
              </div>
            ) : (
              filteredPosts.map(post => (
                <div key={post.id} className="card card-hover-shimmer" style={{ padding: 16, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 18 }}>{post.title}</div>
                      <div style={{ color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>{post.content}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                        <div className="small" style={{ color: 'var(--text-muted)' }}>
                          <span style={{ fontWeight: 600 }}>{post.author}</span> · <span>{post.authorRank}</span>
                        </div>
                        <div className="small" style={{ color: 'var(--text-muted)' }}>{formatDate(post.createdAt)}</div>
                        <div style={{ display: 'flex', gap: 16 }}>
                          <div className="small" style={{ color: 'var(--text-muted)' }}>👍 {post.likes}</div>
                          <div className="small" style={{ color: 'var(--text-muted)' }}>💬 {post.replies}</div>
                          <div className="small" style={{ color: 'var(--text-muted)' }}>👁 {post.views}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* New Post Modal */}
        {showNewPost && (
          <div onClick={() => { setShowNewPost(false); setNewPostTitle(''); setNewPostContent(''); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', padding: 12, zIndex: 50 }}>
            <div className="card" onClick={e => e.stopPropagation()} style={{ width: 'min(800px, 96vw)', maxHeight: '90vh', overflow: 'auto', padding: 16, display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>Новый пост</div>
                <button className="button secondary" onClick={() => { setShowNewPost(false); setNewPostTitle(''); setNewPostContent(''); }} style={{ padding: '6px 10px', fontSize: 13 }}>Закрыть</button>
              </div>
              <div>
                <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>Тема</div>
                <select 
                  value={selectedTopic || ''} 
                  onChange={e => setSelectedTopic(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)' }}
                >
                  <option value="">Выберите тему</option>
                  {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>Заголовок</div>
                <input 
                  value={newPostTitle}
                  onChange={e => setNewPostTitle(e.target.value)}
                  placeholder="Заголовок поста"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)' }}
                />
              </div>
              <div>
                <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>Содержание</div>
                <textarea 
                  value={newPostContent}
                  onChange={e => setNewPostContent(e.target.value)}
                  placeholder="Текст поста..."
                  rows={8}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="button secondary" onClick={() => { setShowNewPost(false); setNewPostTitle(''); setNewPostContent(''); }} style={{ padding: '8px 12px' }}>Отмена</button>
                <button className="button" onClick={createPost} disabled={!newPostTitle.trim() || !newPostContent.trim() || !selectedTopic} style={{ padding: '8px 12px' }}>Опубликовать</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

