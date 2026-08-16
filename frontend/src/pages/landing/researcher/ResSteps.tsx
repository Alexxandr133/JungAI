import './ResSteps.css';

const STEPS = [
  {
    n: '1',
    title: 'Регистрация исследователем — 5 минут.',
  },
  {
    n: '2',
    title: 'Первый первый проект.',
  },
  {
    n: '3',
    title: 'Материал растёт: символы, частота, участники тестов.',
  },
] as const;

export function ResSteps() {
  return (
    <section className="res-steps" aria-labelledby="res-steps-heading">
      <div className="landing-container">
        <h2 id="res-steps-heading" className="landing-h2 res-steps__title">
          Старт — за один вечер
        </h2>
        <ol className="res-steps__list">
          {STEPS.map((step) => (
            <li key={step.n} className="landing-card res-steps__card">
              <div className="res-steps__num" aria-hidden>
                {step.n}
              </div>
              <h3 className="landing-h3 res-steps__card-title">{step.title}</h3>
            </li>
          ))}
        </ol>
        <p className="res-steps__banner" role="note">
          Платформа в раннем доступе — первые исследователи подключаются бесплатно; тарифы появятся
          скоро, ранний доступ сохраняет льготные условия.
        </p>
      </div>
    </section>
  );
}
