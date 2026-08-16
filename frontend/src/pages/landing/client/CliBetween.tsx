import './CliBetween.css';

const BETWEEN_ITEMS = [
  {
    title: 'Дневник снов.',
    body: 'Записывайте сны — платформа выделяет символы и собирает их частоту. На сессии это живой материал для работы.',
  },
  {
    title: 'Тесты аналитической традиции.',
    body: 'Архетипы, индивидуация, спиральная динамика — с результатами и пояснениями, а не просто «ваш тип».',
  },
  {
    title: 'Задачи и динамика.',
    body: 'Заметки, задачи от психолога и отметки состояния — ваша дорога изменений в одном месте.',
  },
] as const;

const ILLUSTRATIVE_SYMBOLS = [
  { symbol: 'вода', count: 14 },
  { symbol: 'дом', count: 11 },
  { symbol: 'лес', count: 9 },
  { symbol: 'дорога', count: 7 },
  { symbol: 'окно', count: 6 },
] as const;

export function CliBetween() {
  const max = Math.max(...ILLUSTRATIVE_SYMBOLS.map((s) => s.count));

  return (
    <section id="between" className="cli-between" aria-labelledby="cli-between-heading">
      <div className="landing-container cli-between__grid">
        <div>
          <h2 id="cli-between-heading" className="landing-h2 cli-between__title">
            Терапия не заканчивается, когда завершается звонок
          </h2>
          <ul className="cli-between__list">
            {BETWEEN_ITEMS.map((item) => (
              <li key={item.title}>
                <strong>{item.title}</strong> {item.body}
              </li>
            ))}
          </ul>
          <p className="cli-between__note">
            Всё это — по желанию. Темп задаёте вы вместе с психологом, а не платформа.
          </p>
        </div>

        <div className="landing-card cli-between__viz" aria-hidden>
          <div className="cli-between__viz-title">Частота символов</div>
          <div className="cli-between__chart">
            {ILLUSTRATIVE_SYMBOLS.map((row, idx) => (
              <div key={row.symbol} className="cli-between__row">
                <span className="cli-between__label">{row.symbol}</span>
                <div className="cli-between__track">
                  <div
                    className="cli-between__fill"
                    style={{
                      width: `${(row.count / max) * 100}%`,
                      background: idx < 2 ? 'var(--brand)' : idx < 4 ? 'var(--peach)' : 'var(--sage)',
                    }}
                  />
                </div>
                <span className="cli-between__count">{row.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
