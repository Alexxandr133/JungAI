import { Link } from 'react-router-dom';
import { OPERATOR_INFO } from '../content/operatorInfo';

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        marginTop: 'auto',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        background: 'var(--surface)',
        padding: '28px clamp(16px, 4vw, 48px) 32px',
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 24,
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>JungAI</div>
          <p className="small" style={{ color: 'var(--text-muted)', margin: 0, lineHeight: 1.55, maxWidth: 320 }}>
            Интеллектуальный партнер для специалистов.
          </p>
        </div>

        <div>
          <div className="small" style={{ fontWeight: 700, marginBottom: 10, color: 'var(--text)' }}>
            Документы
          </div>
          <nav style={{ display: 'grid', gap: 8 }}>
            <Link to="/terms" className="small" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
              Пользовательское соглашение
            </Link>
            <Link to="/privacy" className="small" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
              Политика конфиденциальности
            </Link>
            <Link
              to="/personal-data-consent"
              className="small"
              style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
            >
              Согласие на обработку ПДн
            </Link>
          </nav>
        </div>

        <div>
          <div className="small" style={{ fontWeight: 700, marginBottom: 10, color: 'var(--text)' }}>
            Контакты
          </div>
          <div className="small" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <div>{OPERATOR_INFO.shortName}</div>
            <div>
              <a href={`mailto:${OPERATOR_INFO.email}`} style={{ color: 'var(--primary)' }}>
                {OPERATOR_INFO.email}
              </a>
            </div>
            <div style={{ marginTop: 8 }}>
              <Link to="/contacts" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                Все реквизиты →
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div
        className="small"
        style={{
          maxWidth: 1400,
          margin: '20px auto 0',
          paddingTop: 16,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          color: 'var(--text-muted)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px 16px',
          justifyContent: 'space-between',
        }}
      >
        <span>
          © {year} JungAI - платформа аналитической психологии
        </span>
        <span>Оператор ПДн: реестр РКН № {OPERATOR_INFO.rknRegistryNumber}</span>
      </div>
    </footer>
  );
}
