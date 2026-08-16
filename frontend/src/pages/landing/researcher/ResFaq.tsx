import { useId, useState } from 'react';
import './ResFaq.css';

const FAQ_ITEMS = [
  {
    q: 'Я практикующий психолог, не исследователь.',
    a: 'Исследовательский контур полезен и в практике: сны и символы клиентов, гексаграмма индивидуации, публикации. Смотрите блок «Психологам».',
  },
  {
    q: 'Как работает ИИ-извлечение символов?',
    a: 'Платформа передаёт текст сна модели и получает теги символов; у записи есть статус и версия извлечения. Интерпретация всегда ваша — ИИ лишь инструмент.',
  },
  {
    q: 'Можно ли привлекать участников?',
    a: 'Да. Клиентам платформы доступны тесты, включая гексаграмму индивидуации, а API участников возвращает результаты в ваши проекты.',
  },
  {
    q: 'Это медицинские исследования?',
    a: 'Нет. JungAI — платформа психологических исследований и практики, а не клиника. Исследования — в рамках психологической науки и этики платформы.',
  },
  {
    q: 'Что с моими данными?',
    a: 'Проекты, дневники и материалы — в вашем контуре. Платформа работает по 152-ФЗ и состоит в реестре РКН № 15-26-005049.',
  },
] as const;

export function ResFaq() {
  const baseId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="res-faq" aria-labelledby="res-faq-heading">
      <div className="landing-container res-faq__inner">
        <h2 id="res-faq-heading" className="landing-h2 res-faq__title">
          Вопросы
        </h2>
        <div className="res-faq__list">
          {FAQ_ITEMS.map((item, i) => {
            const open = openIndex === i;
            const panelId = `${baseId}-panel-${i}`;
            const btnId = `${baseId}-btn-${i}`;
            return (
              <div key={item.q} className={`landing-card res-faq__item${open ? ' is-open' : ''}`}>
                <button
                  type="button"
                  id={btnId}
                  className="res-faq__q"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(open ? null : i)}
                >
                  <span>{item.q}</span>
                  <span className="res-faq__icon" aria-hidden>
                    {open ? '−' : '+'}
                  </span>
                </button>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={btnId}
                  className="res-faq__a"
                  hidden={!open}
                >
                  <p className="landing-body">{item.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
