import './MockDeskPanel.css';

const QUICK = [
  'Запланировать встречу',
  'Открыть клиентов',
  'Рабочая зона',
  'AI-ассистент',
  'Транскрибация',
] as const;

const NAV = [
  {
    title: 'События',
    note: 'Сессии, история и приглашения',
    live: 'Ближайшая: сегодня, 16:30',
    active: true,
  },
  {
    title: 'Клиенты',
    note: 'Карточки клиентов и прогресс',
    live: 'Активных: 8',
    active: true,
  },
  {
    title: 'Сны',
    note: 'Новые записи и анализ',
    live: 'К сессии: 2',
    active: true,
  },
  {
    title: 'Сообщества',
    note: 'Лента постов и сообщества',
    live: 'Нет черновиков',
    active: false,
  },
] as const;

export function MockDeskPanel() {
  return (
    <div className="mock-desk" aria-hidden>
      <div className="mock-desk__header">
        <h4 className="mock-desk__h1">Рабочий стол</h4>
      </div>

      <div className="mock-desk__welcome">
        <div className="mock-desk__welcome-top">
          <div>
            <div className="mock-desk__date">вторник, 18 марта</div>
            <div className="mock-desk__greeting">Добрый день, Елена</div>
          </div>
          <div className="mock-desk__welcome-actions">
            <span className="mock-desk__note-btn">✎</span>
            <span className="mock-desk__btn">Звонки</span>
          </div>
        </div>

        <div className="mock-desk__session">
          <div>
            <div className="mock-desk__session-label">Ближайшая сессия</div>
            <div className="mock-desk__session-title">Анна Смирнова</div>
            <div className="mock-desk__session-meta">сегодня, 16:30 · онлайн</div>
          </div>
          <div className="mock-desk__session-side">
            <span className="mock-desk__chip">2 заявки</span>
            <span className="mock-desk__btn">Подключиться</span>
          </div>
        </div>
      </div>

      <div className="mock-desk__quick">
        {QUICK.map((label) => (
          <span key={label} className="mock-desk__quick-btn">
            {label}
          </span>
        ))}
      </div>

      <div className="mock-desk__nav">
        {NAV.map((item) => (
          <div key={item.title} className="mock-desk__nav-card">
            <div className="mock-desk__nav-title">{item.title}</div>
            <div className="mock-desk__nav-note">{item.note}</div>
            <div
              className={`mock-desk__nav-live${item.active ? ' mock-desk__nav-live--active' : ''}`}
            >
              {item.live}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
