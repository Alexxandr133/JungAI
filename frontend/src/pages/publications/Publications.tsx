import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { UniversalNavbar } from '../../components/UniversalNavbar';

type Post = {
  id: string;
  title: string;
  content: string;
  author: string;
  authorId: string;
  topic: string;
  topicId: string;
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

export default function PublicationsPage() {
  const { user, token } = useAuth();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [showNewPost, setShowNewPost] = useState(false);
  const [showNewTopic, setShowNewTopic] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostTopicId, setNewPostTopicId] = useState<string>(''); // Отдельный стейт для выбора темы в модальном окне
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicDescription, setNewTopicDescription] = useState('');
  const [newTopicIcon, setNewTopicIcon] = useState('💬');
  const [loading, setLoading] = useState(false);

  async function loadTopics() {
    try {
      if (token) {
        const res = await api<{ topics: Topic[] }>('/api/publications/topics', { token });
        setTopics(res.topics || []);
      } else {
        // Demo data
        const demoTopics: Topic[] = [
          { id: 't1', name: 'Методики работы', description: 'Обмен опытом по техникам терапии', postsCount: 24, icon: '🧠' },
          { id: 't2', name: 'Кейсы и разборы', description: 'Обсуждение клинических случаев', postsCount: 18, icon: '📋' },
          { id: 't3', name: 'Супервизия', description: 'Вопросы и консультации коллег', postsCount: 31, icon: '👥' },
          { id: 't4', name: 'Исследования', description: 'Научные публикации и исследования', postsCount: 42, icon: '🔬' },
          { id: 't5', name: 'Интерпретация снов', description: 'Символика и архетипы', postsCount: 67, icon: '💭' },
          { id: 't6', name: 'Юнгианская психология', description: 'Архетипы, коллективное бессознательное', postsCount: 19, icon: '🎭' },
          { id: 't7', name: 'Этика и практика', description: 'Профессиональные стандарты', postsCount: 15, icon: '⚖️' }
        ];
        setTopics(demoTopics);
      }
    } catch (e) {
      // Fallback to demo data
      const demoTopics: Topic[] = [
        { id: 't1', name: 'Методики работы', description: 'Обмен опытом по техникам терапии', postsCount: 24, icon: '🧠' },
        { id: 't2', name: 'Кейсы и разборы', description: 'Обсуждение клинических случаев', postsCount: 18, icon: '📋' },
        { id: 't3', name: 'Супервизия', description: 'Вопросы и консультации коллег', postsCount: 31, icon: '👥' },
        { id: 't4', name: 'Исследования', description: 'Научные публикации и исследования', postsCount: 42, icon: '🔬' },
        { id: 't5', name: 'Интерпретация снов', description: 'Символика и архетипы', postsCount: 67, icon: '💭' },
        { id: 't6', name: 'Юнгианская психология', description: 'Архетипы, коллективное бессознательное', postsCount: 19, icon: '🎭' },
        { id: 't7', name: 'Этика и практика', description: 'Профессиональные стандарты', postsCount: 15, icon: '⚖️' }
      ];
      setTopics(demoTopics);
    }
  }

  async function loadPosts() {
    try {
      if (token) {
        const url = selectedTopic 
          ? `/api/publications/posts?topicId=${selectedTopic}`
          : '/api/publications/posts';
        const res = await api<{ posts: Post[] }>(url, { token });
        setPosts(res.posts || []);
      } else {
        // Demo data
        const demoPosts: Post[] = [
          { id: 'p1', title: 'Работа с комплексом Тени через активное воображение', content: 'Хочу поделиться опытом использования активного воображения для работы с комплексом Тени у клиента...', author: 'Анна Иванова', authorId: 'u1', topic: 't4', topicId: 't4', createdAt: new Date(Date.now() - 3600000).toISOString(), likes: 12, replies: 5, views: 89 },
          { id: 'p2', title: 'Интерпретация сновидения: красная дверь в длинном коридоре', content: 'Клиент описывает повторяющийся сон о красной двери. Предлагаю разобрать символику...', author: 'Дмитрий Смирнов', authorId: 'u2', topic: 't5', topicId: 't5', createdAt: new Date(Date.now() - 7200000).toISOString(), likes: 8, replies: 12, views: 156 },
          { id: 'p3', title: 'Этические вопросы при работе с границами', content: 'Как вы справляетесь с ситуациями, когда клиент нарушает границы терапевтических отношений?', author: 'Мария Петрова', authorId: 'u3', topic: 't7', topicId: 't7', createdAt: new Date(Date.now() - 10800000).toISOString(), likes: 15, replies: 9, views: 203 }
        ];
        setPosts(demoPosts);
      }
    } catch (e) {
      // Fallback to demo data
      const demoPosts: Post[] = [
        { id: 'p1', title: 'Работа с комплексом Тени через активное воображение', content: 'Хочу поделиться опытом использования активного воображения для работы с комплексом Тени у клиента...', author: 'Анна Иванова', authorId: 'u1', topic: 't4', topicId: 't4', createdAt: new Date(Date.now() - 3600000).toISOString(), likes: 12, replies: 5, views: 89 },
        { id: 'p2', title: 'Интерпретация сновидения: красная дверь в длинном коридоре', content: 'Клиент описывает повторяющийся сон о красной двери. Предлагаю разобрать символику...', author: 'Дмитрий Смирнов', authorId: 'u2', topic: 't5', topicId: 't5', createdAt: new Date(Date.now() - 7200000).toISOString(), likes: 8, replies: 12, views: 156 },
        { id: 'p3', title: 'Этические вопросы при работе с границами', content: 'Как вы справляетесь с ситуациями, когда клиент нарушает границы терапевтических отношений?', author: 'Мария Петрова', authorId: 'u3', topic: 't7', topicId: 't7', createdAt: new Date(Date.now() - 10800000).toISOString(), likes: 15, replies: 9, views: 203 }
      ];
      setPosts(demoPosts);
    }
  }

  useEffect(() => {
    loadTopics();
  }, [token]);

  useEffect(() => {
    loadPosts();
  }, [token, selectedTopic]);

  function formatDate(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'только что';
    if (hours < 24) return `${hours} ч назад`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} дн. назад`;
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  }

  async function createPost(e?: React.FormEvent | React.MouseEvent) {
    if (e) e.preventDefault();
    if (!newPostTitle.trim() || !newPostContent.trim() || !newPostTopicId) return;
    if (!user) {
      window.dispatchEvent(new CustomEvent('show-register-modal', { detail: { reason: 'create-publication' } }));
      return;
    }
    
    setLoading(true);
    try {
      if (token) {
        const res = await api<{ post: Post }>('/api/publications/posts', {
          method: 'POST',
          token,
          body: {
            title: newPostTitle,
            content: newPostContent,
            topicId: newPostTopicId
          }
        });
        setPosts([res.post, ...posts]);
      } else {
        // Local demo
        const newPost: Post = {
          id: `p-${Date.now()}`,
          title: newPostTitle,
          content: newPostContent,
          author: user.email?.split('@')[0] || 'Психолог',
          authorId: user.id || 'user',
          topic: newPostTopicId,
          topicId: newPostTopicId,
          createdAt: new Date().toISOString(),
          likes: 0,
          replies: 0,
          views: 0
        };
        setPosts([newPost, ...posts]);
      }
      setShowNewPost(false);
      setNewPostTitle('');
      setNewPostContent('');
      setNewPostTopicId(''); // Сбрасываем выбор темы
      await loadTopics(); // Refresh topic counts
    } catch (e: any) {
      console.error('Failed to create post:', e);
    } finally {
      setLoading(false);
    }
  }

  async function createTopic(e?: React.FormEvent | React.MouseEvent) {
    if (e) e.preventDefault();
    if (!newTopicName.trim() || !newTopicDescription.trim()) return;
    if (!user) {
      window.dispatchEvent(new CustomEvent('show-register-modal', { detail: { reason: 'create-topic' } }));
      return;
    }
    
    setLoading(true);
    try {
      if (token) {
        const res = await api<{ topic: Topic }>('/api/publications/topics', {
          method: 'POST',
          token,
          body: {
            name: newTopicName,
            description: newTopicDescription,
            icon: newTopicIcon
          }
        });
        setTopics([...topics, res.topic]);
      } else {
        // Local demo
        const newTopic: Topic = {
          id: `t-${Date.now()}`,
          name: newTopicName,
          description: newTopicDescription,
          postsCount: 0,
          icon: newTopicIcon
        };
        setTopics([...topics, newTopic]);
      }
      setShowNewTopic(false);
      setNewTopicName('');
      setNewTopicDescription('');
      setNewTopicIcon('💬');
    } catch (e: any) {
      console.error('Failed to create topic:', e);
    } finally {
      setLoading(false);
    }
  }

  const filteredPosts = selectedTopic ? posts.filter(p => p.topicId === selectedTopic) : posts;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <UniversalNavbar />
      <main style={{ flex: 1, padding: '32px 48px', maxWidth: '100%', overflowX: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>Публикации</h1>
          {user && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="button secondary" onClick={() => setShowNewTopic(true)} style={{ padding: '10px 20px' }}>+ Новая тема</button>
              <button className="button" onClick={() => setShowNewPost(true)} style={{ padding: '10px 20px' }}>+ Новый пост</button>
            </div>
          )}
        </div>

        {/* Topics */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Темы</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            <div 
              className={`card ${!selectedTopic ? 'card-hover-shimmer' : ''}`}
              onClick={() => setSelectedTopic(null)}
              style={{ 
                padding: 16, 
                cursor: 'pointer',
                border: !selectedTopic ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)'
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Все темы</div>
              <div className="small" style={{ color: 'var(--text-muted)' }}>Все публикации</div>
            </div>
            {topics.map(topic => (
              <div 
                key={topic.id}
                className={`card ${selectedTopic === topic.id ? 'card-hover-shimmer' : ''}`}
                onClick={() => setSelectedTopic(topic.id)}
                style={{ 
                  padding: 16, 
                  cursor: 'pointer',
                  border: selectedTopic === topic.id ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>{topic.icon}</div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{topic.name}</div>
                <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 4, lineHeight: 1.4 }}>{topic.description}</div>
                <div className="small" style={{ color: 'var(--text-muted)' }}>{topic.postsCount} публикаций</div>
              </div>
            ))}
          </div>
        </div>

        {/* Posts */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 18 }}>
            Публикации {selectedTopic && `(${topics.find(t => t.id === selectedTopic)?.name})`}
          </div>
          <div style={{ display: 'grid', gap: 14 }}>
            {filteredPosts.length === 0 ? (
              <div className="card" style={{ padding: 32, textAlign: 'center' }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>💬</div>
                <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 8 }}>Нет публикаций</div>
                <div className="small" style={{ color: 'var(--text-muted)', marginTop: 4 }}>Создайте первую публикацию в этой теме!</div>
              </div>
            ) : (
              filteredPosts.map(post => (
                <div key={post.id} className="card card-hover-shimmer" style={{ padding: 18, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'start', gap: 14 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 20, lineHeight: 1.4 }}>{post.title}</div>
                      <div style={{ color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.7, fontSize: 15 }}>{post.content}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                        <div className="small" style={{ color: 'var(--text-muted)' }}>
                          <span style={{ fontWeight: 600 }}>{post.author}</span>
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
          <div onClick={(e) => { if (e.target === e.currentTarget) { setShowNewPost(false); setNewPostTitle(''); setNewPostContent(''); setNewPostTopicId(''); } }} style={{ position: 'fixed', inset: 0, background: 'rgba(5,8,16,0.75)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', padding: 16, zIndex: 1000 }}>
            <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: 'min(800px, 96vw)', maxHeight: '90vh', overflow: 'auto', padding: 20, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 60px rgba(0,0,0,0.45)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 20 }}>Новая публикация</div>
                <button className="button secondary" onClick={() => { setShowNewPost(false); setNewPostTitle(''); setNewPostContent(''); setNewPostTopicId(''); }} style={{ padding: '6px 10px', fontSize: 13 }}>Закрыть</button>
              </div>
              <div style={{ display: 'grid', gap: 14 }}>
                <div>
                  <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>Тема</div>
                  <select 
                    value={newPostTopicId} 
                    onChange={e => setNewPostTopicId(e.target.value)}
                    required
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 14 }}
                  >
                    <option value="">Выберите тему</option>
                    {topics.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
                  </select>
                </div>
                <div>
                  <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>Заголовок</div>
                  <input 
                    value={newPostTitle}
                    onChange={e => setNewPostTitle(e.target.value)}
                    placeholder="Заголовок публикации"
                    required
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 14 }}
                  />
                </div>
                <div>
                  <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>Содержание</div>
                  <textarea 
                    value={newPostContent}
                    onChange={e => setNewPostContent(e.target.value)}
                    placeholder="Текст публикации..."
                    rows={10}
                    required
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', resize: 'vertical', fontSize: 14, fontFamily: 'inherit' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                  <button className="button secondary" onClick={() => { setShowNewPost(false); setNewPostTitle(''); setNewPostContent(''); setNewPostTopicId(''); }} style={{ padding: '10px 16px', fontSize: 14 }}>Отмена</button>
                  <button type="button" className="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); createPost(e); }} disabled={!newPostTitle.trim() || !newPostContent.trim() || !newPostTopicId || loading} style={{ padding: '10px 16px', fontSize: 14 }}>{loading ? 'Публикация...' : 'Опубликовать'}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* New Topic Modal */}
        {showNewTopic && (
          <div onClick={(e) => { if (e.target === e.currentTarget) { setShowNewTopic(false); setNewTopicName(''); setNewTopicDescription(''); setNewTopicIcon('💬'); } }} style={{ position: 'fixed', inset: 0, background: 'rgba(5,8,16,0.75)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', padding: 16, zIndex: 1000 }}>
            <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: 'min(600px, 96vw)', padding: 20, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 60px rgba(0,0,0,0.45)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 20 }}>Новая тема</div>
                <button className="button secondary" onClick={() => { setShowNewTopic(false); setNewTopicName(''); setNewTopicDescription(''); setNewTopicIcon('💬'); }} style={{ padding: '6px 10px', fontSize: 13 }}>Закрыть</button>
              </div>
              <div style={{ display: 'grid', gap: 14 }}>
                <div>
                  <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>Иконка</div>
                  <input 
                    value={newTopicIcon}
                    onChange={e => setNewTopicIcon(e.target.value)}
                    placeholder="💬"
                    maxLength={2}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 20, textAlign: 'center' }}
                  />
                </div>
                <div>
                  <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>Название</div>
                  <input 
                    value={newTopicName}
                    onChange={e => setNewTopicName(e.target.value)}
                    placeholder="Название темы"
                    required
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 14 }}
                  />
                </div>
                <div>
                  <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>Описание</div>
                  <textarea 
                    value={newTopicDescription}
                    onChange={e => setNewTopicDescription(e.target.value)}
                    placeholder="Описание темы"
                    rows={4}
                    required
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', resize: 'vertical', fontSize: 14, fontFamily: 'inherit' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                  <button className="button secondary" onClick={() => { setShowNewTopic(false); setNewTopicName(''); setNewTopicDescription(''); setNewTopicIcon('💬'); }} style={{ padding: '10px 16px', fontSize: 14 }}>Отмена</button>
                  <button type="button" className="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); createTopic(e); }} disabled={!newTopicName.trim() || !newTopicDescription.trim() || loading} style={{ padding: '10px 16px', fontSize: 14 }}>{loading ? 'Создание...' : 'Создать тему'}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

