import './ResTour.css';

const BLOCKS = [
  {
    id: 'material',
    eyebrow: 'Материал',
    cyan: true,
    title: 'Сны становятся структурированными данными',
    bullets: [
      'Записываете сон — платформа сама извлекает символы: у каждого сна статус обработки и версия извлечения.',
      'Частота и динамика символов — по вашему дневнику и по платформе в целом.',
      'Анонимизация текста снов — для этичной работы с материалом.',
    ],
  },
  {
    id: 'model',
    eyebrow: 'Модель',
    cyan: true,
    title: 'Гексаграмма индивидуации — собственная диагностическая модель',
    bullets: [
      'Шесть стадий, оси компенсаций, метрики дефицита, фиксации и интеграции.',
      'Тест из 36 вопросов для участников; результаты — на дашборде с гексаграммой.',
      'API участников — для ваших исследовательских проектов.',
    ],
  },
  {
    id: 'space',
    eyebrow: 'Пространство',
    cyan: false,
    title: 'Исследовательские проекты — в одном месте',
    bullets: [
      'Проекты и вкладки, редактор материалов как в Word.',
      'ИИ-ассистент отвечает только в контексте материалов вашего проекта.',
      'Гипотезы, выдержки, анализ — не теряются между блокнотами.',
    ],
  },
  {
    id: 'output',
    eyebrow: 'Выход',
    cyan: false,
    title: 'Исследования становятся экспертизой',
    bullets: [
      'Публикуйте статьи от своего имени или от имени сообщества.',
      'Аудитория платформы — практикующие психологи и клиенты, которым близка юнгианская традиция.',
    ],
  },
] as const;

export function ResTour() {
  return (
    <section id="tools" className="res-tour" aria-label="Инструменты исследовательского контура">
      {BLOCKS.map((block, i) => {
        const soft = i % 2 === 1;
        const flip = i % 2 === 1;
        return (
          <div
            key={block.id}
            className={`res-tour__block${soft ? ' res-tour__block--soft' : ''}`}
          >
            <div className={`landing-container res-tour__row${flip ? ' res-tour__row--flip' : ''}`}>
              <div className="res-tour__text">
                <p className={`landing-eyebrow${block.cyan ? ' res-eyebrow--accent' : ''}`}>
                  {block.eyebrow}
                </p>
                <h3 className="landing-h3" style={{ fontSize: 22, marginBottom: 20 }}>
                  {block.title}
                </h3>
                <ul className="res-tour__bullets">
                  {block.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
              <div className="landing-card res-tour__panel" aria-hidden>
                <div className="res-tour__panel-mark">{block.eyebrow}</div>
                <div className="res-tour__panel-lines">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
