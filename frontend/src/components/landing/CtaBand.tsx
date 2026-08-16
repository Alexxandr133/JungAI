import { Link } from 'react-router-dom';
import { OPERATOR_INFO } from '../../content/operatorInfo';
import './CtaBand.css';

type CtaBandProps = {
  title?: string;
  sub?: string;
  primaryLabel?: string;
  primaryTo?: string;
  tertiaryLabel?: string;
};

/** S10 — тексты по умолчанию из COPY-PSY */
export function CtaBand({
  title = 'Попробуйте платформу на этой неделе',
  sub = 'Регистрация — 5 минут. Посмотрите, сколько времени освобождает один контур вместо пяти сервисов.',
  primaryLabel = 'Попробовать бесплатно',
  primaryTo = '/register',
  tertiaryLabel,
}: CtaBandProps) {
  const mailLabel = tertiaryLabel ?? `Написать нам: ${OPERATOR_INFO.email} →`;
  return (
    <section className="cta-band" aria-labelledby="cta-band-heading">
      <div className="landing-container cta-band__inner">
        <h2 id="cta-band-heading" className="landing-h2 cta-band__title">
          {title}
        </h2>
        <p className="landing-lead cta-band__sub">{sub}</p>
        <div className="cta-band__actions">
          <Link to={primaryTo} className="landing-btn landing-btn--primary">
            {primaryLabel}
          </Link>
          <a href={`mailto:${OPERATOR_INFO.email}`} className="landing-btn landing-btn--tertiary">
            {mailLabel}
          </a>
        </div>
      </div>
    </section>
  );
}
