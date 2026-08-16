import { Link } from 'react-router-dom';
import { LandingNavbar } from '../../components/landing/LandingNavbar';
import { LandingFooter } from '../../components/landing/LandingFooter';
import { usePageMeta } from '../../hooks/usePageMeta';
import '../../styles/landing-tokens.css';

type AudienceStubProps = {
  title: string;
  lead: string;
  metaTitle: string;
};

/** Универсальный stub для аудиторий без готового лендинга */
export function AudienceStubPage({ title, lead, metaTitle }: AudienceStubProps) {
  usePageMeta(metaTitle, lead);

  return (
    <div className="landing">
      <LandingNavbar />
      <main style={{ flex: 1, padding: 'var(--section-y) 0' }}>
        <div className="landing-container" style={{ maxWidth: 640, textAlign: 'center' }}>
          <p className="landing-eyebrow">Скоро</p>
          <h1 className="landing-h1" style={{ marginBottom: 16 }}>
            {title}
          </h1>
          <p className="landing-lead" style={{ marginBottom: 32 }}>
            {lead}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            <Link to="/" className="landing-btn landing-btn--primary">
              Смотреть для психологов
            </Link>
            <Link to="/login" className="landing-btn landing-btn--secondary">
              Войти
            </Link>
            <Link to="/register" className="landing-btn landing-btn--tertiary">
              Регистрация →
            </Link>
          </div>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
