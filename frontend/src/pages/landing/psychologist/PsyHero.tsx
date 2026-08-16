import { Link } from 'react-router-dom';
import { OPERATOR_INFO } from '../../../content/operatorInfo';
import './PsyHero.css';

type PublicStats = {
  psychologists: number;
  clients: number;
  dreams: number;
  sessions: number;
};

type PsyHeroProps = {
  stats: PublicStats | null;
  statsLoading: boolean;
};

const FLOAT_CHIPS = [
  { text: 'Клиент подтвердил сессию', className: 'psy-hero__chip--1' },
  { text: 'Транскрипция готова', className: 'psy-hero__chip--2' },
  { text: 'ИИ выделил символы сна', className: 'psy-hero__chip--3' },
] as const;

export function PsyHero({ stats, statsLoading }: PsyHeroProps) {
  return (
    <section className="psy-hero">
      <div className="psy-hero__blob psy-hero__blob--brand" aria-hidden />
      <div className="psy-hero__blob psy-hero__blob--peach" aria-hidden />

      <div className="landing-container psy-hero__grid">
        <div>
          <p className="landing-eyebrow">Практикующим психологам и исследователям</p>
          <h1 className="landing-h1" style={{ marginBottom: 20 }}>
            Меньше рутины — больше терапии
          </h1>
          <p className="landing-lead" style={{ marginBottom: 28, maxWidth: 540 }}>
            JungAI собирает то, что сейчас разбросано по пяти сервисам: карточки клиентов, календарь с
            самозаписью, видеосессии, транскрибацию и ИИ, который понимает ваш подход. Без зоопарка
            Notion, Zoom и Calendly.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 36 }}>
            <Link to="/register" className="landing-btn landing-btn--primary">
              Попробовать бесплатно
            </Link>
            <a href="#tour" className="landing-btn landing-btn--secondary">
              Смотреть, как устроено
            </a>
          </div>

          <div className="psy-hero__trust">
            <TrustStat
              value={statsLoading ? '…' : String(stats?.psychologists ?? 0)}
              label="психологов уже на платформе"
            />
            <TrustStat
              value={statsLoading ? '…' : String(stats?.sessions ?? 0)}
              label="сессий проведено"
            />
            <TrustStat
              value={statsLoading ? '…' : String(stats?.dreams ?? 0)}
              label="снов записано"
            />
            <div className="psy-hero__trust-rkn">
              <div className="landing-small" style={{ color: 'var(--ink-soft)', lineHeight: 1.45 }}>
                Оператор ПДн — реестр РКН № {OPERATOR_INFO.rknRegistryNumber}
              </div>
            </div>
          </div>
        </div>

        <div className="psy-hero__mock-wrap">
          <div className="landing-card psy-hero__mock">
            <div className="landing-mock-shot">
              <img
                className="psy-hero__mock-img landing-mock-shot__img"
                src="/landing/mocks/hero-clients.png"
                alt="Интерфейс JungAI: список клиентов"
                width={960}
                height={640}
                loading="eager"
                decoding="async"
              />
            </div>
          </div>

          {FLOAT_CHIPS.map((chip) => (
            <div key={chip.text} className={`psy-hero__chip ${chip.className}`}>
              {chip.text}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrustStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="psy-hero__stat">
      <div className="psy-hero__stat-value">{value}</div>
      <div className="landing-small" style={{ marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}
