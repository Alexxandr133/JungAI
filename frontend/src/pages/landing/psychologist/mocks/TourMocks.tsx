import {
  MessageSquare,
  Mic,
  MonitorUp,
  PhoneOff,
  Users,
  Video,
} from 'lucide-react';
import './TourMocks.css';

export function MockCalendarPanel() {
  const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const cells = [
    '', '', '1', '2', '3', '4', '5',
    '6', '7', '8', '9', '10', '11', '12',
    '13', '14', '15', '16', '17', '18', '19',
    '20', '21', '22', '23', '24', '25', '26',
    '27', '28', '29', '30', '31', '', '',
  ];
  const sessionDays = new Set(['10', '12', '17', '18', '24']);

  return (
    <div className="tm tm--events" aria-hidden>
      <header className="tm-events__header">
        <div>
          <h4 className="tm-events__h1">Сессии и встречи</h4>
          <div className="tm-events__sub">Часовой пояс: Europe/Moscow</div>
        </div>
        <div className="tm-events__header-actions">
          <span className="tm-btn tm-btn--secondary">Календарь</span>
          <span className="tm-btn">Запланировать</span>
        </div>
      </header>

      <div className="tm-events__tabs">
        <span className="tm-events__tab tm-events__tab--active">Предстоящие</span>
        <span className="tm-events__tab">История</span>
        <span className="tm-chip">Сессия</span>
        <span className="tm-chip">Видеовстреча</span>
      </div>

      <div className="tm-events__grid">
        <div className="tm-events__col">
          <div className="tm-card tm-events__nearest">
            <div className="tm-events__nearest-label">Ближайшая</div>
            <div className="tm-events__nearest-title">Анна Смирнова</div>
            <div className="tm-events__nearest-meta">сегодня, 16:30 · онлайн</div>
            <div className="tm-events__nearest-row">
              <span className="tm-badge tm-badge--ok">подтверждена</span>
              <span className="tm-btn tm-btn--sm">Открыть комнату</span>
            </div>
          </div>

          <div className="tm-card">
            <div className="tm-card__title">Заявки и запросы</div>
            <div className="tm-req">
              <div className="tm-req__head">
                <span className="tm-badge tm-badge--warn">Заявка на слот</span>
                <span className="tm-badge tm-badge--new">Новый</span>
              </div>
              <div className="tm-req__name">Игорь Петров</div>
              <div className="tm-req__meta">19 мар, 16:30 · Первая встреча</div>
              <div className="tm-req__actions">
                <span className="tm-btn tm-btn--sm">Принять</span>
                <span className="tm-btn tm-btn--sm tm-btn--secondary">Отклонить</span>
              </div>
            </div>
            <div className="tm-req">
              <div className="tm-req__head">
                <span className="tm-badge tm-badge--warn">Заявка клиента</span>
              </div>
              <div className="tm-req__name">Мария Козлова</div>
              <div className="tm-req__meta">20 мар, 10:00 · просит перенос</div>
              <div className="tm-req__actions">
                <span className="tm-btn tm-btn--sm">Принять</span>
                <span className="tm-btn tm-btn--sm tm-btn--secondary">Отклонить</span>
              </div>
            </div>
          </div>
        </div>

        <div className="tm-card tm-events__cal">
          <div className="tm-events__cal-head">Март 2026</div>
          <div className="tm-events__week">
            {days.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="tm-events__days">
            {cells.map((d, i) => (
              <span
                key={i}
                className={
                  !d
                    ? 'tm-day tm-day--empty'
                    : sessionDays.has(d)
                      ? 'tm-day tm-day--session'
                      : d === '18'
                        ? 'tm-day tm-day--today'
                        : 'tm-day'
                }
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MockVideoPanel() {
  return (
    <div className="tm tm--voice" aria-hidden>
      <div className="tm-voice__stage">
        <div className="tm-voice__tile tm-voice__tile--main">
          <div className="tm-voice__avatar">А</div>
          <span className="tm-voice__name">Анна Смирнова</span>
        </div>
        <div className="tm-voice__tile tm-voice__tile--self">
          <div className="tm-voice__avatar tm-voice__avatar--self">Е</div>
          <span className="tm-voice__name">Вы</span>
        </div>
      </div>

      <div className="tm-voice__toolbar">
        <div className="tm-voice__group">
          <span className="tm-voice__round" title="Микрофон">
            <Mic size={15} strokeWidth={2} />
          </span>
          <span className="tm-voice__round" title="Камера">
            <Video size={15} strokeWidth={2} />
          </span>
        </div>
        <div className="tm-voice__group tm-voice__group--center">
          <span className="tm-voice__pill">
            <Users size={12} strokeWidth={2} /> Участники 2
          </span>
          <span className="tm-voice__pill">
            <MessageSquare size={12} strokeWidth={2} /> Чат
          </span>
          <span className="tm-voice__pill tm-voice__pill--icon" title="Демонстрация">
            <MonitorUp size={13} strokeWidth={2} />
          </span>
        </div>
        <div className="tm-voice__group tm-voice__group--right">
          <span className="tm-voice__hangup">
            <PhoneOff size={13} strokeWidth={2} />
            Завершить
          </span>
        </div>
      </div>
    </div>
  );
}

export function MockAiPanel() {
  return (
    <div className="tm tm--ai" aria-hidden>
      <aside className="tm-ai__sidebar">
        <div className="tm-ai__sidebar-actions">
          <span className="tm-ai__new">Новый чат</span>
          <span className="tm-ai__folder">+ Папка</span>
        </div>
        <div className="tm-ai__row tm-ai__row--active">Разбор сна · Анна</div>
        <div className="tm-ai__row">Супервизия кейса</div>
        <div className="tm-ai__row">Выжимка сессии 12.03</div>
        <div className="tm-ai__quota">Токены · 68% осталось</div>
      </aside>

      <div className="tm-ai__main">
        <header className="tm-ai__header">
          <div>
            <div className="tm-ai__title">AI Ассистент</div>
            <div className="tm-ai__chips">
              <span className="tm-ai__chip">Клиент: Анна Смирнова</span>
              <span className="tm-ai__chip tm-ai__chip--soft">Юнгианский анализ</span>
            </div>
          </div>
          <span className="tm-btn tm-btn--secondary tm-btn--sm">Транскрибация</span>
        </header>

        <div className="tm-ai__messages">
          <div className="tm-ai__tips">
            <span className="tm-ai__tip">Разберите символы сна</span>
            <span className="tm-ai__tip">Подготовьте гипотезы</span>
          </div>
          <div className="tm-ai__bubble tm-ai__bubble--mine">
            В сне клиентки повторяется мост и тёмный лес. Что это может означать в юнгианском ключе?
          </div>
          <div className="tm-ai__bubble-row">
            <span className="tm-ai__bot-icon">✦</span>
            <div className="tm-ai__bubble tm-ai__bubble--theirs">
              Мост часто связан с переходом между сознательным и бессознательным. Лес — пространство
              неизвестного. Можно спросить: куда ведёт мост и что она чувствует на середине пути.
            </div>
          </div>
        </div>

        <div className="tm-ai__composer">
          <span className="tm-ai__composer-input">Спросите ассистента или прикрепите файл…</span>
          <span className="tm-ai__send">→</span>
        </div>
      </div>
    </div>
  );
}

export function MockTranscriptionPanel() {
  return (
    <div className="tm tm--trans" aria-hidden>
      <header className="tm-ai__header tm-trans__header">
        <div className="tm-ai__title">Транскрибация</div>
        <span className="tm-btn tm-btn--secondary tm-btn--sm">AI Ассистент</span>
      </header>

      <p className="tm-trans__hint">
        Загрузите аудио сессии — получите текст с таймкодами [ЧЧ:ММ:СС] и разделением по спикерам.
      </p>

      <div className="tm-trans__drop">
        <div className="tm-trans__drop-icon">↑</div>
        <div className="tm-trans__drop-title">Выбрать файл</div>
        <div className="tm-trans__drop-sub">или перетащите аудио сюда · mp3, m4a, wav</div>
      </div>

      <div className="tm-trans__list-head">Недавние записи</div>
      <div className="tm-trans__list">
        <div className="tm-trans__card tm-trans__card--open">
          <div className="tm-trans__card-title">Сессия · Анна Смирнова · 18 мар</div>
          <div className="tm-trans__card-meta">52 мин · 2 спикера · готово</div>
          <div className="tm-trans__lines">
            <div className="tm-trans__line">
              <span className="tm-trans__ts">[00:00:18]</span>
              <span className="tm-trans__spk">Спикер 1:</span>
              Сон про мост снова пришёл. На этот раз я почти перешла.
            </div>
            <div className="tm-trans__line">
              <span className="tm-trans__ts">[00:01:04]</span>
              <span className="tm-trans__spk">Спикер 2:</span>
              Что изменилось в ощущении на середине моста?
            </div>
          </div>
        </div>
        <div className="tm-trans__card">
          <div className="tm-trans__card-title">Сессия · Игорь Петров · 12 мар</div>
          <div className="tm-trans__card-meta">48 мин · готово</div>
          <div className="tm-trans__preview">Давайте вернёмся к теме границ на работе…</div>
        </div>
      </div>
    </div>
  );
}

export function MockWorkspacePanel() {
  return (
    <div className="tm tm--wa" aria-hidden>
      <aside className="tm-wa__clients">
        <div className="tm-wa__clients-title">Клиенты</div>
        <div className="tm-wa__client tm-wa__client--active">
          <span className="tm-wa__av">А</span>
          Анна Смирнова
        </div>
        <div className="tm-wa__client">
          <span className="tm-wa__av">И</span>
          Игорь Петров
        </div>
        <div className="tm-wa__client">
          <span className="tm-wa__av">М</span>
          Мария Козлова
        </div>
      </aside>

      <div className="tm-wa__editor">
        <div className="tm-wa__tabs">
          <span className="tm-wa__tab tm-wa__tab--active">Дневник клиента</span>
          <span className="tm-wa__tab">Сны</span>
          <span className="tm-wa__tab">Тесты</span>
          <span className="tm-wa__tab tm-wa__tab--add">+ Вкладка</span>
        </div>
        <div className="tm-wa__toolbar">
          <span>B</span>
          <span>I</span>
          <span>U</span>
          <span className="tm-wa__swatch tm-wa__swatch--peach" />
          <span className="tm-wa__swatch tm-wa__swatch--sage" />
          <span className="tm-wa__swatch tm-wa__swatch--lavender" />
          <span className="tm-wa__ai">AI</span>
          <span className="tm-wa__saved">Сохранено · 16:28</span>
        </div>
        <div className="tm-wa__doc">
          <h5 className="tm-wa__doc-title">Кейс: переход через мост</h5>
          <p className="tm-wa__doc-p">
            Клиентка описывает повторяющийся сон: мост над тёмной водой и лес на другом берегу.
            Рабочая гипотеза — образ перехода к новой идентичности.
          </p>
          <p className="tm-wa__doc-p tm-wa__doc-p--hl">
            На середине моста страх снизился; фигура на берегу ощущается поддерживающей.
          </p>
          <div className="tm-wa__placeholder">Пишите здесь — всё сохраняется автоматически</div>
        </div>
      </div>
    </div>
  );
}

export function MockPublicationsPanel() {
  const posts = [
    {
      community: 'Юнгианская практика',
      type: 'Статья',
      title: 'Сон как язык психики',
      excerpt: 'Как работать с образами, не навязывая готовых интерпретаций клиенту.',
      author: 'Елена В.',
      time: '2 ч назад',
      replies: 6,
      likes: 14,
      pinned: true,
    },
    {
      community: 'Онлайн-терапия',
      type: 'Заметка',
      title: 'Границы в онлайн-сессии',
      excerpt: 'Что помогает сохранить рамку, когда кабинет — экран.',
      author: 'Елена В.',
      time: 'вчера',
      replies: 3,
      likes: 9,
      pinned: false,
    },
  ] as const;

  return (
    <div className="tm tm--forum" aria-hidden>
      <header className="tm-forum__header">
        <h4 className="tm-forum__h1">Сообщества</h4>
        <span className="tm-btn tm-btn--sm">+ Новый пост</span>
      </header>

      <div className="tm-forum__toolbar">
        <span className="tm-events__tab tm-events__tab--active">Все</span>
        <span className="tm-events__tab">Подписки</span>
        <span className="tm-chip">Новые</span>
      </div>

      <div className="tm-forum__feed">
        {posts.map((p) => (
          <article key={p.title} className="tm-forum__row">
            <div className="tm-forum__row-meta">
              <span>{p.community}</span>
              <span>·</span>
              <span>{p.type}</span>
              {p.pinned ? <span className="tm-badge tm-badge--ok">Закреплено</span> : null}
            </div>
            <div className="tm-forum__row-title">{p.title}</div>
            <div className="tm-forum__row-excerpt">{p.excerpt}</div>
            <div className="tm-forum__row-foot">
              <span>
                {p.author} · {p.time}
              </span>
              <span>
                {p.replies} ответов · {p.likes} ♥
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
