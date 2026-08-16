import { Link } from 'react-router-dom';
import { LandingNavbar } from '../../components/landing/LandingNavbar';
import { LandingFooter } from '../../components/landing/LandingFooter';
import { usePageMeta } from '../../hooks/usePageMeta';
import '../../styles/landing-tokens.css';

const AUDIENCES = [
  {
    path: '/',
    eyebrow: 'Специалистам',
    title: 'Для психолога',
    lead: 'CRM, календарь с самозаписью, видеосессии, транскрибация и ИИ под ваш подход — в одном окне.',
    cta: 'Смотреть для психологов',
    featured: true,
  },
  {
    path: '/for-clients',
    eyebrow: 'Клиентам',
    title: 'Для клиента',
    lead: 'Найти психолога, сессии на платформе и поддержка между встречами — скоро на этой странице.',
    cta: 'Перейти',
    featured: false,
  },
  {
    path: '/for-researchers',
    eyebrow: 'Исследователям',
    title: 'Для исследователя',
    lead: 'Дневник снов с символами, гексаграмма индивидуации и исследовательские проекты.',
    cta: 'Перейти',
    featured: false,
  },
] as const;

export default function GuestWorkspace() {
  usePageMeta(
    'JungAI — платформа аналитической психологии',
    'Выберите, кто вы: психолог, клиент или исследователь. JungAI — практика, сессии и исследования в одном контуре.'
  );

  return (
    <div className="landing">
      <LandingNavbar />
      <main style={{ flex: 1, padding: 'var(--section-y) 0' }}>
        <div className="landing-container">
          <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 48px' }}>
            <p className="landing-eyebrow">JungAI</p>
            <h1 className="landing-h1" style={{ marginBottom: 16 }}>
              Кому нужна платформа?
            </h1>
            <p className="landing-lead">
              Три входа — одна платформа: практика психолога, путь клиента и исследовательский контур.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 20,
            }}
          >
            {AUDIENCES.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="landing-card"
                style={{
                  padding: 28,
                  textDecoration: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  borderColor: item.featured ? 'var(--brand)' : 'var(--card-border)',
                  boxShadow: item.featured ? 'var(--shadow-mock)' : 'var(--shadow-card)',
                  background: 'var(--card)',
                }}
              >
                <span className="landing-eyebrow" style={{ marginBottom: 0 }}>
                  {item.eyebrow}
                </span>
                <h2 className="landing-h3">{item.title}</h2>
                <p className="landing-body" style={{ flex: 1 }}>
                  {item.lead}
                </p>
                <span
                  className="landing-btn landing-btn--tertiary"
                  style={{ alignSelf: 'flex-start', padding: 0 }}
                >
                  {item.cta} →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
