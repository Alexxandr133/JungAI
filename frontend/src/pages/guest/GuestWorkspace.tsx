import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { GuestNavbar } from '../../components/GuestNavbar';
import { PlatformIcon, type PlatformIconName } from '../../components/icons';
import '../../styles/tokens.css';

/** Пример для плашки, пока нет снов за текущие сутки с достаточным текстом */
const DEMO_SYMBOL_WORDS: Array<{ symbol: string; count: number }> = [
  { symbol: 'вода', count: 14 },
  { symbol: 'дом', count: 12 },
  { symbol: 'лес', count: 10 },
  { symbol: 'дорога', count: 9 },
  { symbol: 'окно', count: 8 },
  { symbol: 'мать', count: 7 },
  { symbol: 'дверь', count: 6 },
  { symbol: 'свет', count: 6 },
  { symbol: 'тень', count: 5 },
  { symbol: 'птица', count: 4 }
];

const symbolChartCardStyle = { padding: 24, marginBottom: 24, width: '100%' as const };

/** Голубой (--accent) → фиолетовый (--primary); чем ниже строка в рейтинге, тем глубже фиолетовый акцент */
function barFillForRank(index: number, total: number): string {
  const t = total <= 1 ? 0 : index / (total - 1);
  const cyanA = 0.88 - t * 0.38;
  const violA = 0.42 + t * 0.53;
  return `linear-gradient(90deg, rgba(25,224,255,${cyanA}) 0%, rgba(124,92,255,${violA}) 100%)`;
}

function SymbolFrequencyChart({
  items,
  loading
}: {
  items: Array<{ symbol: string; count: number }>;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="card" style={symbolChartCardStyle}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16 }}>Частота символов</div>
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px 16px', fontSize: 15 }}>Загрузка…</div>
      </div>
    );
  }

  const isDemo = items.length === 0;
  const rows = isDemo ? DEMO_SYMBOL_WORDS : items;
  const max = Math.max(1, ...rows.map((i) => i.count));

  return (
    <div className="card" style={symbolChartCardStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 20,
          flexWrap: 'wrap'
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 18 }}>Частота символов</div>
        {isDemo && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-muted)',
              border: '1px solid rgba(255,255,255,0.12)',
              padding: '4px 12px',
              borderRadius: 999,
              letterSpacing: '0.02em'
            }}
          >
            демо
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {rows.map((row, idx) => (
          <div
            key={`${row.symbol}-${idx}`}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(72px, 0.35fr) 1fr minmax(40px, auto)',
              gap: 14,
              alignItems: 'center'
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              title={row.symbol}
            >
              {row.symbol}
            </span>
            <div
              style={{
                height: 12,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.06)',
                overflow: 'hidden',
                minWidth: 0,
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)'
              }}
            >
              <div
                style={{
                  width: `${(row.count / max) * 100}%`,
                  height: '100%',
                  borderRadius: 8,
                  background: barFillForRank(idx, rows.length),
                  minWidth: row.count > 0 ? 4 : 0,
                  transition: 'width 0.35s ease, background 0.25s ease',
                  boxShadow: '0 0 14px rgba(25, 224, 255, 0.12), 0 0 18px rgba(124, 92, 255, 0.1)'
                }}
              />
            </div>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--text-muted)',
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {row.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GuestWorkspace() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    psychologists: 0,
    clients: 0,
    dreams: 0,
    topSymbolsToday: [] as Array<{ symbol: string; count: number }>
  });
  const [statsReady, setStatsReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api<{
          psychologists: number;
          clients: number;
          dreams: number;
          topSymbolsToday: Array<{ symbol: string; count: number }>;
        }>('/api/psychologists/public/stats');
        setStats({
          psychologists: data.psychologists,
          clients: data.clients,
          dreams: data.dreams,
          topSymbolsToday: data.topSymbolsToday ?? []
        });
      } catch (e) {
        console.error('Failed to load stats:', e);
        setStats({
          psychologists: 0,
          clients: 0,
          dreams: 0,
          topSymbolsToday: []
        });
      } finally {
        setStatsReady(true);
      }
    })();
  }, []);

  const features: Array<{
    icon: PlatformIconName;
    title: string;
    description: string;
    path: string;
    color: string;
  }> = [
    {
      icon: 'chart',
      title: 'Психологические тесты',
      description: 'Пройдите тесты на определение архетипов, работу с Тенью, спиральную динамику и многое другое',
      path: '/guest/tests',
      color: 'var(--surface-2)'
    },
    {
      icon: 'library',
      title: 'Публикации',
      description: 'Читайте статьи и исследования от психологов и исследователей',
      path: '/guest/publications',
      color: 'var(--surface-2)'
    },
    {
      icon: 'dreams',
      title: 'Запись снов',
      description: 'Ведите дневник сновидений и делитесь своими снами с сообществом',
      path: '/guest/dreams',
      color: 'var(--surface-2)'
    },
    {
      icon: 'stethoscope',
      title: 'Найти психолога',
      description: 'Просмотрите профили психологов и запишитесь на консультацию',
      path: '/psychologists',
      color: 'var(--surface-2)'
    },
    {
      icon: 'target',
      title: 'Индивидуальная работа',
      description: 'Зарегистрируйтесь, чтобы получить доступ к персональным инструментам и работе с психологом',
      path: '/register',
      color: 'var(--surface-2)'
    }
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <GuestNavbar />
      <main
        style={{
          flex: 1,
          padding: '24px clamp(16px, 5vw, 48px)',
          maxWidth: 1400,
          margin: '0 auto',
          width: '100%'
        }}
      >
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
            maxWidth: 720, 
            fontSize: 18,
            lineHeight: 1.7,
            color: 'var(--text-muted)',
            marginBottom: 40
          }}>
            JungAI — аналитическая платформа и интеллектуальный партнёр в области психологии. Она помогает вести
            сессии с клиентами, фиксировать и разбирать ход терапии, при необходимости корректировать подход и динамику,
            вести дневник сновидений и глубже исследовать бессознательное. Это опора для профессионального роста,
            устойчивой практики и дальнейшего развития.
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

        {/* Символы за сегодня — полная ширина; затем счётчики */}
        <div style={{ marginBottom: 64 }}>
          <SymbolFrequencyChart items={stats.topSymbolsToday} loading={!statsReady} />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
              marginTop: 16
            }}
          >
            <div
              className="card"
              style={{
                padding: '28px 20px',
                minHeight: 0,
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <div style={{ color: 'var(--primary)' }} aria-hidden>
                <PlatformIcon name="stethoscope" size={26} strokeWidth={1.5} />
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>{stats.psychologists}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.25 }}>Психологов</div>
            </div>
            <div
              className="card"
              style={{
                padding: '16px 18px',
                minHeight: 0,
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <div style={{ color: 'var(--primary)' }} aria-hidden>
                <PlatformIcon name="users" size={26} strokeWidth={1.5} />
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>{stats.clients}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.25 }}>Клиентов</div>
            </div>
            <div
              className="card"
              style={{
                padding: '16px 18px',
                minHeight: 0,
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <div style={{ color: 'var(--primary)' }} aria-hidden>
                <PlatformIcon name="dreams" size={26} strokeWidth={1.5} />
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>{stats.dreams}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.25 }}>Снов</div>
            </div>
            <div
              className="card"
              style={{
                padding: '16px 18px',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                textAlign: 'left'
              }}
            >
              <div style={{ flexShrink: 0, color: 'var(--primary)' }} aria-hidden>
                <PlatformIcon name="orbit" size={26} strokeWidth={1.5} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {!statsReady ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>…</div>
                ) : (
                  <>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        letterSpacing: '0.03em',
                        textTransform: 'uppercase',
                        marginBottom: 6,
                        lineHeight: 1.25
                      }}
                    >
                      Популярные символы
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        color: 'var(--text)',
                        lineHeight: 1.4,
                        fontVariantNumeric: 'tabular-nums'
                      }}
                    >
                      {(stats.topSymbolsToday.length ? stats.topSymbolsToday : DEMO_SYMBOL_WORDS)
                        .slice(0, 3)
                        .map((item) => `${item.symbol} ${item.count}`)
                        .join(' · ')}
                    </div>
                  </>
                )}
              </div>
            </div>
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
                  <div
                    style={{
                      marginBottom: 16,
                      width: 56,
                      height: 56,
                      borderRadius: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--surface)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: 'var(--primary)'
                    }}
                  >
                    <PlatformIcon name={feature.icon} size={30} strokeWidth={1.6} />
                  </div>
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

