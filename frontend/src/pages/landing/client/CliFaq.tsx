import { useId, useState } from 'react';
import './CliFaq.css';

const FAQ_ITEMS = [
  {
    q: 'Это терапия или бот?',
    a: 'Живой психолог. Видео-сессии на платформе, настоящий специалист из каталога. ИИ — вспомогательный инструмент для символов и материалов, он не ведёт терапию.',
  },
  {
    q: 'Как выбрать психолога?',
    a: 'По запросу и методу: в карточке — подход, описание и цена. Если после первой встречи поняли, что «не то» — это нормально, можно сменить специалиста.',
  },
  {
    q: 'Как проходят сессии?',
    a: 'По видео, прямо на платформе: вы получаете ссылку и подключаетесь в один клик, без установки приложений. Сессия длится 50–60 минут.',
  },
  {
    q: 'Сколько это стоит?',
    a: 'Каждый психолог указывает цену в своей карточке — вы видите её до записи. Для клиента платформа бесплатна: вы платите только за сессии своему специалисту.',
  },
  {
    q: 'Что с моими данными?',
    a: 'Платформа — оператор персональных данных (реестр РКН № 15-26-005049) и работает по 152-ФЗ. Дневники и заметки видите только вы и ваш психолог.',
  },
  {
    q: 'Я никогда не был(а) у психолога. Это нормально?',
    a: 'Да. Первая встреча — знакомство: вы рассказываете о себе и задаёте вопросы. Никаких «правильных» запросов не существует.',
  },
  {
    q: 'Что такое аналитическая психология?',
    a: 'Направление, выросшее из работ Карла Юнга: бессознательное, сны, символы, индивидуация — путь к себе. На платформе это не лозунг, а инструменты: дневник снов, тесты, работа с символами.',
  },
  {
    q: 'А если психолог не подойдёт?',
    a: 'Так бывает, и это не ошибка. Напишите нам или посмотрите каталог — подскажем специалистов, работающих с похожим запросом.',
  },
] as const;

export function CliFaq() {
  const baseId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="cli-faq" aria-labelledby="cli-faq-heading">
      <div className="landing-container cli-faq__inner">
        <h2 id="cli-faq-heading" className="landing-h2 cli-faq__title">
          Вопросы
        </h2>
        <div className="cli-faq__list">
          {FAQ_ITEMS.map((item, i) => {
            const open = openIndex === i;
            const panelId = `${baseId}-panel-${i}`;
            const btnId = `${baseId}-btn-${i}`;
            return (
              <div key={item.q} className={`landing-card cli-faq__item${open ? ' is-open' : ''}`}>
                <button
                  type="button"
                  id={btnId}
                  className="cli-faq__q"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(open ? null : i)}
                >
                  <span>{item.q}</span>
                  <span className="cli-faq__icon" aria-hidden>
                    {open ? '−' : '+'}
                  </span>
                </button>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={btnId}
                  className="cli-faq__a"
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
