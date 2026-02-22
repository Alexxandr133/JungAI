import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { GuestNavbar } from '../../components/GuestNavbar';
import '../../styles/tokens.css';

export default function GuestWorkspace() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    psychologists: 0,
    clients: 0,
    dreams: 0,
    topSymbolsToday: [] as Array<{ symbol: string; count: number }>,
    topSymbolsAll: [] as Array<{ symbol: string; count: number }>
  });

  useEffect(() => {
    // Загружаем статистику с API
    (async () => {
      try {
        const data = await api<{
          psychologists: number;
          clients: number;
          dreams: number;
          topSymbolsToday: Array<{ symbol: string; count: number }>;
          topSymbolsAll: Array<{ symbol: string; count: number }>;
        }>('/api/psychologists/public/stats');
        setStats(data);
      } catch (e) {
        console.error('Failed to load stats:', e);
        // Fallback значения
        setStats({
          psychologists: 0,
          clients: 0,
          dreams: 0,
          topSymbolsToday: [],
          topSymbolsAll: []
        });
      }
    })();
  }, []);

  const features = [
    {
      icon: '📊',
      title: 'Психологические тесты',
      description: 'Пройдите тесты на определение архетипов, работу с Тенью, спиральную динамику и многое другое',
      path: '/guest/tests',
      color: 'var(--surface-2)'
    },
    {
      icon: '💬',
      title: 'Форум сообщества',
      description: 'Общайтесь с другими участниками, делитесь опытом и получайте поддержку',
      path: '/guest/community',
      color: 'var(--surface-2)'
    },
    {
      icon: '📚',
      title: 'Публикации',
      description: 'Читайте статьи и исследования от психологов и исследователей',
      path: '/guest/publications',
      color: 'var(--surface-2)'
    },
    {
      icon: '💭',
      title: 'Запись снов',
      description: 'Ведите дневник сновидений и делитесь своими снами с сообществом',
      path: '/guest/dreams',
      color: 'var(--surface-2)'
    },
    {
      icon: '👨‍⚕️',
      title: 'Найти психолога',
      description: 'Просмотрите профили психологов и запишитесь на консультацию',
      path: '/psychologists',
      color: 'var(--surface-2)'
    },
    {
      icon: '🎯',
      title: 'Индивидуальная работа',
      description: 'Зарегистрируйтесь, чтобы получить доступ к персональным инструментам и работе с психологом',
      path: '/register',
      color: 'var(--surface-2)'
    }
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <GuestNavbar />
      <main style={{ flex: 1, padding: '32px 48px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
        {/* Hero Section */}
        <div style={{ textAlign: 'center', marginBottom: 64, padding: '40px 0' }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.5px', color: 'var(--primary)', marginBottom: 16 }}>
            Психология • Исследования • Искусственный интеллект
          </div>
          <h1 style={{ 
            margin: 0, 
            fontSize: 'clamp(32px, 5vw, 56px)', 
            fontWeight: 800, 
            lineHeight: 1.2,
            background: 'linear-gradient(135deg, var(--text) 0%, var(--primary) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: 24
          }}>
            JungAI — платформа аналитической психологии
          </h1>
          <p style={{ 
            margin: '0 auto', 
            maxWidth: 700, 
            fontSize: 18,
            lineHeight: 1.7,
            color: 'var(--text-muted)',
            marginBottom: 40
          }}>
            Jung-Ai — психологическая платформа и ваш интеллектуальный партнер в практических исследованиях и психологической практике. Данная платформа объединяющая психологов и клиентов позволяет практиковать и общаться, вести учет и анализировать терапевтическую динамику, хранить дневник сновидений, исследовать сны и синхронии. Публикуйте свои работы, находите единомышленников и растите профессионально.
          </p>
          {!user && (
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button 
                className="button" 
                onClick={() => navigate('/register')}
                style={{ padding: '14px 32px', fontSize: 16, fontWeight: 600 }}
              >
                Начать бесплатно
              </button>
              <button 
                className="button secondary" 
                onClick={() => navigate('/login')}
                style={{ padding: '14px 32px', fontSize: 16, fontWeight: 600 }}
              >
                Войти
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 64 }}>
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>👨‍⚕️</div>
            <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>{stats.psychologists}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Психологов</div>
          </div>
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
            <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>{stats.clients}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Клиентов</div>
          </div>
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>💭</div>
            <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>{stats.dreams}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Снов</div>
          </div>
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔮</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, minHeight: 28 }}>
              {stats.topSymbolsToday.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 4 }}>Топ символов сегодня:</div>
                  {stats.topSymbolsToday.map((item, idx) => (
                    <div key={idx} style={{ fontSize: 13, color: 'var(--text)' }}>
                      {item.symbol} ({item.count})
                    </div>
                  ))}
                </div>
              ) : stats.topSymbolsAll.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 4 }}>Частые символы:</div>
                  {stats.topSymbolsAll.slice(0, 3).map((item, idx) => (
                    <div key={idx} style={{ fontSize: 13, color: 'var(--text)' }}>
                      {item.symbol} ({item.count})
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Нет данных</div>
              )}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Символы</div>
          </div>
        </div>

        {/* Features Grid */}
        <div style={{ marginBottom: 64 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 32, textAlign: 'center' }}>
            Возможности платформы
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
            {features.map((feature, idx) => (
              <div
                key={idx}
                className="card card-hover-shimmer"
                onClick={() => navigate(feature.path)}
                style={{
                  padding: 24,
                  cursor: 'pointer',
                  background: feature.color,
                  border: '1px solid rgba(255,255,255,0.08)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>{feature.icon}</div>
                  <h3 style={{ margin: 0, marginBottom: 12, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
                    {feature.title}
                  </h3>
                  <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6, fontSize: 14 }}>
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        {!user && (
          <div className="card" style={{ padding: 48, textAlign: 'center', borderRadius: 20, background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%)' }}>
            <h2 style={{ margin: 0, marginBottom: 16, fontSize: 36, fontWeight: 800 }}>
              Готовы начать работу?
            </h2>
            <p style={{ margin: '16px 0 32px 0', fontSize: 18, color: 'var(--text-muted)' }}>
              Зарегистрируйтесь, чтобы получить доступ ко всем функциям платформы
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button 
                className="button" 
                onClick={() => navigate('/register')}
                style={{ padding: '14px 32px', fontSize: 16, fontWeight: 600 }}
              >
                Зарегистрироваться
              </button>
              <button 
                className="button secondary" 
                onClick={() => navigate('/login')}
                style={{ padding: '14px 32px', fontSize: 16, fontWeight: 600 }}
              >
                Войти
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

