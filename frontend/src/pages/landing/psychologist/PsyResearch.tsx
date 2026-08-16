import './PsyResearch.css';

const RESEARCH_BULLETS = [
  'Дневник снов и ИИ-символы: платформа выделяет символы из снов и собирает их частоту.',
  'Исследовательские проекты: материалы, вкладки и ИИ-ассистент в контексте проекта.',
  'ИИ Ассистент: не замена специалиста, а усиление компетенций. Разбирайте ваши кейсы и тестируйте гипотезы, фиксируйте их и улучшайте свой подход.',
] as const;

/** Иллюстрация частоты символов (не live API) */
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

export function PsyResearch() {
  const rows = ILLUSTRATIVE_SYMBOLS;
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <section id="research" className="psy-research" aria-labelledby="psy-research-heading">
      <div className="landing-container psy-research__grid">
        <div className="psy-research__copy">
          <p className="landing-eyebrow">Исследования</p>
          <h2 id="psy-research-heading" className="landing-h2" style={{ marginBottom: 16 }}>
            Больше, чем CRM: исследовательский контур
          </h2>
          <p className="landing-lead" style={{ marginBottom: 24 }}>
            JungAI вырос из юнгианской традиции — поэтому здесь есть то, чего нет ни в одной CRM:
            инструменты для работы с бессознательным и исследования.
          </p>
          <ul className="psy-research__bullets">
            {RESEARCH_BULLETS.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <p className="psy-research__diff">
            Это не «когда-нибудь потом». На JungAI с этим уже работают специалисты и клиенты.
          </p>
        </div>

        <div className="landing-card psy-research__viz" aria-hidden>
          <div className="psy-research__viz-title">Частота символов</div>
          <div className="psy-research__chart">
            {rows.map((row, idx) => (
              <div key={`${row.symbol}-${idx}`} className="psy-research__chart-row">
                <span className="psy-research__chart-label" title={row.symbol}>
                  {row.symbol}
                </span>
                <div className="psy-research__bar-track">
                  <div
                    className="psy-research__bar-fill"
                    style={{
                      width: `${(row.count / max) * 100}%`,
                      background: barColor(idx, rows.length),
                    }}
                  />
                </div>
                <span className="psy-research__chart-count">{row.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Тёплые лендинг-цвета: brand → peach → sage */
function barColor(index: number, total: number): string {
  const t = total <= 1 ? 0 : index / (total - 1);
  if (t < 0.45) return 'var(--brand)';
  if (t < 0.75) return 'var(--peach)';
  return 'var(--sage)';
}
