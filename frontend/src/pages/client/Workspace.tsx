import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Video, MessageSquare, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useMessengerUi } from '../../context/MessengerUiContext';
import { useChatSocket } from '../../context/ChatSocketContext';
import { api } from '../../lib/api';
import { ClientNavbar } from '../../components/ClientNavbar';
import { MoodCheckInControl, MoodMiniChart } from '../../components/client/MoodCheckIn';
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

/** Координаты звёзд созвездия вех (viewBox 0 0 320 200) */
const MILESTONE_STAR_POS: Array<{ x: number; y: number }> = [
  { x: 36, y: 120 },
  { x: 88, y: 52 },
  { x: 148, y: 96 },
  { x: 198, y: 40 },
  { x: 248, y: 110 },
  { x: 292, y: 58 },
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

function moonPhaseLabel(d = new Date()): string {
  const synodic = 29.53058867;
  const knownNew = Date.UTC(2000, 0, 6, 18, 14);
  const days = (d.getTime() - knownNew) / 86400000;
  const age = ((days % synodic) + synodic) % synodic;
  const frac = age / synodic;
  if (frac < 0.03 || frac > 0.97) return 'новолуние';
  if (frac < 0.22) return 'растущий серп';
  if (frac < 0.28) return 'первая четверть';
  if (frac < 0.47) return 'растущая луна';
  if (frac < 0.53) return 'полнолуние';
  if (frac < 0.72) return 'убывающая луна';
  if (frac < 0.78) return 'последняя четверть';
  return 'убывающий серп';
}

function pathDayForUser(userId: string | undefined, earliestIso?: string | null): number {
  if (!userId) return 1;
  const key = `jungai_path_start_${userId}`;
  try {
    let start = localStorage.getItem(key);
    if (earliestIso) {
      const earliestMs = new Date(earliestIso).getTime();
      if (!Number.isNaN(earliestMs)) {
        if (!start || earliestMs < new Date(start).getTime()) {
          start = new Date(earliestMs).toISOString();
          localStorage.setItem(key, start);
        }
      }
    }
    if (!start) {
      start = new Date().toISOString();
      localStorage.setItem(key, start);
    }
    return Math.max(1, Math.floor((Date.now() - new Date(start).getTime()) / 86400000) + 1);
  } catch {
    return 1;
  }
}

function discussWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'вопрос';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'вопроса';
  return 'вопросов';
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
  const [pathDay, setPathDay] = useState(1);

  const insight = useMemo(() => insightForToday(), []);
  const greet = useMemo(() => greetingForHour(), []);
  const moon = useMemo(() => moonPhaseLabel(), []);
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
        setPathDay(1);
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

        const name = profile?.client?.name?.trim() || profile?.profile?.name?.trim() || '';
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

        const dates = [
          ...ownDreams.map((d) => d.createdAt),
          ...jItems.map((j) => j.createdAt),
        ].filter(Boolean);
        const earliest = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null;
        setPathDay(pathDayForUser(uid, earliest));
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

  const spaces: Array<{
    mod: string;
    kicker: string;
    title: string;
    hint: string;
    to: string;
    trust?: boolean;
  }> = [
    {
      mod: 'dreams',
      kicker: 'Сны',
      title: 'Журнал снов',
      hint: dreamTotal
        ? `${dreamTotal} ваших записей`
        : 'Записывайте образы и символы — тёмная «ночь» с отдельным настроением.',
      to: '/dreams',
    },
    {
      mod: 'journal',
      kicker: 'Дневник',
      title: 'Личный дневник',
      hint:
        journalCount > 0
          ? `${journalCount} записей · шифруются на устройстве, доступны только вам и вашему психологу.`
          : 'Записи шифруются на устройстве и доступны только вам.',
      to: '/client/journal',
      trust: true,
    },
    {
      mod: 'care',
      kicker: 'Развитие',
      title: 'Забота и прогресс',
      hint: 'Трекер, задания и наблюдения между сессиями.',
      to: '/client/care',
    },
    {
      mod: 'community',
      kicker: 'Форум',
      title: 'Сообщества',
      hint: 'Лента, посты и обсуждения — можно создавать свои сообщества.',
      to: '/communities',
    },
    {
      mod: 'ai',
      kicker: 'ИИ',
      title: 'ИИ-помощник',
      hint: 'Спокойный диалог для прояснения мыслей.',
      to: '/client/ai',
    },
  ];

  const unreadTotal = unread?.total ?? 0;

  return (
    <div className="client-desk">
      <ClientNavbar />
      <main className="client-desk__main">
        {loading && token && <p className="client-desk__loading">Загрузка…</p>}

        <div className="client-desk__zones">
          {/* —— Сегодня —— */}
          <section aria-labelledby="zone-today">
            <p id="zone-today" className="client-desk__zone-label">
              Сегодня
            </p>

            <div className="client-desk__hero">
              <div className="client-desk__hero-grid">
                <div>
                  <p className="client-desk__path-day">
                    День {pathDay} вашего пути · {moon}
                  </p>
                  <h1 className="client-desk__h1">
                    {greet}
                    {displayName ? `, ${displayName}` : ''}
                  </h1>
                  <p className="client-desk__lead">Сны, дневник и связь с психологом — без гонки за цифрами.</p>
                </div>
                <div className="client-desk__mood">
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

              {hasPsychologist === false && (
                <div className="client-desk__connect">
                  <p>Сессии, чат и совместная работа со снами удобнее, когда у вас есть специалист на платформе.</p>
                  <button type="button" className="button" onClick={() => navigate('/client/match')}>
                    Подобрать по анкете
                  </button>
                </div>
              )}

              {nearestEvent && (
                <div className="client-desk__ticket">
                  <div>
                    <div className="client-desk__ticket-label">Ближайшая сессия</div>
                    <h2 className="client-desk__ticket-title">{nearestEvent.title}</h2>
                    <div className="client-desk__ticket-when">
                      {new Date(nearestEvent.startsAt).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    {countdown && <div className="client-desk__ticket-count">{countdown}</div>}
                  </div>
                  <div className="client-desk__ticket-actions">
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
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => openMessenger()}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                    >
                      <MessageSquare size={16} />
                      Написать
                    </button>
                  </div>
                </div>
              )}

              <div className="client-desk__quote">
                <div className="client-desk__quote-mark" aria-hidden>
                  “
                </div>
                <p className="client-desk__quote-text">{insight}</p>
                <div className="client-desk__quote-actions">
                  <Link
                    to="/client/journal"
                    state={{ prefill: insight }}
                    className="button secondary"
                    style={{ textDecoration: 'none', padding: '8px 16px', fontSize: 13 }}
                  >
                    В дневник
                  </Link>
                  <button
                    type="button"
                    className="button secondary"
                    style={{ padding: '8px 16px', fontSize: 13 }}
                    onClick={() => openMessenger()}
                  >
                    Обсудить
                  </button>
                </div>
              </div>

              {reflectionEventId && (
                <div className="client-desk__reflect">
                  <p>Прошла сессия — уделите пару минут рефлексии: это попадёт в «Мой путь».</p>
                  <div className="client-desk__reflect-mood">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={reflectMood === n ? 'is-on' : undefined}
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
                  />
                  <div className="client-desk__reflect-actions">
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
                <div className="client-desk__trail">
                  <div className="client-desk__trail-head">
                    <h2 className="client-desk__trail-title">С чего начать</h2>
                    <p className="client-desk__trail-sub">
                      {onboarding.doneCount} из {onboarding.total}
                    </p>
                  </div>
                  <ul className="client-desk__trail-list">
                    {onboarding.steps.map((s) => (
                      <li key={s.id}>
                        <Link to={s.path} className={s.done ? 'is-done' : undefined}>
                          {s.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          {/* —— С психологом —— */}
          <section aria-labelledby="zone-psych">
            <p id="zone-psych" className="client-desk__zone-label">
              С психологом
            </p>

            {discussCount > 0 && (
              <p className="client-desk__psych-note">
                К сессии скопилось{' '}
                <strong>
                  {discussCount} {discussWord(discussCount)}
                </strong>{' '}
                — сны и темы с флагом «Обсудить».
              </p>
            )}

            {homework.map((h) => {
              const lines = parseHomeworkLines(h.homework || '');
              const done = loadHomeworkDone(h.id);
              const progressPct = lines.length ? Math.round((done.size / lines.length) * 100) : 0;
              return (
                <div key={`${h.id}-v${hwDoneVersion}`} className="client-desk__task">
                  <div className="client-desk__task-meta">
                    Задание · сессия {new Date(h.date).toLocaleDateString('ru-RU')}
                  </div>
                  {lines.length > 0 ? (
                    <ul>
                      {lines.map((line, idx) => (
                        <li key={idx}>
                          <label>
                            <input
                              type="checkbox"
                              checked={done.has(idx)}
                              onChange={() => toggleHomeworkLine(h.id, idx, lines.length)}
                            />
                            <span style={{ textDecoration: done.has(idx) ? 'line-through' : 'none', opacity: done.has(idx) ? 0.65 : 1 }}>
                              {line}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>{h.homework}</p>
                  )}
                  {lines.length > 0 && (
                    <div className="client-desk__task-progress" aria-hidden>
                      <span style={{ width: `${progressPct}%` }} />
                    </div>
                  )}
                </div>
              );
            })}

            {!homework.length && hasPsychologist !== false && (
              <p className="client-desk__empty-soft">
                Задания от психолога появятся после сессий. Пока можно написать в чат или отметить настроение.
              </p>
            )}

            <div className="client-desk__messages-row">
              <div>
                <h3>Сообщения</h3>
                <p>{unreadTotal > 0 ? `${unreadTotal} непрочитанных` : 'Диалог с психологом'}</p>
              </div>
              <button type="button" className="button" onClick={() => openMessenger()}>
                Открыть чат
              </button>
            </div>
          </section>

          {/* —— Мой путь —— */}
          <section aria-labelledby="zone-path">
            <p id="zone-path" className="client-desk__zone-label">
              Мой путь
            </p>
            <div className="client-desk__path">
              <article className="client-desk__path-panel client-desk__path-panel--mood">
                <header className="client-desk__path-head">
                  <div>
                    <h3>Динамика настроения</h3>
                    <p>Отметки за период · дни сессий отмечены на графике</p>
                  </div>
                  <Link to="/client/care" className="client-desk__path-cta">
                    Открыть трекер
                  </Link>
                </header>
                <div className="client-desk__path-chart">
                  <MoodMiniChart points={moodTrend} height={220} sessionMarkers={moodChartSessionMarkers} />
                </div>
              </article>

              <article className="client-desk__path-panel client-desk__path-panel--milestones">
                <header className="client-desk__path-head">
                  <div>
                    <h3>Вехи</h3>
                    <p>
                      {milestonesDone.filter((m) => m.done).length} из {milestonesDone.length}
                    </p>
                  </div>
                </header>
                <div className="client-desk__path-sky" aria-hidden={!milestonesDone.some((m) => m.done)}>
                  <svg
                    className="client-desk__constellation"
                    viewBox="0 0 320 140"
                    role="img"
                    aria-label="Созвездие вех пути"
                  >
                    {milestonesDone.map((m, i) => {
                      if (i === 0) return null;
                      const a = MILESTONE_STAR_POS[i - 1];
                      const b = MILESTONE_STAR_POS[i];
                      const lit = milestonesDone[i - 1].done && m.done;
                      return (
                        <line
                          key={`line-${m.id}`}
                          x1={a.x}
                          y1={a.y * 0.7}
                          x2={b.x}
                          y2={b.y * 0.7}
                          stroke={lit ? 'var(--brand)' : 'var(--card-border)'}
                          strokeWidth={lit ? 1.5 : 1}
                          strokeOpacity={lit ? 0.5 : 0.9}
                        />
                      );
                    })}
                    {milestonesDone.map((m, i) => {
                      const p = MILESTONE_STAR_POS[i];
                      const cy = p.y * 0.7;
                      return (
                        <g key={m.id}>
                          <circle
                            cx={p.x}
                            cy={cy}
                            r={m.done ? 6.5 : 5}
                            fill={m.done ? 'var(--brand)' : 'var(--card)'}
                            stroke={m.done ? 'var(--brand)' : 'var(--card-border)'}
                            strokeWidth={1.75}
                          >
                            <title>{m.label}</title>
                          </circle>
                          <text
                            x={p.x}
                            y={cy + 3.2}
                            textAnchor="middle"
                            className={m.done ? 'client-desk__star-n is-on' : 'client-desk__star-n'}
                          >
                            {i + 1}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
                <ol className="client-desk__milestones">
                  {milestonesDone.map((m, i) => (
                    <li key={m.id} className={m.done ? 'is-done' : undefined}>
                      <span className="client-desk__milestone-idx" aria-hidden>
                        {i + 1}
                      </span>
                      <span className="client-desk__milestone-label">{m.label}</span>
                      {m.done && <span className="client-desk__milestone-done">есть</span>}
                    </li>
                  ))}
                </ol>
              </article>
            </div>
          </section>

          {/* —— Ваши пространства —— */}
          <section aria-labelledby="zone-spaces">
            <p id="zone-spaces" className="client-desk__zone-label">
              Ваши пространства
            </p>
            <div className="client-desk__spaces">
              {spaces.map((s) => (
                <Link key={s.to} to={s.to} className={`client-desk__space client-desk__space--${s.mod}`}>
                  <span className="client-desk__space-kicker">{s.kicker}</span>
                  <h3 className="client-desk__space-title">{s.title}</h3>
                  <p className={`client-desk__space-hint${s.trust ? ' client-desk__space-hint--trust' : ''}`}>{s.hint}</p>
                </Link>
              ))}
            </div>

            {(weekSymbol || recentDreams.length > 0) && (
              <div className="client-desk__dreams">
                <div className="client-desk__dreams-head">
                  <h3>Сны</h3>
                  {weekSymbol && <span className="client-desk__symbol">Символ недели · {weekSymbol}</span>}
                </div>
                {recentDreams.map((d) => (
                  <div key={d.id} className="client-desk__dream-row">
                    <Link to={`/dreams/${d.id}`}>
                      <h4>{d.title || 'Без названия'}</h4>
                      {d.content && <p>{d.content}</p>}
                      <time dateTime={d.createdAt}>{new Date(d.createdAt).toLocaleDateString('ru-RU')}</time>
                    </Link>
                    {token && (
                      <button
                        type="button"
                        className="client-desk__dream-del"
                        title="Удалить сон"
                        onClick={() => void deleteDream(d.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <Link to="/dreams" className="client-desk__path-link">
                  Все сны →
                </Link>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
