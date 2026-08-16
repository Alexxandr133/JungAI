import { OPERATOR_INFO } from '../../../content/operatorInfo';
import './CliTrust.css';

const TRUST_ITEMS = [
  {
    title: 'Психологи верифицированы.',
    body: 'У нас есть четкие требования к психологам, которые мы проверяем до публикации в каталоге.',
  },
  {
    title: 'Работаем по закону.',
    body: `Оператор персональных данных — реестр РКН № ${OPERATOR_INFO.rknRegistryNumber}, 152-ФЗ.`,
  },
  {
    title: 'ИИ — ассистент, не терапевт.',
    body: 'ИИ не ведёт терапию и не заменяет специалиста. Это зафиксировано в наших правилах.',
  },
  {
    title: 'Конфиденциально.',
    body: 'Мы тщательно следим за соблюдением всех мер конфиденциальности и защиты персональных данных.',
  },
] as const;

export function CliTrust() {
  return (
    <section className="cli-trust" aria-labelledby="cli-trust-heading">
      <div className="landing-container">
        <h2 id="cli-trust-heading" className="landing-h2 cli-trust__title">
          Наш принцип — залог вашего спокойствия
        </h2>
        <ul className="cli-trust__grid">
          {TRUST_ITEMS.map((item) => (
            <li key={item.title} className="landing-card cli-trust__card">
              <h3 className="landing-h3 cli-trust__card-title">{item.title}</h3>
              <p className="landing-body cli-trust__card-body">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
