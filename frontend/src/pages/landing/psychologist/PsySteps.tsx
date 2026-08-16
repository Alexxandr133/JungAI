import './PsySteps.css';

const STEPS = [
  {
    n: '1',
    title: 'Регистрация — 5 минут.',
    body: 'Без карты и обязательств.',
  },
  {
    n: '2',
    title: 'Верификация — 1 день.',
    body: 'Мы проверяем образование, чтобы клиентам было спокойно, а вам не приходилось конкурировать с «ботами».',
  },
  {
    n: '3',
    title: 'Практика.',
    body: 'Календарь, клиенты, рабочая область. Поможем переехать с Notion и таблиц.',
  },
] as const;

export function PsySteps() {
  return (
    <section className="psy-steps" aria-labelledby="psy-steps-heading">
      <div className="landing-container">
        <h2 id="psy-steps-heading" className="landing-h2 psy-steps__title">
          Быстрый старт
        </h2>
        <ol className="psy-steps__list">
          {STEPS.map((step) => (
            <li key={step.n} className="landing-card psy-steps__card">
              <div className="psy-steps__num" aria-hidden>
                {step.n}
              </div>
              <div>
                <h3 className="landing-h3 psy-steps__card-title">{step.title}</h3>
                <p className="landing-body psy-steps__card-body">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
