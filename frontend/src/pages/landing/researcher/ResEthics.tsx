import './ResEthics.css';

const ITEMS = [
  {
    title: 'Данные.',
    body: 'Доступ к большим объёмам данных.',
  },
  {
    title: 'Тестирование методов и гипотез.',
    body: 'Мы не ограничиваем вас в тестировании методов и гипотез, а функционал платформы расширяется еженедельно.',
  },
  {
    title: 'Ваши материалы — ваши.',
    body: 'Дневники, проекты и гипотезы остаются в вашем контуре.',
  },
  {
    title: 'ИИ — инструмент, не соавтор.',
    body: 'Извлечение символов и гипотезы проверяете и интерпретируете вы.',
  },
] as const;

export function ResEthics() {
  return (
    <section id="ethics" className="res-ethics" aria-labelledby="res-ethics-heading">
      <div className="landing-container">
        <h2 id="res-ethics-heading" className="landing-h2 res-ethics__title">
          Исследовать спокойно — это здесь принципиально
        </h2>
        <ul className="res-ethics__grid">
          {ITEMS.map((item) => (
            <li key={item.title} className="landing-card res-ethics__card">
              <h3 className="landing-h3 res-ethics__card-title">{item.title}</h3>
              <p className="landing-body">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
