import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Video, MessageSquare, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useMessengerUi } from '../../context/MessengerUiContext';
import { useChatSocket } from '../../context/ChatSocketContext';
import { api } from '../../lib/api';
import { ClientNavbar } from '../../components/ClientNavbar';
import { PlatformIcon, type PlatformIconName } from '../../components/icons';
import { MoodCheckInControl, MoodMiniChart } from '../../components/client/MoodCheckIn';
import { StarfieldBackground } from '../../components/visuals';
import './Workspace.css';

type DreamBrief = { id: string; title: string; content?: string; createdAt: string; userId?: string | null; symbols?: unknown };

type EventBrief = {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  sessionStatus?: string;
  voiceRoom?: { roomUrl: string } | null;
};

type HomeworkItem = { id: string; date: string; homework: string; nextFocus?: string | null };

type SessionReflectionItem = { id: string; eventId?: string | null; createdAt: string };

const ROTATING_INSIGHTS = [
  'Сон, записанный сразу после пробуждения, сохраняет больше деталей — даже одно предложение уже ценно.',
  'Не обязательно «понимать» сон: достаточно отметить настроение и образы — смысл часто проявляется со временем.',
  'Короткая запись в дневнике в тот же день, когда что-то произошло, помогает на сессии не упустить важное.',
  'Если тревожно начать писать — начните с одного слова или цвета, который вспомнился.',
  'Повторяющийся мотив во снах не всегда «предсказание» — чаще это способ психики обрабатывать опыт.',
  'Пауза между сессиями — нормальная часть процесса: платформа помогает не терять нить между встречами.',
  'Вопрос к психологу можно набросать черновиком здесь или в дневнике — так легче говорить вслух.',
  '«Не помню сон» тоже данные: можно записать, как вы проснулись и что чувствовали.',
];

const PATH_MILESTONES: Array<{ id: string; label: string; check: (ctx: MilestoneCtx) => boolean }> = [
  { id: 'mood', label: 'Первый check-in настроения', check: (c) => c.hasMoodCheckIn },
  { id: 'dream', label: 'Первый сон в журнале', check: (c) => c.dreamCount > 0 },
  { id: 'journal', label: 'Первая запись в дневнике', check: (c) => c.journalCount > 0 },
  { id: 'session', label: 'Первая принятая сессия', check: (c) => c.acceptedSessionCount > 0 },
  { id: 'journal5', label: 'Пять записей в дневнике', check: (c) => c.journalCount >= 5 },
  { id: 'discuss', label: 'Сон отмечен «обсудить на сессии»', check: (c) => c.discussCount > 0 },
];

type MilestoneCtx = {
  hasMoodCheckIn: boolean;
  dreamCount: number;
  journalCount: number;
  acceptedSessionCount: number;
  discussCount: number;
};

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

function filterOwnDreams(items: DreamBrief[], clientUserId: string | undefined): DreamBrief[] {
  if (!clientUserId) return items;
  return items.filter((d) => d.userId === clientUserId);
}

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

function weekSymbolFromDreams(dreams: DreamBrief[]): string | null {
  const weekAgo = Date.now() - 7 * 86400000;
  const recent = dreams.filter((d) => new Date(d.createdAt).getTime() >= weekAgo);
  const counts = new Map<string, number>();
  for (const d of recent) {
    const syms = Array.isArray(d.symbols) ? (d.symbols as string[]) : [];
    for (const s of syms) {
      const k = String(s || '').trim().toLowerCase();
      if (!k) continue;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [sym, n] of counts.entries()) {
    if (n > bestN) {
      bestN = n;
      best = sym;
    }
  }
  if (best !== null) return best.charAt(0).toUpperCase() + best.slice(1);
  const fallback = recent[0];
  if (!fallback) return null;
  const syms = Array.isArray(fallback.symbols) ? (fallback.symbols as string[]) : [];
  const first = syms[0] ? String(syms[0]).trim() : '';
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : null;
}

function parseHomeworkLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s\-•*\d.)]+/, '').trim())
    .filter(Boolean);
}

function homeworkProgressStorageKey(homeworkId: string): string {
  return `jingai_hw_done_${homeworkId}`;
}

function loadHomeworkDone(homeworkId: string): Set<number> {
  try {
    const raw = localStorage.getItem(homeworkProgressStorageKey(homeworkId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as number[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveHomeworkDone(homeworkId: string, done: Set<number>) {
  localStorage.setItem(homeworkProgressStorageKey(homeworkId), JSON.stringify([...done]));
}

function useSessionCountdown(startsAt: string | null): string | null {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!startsAt) {
      setLabel(null);
      return;
    }
    const tick = () => {
      const ms = new Date(startsAt).getTime() - Date.now();
      if (ms <= 0) {
        setLabel('Сейчас');
        return;
      }
      const sec = Math.floor(ms / 1000);
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      if (h > 0) setLabel(`${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      else setLabel(`${m}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startsAt]);
  return label;
}

export default function ClientWorkspace() {
  const { token, user } = useAuth();
  const { openMessenger } = useMessengerUi();
  const { unread } = useChatSocket();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [dreamTotal, setDreamTotal] = useState(0);
  const [recentDreams, setRecentDreams] = useState<DreamBrief[]>([]);
  const [weekSymbol, setWeekSymbol] = useState<string | null>(null);
  const [journalCount, setJournalCount] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState<EventBrief[]>([]);
  const [nearestEvent, setNearestEvent] = useState<EventBrief | null>(null);
  const [hasPsychologist, setHasPsychologist] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState<{
    steps: Array<{ id: string; title: string; done: boolean; path: string }>;
    doneCount: number;
    total: number;
    complete: boolean;
  } | null>(null);
  const [todayMood, setTodayMood] = useState<number | null>(null);
  const [moodEnergy, setMoodEnergy] = useState(3);
  const [moodAnxiety, setMoodAnxiety] = useState(3);
  const [moodLocked, setMoodLocked] = useState(false);
  const [moodTrend, setMoodTrend] = useState<
    Array<{ date: string; mood: number | null; energy?: number | null; anxiety?: number | null }>
  >([]);
  const [progressCtx, setProgressCtx] = useState<MilestoneCtx | null>(null);
  const [homework, setHomework] = useState<HomeworkItem[]>([]);
  const [discussCount, setDiscussCount] = useState(0);
  const [reflectionEventId, setReflectionEventId] = useState<string | null>(null);
  const [reflectMood, setReflectMood] = useState(3);
  const [reflectText, setReflectText] = useState('');
  const [reflectSaving, setReflectSaving] = useState(false);
  const [hwDoneVersion, setHwDoneVersion] = useState(0);
  const [moodSaving, setMoodSaving] = useState(false);

  const insight = useMemo(() => insightForToday(), []);
  const greet = useMemo(() => greetingForHour(), []);
  const countdown = useSessionCountdown(nearestEvent?.startsAt ?? null);

  const sessionMarkerDates = useMemo(() => {
    const keys = new Set<string>();
    for (const ev of upcomingEvents) {
      if (ev.sessionStatus === 'accepted' || !ev.sessionStatus) keys.add(dateKey(ev.startsAt));
    }
    return [...keys];
  }, [upcomingEvents]);

  const moodChartSessionMarkers = useMemo(
    () => sessionMarkerDates.filter((k) => moodTrend.some((p) => p.date === k || p.date.startsWith(k))),
    [sessionMarkerDates, moodTrend]
  );

  const milestonesDone = useMemo(() => {
    if (!progressCtx) return PATH_MILESTONES.map((m) => ({ ...m, done: false }));
    return PATH_MILESTONES.map((m) => ({ ...m, done: m.check(progressCtx) }));
  }, [progressCtx]);

  useEffect(() => {
    (async () => {
      if (!token) {
        setDreamTotal(2);
        setRecentDreams([
          { id: 'd1', title: 'Лечу над горящим городом', createdAt: new Date().toISOString(), userId: 'demo', symbols: ['полёт', 'огонь'] },
          { id: 'd2', title: 'Красная дверь и коридор', createdAt: new Date().toISOString(), userId: 'demo', symbols: ['дверь'] },
        ]);
        setWeekSymbol('Дверь');
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
          token,
        }).catch(() => null);
        const dreamsP = api<{ items: DreamBrief[]; total: number }>('/api/dreams', { token }).catch(() => ({
          items: [] as DreamBrief[],
          total: 0,
        }));
        const journalP = api<{ items: { createdAt: string }[] }>('/api/journal/entries', { token }).catch(() => ({
          items: [] as { createdAt: string }[],
        }));
        const eventsP = api<{ items: EventBrief[] }>('/api/my-events', { token }).catch(() => ({ items: [] as EventBrief[] }));
        const onboardingP = api<{
          steps: Array<{ id: string; title: string; done: boolean; path: string }>;
          doneCount: number;
          total: number;
          complete: boolean;
        }>('/api/client/onboarding', { token }).catch(() => null);
        const moodP = api<{
          daily: Array<{ date: string; mood: number | null; energy: number | null; anxiety: number | null }>;
          today: { mood: number; energy: number; anxiety: number } | null;
          lockedToday: boolean;
        }>('/api/client/mood?days=14', { token }).catch(() => null);
        const progressP = api<{
          eventCount: number;
          dreamCount: number;
          journalCount: number;
          moodTrend: Array<{ date: string; mood: number; energy: number; anxiety: number }>;
          flaggedDreams: Array<{ id: string }>;
          openHomework: HomeworkItem[];
          reflections: SessionReflectionItem[];
        }>('/api/client/progress', { token }).catch(() => null);
        const homeworkP = api<{ items: HomeworkItem[] }>('/api/client/homework', { token }).catch(() => ({
          items: [] as HomeworkItem[],
        }));
        const remindP = api<{ upcoming: Array<{ id: string; title: string; startsAt: string; endsAt?: string }> }>(
          '/api/client/session-reminders/sync',
          { token, method: 'POST', body: {} }
        ).catch(() => null);

        const [hasP, profile, dreams, journal, events, onboard, mood, progress, hwRes] = await Promise.all([
          psychP,
          profileP,
          dreamsP,
          journalP,
          eventsP,
          onboardingP,
          moodP,
          progressP,
          homeworkP,
          remindP,
        ]);

        setHasPsychologist(hasP);
        setOnboarding(onboard);
        if (mood?.today) {
          setTodayMood(mood.today.mood);
          setMoodEnergy(mood.today.energy);
          setMoodAnxiety(mood.today.anxiety);
        }
        setMoodLocked(Boolean(mood?.lockedToday));
        setMoodTrend(mood?.daily || []);

        const ownDreams = filterOwnDreams(dreams.items || [], uid);
        setDreamTotal(ownDreams.length);
        setRecentDreams(ownDreams.slice(0, 5));
        setWeekSymbol(weekSymbolFromDreams(ownDreams));

        const jItems = journal.items || [];
        setJournalCount(jItems.length);

        const now = Date.now();
        const upcoming = (events.items || [])
          .filter((ev) => {
            if (new Date(ev.startsAt).getTime() < now - 3600000) return false;
            return ev.sessionStatus === 'accepted' || ev.sessionStatus === 'pending' || !ev.sessionStatus;
          })
          .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
        setUpcomingEvents(upcoming);
        setNearestEvent(upcoming[0] || null);

        if (progress) {
          setDiscussCount(progress.flaggedDreams?.length ?? 0);
          setProgressCtx({
            hasMoodCheckIn: (mood?.daily || []).some((d) => d.mood != null),
            dreamCount: progress.dreamCount ?? ownDreams.length,
            journalCount: progress.journalCount ?? jItems.length,
            acceptedSessionCount: (events.items || []).filter((e) => e.sessionStatus === 'accepted').length,
            discussCount: progress.flaggedDreams?.length ?? 0,
          });
        }

        setHomework(hwRes.items?.length ? hwRes.items : progress?.openHomework || []);

        const name =
          profile?.client?.name?.trim() ||
          profile?.profile?.name?.trim() ||
          '';
        setDisplayName(name);

        const reflectionCandidates = (events.items || []).filter((ev) => {
          if (!ev.endsAt) return false;
          const endMs = new Date(ev.endsAt).getTime();
          const oneHourAfter = endMs + 3600000;
          return now >= oneHourAfter && now <= endMs + 72 * 3600000;
        });
        const reflectedEventIds = new Set((progress?.reflections || []).map((r) => r.eventId).filter(Boolean));
        const needReflect = reflectionCandidates.find((ev) => !reflectedEventIds.has(ev.id));
        setReflectionEventId(needReflect?.id ?? null);
      } catch {
        /* keep defaults */
      } finally {
        setLoading(false);
      }
    })();
  }, [token, user?.id]);

  async function saveWorkspaceMood(next: { mood: number; energy: number; anxiety: number }) {
    if (!token || moodLocked) return;
    setMoodSaving(true);
    try {
      await api('/api/client/mood', { token, method: 'POST', body: next });
      setTodayMood(next.mood);
      setMoodEnergy(next.energy);
      setMoodAnxiety(next.anxiety);
      setMoodLocked(true);
      const todayKey = new Date().toISOString().slice(0, 10);
      setMoodTrend((prev) =>
        prev.map((p) =>
          p.date === todayKey ? { ...p, mood: next.mood, energy: next.energy, anxiety: next.anxiety } : p
        )
      );
      setProgressCtx((c) => (c ? { ...c, hasMoodCheckIn: true } : c));
    } catch {
      /* ignore */
    } finally {
      setMoodSaving(false);
    }
  }

  async function deleteDream(id: string) {
    if (!token || !window.confirm('Удалить запись сна?')) return;
    try {
      await api(`/api/dreams/${id}`, { method: 'DELETE', token });
      setRecentDreams((prev) => prev.filter((d) => d.id !== id));
      setDreamTotal((n) => Math.max(0, n - 1));
    } catch {
      /* ignore */
    }
  }

  async function submitReflection() {
    if (!token || !reflectionEventId) return;
    setReflectSaving(true);
    try {
      await api('/api/client/session-reflection', {
        token,
        method: 'POST',
        body: { eventId: reflectionEventId, moodAfter: reflectMood, text: reflectText.trim() || null },
      });
      setReflectionEventId(null);
      setReflectText('');
      setReflectMood(3);
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Не удалось сохранить';
      window.alert(msg);
    } finally {
      setReflectSaving(false);
    }
  }

  function toggleHomeworkLine(homeworkId: string, lineIndex: number, totalLines: number) {
    const done = loadHomeworkDone(homeworkId);
    if (done.has(lineIndex)) done.delete(lineIndex);
    else done.add(lineIndex);
    saveHomeworkDone(homeworkId, done);
    setHwDoneVersion((v) => v + 1);
    void totalLines;
  }

  const spaceCards: Array<{
    label: string;
    title: string;
    hint: string;
    to: string;
    icon: PlatformIconName;
    trust?: boolean;
  }> = [
    {
      label: 'Сны',
      title: 'Журнал снов',
      hint: dreamTotal
        ? `${dreamTotal} ваших записей · тёмная «ночь» на отдельной странице.`
        : 'Записывайте образы и символы — тёмная «ночь» с отдельным настроением.',
      to: '/dreams',
      icon: 'dreams',
    },
    {
      label: 'Дневник',
      title: 'Личный дневник',
      hint:
        journalCount > 0
          ? `${journalCount} записей · шифруются на устройстве, доступны только вам.`
          : 'Записи шифруются на устройстве и доступны только вам.',
      to: '/client/journal',
      icon: 'journal',
      trust: true,
    },
    {
      label: 'Развитие',
      title: 'Забота и прогресс',
      hint: 'Трекер, задания и наблюдения между сессиями.',
      to: '/client/care',
      icon: 'heart',
    },
    {
      label: 'ИИ',
      title: 'ИИ-помощник',
      hint: 'Спокойный диалог для прояснения мыслей.',
      to: '/client/ai',
      icon: 'bot',
    },
  ];

  const unreadTotal = unread?.total ?? 0;

  return (
    <div className="client-workspace">
      <ClientNavbar />
      <main className="client-workspace__main">
        {loading && token && (
          <p className="small" style={{ color: 'var(--ink-muted)', marginBottom: 16 }}>
            Загрузка…
          </p>
        )}
        {hasPsychologist === false && (
          <div className="client-workspace__card client-workspace__card--flat" style={{ padding: 22, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ flex: '1 1 280px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span style={{ color: 'var(--brand)', display: 'inline-flex' }}>
                    <PlatformIcon name="stethoscope" size={28} strokeWidth={1.5} />
                  </span>
                  <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>Подключите психолога</h2>
                </div>
                <p style={{ margin: 0, color: 'var(--ink-soft)', lineHeight: 1.6, fontSize: 14 }}>
                  Сессии, чат и совместная работа со снами удобнее, когда у вас есть специалист на платформе.
                </p>
              </div>
              <button type="button" className="button" onClick={() => navigate('/client/match')} style={{ padding: '12px 22px', fontWeight: 700 }}>
                Подобрать по анкете
              </button>
            </div>
          </div>
        )}

        <div className="client-workspace__zones">
          {/* —— Сегодня —— */}
          <section aria-labelledby="zone-today">
            <h2 id="zone-today" className="client-workspace__zone-title">
              Сегодня
            </h2>
            <div className="client-home-today__hero client-workspace__card client-home-today__grid">
              <div>
                <div className="small" style={{ color: 'var(--brand)', fontWeight: 700, letterSpacing: '0.04em', marginBottom: 8 }}>
                  ЛИЧНЫЙ КАБИНЕТ
                </div>
                <h1 className="client-workspace__h1" style={{ margin: 0, fontSize: 'clamp(26px, 4vw, 34px)', lineHeight: 1.2 }}>
                  {greet}
                  {displayName ? `, ${displayName}` : ''}
                </h1>
                <p className="client-home-today__lead">Сны, дневник и связь с психологом — в спокойном темпе, без гонки за цифрами.</p>
              </div>
              <div className="client-workspace__card client-workspace__card--flat" style={{ padding: 18 }}>
                <MoodCheckInControl
                  compact
                  mood={todayMood}
                  energy={moodEnergy}
                  anxiety={moodAnxiety}
                  locked={moodLocked}
                  saving={moodSaving}
                  disabled={!token}
                  onSave={(v) => void saveWorkspaceMood(v)}
                />
              </div>
            </div>

            {nearestEvent && (
              <div className="client-workspace__card client-home-session" style={{ marginTop: 14 }}>
                <div className="client-home-session__title">Ближайшая сессия</div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{nearestEvent.title}</div>
                <div className="client-home-session__when">
                  {new Date(nearestEvent.startsAt).toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
                {countdown && <div className="client-home-countdown">{countdown}</div>}
                <div className="client-home-session__actions">
                  {nearestEvent.voiceRoom?.roomUrl && (
                    <a
                      href={nearestEvent.voiceRoom.roomUrl}
                      className="button"
                      style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                    >
                      <Video size={16} />
                      Подключиться
                    </a>
                  )}
                  <button type="button" className="button secondary" onClick={() => openMessenger()} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <MessageSquare size={16} />
                    Написать
                  </button>
                </div>
              </div>
            )}

            <div className="client-workspace__card client-home-thought" style={{ marginTop: 14 }}>
              <div className="client-home-thought__head">
                <div className="client-home-thought__title">
                  <PlatformIcon name="sparkles" size={20} strokeWidth={1.75} />
                  Мысль дня
                </div>
                <div className="client-home-thought__actions">
                  <Link to="/client/journal" state={{ prefill: insight }} className="button secondary" style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                    В дневник
                  </Link>
                  <button type="button" className="button secondary" style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600 }} onClick={() => openMessenger()}>
                    Обсудить
                  </button>
                </div>
              </div>
              <p className="client-home-thought__text">{insight}</p>
            </div>

            {reflectionEventId && (
              <div className="client-workspace__card client-home-reflection" style={{ marginTop: 14 }}>
                <p>Прошла сессия — уделите пару минут рефлексии: это попадёт в «Мой путь».</p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={reflectMood === n ? 'button' : 'button secondary'}
                      style={{ minWidth: 40, padding: '8px 10px' }}
                      onClick={() => setReflectMood(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <textarea
                  value={reflectText}
                  onChange={(e) => setReflectText(e.target.value)}
                  placeholder="Что осталось важным? (необязательно)"
                  rows={3}
                  style={{ width: '100%', padding: 12, borderRadius: 10, resize: 'vertical', fontFamily: 'inherit', marginBottom: 12, border: '1px solid var(--line)' }}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" className="button secondary" onClick={() => setReflectionEventId(null)}>
                    Позже
                  </button>
                  <button type="button" className="button" disabled={reflectSaving} onClick={() => void submitReflection()}>
                    {reflectSaving ? '…' : 'Сохранить'}
                  </button>
                </div>
              </div>
            )}

            {onboarding && !onboarding.complete && (
              <div className="client-workspace__card" style={{ padding: 18, marginTop: 14 }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>С чего начать</div>
                <div className="small" style={{ color: 'var(--ink-muted)', marginBottom: 12 }}>
                  {onboarding.doneCount} из {onboarding.total}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {onboarding.steps.map((s) => (
                    <Link
                      key={s.id}
                      to={s.path}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 10,
                        textDecoration: 'none',
                        color: 'inherit',
                        background: 'var(--paper-soft)',
                        border: '1px solid var(--line)',
                      }}
                    >
                      <span style={{ color: s.done ? 'var(--sage)' : 'var(--ink-muted)', fontWeight: 800, width: 20 }}>
                        {s.done ? '✓' : '○'}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{s.title}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* —— С психологом —— */}
          <section aria-labelledby="zone-psych">
            <h2 id="zone-psych" className="client-workspace__zone-title">
              С психологом
            </h2>
            <div className="client-home-psych">
              {discussCount > 0 && (
                <div className="client-home-psych__aggregate">
                  К сессии скопилось <strong>{discussCount}</strong> {discussCount === 1 ? 'вопрос' : discussCount < 5 ? 'вопроса' : 'вопросов'} — сны и темы с флагом «Обсудить».
                </div>
              )}
              {homework.map((h) => {
                const lines = parseHomeworkLines(h.homework || '');
                const done = loadHomeworkDone(h.id);
                const progressPct = lines.length ? Math.round((done.size / lines.length) * 100) : 0;
                return (
                  <article key={`${h.id}-v${hwDoneVersion}`} className="client-workspace__card client-home-task">
                    <div className="client-home-task__meta">
                      Задание · сессия {new Date(h.date).toLocaleDateString('ru-RU')}
                    </div>
                    {lines.length > 0 ? (
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
                        {lines.map((line, idx) => (
                          <li key={idx}>
                            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', fontSize: 14, lineHeight: 1.5 }}>
                              <input
                                type="checkbox"
                                checked={done.has(idx)}
                                onChange={() => toggleHomeworkLine(h.id, idx, lines.length)}
                                style={{ marginTop: 4 }}
                              />
                              <span style={{ textDecoration: done.has(idx) ? 'line-through' : 'none', opacity: done.has(idx) ? 0.65 : 1 }}>{line}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="client-home-task__body">{h.homework}</p>
                    )}
                    {lines.length > 0 && (
                      <div className="client-home-task__progress" aria-hidden>
                        <span style={{ width: `${progressPct}%` }} />
                      </div>
                    )}
                  </article>
                );
              })}
              {!homework.length && hasPsychologist !== false && (
                <div className="client-workspace__card" style={{ padding: 18, color: 'var(--ink-muted)', fontSize: 14 }}>
                  Задания от психолога появятся после сессий. Пока можно написать в чат или отметить настроение.
                </div>
              )}
              <div className="client-workspace__card client-home-messages">
                <div>
                  <div style={{ fontWeight: 800 }}>Сообщения</div>
                  <div className="small" style={{ color: 'var(--ink-muted)', marginTop: 4 }}>
                    {unreadTotal > 0 ? `${unreadTotal} непрочитанных` : 'Диалог с психологом'}
                  </div>
                </div>
                <button type="button" className="button" onClick={() => openMessenger()}>
                  Открыть чат
                </button>
              </div>
            </div>
          </section>

          {/* —— Мой путь —— */}
          <section aria-labelledby="zone-path">
            <h2 id="zone-path" className="client-workspace__zone-title">
              Мой путь
            </h2>
            <div className="client-home-path__grid">
              <div className="client-workspace__card" style={{ padding: 18 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Динамика настроения</div>
                <MoodMiniChart points={moodTrend} height={180} sessionMarkers={moodChartSessionMarkers} />
                <Link to="/client/care" className="small" style={{ color: 'var(--brand)', fontWeight: 600, display: 'inline-block', marginTop: 10 }}>
                  Открыть трекер →
                </Link>
              </div>
              <div className="client-workspace__card" style={{ padding: 18 }}>
                <div style={{ fontWeight: 700, marginBottom: 12 }}>Вехи</div>
                <ul className="client-home-milestones">
                  {milestonesDone.map((m) => (
                    <li key={m.id} className={m.done ? 'is-done' : undefined}>
                      <span className="client-home-milestones__dot" aria-hidden />
                      {m.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* —— Ваши пространства —— */}
          <section aria-labelledby="zone-spaces">
            <h2 id="zone-spaces" className="client-workspace__zone-title">
              Ваши пространства
            </h2>
            <div className="client-home-spaces__grid">
              {spaceCards.map((s) => (
                <Link key={s.to} to={s.to} className="client-workspace__card client-home-space-link">
                  <div className="client-home-space-link__icon">
                    <PlatformIcon name={s.icon} size={32} strokeWidth={1.5} />
                  </div>
                  <div className="client-home-space-link__title">{s.title}</div>
                  <p className={`client-home-space-link__hint${s.trust ? ' client-home-space-link--trust' : ''}`}>{s.hint}</p>
                </Link>
              ))}
            </div>

            {(weekSymbol || recentDreams.length > 0) && (
              <div className="client-workspace__card client-home-dreams" style={{ marginTop: 14 }}>
                <StarfieldBackground opacity={0.85} contained />
                <div className="client-home-dreams__inner">
                {weekSymbol && (
                  <>
                    <div className="client-home-dreams__symbol-label">Символ недели</div>
                    <div className="client-home-dreams__symbol">{weekSymbol}</div>
                  </>
                )}
                {recentDreams.length > 0 && (
                  <>
                    <div className="client-home-dreams__symbol-label" style={{ marginTop: weekSymbol ? 20 : 0 }}>
                      Последние сны
                    </div>
                    <ul className="client-home-dreams__list">
                      {recentDreams.map((d) => (
                        <li key={d.id} className="client-home-dreams__row">
                          <Link to={`/dreams/${d.id}`} className="client-home-dreams__row-link">
                            <div className="client-home-dreams__row-title">{d.title || 'Без названия'}</div>
                            {d.content && <p className="client-home-dreams__row-excerpt">{d.content}</p>}
                            <div className="client-home-dreams__row-date">
                              {new Date(d.createdAt).toLocaleDateString('ru-RU')}
                            </div>
                          </Link>
                          {token && (
                            <button
                              type="button"
                              className="client-home-dreams__row-delete"
                              title="Удалить сон"
                              onClick={(e) => {
                                e.preventDefault();
                                void deleteDream(d.id);
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                    <Link to="/dreams" className="small" style={{ color: '#c4b5fd', fontWeight: 600, marginTop: 12, display: 'inline-block' }}>
                      Все сны →
                    </Link>
                  </>
                )}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
