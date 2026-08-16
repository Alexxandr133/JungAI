import { Link } from 'react-router-dom';
import { OPERATOR_INFO } from '../../content/operatorInfo';

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        marginTop: 'auto',
        borderTop: '1px solid var(--line)',
        background: 'var(--paper-soft)',
        padding: '36px 0 28px',
      }}
    >
      <div className="landing-container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 28,
            marginBottom: 28,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 22,
                marginBottom: 8,
              }}
            >
              JungAI
            </div>
            <p className="landing-small" style={{ margin: 0, maxWidth: 280 }}>
              Платформа для частной практики психолога: клиенты, календарь, видео, ИИ и транскрибация.
            </p>
          </div>

          <div>
            <div className="landing-small" style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>
              Аудитории
            </div>
            <nav style={{ display: 'grid', gap: 8 }}>
              <Link to="/" className="landing-small" style={{ textDecoration: 'none' }}>
                Для психолога
              </Link>
              <Link to="/for-clients" className="landing-small" style={{ textDecoration: 'none' }}>
                Для клиента
              </Link>
              <Link to="/for-researchers" className="landing-small" style={{ textDecoration: 'none' }}>
                Для исследователя
              </Link>
            </nav>
          </div>

          <div>
            <div className="landing-small" style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>
              Документы
            </div>
            <nav style={{ display: 'grid', gap: 8 }}>
              <Link to="/terms" className="landing-small" style={{ textDecoration: 'none' }}>
                Пользовательское соглашение
              </Link>
              <Link to="/privacy" className="landing-small" style={{ textDecoration: 'none' }}>
                Политика конфиденциальности
              </Link>
              <Link to="/personal-data-consent" className="landing-small" style={{ textDecoration: 'none' }}>
                Согласие на обработку ПДн
              </Link>
              <Link to="/contacts" className="landing-small" style={{ textDecoration: 'none' }}>
                Контакты и реквизиты
              </Link>
            </nav>
          </div>

          <div>
            <div className="landing-small" style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>
              Контакты
            </div>
            <div className="landing-small" style={{ lineHeight: 1.6 }}>
              <div>{OPERATOR_INFO.shortName}</div>
              <a href={`mailto:${OPERATOR_INFO.email}`} style={{ color: 'var(--brand)', fontWeight: 600 }}>
                {OPERATOR_INFO.email}
              </a>
            </div>
          </div>
        </div>

        <div
          className="landing-small"
          style={{
            paddingTop: 16,
            borderTop: '1px solid var(--line)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px 16px',
            justifyContent: 'space-between',
          }}
        >
          <span>© {year} JungAI — платформа аналитической психологии</span>
          <span>Оператор ПДн: реестр РКН № {OPERATOR_INFO.rknRegistryNumber}</span>
        </div>
      </div>
    </footer>
  );
}
