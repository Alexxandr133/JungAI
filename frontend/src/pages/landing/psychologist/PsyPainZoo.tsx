import './PsyPainZoo.css';

const ZOO_CHIPS = [
  'Notion',
  'Zoom',
  'Calendly',
  'WhatsApp',
  'ChatGPT',
  'таблицы',
  'бумажные заметки',
  'Сервысы по поиску клиентов',
] as const;

const CHIP_SOFT = ['brand', 'peach', 'sage', 'brand', 'peach', 'sage', 'brand', 'peach'] as const;

export function PsyPainZoo() {
  return (
    <section className="psy-zoo" aria-labelledby="psy-zoo-heading">
      <div className="landing-container">
        <h2 id="psy-zoo-heading" className="landing-h2 psy-zoo__title" style={{ marginBottom: 32 }}>
          Обычно психолог использует разрозненные инструменты:
        </h2>

        <div className="psy-zoo__grid">
          <div className="psy-zoo__col">
            <h3 className="landing-h3 psy-zoo__sub">Выглядит это так:</h3>
            <div className="psy-zoo__chips" aria-label="Разрозненные инструменты">
              {ZOO_CHIPS.map((label, i) => (
                <span
                  key={label}
                  className={`psy-zoo__chip psy-zoo__chip--${CHIP_SOFT[i]} psy-zoo__chip--scatter-${i}`}
                >
                  {label}
                </span>
              ))}
            </div>
            <p className="landing-body psy-zoo__caption">
              Пять сервисов, четыре подписки, ничего не связано. База клиентов — в одном месте, запись —
              в другом, заметки — в третьем.
            </p>
          </div>

          <div className="landing-card psy-zoo__jung">
            <h3 className="landing-h3 psy-zoo__sub">С JungAI</h3>
            <p className="landing-body" style={{ marginBottom: 20 }}>
              Клиенты, календарь, видео, заметки, ИИ и транскрибация — в одном окне. Клиент
              записывается сам, заметки лежат в карточке, ИИ помнит контекст вашей школы.
            </p>
            <ul className="psy-zoo__unified" aria-label="Единый контур JungAI">
              {['Клиенты', 'Календарь', 'Видео', 'Заметки', 'ИИ', 'Транскрибация'].map((item) => (
                <li key={item} className="psy-zoo__unified-item">
                  <span className="psy-zoo__check" aria-hidden>
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="psy-zoo__bridge">
          <a href="#tour" className="landing-btn landing-btn--tertiary">
            Смотреть, как это устроено ↓
          </a>
        </div>
      </div>
    </section>
  );
}
