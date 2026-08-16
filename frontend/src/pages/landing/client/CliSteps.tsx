import './CliSteps.css';

const STEPS = [
  {
    n: '1',
    title: 'Выберите специалиста.',
    body: 'Каталог с методами, описанием и ценой — или по вашему запросу.',
  },
  {
    n: '2',
    title: 'Встречайтесь по видео.',
    body: 'Прямо на платформе, по ссылке, без установки приложений. Сессия 50–60 минут.',
  },
  {
    n: '3',
    title: 'Работайте между сессиями.',
    body: 'Дневник снов, тесты и задачи от психолога — по желанию и в вашем темпе.',
  },
] as const;

export function CliSteps() {
  return (
    <section id="how" className="cli-steps" aria-labelledby="cli-steps-heading">
      <div className="landing-container">
        <h2 id="cli-steps-heading" className="landing-h2 cli-steps__title">
          Три шага — и вы не один на один
        </h2>
        <ol className="cli-steps__list">
          {STEPS.map((step) => (
            <li key={step.n} className="landing-card cli-steps__card">
              <div className="cli-steps__num" aria-hidden>
                {step.n}
              </div>
              <h3 className="landing-h3 cli-steps__card-title">{step.title}</h3>
              <p className="landing-body cli-steps__card-body">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
