import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ClientNavbar } from '../../components/ClientNavbar';
import '../../styles/tokens.css';

type DreamBrief = { id: string; title: string; createdAt: string; userId?: string | null };

type EventBrief = {
  id: string;
  title: string;
  startsAt: string;
  sessionStatus?: string;
};

const ROTATING_INSIGHTS = [
  'Сон, записанный сразу после пробуждения, сохраняет больше деталей — даже одно предложение уже ценно.',
  'Не обязательно «понимать» сон: достаточно отметить настроение и образы — смысл часто проявляется со временем.',
  'Короткая запись в дневнике в тот же день, когда что-то произошло, помогает на сессии не упустить важное.',
  'Если тревожно начать писать — начните с одного слова или цвета, который вспомнился.',
  'Повторяющийся мотив во снах не всегда «предсказание» — чаще это способ психики обрабатывать опыт.',
  'Пауза между сессиями — нормальная часть процесса: платформа помогает не терять нить между встречами.',
  'Вопрос к психологу можно набросать черновиком здесь или в дневнике — так легче говорить вслух.',
  '«Не помню сон» тоже данные: можно записать, как вы проснулись и что чувствовали.',
  'Задания и уровень — игра мотивации; главное — регулярность, а не цифры.',
  'Сообщение психологу в чате не требует идеальной формулировки — достаточно искренности.',
  'Если долго нет снов на запись — отметьте день короткой фразой о сне или отдыхе.',
  'Тесты на платформе — для самоисследования; обсуждать смысл удобнее с живым специалистом.'
];

function greetingForHour(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 17) return 'Добрый день';
  if (h < 22) return 'Добрый вечер';
  return 'Доброй ночи';
}

function insightForToday(): string {
  const start = new Date(new Date().getFullYear(), 0, 0).getTime();
  const day = Math.floor((Date.now() - start) / 86400000);
  return ROTATING_INSIGHTS[day % ROTATING_INSIGHTS.length];
}

/** Только сны, созданные самим клиентом (userId совпадает с аккаунтом), не записанные психологом */
function filterOwnDreams(items: DreamBrief[], clientUserId: string | undefined): DreamBrief[] {
  if (!clientUserId) return items;
  return items.filter(d => d.userId === clientUserId);
}

function useWideLayout(breakpoint = 900) {
  const [wide, setWide] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= breakpoint : false
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [breakpoint]);
  return wide;
}

export default function ClientWorkspace() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const wideLayout = useWideLayout(900);

  const [displayName, setDisplayName] = useState<string>('');
  const [dreamTotal, setDreamTotal] = useState(0);
  const [recentDreams, setRecentDreams] = useState<DreamBrief[]>([]);
  const [journalCount, setJournalCount] = useState(0);
  const [journalThisWeek, setJournalThisWeek] = useState(0);
  const [dailyStreak, setDailyStreak] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState<EventBrief[]>([]);
  const [hasPsychologist, setHasPsychologist] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const insight = useMemo(() => insightForToday(), []);
  const greet = useMemo(() => greetingForHour(), []);

  useEffect(() => {
    (async () => {
      if (!token) {
        setDreamTotal(2);
        setRecentDreams([
          { id: 'd1', title: 'Лечу над горящим городом', createdAt: new Date().toISOString(), userId: 'demo' },
          { id: 'd2', title: 'Красная дверь и коридор', createdAt: new Date().toISOString(), userId: 'demo' }
        ]);
        setHasPsychologist(null);
        setLoading(false);
        return;
      }
      if (!user?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const uid = user.id;
      try {
        const psychP = api('/api/clients/my-psychologist', { token }).then(
          () => true,
          () => false
        );
        const profileP = api<{ client?: { name?: string }; profile?: { name?: string } }>('/api/client/profile', {
          token
        }).catch(() => null);
        const dreamsP = api<{ items: DreamBrief[]; total: number }>('/api/dreams', { token }).catch(() => ({
          items: [] as DreamBrief[],
          total: 0
        }));
        const journalP = api<{ items: { createdAt: string }[] }>('/api/journal/entries', { token }).catch(() => ({
          items: [] as { createdAt: string }[]
        }));
        const eventsP = api<{ items: EventBrief[] }>('/api/my-events', { token }).catch(() => ({ items: [] as EventBrief[] }));

        const [hasP, profile, dreams, journal, events] = await Promise.all([
          psychP,
          profileP,
          dreamsP,
          journalP,
          eventsP
        ]);

        setHasPsychologist(hasP);
        const name =
          profile?.client?.name?.trim() ||
          profile?.profile?.name?.trim() ||
          '';
        setDisplayName(name);

        const ownDreams = filterOwnDreams(dreams.items || [], uid);
        setDreamTotal(ownDreams.length);
        setRecentDreams(ownDreams.slice(0, 4));

        const jItems = journal.items || [];
        setJournalCount(jItems.length);
        const weekAgo = Date.now() - 7 * 86400000;
        setJournalThisWeek(jItems.filter(e => new Date(e.createdAt).getTime() >= weekAgo).length);

        const now = Date.now();
        const upcoming = (events.items || [])
          .filter(ev => new Date(ev.startsAt).getTime() >= now - 3600000)
          .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
          .slice(0, 3);
        setUpcomingEvents(upcoming);

        const allActivities: Date[] = [];
        ownDreams.forEach(d => d.createdAt && allActivities.push(new Date(d.createdAt)));
        jItems.forEach(e => e.createdAt && allActivities.push(new Date(e.createdAt)));
        if (allActivities.length === 0) {
          setDailyStreak(0);
        } else {
          allActivities.sort((a, b) => b.getTime() - a.getTime());
          const uniqueDates = Array.from(
            new Set(
              allActivities.map(d => {
                const x = new Date(d);
                x.setHours(0, 0, 0, 0);
                return x.getTime();
              })
            )
          ).sort((a, b) => b - a);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayTime = today.getTime();
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayTime = yesterday.getTime();

          const startFrom = uniqueDates[0] === todayTime ? todayTime : uniqueDates[0] === yesterdayTime ? yesterdayTime : null;
          if (startFrom === null) {
            setDailyStreak(0);
          } else {
            let streak = 1;
            const anchor = new Date(startFrom);
            for (let i = 1; i < uniqueDates.length; i++) {
              const expected = new Date(anchor);
              expected.setDate(expected.getDate() - i);
              expected.setHours(0, 0, 0, 0);
              if (uniqueDates[i] === expected.getTime()) streak++;
              else break;
            }
            setDailyStreak(streak);
          }
        }
      } catch {
        /* keep defaults */
      } finally {
        setLoading(false);
      }
    })();
  }, [token, user?.id]);

  const statCards = [
    {
      label: 'Мои сны',
      value: dreamTotal,
      hint: 'только ваши записи',
      to: '/dreams',
      icon: '💭'
    },
    {
      label: 'Дневник',
      value: journalCount,
      hint: `за 7 дн.: ${journalThisWeek}`,
      to: '/client/journal',
      icon: '📝'
    },
    {
      label: 'Серия',
      value: dailyStreak,
      hint: 'дней подряд',
      to: '/client/journal',
      icon: '🔥'
    }
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)'
      }}
    >
      <ClientNavbar />
      <main
        style={{
          flex: 1,
          padding: '28px clamp(16px, 5vw, 48px) 48px',
          maxWidth: wideLayout ? 'min(100%, 1520px)' : 'min(100%, 1120px)',
          margin: '0 auto',
          width: '100%',
          overflowX: 'hidden'
        }}
      >
        {hasPsychologist === false && (
          <div
            className="card"
            style={{
              padding: 22,
              marginBottom: 28,
              background: 'linear-gradient(135deg, rgba(91,124,250,0.14), rgba(124,92,255,0.08))',
              border: '1px solid rgba(91,124,250,0.35)',
              borderRadius: 16
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ flex: '1 1 280px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span style={{ fontSize: 28 }}>👨‍⚕️</span>
                  <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>Подключите психолога</h2>
                </div>
                <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6, fontSize: 14 }}>
                  Сессии, чат и совместная работа со снами удобнее, когда у вас есть специалист на платформе.
                </p>
              </div>
              <button
                type="button"
                className="button"
                onClick={() => navigate('/client/psychologists')}
                style={{ padding: '12px 22px', fontWeight: 700, whiteSpace: 'nowrap' }}
              >
                Найти психолога
              </button>
            </div>
          </div>
        )}

        <section
          style={{
            marginBottom: 28,
            padding: '28px clamp(20px, 4vw, 36px)',
            borderRadius: 20,
            background: 'linear-gradient(155deg, rgba(255,255,255,0.04) 0%, var(--surface) 45%, var(--surface-2) 100%)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.18)'
          }}
        >
          <div className="small" style={{ color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.04em', marginBottom: 8 }}>
            ЛИЧНЫЙ КАБИНЕТ
          </div>
          <h1 style={{ margin: 0, fontSize: 'clamp(26px, 4vw, 34px)', fontWeight: 800, lineHeight: 1.2 }}>
            {greet}
            {displayName ? `, ${displayName}` : ''}
          </h1>
          <p style={{ margin: '14px 0 0', color: 'var(--text-muted)', fontSize: 16, lineHeight: 1.55, maxWidth: 560 }}>
            Сны, дневник и связь с психологом — в спокойном темпе. Здесь важны ваши шаги, а не идеальный результат с первого раза.
          </p>
        </section>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 14,
            marginBottom: 28
          }}
        >
          {statCards.map(s => (
            <Link
              key={s.label}
              to={s.to}
              className="card card-hover-shimmer"
              style={{
                padding: 18,
                textDecoration: 'none',
                color: 'inherit',
                borderRadius: 14,
                display: 'block',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.02)'
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
              <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 4 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{loading ? '…' : s.value}</div>
              <div className="small" style={{ color: 'var(--text-muted)', marginTop: 6 }}>
                {s.hint}
              </div>
            </Link>
          ))}
          <Link
            to="/client/tasks"
            className="card card-hover-shimmer"
            style={{
              padding: 18,
              textDecoration: 'none',
              color: 'inherit',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.02)'
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 8 }}>🏆</div>
            <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 4 }}>
              Уровень
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>Баллы и ступени</div>
            <div className="small" style={{ color: 'var(--text-muted)', marginTop: 6 }}>
              Открыть →
            </div>
          </Link>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 20,
            alignItems: 'stretch',
            marginBottom: 28
          }}
        >
          <div
            className="card"
            style={{
              padding: 22,
              borderRadius: 16,
              background: 'linear-gradient(165deg, rgba(124,92,255,0.12), rgba(255,255,255,0.02))',
              border: '1px solid rgba(124,92,255,0.22)'
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 14
              }}
            >
              <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>✨</span> Мысль дня
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <Link
                  to="/client/journal"
                  className="button secondary"
                  style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
                >
                  Дневник
                </Link>
                <Link
                  to="/chat"
                  className="button secondary"
                  style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
                >
                  Сообщения
                </Link>
              </div>
            </div>
            <p style={{ margin: 0, lineHeight: 1.65, color: 'var(--text)', fontSize: 15 }}>{insight}</p>
          </div>

          <div
            className="card"
            style={{
              padding: 22,
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.02)'
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>📅</span> Ближайшие события
              </span>
              <Link to="/client/sessions" className="small" style={{ color: 'var(--primary)' }}>
                Все
              </Link>
            </div>
            {!token && (
              <p className="small" style={{ color: 'var(--text-muted)', margin: 0 }}>
                Войдите, чтобы видеть сессии.
              </p>
            )}
            {token && !upcomingEvents.length && (
              <p className="small" style={{ color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                Пока нет запланированных встреч. Когда психолог назначит сессию, она появится здесь.
              </p>
            )}
            {upcomingEvents.map(ev => (
              <div
                key={ev.id}
                style={{
                  padding: '12px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  fontSize: 14
                }}
              >
                <div style={{ fontWeight: 600 }}>{ev.title}</div>
                <div className="small" style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                  {new Date(ev.startsAt).toLocaleString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                  {ev.sessionStatus === 'pending' && (
                    <span style={{ marginLeft: 8, color: '#fbbf24' }}>· нужен ответ</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800 }}>Что сделать сейчас</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
            marginBottom: 32
          }}
        >
          <Link
            to="/dreams/new"
            className="card card-hover-shimmer"
            style={{
              padding: 24,
              borderRadius: 16,
              textDecoration: 'none',
              color: 'inherit',
              border: '1px solid rgba(91,124,250,0.28)',
              background: 'linear-gradient(135deg, rgba(91,124,250,0.14), transparent)'
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>🌙</div>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8 }}>Записать сон</div>
            <div className="small" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Ваш текст — ваша запись; психолог может вести отдельные материалы в работе с вами.
            </div>
          </Link>
          <Link
            to="/client/journal"
            className="card card-hover-shimmer"
            style={{
              padding: 24,
              borderRadius: 16,
              textDecoration: 'none',
              color: 'inherit',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.03)'
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>📔</div>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8 }}>Дневник</div>
            <div className="small" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Мысли между сессиями — в одном месте.
            </div>
          </Link>
          <Link
            to="/client/ai"
            className="card card-hover-shimmer"
            style={{
              padding: 24,
              borderRadius: 16,
              textDecoration: 'none',
              color: 'inherit',
              border: '1px solid rgba(124,92,255,0.32)',
              background: 'linear-gradient(135deg, rgba(124,92,255,0.12), transparent)'
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8 }}>ИИ-помощник</div>
            <div className="small" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Отдельная страница для спокойного диалога.
            </div>
          </Link>
        </div>

        <div
          style={{
            position: 'relative',
            borderRadius: 20,
            padding: 2,
            background: 'linear-gradient(135deg, rgba(124,92,255,0.35), rgba(34,211,238,0.25), rgba(251,191,36,0.2))',
            marginBottom: 8
          }}
        >
          <div
            className="card"
            style={{
              padding: 24,
              borderRadius: 18,
              margin: 0,
              background: 'var(--surface)',
              border: 'none',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 18,
                flexWrap: 'wrap',
                gap: 10
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>Ваши последние сны</div>
                <div className="small" style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                  Только то, что вы записали сами (не черновики психолога)
                </div>
              </div>
              <Link to="/dreams" style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 600 }}>
                Все сны →
              </Link>
            </div>
            {!recentDreams.length && !loading && (
              <p className="small" style={{ color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
                Пока нет ваших записей. Добавьте короткое описание сна — этого достаточно для начала.
              </p>
            )}
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {recentDreams.map(d => (
                <li key={d.id}>
                  <Link
                    to={`/dreams/${d.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '14px 16px',
                      borderRadius: 14,
                      background: 'linear-gradient(90deg, rgba(124,92,255,0.08), rgba(34,211,238,0.05))',
                      textDecoration: 'none',
                      color: 'var(--text)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      transition: 'transform 0.15s ease, border-color 0.15s'
                    }}
                  >
                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.title || 'Без названия'}
                    </span>
                    <span className="small" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                      {new Date(d.createdAt).toLocaleDateString('ru-RU')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
