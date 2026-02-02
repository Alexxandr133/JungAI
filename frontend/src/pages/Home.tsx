import { Link } from 'react-router-dom';
import { Section, Title, Feature, Grid, Nav, Footer } from '../components/ui';
import '../styles/tokens.css';

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Nav />

      {/* Hero Section */}
      <header className="container" style={{ padding: '120px 24px 80px 24px', textAlign: 'center', maxWidth: 1200, margin: '0 auto' }}>
        <div className="kicker" style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.5px', color: 'var(--primary)', marginBottom: 16 }}>
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
          JungAI — платформа аналитической психологии и исследовательской деятельности
        </h1>
        <p className="p" style={{ 
          margin: '0 auto', 
          maxWidth: 700, 
          fontSize: 18,
          lineHeight: 1.7,
          color: 'var(--text-muted)',
          marginBottom: 40
        }}>
          Ведите журналы сновидений и необычных явлений, анализируйте символы и архетипические паттерны, 
          организуйте исследовательскую работу и публикуйте результаты — всё в единой экосистеме с поддержкой ИИ.
        </p>
        <div style={{ display: 'flex', gap: 16, marginTop: 32, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/login" className="button" style={{ padding: '14px 32px', fontSize: 16, fontWeight: 600, textDecoration: 'none' }}>
            Войти в систему
          </Link>
          <Link to="/register" className="button secondary" style={{ padding: '14px 32px', fontSize: 16, fontWeight: 600, textDecoration: 'none' }}>
            Зарегистрироваться
          </Link>
        </div>
      </header>

      {/* Features Section */}
      <Section id="features" style={{ paddingTop: 80, paddingBottom: 80 }}>
        <div className="container" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <Title 
            kicker="Возможности" 
            title="Всё необходимое для работы с аналитической психологией" 
            subtitle="JungAI объединяет инструменты для ведения журналов, анализа данных и научной публикации — от личной практики до коллективных исследований." 
            center 
          />
          <div style={{ marginTop: 48 }}>
            <Grid cols={3}>
            <Feature 
              icon={<div style={{ fontSize: 48, marginBottom: 16 }}>💭</div>}
              title="Журналы сновидений" 
              text="Структурированный ввод снов и необычных случаев с метками, тегами и символами. Автоматический анализ и поиск паттернов." 
            />
            <Feature 
              icon={<div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>}
              title="Аналитика и статистика" 
              text="Частоты символов, архетипические паттерны, гипотезы и рекомендации ИИ. Визуализация данных для исследований." 
            />
            <Feature 
              icon={<div style={{ fontSize: 48, marginBottom: 16 }}>🔮</div>}
              title="Амплификации" 
              text="База знаний символов, архетипов и мифов. Связывайте сны с амплификациями для глубокого анализа." 
            />
            <Feature 
              icon={<div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>}
              title="Рабочая область" 
              text="Ведите клиентов, создавайте заметки, планируйте сессии и отслеживайте прогресс. Всё в одном месте." 
            />
            <Feature 
              icon={<div style={{ fontSize: 48, marginBottom: 16 }}>🔬</div>}
              title="Исследования" 
              text="Инструменты для исследователей: обезличенные данные, статистика, экспорт данных для научных работ." 
            />
            <Feature 
              icon={<div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>}
              title="Публикации" 
              text="Создавайте и публикуйте материалы, делитесь результатами исследований с сообществом." 
            />
            </Grid>
          </div>
        </div>
      </Section>

      {/* About Section */}
      <Section id="about" style={{ paddingTop: 80, paddingBottom: 80, background: 'var(--surface)' }}>
        <div className="container" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <div className="card" style={{ padding: 48, borderRadius: 20 }}>
            <Title 
              kicker="О платформе" 
              title="Единое пространство практики и исследований" 
              subtitle="JungAI создан для психологов, исследователей и всех, кто интересуется аналитической психологией. Платформа объединяет инструменты для личной практики и коллективных исследований." 
              center 
            />
            <div style={{ marginTop: 48, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32 }}>
              <div>
                <div style={{ fontSize: 32, marginBottom: 16 }}>🎯</div>
                <h3 style={{ margin: 0, marginBottom: 12, fontSize: 20, fontWeight: 700 }}>Для психологов</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Ведите клиентов, анализируйте сны, создавайте заметки и отслеживайте прогресс терапии. 
                  Инструменты для эффективной работы с клиентами.
                </p>
              </div>
              <div>
                <div style={{ fontSize: 32, marginBottom: 16 }}>🔬</div>
                <h3 style={{ margin: 0, marginBottom: 12, fontSize: 20, fontWeight: 700 }}>Для исследователей</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Анализируйте обезличенные данные, находите паттерны, экспортируйте данные для исследований. 
                  Инструменты для научной работы.
                </p>
              </div>
              <div>
                <div style={{ fontSize: 32, marginBottom: 16 }}>💭</div>
                <h3 style={{ margin: 0, marginBottom: 12, fontSize: 20, fontWeight: 700 }}>Для клиентов</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Ведите дневник сновидений, получайте анализы и рекомендации, отслеживайте свой прогресс 
                  в работе с психологом.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* CTA Section */}
      <Section id="cta" style={{ paddingTop: 80, paddingBottom: 120 }}>
        <div className="container" style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px' }}>
          <div className="card" style={{ padding: 64, textAlign: 'center', borderRadius: 20, background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%)' }}>
            <h2 style={{ margin: 0, marginBottom: 16, fontSize: 36, fontWeight: 800 }}>
              Готовы начать работу?
            </h2>
            <p className="p" style={{ margin: '16px 0 32px 0', fontSize: 18, color: 'var(--text-muted)' }}>
              Присоединяйтесь к платформе JungAI и откройте новые возможности для работы с аналитической психологией
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/login" className="button" style={{ padding: '14px 32px', fontSize: 16, fontWeight: 600, textDecoration: 'none' }}>
                Войти
              </Link>
              <Link to="/register" className="button secondary" style={{ padding: '14px 32px', fontSize: 16, fontWeight: 600, textDecoration: 'none' }}>
                Зарегистрироваться
              </Link>
            </div>
          </div>
        </div>
      </Section>

      <Footer />
    </div>
  );
}
