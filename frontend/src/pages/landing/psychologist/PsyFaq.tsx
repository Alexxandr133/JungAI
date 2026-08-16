import { useId, useState } from 'react';
import './PsyFaq.css';

const FAQ_ITEMS = [
  {
    q: 'Я из другой школы терапии. Мне подойдёт платформа?',
    a: 'Да. JungAI вырос из аналитической традиции, но CRM, календарь, видео и транскрибация работают для любой модальности. ИИ-ассистент настраивается под ваш подход и не смешивает школы.',
  },
  {
    q: 'Что происходит с данными моих клиентов?',
    a: 'Вы остаётесь владельцем своей базы: карточки, заметки, транскрипции. Платформа — оператор персональных данных (реестр РКН № 15-26-005049) и работает по 152-ФЗ. Аудиозаписи сессий не хранятся — только текст, который вы решили оставить.',
  },
  {
    q: 'Мои клиенты останутся моими?',
    a: 'Конечно. Платформа не «отводит» клиентов и не навязывает своих: вы приглашаете клиентов по ссылке, они записываются сами.',
  },
  {
    q: 'Как проходят видеосессии? Клиенту нужно что-то устанавливать?',
    a: 'Нет. Вы отправляете ссылку — клиент подключается из браузера в один клик, даже без аккаунта.',
  },
  {
    q: 'Я веду записи в Notion и запись через Calendly. Сложно переехать?',
    a: 'Старт занимает один вечер: настраиваете календарь, постепенно переносите карточки. Транскрибация и ИИ — сверху к тому, что у вас уже есть.',
  },
  {
    q: 'Сколько это стоит?',
    a: 'Сейчас платформа в раннем доступе — бесплатно для первых специалистов. Тарифы появятся скоро; участники раннего доступа сохраняют льготные условия.',
  },
  {
    q: 'Зачем нужна верификация?',
    a: 'Чтобы клиентам было спокойно, а вам не приходилось конкурировать с «ботами-психологами». Мы проверяем образование и метод — так доверие строится у всех серьёзных сервисов.',
  },
  {
    q: 'ИИ не заменяет терапевта?',
    a: 'Нет. ИИ — ассистент для рутины и анализа: транскрипция, материалы, гипотезы. Клинические решения всегда остаются за вами. Это зафиксировано в пользовательском соглашении.',
  },
] as const;

export function PsyFaq() {
  const baseId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="psy-faq" aria-labelledby="psy-faq-heading">
      <div className="landing-container psy-faq__inner">
        <h2 id="psy-faq-heading" className="landing-h2 psy-faq__title">
          FAQ
        </h2>
        <div className="psy-faq__list">
          {FAQ_ITEMS.map((item, i) => {
            const open = openIndex === i;
            const panelId = `${baseId}-panel-${i}`;
            const btnId = `${baseId}-btn-${i}`;
            return (
              <div key={item.q} className={`landing-card psy-faq__item${open ? ' is-open' : ''}`}>
                <button
                  type="button"
                  id={btnId}
                  className="psy-faq__q"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(open ? null : i)}
                >
                  <span>{item.q}</span>
                  <span className="psy-faq__icon" aria-hidden>
                    {open ? '−' : '+'}
                  </span>
                </button>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={btnId}
                  className="psy-faq__a"
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
