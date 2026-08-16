import { Link } from 'react-router-dom';
import { IndividuationHexagram } from '../../../components/individuation/IndividuationHexagram';
import './ResHero.css';

type PublicStats = {
  psychologists: number;
  dreams: number;
};

type ResHeroProps = {
  stats: PublicStats | null;
  statsLoading: boolean;
};

/** Иллюстрация частоты символов (§16.1) — не live API */
const ILLUSTRATIVE_SYMBOLS: Array<{ symbol: string; count: number }> = [
  { symbol: 'вода', count: 14 },
  { symbol: 'дом', count: 12 },
  { symbol: 'лес', count: 10 },
  { symbol: 'дорога', count: 9 },
  { symbol: 'окно', count: 8 },
  { symbol: 'дверь', count: 6 },
  { symbol: 'свет', count: 6 },
  { symbol: 'тень', count: 5 },
];

function barColor(index: number, total: number): string {
  const t = total <= 1 ? 0 : index / (total - 1);
  if (t < 0.5) return 'var(--brand)';
  if (t < 0.75) return 'var(--brand-deep)';
  return 'var(--sage)';
}

export function ResHero({ stats, statsLoading }: ResHeroProps) {
  const max = Math.max(1, ...ILLUSTRATIVE_SYMBOLS.map((r) => r.count));
  const dreams = stats?.dreams ?? 0;
  const people = (stats?.psychologists ?? 0);

  return (
    <section className="res-hero" aria-labelledby="res-hero-heading">
      <div className="landing-container res-hero__grid">
        <div className="res-hero__copy">
          <p className="landing-eyebrow">Исследователям и практикующим психологам</p>
          <h1 id="res-hero-heading" className="landing-h1" style={{ marginBottom: 28 }}>
            Исследуйте бессознательное с помощью технологий
          </h1>
          <p className="landing-lead" style={{ marginBottom: 36, maxWidth: 540 }}>
            JungAI вырос из юнгианской традиции и собирает исследовательский контур: дневник снов с
            ИИ-извлечением символов, частота символов, модель индивидуации и пространство проектов.
            Вместо разрозненных таблиц, заметок и файлов — один контур.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 36 }}>
            <Link to="/register?role=researcher" className="landing-btn landing-btn--primary">
              Начать исследование
            </Link>
            <a href="#tools" className="landing-btn landing-btn--secondary">
              Смотреть, как устроено
            </a>
          </div>
          <div className="res-hero__trust">
            <div className="res-hero__stat">
              <div className="res-hero__stat-value">
                {statsLoading ? '…' : dreams.toLocaleString('ru-RU')}
              </div>
              <div className="landing-small">снов записано на платформе</div>
            </div>
            <div className="res-hero__stat">
              <div className="res-hero__stat-value">
                {statsLoading ? '…' : people.toLocaleString('ru-RU')}
              </div>
              <div className="landing-small">психологов и исследователей уже работают</div>
            </div>
            <div className="res-hero__trust-rkn landing-small">
              Оператор ПДн — реестр РКН № 15-26-005049
            </div>
          </div>
        </div>

        <div className="res-hero__visual" aria-hidden>
          <div className="landing-card res-hero__hex-card">
            <IndividuationHexagram size={280} animated />
          </div>
          <div className="landing-card res-hero__chart-card">
            <div className="res-hero__chart-title">Частота символов</div>
            <div className="res-hero__chart">
              {ILLUSTRATIVE_SYMBOLS.map((row, idx) => (
                <div key={row.symbol} className="res-hero__chart-row">
                  <span className="res-hero__chart-label">{row.symbol}</span>
                  <div className="res-hero__bar-track">
                    <div
                      className="res-hero__bar-fill"
                      style={{
                        width: `${(row.count / max) * 100}%`,
                        background: barColor(idx, ILLUSTRATIVE_SYMBOLS.length),
                      }}
                    />
                  </div>
                  <span className="res-hero__chart-count">{row.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
