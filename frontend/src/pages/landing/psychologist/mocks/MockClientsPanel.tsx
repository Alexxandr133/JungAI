import './MockClientsPanel.css';

type DemoClient = {
  id: string;
  name: string;
  initial: string;
  status: 'registered' | 'pending';
  statusLabel: string;
  subtitle: string;
  city: string;
  age: number;
  email: string;
  tags: { label: string; color: string }[];
  nextSession: string;
  lastContact: string;
  tasks: string;
};

const DEMO_CLIENTS: DemoClient[] = [
  {
    id: '1',
    name: 'Анна Смирнова',
    initial: 'А',
    status: 'registered',
    statusLabel: 'В терапии',
    subtitle: 'В терапии с 12 марта 2025',
    city: 'Москва',
    age: 34,
    email: 'a.smirnova@mail.ru',
    tags: [
      { label: 'юнгианский анализ', color: '#6c5bd4' },
      { label: 'сны', color: '#3e8a6e' },
    ],
    nextSession: '18 мар, 11:00',
    lastContact: '14 мар, 19:20',
    tasks: '2 задачи',
  },
  {
    id: '2',
    name: 'Игорь Петров',
    initial: 'И',
    status: 'registered',
    statusLabel: 'В терапии',
    subtitle: 'В терапии с 3 января 2026',
    city: 'Санкт-Петербург',
    age: 41,
    email: 'igor.p@example.com',
    tags: [
      { label: 'тревога', color: '#f2a65a' },
      { label: 'карьера', color: '#6c5bd4' },
    ],
    nextSession: '19 мар, 16:30',
    lastContact: '12 мар, 10:05',
    tasks: 'нет задач',
  },
  {
    id: '3',
    name: 'Мария Козлова',
    initial: 'М',
    status: 'pending',
    statusLabel: 'Ожидает регистрации',
    subtitle: 'Не зарегистрирован',
    city: 'Казань',
    age: 28,
    email: 'm.kozlova@yandex.ru',
    tags: [{ label: 'первичная встреча', color: '#57536e' }],
    nextSession: 'не запланирована',
    lastContact: '—',
    tasks: '1 задача',
  },
];

export function MockClientsPanel() {
  return (
    <div className="mock-clients" aria-hidden>
      <div className="mock-clients__toolbar">
        <div className="mock-clients__title-row">
          <h4 className="mock-clients__title">Мои клиенты</h4>
          <span className="mock-clients__add">Добавить клиента</span>
        </div>
        <div className="mock-clients__search">Поиск: клиенты, сны, архетипы</div>
        <div className="mock-clients__tabs">
          <span className="mock-clients__tab mock-clients__tab--active">Активные</span>
          <span className="mock-clients__tab">Архив</span>
          <span className="mock-clients__count">3 клиента</span>
        </div>
      </div>

      <div className="mock-clients__grid">
        {DEMO_CLIENTS.map((c) => (
          <article key={c.id} className={`mock-clients__card mock-clients__card--${c.status}`}>
            <div className="mock-clients__head">
              <div className="mock-clients__avatar">{c.initial}</div>
              <div className="mock-clients__identity">
                <div className="mock-clients__name-row">
                  <span className="mock-clients__name">{c.name}</span>
                  <span className={`mock-clients__badge mock-clients__badge--${c.status}`}>
                    {c.statusLabel}
                  </span>
                </div>
                <div className="mock-clients__subtitle">{c.subtitle}</div>
                <div className="mock-clients__meta">
                  {c.city} · {c.age} лет
                </div>
              </div>
            </div>

            <div className="mock-clients__email">{c.email}</div>

            <div className="mock-clients__tags">
              {c.tags.map((t) => (
                <span
                  key={t.label}
                  className="mock-clients__tag"
                  style={{
                    background: `color-mix(in srgb, ${t.color} 18%, #f3f1fa)`,
                    border: `1px solid color-mix(in srgb, ${t.color} 40%, #e2dff0)`,
                  }}
                >
                  {t.label}
                </span>
              ))}
            </div>

            <div className="mock-clients__crm">
              <div className="mock-clients__crm-row">
                <span>Следующая сессия</span>
                <strong>{c.nextSession}</strong>
              </div>
              <div className="mock-clients__crm-row">
                <span>Последний контакт</span>
                <strong>{c.lastContact}</strong>
              </div>
              <div className="mock-clients__crm-row">
                <span>Задачи</span>
                <strong>{c.tasks}</strong>
              </div>
            </div>

            <div className="mock-clients__actions">
              <span className="mock-clients__btn">Профиль</span>
              <span className="mock-clients__btn mock-clients__btn--ghost">Написать</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
