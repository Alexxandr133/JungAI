import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { PsychologistNavbar } from '../components/PsychologistNavbar';
import { ClientNavbar } from '../components/ClientNavbar';
import { ResearcherNavbar } from '../components/ResearcherNavbar';

type PlatformUpdate = {
  id: string;
  title: string;
  description: string;
  details: string[];
  publishedAt: string;
};

type SectionKey = 'main' | 'tools' | 'ai' | 'research' | 'publications';
type SectionDocItem = {
  title: string;
  description: string;
  usage: string;
  access: string;
};

function roleLabel(role: string | undefined): string {
  if (role === 'client') return 'Клиент';
  if (role === 'psychologist') return 'Психолог';
  if (role === 'researcher') return 'Исследователь';
  if (role === 'admin') return 'Администратор';
  return 'Пользователь';
}

const MAX_UPDATE_DETAIL_LINES = 12;

const fieldStyle: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'var(--surface-2)',
  color: 'var(--text)',
  boxSizing: 'border-box'
};

function AboutPlatform() {
  const { user, token } = useAuth();
  const [tab, setTab] = useState<'about' | 'updates'>('about');
  const [items, setItems] = useState<PlatformUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionKey>('main');

  const isAdmin = user?.role === 'admin';
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addFormError, setAddFormError] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDetails, setFormDetails] = useState('');
  const [formPublishedAt, setFormPublishedAt] = useState('');

  const sectionDocs = useMemo(() => {
    const mapByRole: Record<string, Record<SectionKey, { title: string; intro: string; items: SectionDocItem[] }>> = {
      psychologist: {
        main: {
          title: 'Основное',
          intro: 'Это центральный блок ежедневной работы психолога. Здесь вы управляете потоками задач и взаимодействием с клиентами.',
          items: [
            { title: 'Рабочий стол', description: 'Сводка по дню: активные клиенты, ближайшие действия, последние события.', usage: 'Начинайте рабочий день с проверки карточек и приоритетов.', access: 'Психолог, админ.' },
            { title: 'Клиенты', description: 'Список клиентов, их статус, переход в детальные профили и рабочие вкладки.', usage: 'Открывайте карточку клиента для глубокой работы по кейсу.', access: 'Психолог, админ.' },
            { title: 'Сессии', description: 'Планирование и контроль консультаций, календарь встреч, статусы.', usage: 'Фиксируйте даты, переносы и follow-up по каждой сессии.', access: 'Психолог, админ.' },
            { title: 'Сообщения', description: 'Коммуникация внутри платформы, быстрое согласование по клиенту.', usage: 'Используйте для оперативных уточнений и ведения диалога.', access: 'Психолог, админ.' }
          ]
        },
        tools: {
          title: 'Инструменты',
          intro: 'Профессиональные рабочие разделы для ведения случаев и фиксации динамики.',
          items: [
            { title: 'Рабочая область', description: 'Документы и структурированные вкладки по каждому клиенту.', usage: 'Заполняйте по сессиям, чтобы сохранялась история наблюдений.', access: 'Психолог, админ.' },
            { title: 'Журнал снов', description: 'Сны клиента и психолога в карточках для анализа.', usage: 'Помечайте символы и используйте контекст в AI-разборе.', access: 'Клиент, психолог, админ.' },
            { title: 'Необъяснимое', description: 'Карточки необычных феноменов для анализа и сопоставления.', usage: 'Собирайте наблюдения в едином формате для дальнейшей работы.', access: 'Клиент, психолог, админ.' },
            { title: 'Библиотека', description: 'Материалы, заметки и база знаний для практики.', usage: 'Формируйте персональную подборку под кейс клиента.', access: 'Психолог, админ.' }
          ]
        },
        ai: {
          title: 'AI ассистент',
          intro: 'Интеллектуальный модуль для помощи в интерпретации и подготовке материалов.',
          items: [
            { title: 'AI чат', description: 'Диалоговый режим с учетом контекста по клиенту и снам.', usage: 'Задавайте конкретную задачу: гипотеза, структура сессии, разбор.', access: 'Психолог, админ.' }
          ]
        },
        research: {
          title: 'Исследования',
          intro: 'Разделы для методического анализа и систематизации практических наблюдений.',
          items: [
            { title: 'Амплификации', description: 'Работа с символами, архетипами и интерпретациями.', usage: 'Используйте как опору при формировании аналитических выводов.', access: 'Психолог, исследователь, админ.' }
          ]
        },
        publications: {
          title: 'Публикации',
          intro: 'Материалы платформы, статьи и практические заметки для развития экспертизы.',
          items: [
            { title: 'Публикации', description: 'Лента статей и контента по методам и кейсам.', usage: 'Применяйте в обучении и работе с клиентскими запросами.', access: 'Психолог, исследователь, админ.' }
          ]
        }
      },
      client: {
        main: {
          title: 'Основное',
          intro: 'Базовый контур клиента: самонаблюдение, сессии, связь с психологом.',
          items: [
            { title: 'Главная', description: 'Ваш обзор состояния и активности в приложении.', usage: 'Начинайте с главной, чтобы видеть актуальные задачи и прогресс.', access: 'Клиент, админ.' },
            { title: 'Мои сны', description: 'Личный журнал снов в карточках.', usage: 'Добавляйте сон сразу после пробуждения для точности деталей.', access: 'Клиент, психолог, админ.' },
            { title: 'Необъяснимое', description: 'Лента феноменов/переживаний для последующего анализа.', usage: 'Записывайте событие в моменте: факт, эмоция, контекст.', access: 'Клиент, психолог, админ.' },
            { title: 'Дневник', description: 'Регулярные заметки о состоянии и мыслях.', usage: 'Ведите кратко, но регулярно — это усиливает динамику терапии.', access: 'Клиент, админ.' },
            { title: 'Сессии', description: 'Ваши запланированные встречи с психологом.', usage: 'Проверяйте даты, готовьте вопросы к следующей сессии.', access: 'Клиент, админ.' }
          ]
        },
        tools: {
          title: 'Инструменты',
          intro: 'Разделы клиента для повседневной практики и отслеживания личной динамики.',
          items: [
            { title: 'Дневник', description: 'Личный журнал состояния, мыслей и инсайтов.', usage: 'Пишите коротко, но регулярно: это помогает видеть динамику между сессиями.', access: 'Клиент, админ.' },
            { title: 'Мои сны', description: 'Карточки сновидений с символами и контекстом.', usage: 'Добавляйте детали сна сразу, чтобы ничего не потерять до разбора.', access: 'Клиент, психолог, админ.' },
            { title: 'Необъяснимое', description: 'Фиксация необычных ощущений и событий.', usage: 'Указывайте время, обстоятельства и эмоции — так проще анализировать паттерны.', access: 'Клиент, психолог, админ.' }
          ]
        },
        ai: {
          title: 'AI ассистент',
          intro: 'Клиентский AI-помощник для саморефлексии, подготовки к сессии и формулировки запроса.',
          items: [
            { title: 'ИИ-помощник', description: 'Диалоговый режим для осмысления переживаний и текущего состояния.', usage: 'Сформулируйте цель разговора: например, "помоги структурировать тревогу перед сессией".', access: 'Клиент, админ.' },
            { title: 'Подготовка к встрече', description: 'Помощь в формулировке вопросов к психологу.', usage: 'Перед сессией соберите 3-5 ключевых вопросов и важных наблюдений.', access: 'Клиент, админ.' }
          ]
        },
        research: {
          title: 'Исследования',
          intro: 'Для клиента этот блок носит обзорный характер и помогает понять исследовательную часть платформы.',
          items: [
            { title: 'Обзор аналитики', description: 'Понимание того, как платформа работает с символами и паттернами.', usage: 'Используйте как справку, чтобы лучше понимать логику интерпретаций.', access: 'Клиент, админ.' }
          ]
        },
        publications: {
          title: 'Публикации',
          intro: 'Полезные статьи и материалы для самопонимания и психообразования.',
          items: [
            { title: 'Публикации', description: 'Лента образовательного контента и практических рекомендаций.', usage: 'Читайте между сессиями и переносите полезные мысли в дневник/вопросы к психологу.', access: 'Клиент, психолог, исследователь, админ.' }
          ]
        }
      },
      researcher: {
        main: {
          title: 'Основное',
          intro: 'Контур исследовательской работы: данные, люди, аналитические наблюдения.',
          items: [
            { title: 'Дашборд', description: 'Сводка исследовательской активности и доступных данных.', usage: 'Отслеживайте текущие задачи и изменения в метриках.', access: 'Исследователь, админ.' },
            { title: 'Сны', description: 'Наборы данных для анализа символов и паттернов.', usage: 'Используйте для гипотез и сравнительных исследований.', access: 'Исследователь, админ.' },
            { title: 'Люди', description: 'Раздел участников и профилей в контексте исследований.', usage: 'Сегментируйте данные по группам и признакам.', access: 'Исследователь, админ.' }
          ]
        },
        tools: {
          title: 'Инструменты',
          intro: 'Методологические разделы для исследовательской обработки материала.',
          items: [
            { title: 'Амплификации', description: 'База символов и интерпретационных связей.', usage: 'Формируйте словари и тематические выборки.', access: 'Исследователь, психолог, админ.' }
          ]
        },
        ai: {
          title: 'AI ассистент',
          intro: 'ИИ поддержка при подготовке аналитических выводов и структурировании наблюдений.',
          items: [
            { title: 'AI чат исследователя', description: 'Помощь в формулировании гипотез и интерпретаций.', usage: 'Используйте как инструмент ускорения исследовательского цикла.', access: 'Исследователь, админ.' }
          ]
        },
        research: {
          title: 'Исследования',
          intro: 'Профильный блок исследователя: аналитика, структуры, гипотезы.',
          items: [
            { title: 'Раздел исследований', description: 'Целевой рабочий контур для аналитической деятельности.', usage: 'Систематизируйте выводы и фиксируйте в публикациях.', access: 'Исследователь, админ.' }
          ]
        },
        publications: {
          title: 'Публикации',
          intro: 'Публикация результатов и распространение знаний команды.',
          items: [
            { title: 'Публикации', description: 'Статьи и отчеты по исследованиям.', usage: 'Оформляйте результаты в понятный формат для коллег.', access: 'Исследователь, психолог, админ.' }
          ]
        }
      }
    };

    const roleKey = user?.role === 'client' ? 'client' : user?.role === 'researcher' ? 'researcher' : 'psychologist';
    return mapByRole[roleKey][activeSection];
  }, [activeSection, user?.role]);

  async function loadUpdates() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ items: PlatformUpdate[] }>('/api/platform/updates', { token });
      setItems(Array.isArray(res.items) ? res.items : []);
    } catch (e: any) {
      setError(e.message || 'Не удалось загрузить обновления');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tab === 'updates') loadUpdates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, token]);

  useEffect(() => {
    if (!showAddModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowAddModal(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showAddModal]);

  async function submitPlatformUpdate(e: FormEvent) {
    e.preventDefault();
    if (!token || !isAdmin) return;
    const title = formTitle.trim();
    const description = formDescription.trim();
    if (!title || !description) {
      setAddFormError('Укажите заголовок и описание');
      return;
    }
    const details = formDetails
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_UPDATE_DETAIL_LINES);
    setAddSubmitting(true);
    setAddFormError(null);
    try {
      await api('/api/admin/platform/updates', {
        method: 'POST',
        token,
        body: {
          title,
          description,
          details,
          ...(formPublishedAt ? { publishedAt: new Date(formPublishedAt).toISOString() } : {})
        }
      });
      setFormTitle('');
      setFormDescription('');
      setFormDetails('');
      setFormPublishedAt('');
      setShowAddModal(false);
      await loadUpdates();
    } catch (err: any) {
      setAddFormError(err?.message || 'Не удалось опубликовать обновление');
    } finally {
      setAddSubmitting(false);
    }
  }

  const Navbar =
    user?.role === 'client' ? ClientNavbar :
    user?.role === 'researcher' ? ResearcherNavbar :
    PsychologistNavbar;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <main style={{ flex: 1, padding: '20px clamp(16px, 5vw, 48px) 40px' }}>
        <section
          className="card"
          style={{
            padding: '28px clamp(18px, 4vw, 40px)',
            marginBottom: 20,
            borderRadius: 20,
            background:
              'radial-gradient(1200px 420px at 0% 0%, rgba(91,124,250,.32), transparent 60%), radial-gradient(900px 360px at 100% 0%, rgba(124,58,237,.28), transparent 60%), linear-gradient(180deg, rgba(12,16,30,.92), rgba(12,16,30,.82))',
            border: '1px solid rgba(130,150,255,.25)'
          }}
        >
          <div className="small" style={{ color: 'rgba(255,255,255,.75)', marginBottom: 8, letterSpacing: '.04em' }}>
            Платформа JungAI · {roleLabel(user?.role)}
          </div>
          <h1 style={{ margin: 0, fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, color: '#fff' }}>
            Инструменты для глубокой работы с клиентами, снами и аналитикой
          </h1>
          <p style={{ margin: '12px 0 0', maxWidth: 860, lineHeight: 1.7, color: 'rgba(255,255,255,.84)' }}>
            Здесь собрана практическая документация по использованию платформы, безопасности данных и свежим обновлениям.
            Раздел обновлений ведется командой, чтобы вы всегда понимали, что изменилось и как это применять в работе.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
            {[
              { id: 'main', label: 'Основное' },
              { id: 'tools', label: 'Инструменты' },
              { id: 'ai', label: 'AI ассистент' },
              { id: 'research', label: 'Исследования' },
              { id: 'publications', label: 'Публикации' }
            ].map((badge) => {
              const active = activeSection === badge.id;
              return (
                <button
                  key={badge.id}
                  type="button"
                  onClick={() => setActiveSection(badge.id as any)}
                  style={{
                    padding: '9px 14px',
                    borderRadius: 999,
                    border: active ? '1px solid rgba(255,255,255,.55)' : '1px solid rgba(255,255,255,.26)',
                    background: active ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.08)',
                    color: '#ffffff',
                    lineHeight: 1.15,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {badge.label}
                </button>
              );
            })}
          </div>
        </section>

        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <button className={tab === 'about' ? 'button' : 'button secondary'} onClick={() => setTab('about')}>О платформе</button>
          <button className={tab === 'updates' ? 'button' : 'button secondary'} onClick={() => setTab('updates')}>Обновления</button>
        </div>

        {error && <div className="card" style={{ padding: 12, marginBottom: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>{error}</div>}

        {tab === 'about' ? (
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              {[
                { t: 'Старт за 5 минут', d: 'Заполните профиль, выберите рабочий раздел и начните вести записи.' },
                { t: 'Под роль пользователя', d: 'Интерфейс и инструменты адаптируются под клиента, психолога или исследователя.' },
                { t: 'AI + практика', d: 'ИИ помогает анализировать, но ключевые решения остаются за специалистом.' }
              ].map((card) => (
                <article key={card.t} className="card" style={{ padding: 18, borderRadius: 16 }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>{card.t}</h3>
                  <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.7 }}>{card.d}</p>
                </article>
              ))}
            </div>

            <div className="card" style={{ padding: 20, borderRadius: 16, background: 'linear-gradient(180deg, rgba(91,124,250,.1), rgba(91,124,250,.03))' }}>
              <h3 style={{ margin: 0 }}>{sectionDocs.title}</h3>
              <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', lineHeight: 1.7 }}>{sectionDocs.intro}</p>
              <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                {sectionDocs.items.map((entry) => (
                  <article key={entry.title} className="card" style={{ padding: 14, borderRadius: 12, background: 'var(--surface-2)' }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{entry.title}</div>
                    <div style={{ marginTop: 6, lineHeight: 1.7 }}>{entry.description}</div>
                    <div className="small" style={{ marginTop: 8, color: 'var(--text-muted)' }}>
                      <strong style={{ color: 'var(--text)' }}>Как использовать:</strong> {entry.usage}
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding: 20, borderRadius: 16 }}>
              <h3 style={{ marginTop: 0 }}>Безопасность и контроль</h3>
              <div style={{ display: 'grid', gap: 10 }}>
                {[
                  'Доступ к разделам ограничивается ролями и проверкой токена.',
                  'Чувствительные операции подтверждаются кодами на email.',
                  'Критичные данные обрабатываются в хэшированном виде.',
                  'Часть пользовательских данных хранится локально в памяти вашего устройства и не отправляется на сервер.',
                  'AI-запросы с потенциально личными данными проходят обезличивание перед отправкой в модель.',
                  'Вы контролируете, какой контекст передается в AI и какие данные включать в анализ.',
                  'Доступ к вашим рабочим материалам и AI-чатам даже для администратора по умолчанию закрыт и может быть предоставлен только по отдельному согласованию.'
                ].map((row) => (
                  <div key={row} style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--surface-2)' }}>{row}</div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                <h3 style={{ marginTop: 0, marginBottom: 0 }}>Лента обновлений</h3>
                {isAdmin && (
                  <button
                    type="button"
                    className="button"
                    title="Добавить обновление"
                    aria-label="Добавить обновление платформы"
                    onClick={() => {
                      setAddFormError(null);
                      setShowAddModal(true);
                    }}
                    style={{
                      minWidth: 44,
                      minHeight: 44,
                      padding: '0 16px',
                      fontSize: 22,
                      lineHeight: 1,
                      fontWeight: 700,
                      borderRadius: 12
                    }}
                  >
                    +
                  </button>
                )}
              </div>
              {loading ? (
                <div className="small" style={{ color: 'var(--text-muted)' }}>Загрузка...</div>
              ) : items.length === 0 ? (
                <div className="small" style={{ color: 'var(--text-muted)' }}>Пока нет публикаций.</div>
              ) : (
                <div style={{ display: 'grid', gap: 14 }}>
                  {items.map((item, idx) => (
                    <article
                      key={item.id}
                      className="card"
                      style={{
                        padding: 16,
                        borderRadius: 16,
                        background: idx === 0
                          ? 'linear-gradient(180deg, rgba(124,58,237,.13), rgba(124,58,237,.05))'
                          : 'var(--surface-2)',
                        border: idx === 0 ? '1px solid rgba(124,58,237,.28)' : '1px solid rgba(255,255,255,.08)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <strong style={{ fontSize: 17 }}>{item.title}</strong>
                        <span className="small" style={{ color: 'var(--text-muted)' }}>
                          {new Date(item.publishedAt).toLocaleString('ru-RU')}
                        </span>
                      </div>
                      <div style={{ marginTop: 8, lineHeight: 1.65 }}>{item.description}</div>
                      {Array.isArray(item.details) && item.details.length > 0 && (
                        <ul style={{ margin: '10px 0 0', paddingLeft: 18, lineHeight: 1.7 }}>
                          {item.details.map((d, dIdx) => <li key={`${item.id}-${dIdx}`}>{d}</li>)}
                        </ul>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {isAdmin && showAddModal && (
          <div
            role="presentation"
            onClick={() => !addSubmitting && setShowAddModal(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(5,8,16,0.78)',
              display: 'grid',
              placeItems: 'center',
              padding: 16,
              zIndex: 2000
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="platform-update-dialog-title"
              className="card"
              onClick={(ev) => ev.stopPropagation()}
              style={{
                width: 'min(520px, 100%)',
                maxHeight: 'min(88vh, 720px)',
                overflowY: 'auto',
                padding: 22,
                borderRadius: 16
              }}
            >
              <h3 id="platform-update-dialog-title" style={{ marginTop: 0 }}>
                Новое обновление
              </h3>
              <p className="small" style={{ marginTop: -6, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                Запись появится во вкладке «Обновления» у всех авторизованных пользователей.
              </p>
              {addFormError && (
                <div
                  style={{
                    padding: 10,
                    marginBottom: 12,
                    borderRadius: 10,
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.35)',
                    color: '#ef4444',
                    fontSize: 14
                  }}
                >
                  {addFormError}
                </div>
              )}
              <form onSubmit={submitPlatformUpdate} style={{ display: 'grid', gap: 14 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="small" style={{ fontWeight: 600 }}>
                    Заголовок
                  </span>
                  <input
                    style={fieldStyle}
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Например: Крупное обновление платформы"
                    required
                    autoFocus
                    disabled={addSubmitting}
                  />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="small" style={{ fontWeight: 600 }}>
                    Описание
                  </span>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Краткий текст обновления"
                    rows={4}
                    required
                    disabled={addSubmitting}
                    style={{ ...fieldStyle, resize: 'vertical', minHeight: 96 }}
                  />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="small" style={{ fontWeight: 600 }}>
                    Пункты списка (необязательно)
                  </span>
                  <span className="small" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Одна строка — один пункт. Не более {MAX_UPDATE_DETAIL_LINES} пунктов.
                  </span>
                  <textarea
                    value={formDetails}
                    onChange={(e) => setFormDetails(e.target.value)}
                    placeholder={'Пункт 1\nПункт 2'}
                    rows={5}
                    disabled={addSubmitting}
                    style={{ ...fieldStyle, resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="small" style={{ fontWeight: 600 }}>
                    Дата публикации (необязательно)
                  </span>
                  <input
                    type="datetime-local"
                    style={fieldStyle}
                    value={formPublishedAt}
                    onChange={(e) => setFormPublishedAt(e.target.value)}
                    disabled={addSubmitting}
                  />
                  <span className="small" style={{ color: 'var(--text-muted)' }}>
                    Если не указать — будет текущее время.
                  </span>
                </label>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 4 }}>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={addSubmitting}
                    onClick={() => setShowAddModal(false)}
                  >
                    Отмена
                  </button>
                  <button type="submit" className="button" disabled={addSubmitting}>
                    {addSubmitting ? 'Публикация…' : 'Опубликовать'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export { AboutPlatform };
export default AboutPlatform;
