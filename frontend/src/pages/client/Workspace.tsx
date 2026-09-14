import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CloudMoon, NotebookPen, PauseCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useMessengerUi } from '../../context/MessengerUiContext';
import { api } from '../../lib/api';
import { ClientNavbar } from '../../components/ClientNavbar';
import { MoodCheckInControl, MoodMiniChart } from '../../components/client/MoodCheckIn';
import { DailyQuoteModal } from '../../components/client/DailyQuoteModal';
import { SessionMonthCalendar } from '../../components/client/SessionMonthCalendar';
import { BreathingPracticeModal } from '../../components/client/BreathingPracticeModal';
import { HabitTrackerMini } from '../../components/client/HabitTrackerMini';
import { quoteForToday } from '../../lib/dailyQuotes';
import { LECTURE_STUBS } from '../../lib/clientActivities';
import { excerptFromHtml, type ForumPost } from '../publications/forumUtils';
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
type AssignmentItem = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  dueAt?: string | null;
  createdAt: string;
};

type SessionReflectionItem = { id: string; eventId?: string | null; createdAt: string };

const PATH_MILESTONES: Array<{ id: string; label: string; check: (ctx: MilestoneCtx) => boolean }> = [
  { id: 'mood', label: 'Первый check-in настроения', check: (c) => c.hasMoodCheckIn },
  { id: 'dream', label: 'Первый сон в журнале', check: (c) => c.dreamCount > 0 },
  { id: 'journal', label: 'Первая запись в дневнике', check: (c) => c.journalCount > 0 },
  { id: 'session', label: 'Первая принятая сессия', check: (c) => c.acceptedSessionCount > 0 },
  { id: 'journal5', label: 'Пять записей в дневнике', check: (c) => c.journalCount >= 5 },
  { id: 'discuss', label: 'Сон отмечен «обсудить на сессии»', check: (c) => c.discussCount > 0 },
  { id: 'assignment', label: 'Первое задание выполнено', check: (c) => c.hasCompletedAssignment },
  { id: 'test', label: 'Пройден первый тест', check: (c) => c.hasTestResult },
];

const MILESTONE_STAR_POS: Array<{ x: number; y: number }> = [
  { x: 28, y: 118 },
  { x: 68, y: 52 },
  { x: 108, y: 100 },
  { x: 148, y: 40 },
  { x: 188, y: 112 },
  { x: 228, y: 48 },
  { x: 268, y: 96 },
  { x: 302, y: 54 },
];

type MilestoneCtx = {
  hasMoodCheckIn: boolean;
  dreamCount: number;
  journalCount: number;
  acceptedSessionCount: number;
  discussCount: number;
  hasCompletedAssignment: boolean;
  hasTestResult: boolean;
};

function greetingForHour(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 17) return 'Добрый день';
  if (h < 22) return 'Добрый вечер';
  return 'Доброй ночи';
}

function filterOwnDreams(items: DreamBrief[], clientUserId: string | undefined): DreamBrief[] {
  if (!clientUserId) return items;
  return items.filter((d) => d.userId === clientUserId);
}

function dateKey(iso: string): string {
  return iso.slice(0, 10);
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

function constellationRewardKey(userId?: string): string {
  return `jungai_constellation_reward_${userId || 'guest'}`;
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
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [dreamTotal, setDreamTotal] = useState(0);
  const [journalCount, setJournalCount] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState<EventBrief[]>([]);
  const [nearestEvent, setNearestEvent] = useState<EventBrief | null>(null);
  const [hasPsychologist, setHasPsychologist] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayMood, setTodayMood] = useState<number | null>(null);
  const [moodEnergy, setMoodEnergy] = useState(3);
  const [moodAnxiety, setMoodAnxiety] = useState(3);
  const [moodLocked, setMoodLocked] = useState(false);
  const [moodTrend, setMoodTrend] = useState<
    Array<{ date: string; mood: number | null; energy?: number | null; anxiety?: number | null }>
  >([]);
  const [progressCtx, setProgressCtx] = useState<MilestoneCtx | null>(null);
  const [homework, setHomework] = useState<HomeworkItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [discussCount, setDiscussCount] = useState(0);
  const [reflectionEventId, setReflectionEventId] = useState<string | null>(null);
  const [reflectMood, setReflectMood] = useState(3);
  const [reflectText, setReflectText] = useState('');
  const [reflectSaving, setReflectSaving] = useState(false);
  const [hwDoneVersion, setHwDoneVersion] = useState(0);
  const [moodSaving, setMoodSaving] = useState(false);
  const [pathDay, setPathDay] = useState(1);
  const [feedPosts, setFeedPosts] = useState<ForumPost[]>([]);
  const [breathOpen, setBreathOpen] = useState(false);
  const [lectureId, setLectureId] = useState<string | null>(null);
  const [rewardClaimed, setRewardClaimed] = useState(false);
  const [quickNote, setQuickNote] = useState('');
  const [quickNoteSaving, setQuickNoteSaving] = useState(false);
  const [quickNoteFlash, setQuickNoteFlash] = useState(false);

  const dailyQuote = useMemo(() => quoteForToday(), []);
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

  const milestonesComplete = milestonesDone.length > 0 && milestonesDone.every((m) => m.done);

  useEffect(() => {
    try {
      setRewardClaimed(localStorage.getItem(constellationRewardKey(user?.id)) === '1');
    } catch {
      setRewardClaimed(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (milestonesComplete && user?.id) {
      try {
        localStorage.setItem(constellationRewardKey(user.id), '1');
        setRewardClaimed(true);
      } catch {
        /* ignore */
      }
    }
  }, [milestonesComplete, user?.id]);

  useEffect(() => {
    (async () => {
      if (!token) {
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
        const assignmentsP = api<{ items: AssignmentItem[] }>('/api/client/assignments', { token }).catch(() => ({
          items: [] as AssignmentItem[],
        }));
        const testsP = api<{ items: unknown[] }>('/api/tests/my-results', { token }).catch(() => ({ items: [] as unknown[] }));
        const feedP = api<{ items: ForumPost[] }>('/api/publications/feed?limit=6&listMode=1', { token }).catch(() =>
          api<{ items: ForumPost[] }>('/api/public/publications/feed?limit=6').catch(() => ({ items: [] as ForumPost[] }))
        );
        void api('/api/client/session-reminders/sync', { token, method: 'POST', body: {} }).catch(() => null);

        const [hasP, profile, dreams, journal, events, mood, progress, hwRes, assignRes, testsRes, feedRes] =
          await Promise.all([
            psychP,
            profileP,
            dreamsP,
            journalP,
            eventsP,
            moodP,
            progressP,
            homeworkP,
            assignmentsP,
            testsP,
            feedP,
          ]);

        setHasPsychologist(hasP);
        setAssignments(assignRes?.items || []);
        setFeedPosts((feedRes?.items || []).slice(0, 6));
        if (mood?.today) {
          setTodayMood(mood.today.mood);
          setMoodEnergy(mood.today.energy);
          setMoodAnxiety(mood.today.anxiety);
        }
        setMoodLocked(Boolean(mood?.lockedToday));
        setMoodTrend(mood?.daily || []);

        const ownDreams = filterOwnDreams(dreams.items || [], uid);
        setDreamTotal(ownDreams.length);

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

        const assignItems = assignRes?.items || [];
        const testItems = testsRes?.items || [];

        if (progress) {
          setDiscussCount(progress.flaggedDreams?.length ?? 0);
          setProgressCtx({
            hasMoodCheckIn: (mood?.daily || []).some((d) => d.mood != null),
            dreamCount: progress.dreamCount ?? ownDreams.length,
            journalCount: progress.journalCount ?? jItems.length,
            acceptedSessionCount: (events.items || []).filter((e) => e.sessionStatus === 'accepted').length,
            discussCount: progress.flaggedDreams?.length ?? 0,
            hasCompletedAssignment: assignItems.some((a) => a.status === 'done'),
            hasTestResult: testItems.length > 0,
          });
        } else {
          setProgressCtx({
            hasMoodCheckIn: (mood?.daily || []).some((d) => d.mood != null),
            dreamCount: ownDreams.length,
            journalCount: jItems.length,
            acceptedSessionCount: (events.items || []).filter((e) => e.sessionStatus === 'accepted').length,
            discussCount: 0,
            hasCompletedAssignment: assignItems.some((a) => a.status === 'done'),
            hasTestResult: testItems.length > 0,
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

        const dates = [...ownDreams.map((d) => d.createdAt), ...jItems.map((j) => j.createdAt)].filter(Boolean);
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

  async function saveQuickJournalNote() {
    const content = quickNote.trim();
    if (!token || !content || quickNoteSaving) return;
    setQuickNoteSaving(true);
    try {
      await api('/api/journal/entries', {
        token,
        method: 'POST',
        body: { content },
      });
      setQuickNote('');
      setJournalCount((n) => n + 1);
      setProgressCtx((c) =>
        c
          ? {
              ...c,
              journalCount: c.journalCount + 1,
            }
          : c
      );
      setQuickNoteFlash(true);
      window.setTimeout(() => setQuickNoteFlash(false), 2200);
    } catch {
      window.alert('Не удалось сохранить заметку. Попробуйте ещё раз.');
    } finally {
      setQuickNoteSaving(false);
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

  function toggleHomeworkLine(homeworkId: string, lineIndex: number) {
    const done = loadHomeworkDone(homeworkId);
    if (done.has(lineIndex)) done.delete(lineIndex);
    else done.add(lineIndex);
    saveHomeworkDone(homeworkId, done);
    setHwDoneVersion((v) => v + 1);
  }

  async function toggleAssignment(task: AssignmentItem) {
    if (!token) return;
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    setAssignments((prev) => prev.map((a) => (a.id === task.id ? { ...a, status: nextStatus } : a)));
    try {
      await api(`/api/client/assignments/${task.id}`, {
        method: 'PATCH',
        token,
        body: { status: nextStatus },
      });
      if (nextStatus === 'done') {
        setProgressCtx((c) => (c ? { ...c, hasCompletedAssignment: true } : c));
      }
    } catch {
      setAssignments((prev) => prev.map((a) => (a.id === task.id ? { ...a, status: task.status } : a)));
    }
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
      hint: dreamTotal ? `${dreamTotal} ваших записей` : 'Записывайте образы и символы.',
      to: '/dreams',
    },
    {
      mod: 'journal',
      kicker: 'Дневник',
      title: 'Личный дневник',
      hint:
        journalCount > 0
          ? `${journalCount} записей · шифруются на устройстве.`
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
      hint: 'Лента, посты и обсуждения.',
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

  const openLecture = lectureId ? LECTURE_STUBS.find((l) => l.id === lectureId) : null;

  const calendarSessions = useMemo(
    () =>
      upcomingEvents.map((ev) => ({
        date: dateKey(ev.startsAt),
        title: ev.title,
      })),
    [upcomingEvents]
  );

  return (
    <div className="client-desk">
      <ClientNavbar />
      <DailyQuoteModal enabled={Boolean(token)} quote={dailyQuote} />
      <BreathingPracticeModal open={breathOpen} onClose={() => setBreathOpen(false)} />
      {openLecture && (
        <div className="client-desk__lecture-modal" role="dialog" aria-modal="true">
          <button type="button" className="client-desk__lecture-backdrop" aria-label="Закрыть" onClick={() => setLectureId(null)} />
          <div className="client-desk__lecture-card">
            <p className="client-desk__lecture-role">{openLecture.role}</p>
            <h3>{openLecture.name}</h3>
            <p>{openLecture.blurb}</p>
            <button type="button" className="button" onClick={() => setLectureId(null)}>
              Закрыть
            </button>
          </div>
        </div>
      )}

      <main className="client-desk__main">
        {loading && token && <p className="client-desk__loading">Загрузка…</p>}

        <div className="client-desk__zones">
          <section aria-labelledby="zone-today">
            <p id="zone-today" className="client-desk__zone-label">
              Сегодня
            </p>

            <div className="client-desk__hero">
              <div className="client-desk__hero-grid client-desk__hero-grid--main">
                <div className="client-desk__hero-greet">
                  <p className="client-desk__path-day">
                    День {pathDay} вашего пути · {moon}
                  </p>
                  <h1 className="client-desk__h1">
                    {greet}
                    {displayName ? `, ${displayName}` : ''}
                  </h1>
                  <p className="client-desk__lead">Все для успешной терапии в одой платформе</p>
                </div>

                <div className="client-desk__hero-cal">
                  <SessionMonthCalendar
                    compact
                    sessions={calendarSessions}
                    nearestLabel={nearestEvent?.title}
                    nearestWhen={
                      nearestEvent
                        ? new Date(nearestEvent.startsAt).toLocaleString('ru-RU', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : null
                    }
                    countdown={countdown}
                    joinUrl={nearestEvent?.voiceRoom?.roomUrl || null}
                    onWrite={() => openMessenger()}
                  />
                </div>

                <div className="client-desk__hero-tasks">
                  <div className="client-desk__tasks-head">
                    <h2>Задания</h2>
                    {discussCount > 0 && (
                      <p className="client-desk__psych-note" style={{ margin: 0 }}>
                        К сессии: {discussCount} {discussWord(discussCount)} «обсудить»
                      </p>
                    )}
                  </div>

                  {assignments.map((a) => (
                    <div key={a.id} className="client-desk__task client-desk__task--flat">
                      <div className="client-desk__task-meta">
                        Задание от психолога
                        {a.dueAt ? ` · до ${new Date(a.dueAt).toLocaleDateString('ru-RU')}` : ''}
                      </div>
                      <ul>
                        <li>
                          <label>
                            <input
                              type="checkbox"
                              checked={a.status === 'done'}
                              onChange={() => void toggleAssignment(a)}
                            />
                            <span
                              style={{
                                textDecoration: a.status === 'done' ? 'line-through' : 'none',
                                opacity: a.status === 'done' ? 0.65 : 1,
                              }}
                            >
                              {a.title}
                            </span>
                          </label>
                        </li>
                      </ul>
                      <div className="client-desk__task-progress" aria-hidden>
                        <span style={{ width: a.status === 'done' ? '100%' : '0%' }} />
                      </div>
                    </div>
                  ))}

                  {homework.map((h) => {
                    const lines = parseHomeworkLines(h.homework || '');
                    const done = loadHomeworkDone(h.id);
                    const progressPct = lines.length ? Math.round((done.size / lines.length) * 100) : 0;
                    return (
                      <div key={`${h.id}-v${hwDoneVersion}`} className="client-desk__task client-desk__task--flat">
                        <div className="client-desk__task-meta">
                          Из сессии · {new Date(h.date).toLocaleDateString('ru-RU')}
                        </div>
                        {lines.length > 0 ? (
                          <ul>
                            {lines.map((line, idx) => (
                              <li key={idx}>
                                <label>
                                  <input
                                    type="checkbox"
                                    checked={done.has(idx)}
                                    onChange={() => toggleHomeworkLine(h.id, idx)}
                                  />
                                  <span
                                    style={{
                                      textDecoration: done.has(idx) ? 'line-through' : 'none',
                                      opacity: done.has(idx) ? 0.65 : 1,
                                    }}
                                  >
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

                  {!assignments.length && !homework.length && hasPsychologist !== false && (
                    <p className="client-desk__empty-soft">Задания от психолога появятся здесь.</p>
                  )}
                </div>
              </div>

              {hasPsychologist === false && (
                <div className="client-desk__connect">
                  <p>Сессии и совместная работа удобнее, когда у вас есть специалист на платформе.</p>
                  <button type="button" className="button" onClick={() => navigate('/client/match')}>
                    Подобрать по анкете
                  </button>
                </div>
              )}

              <div className="client-desk__care">
                <div className="client-desk__care-head">
                  <h2>Забота о себе</h2>
                  <Link to="/client/care" className="client-desk__path-cta">
                    Открыть полностью
                  </Link>
                </div>
                <div className="client-desk__care-grid">
                  <div className="client-desk__care-cell">
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
                  <div className="client-desk__care-cell client-desk__care-cell--chart">
                    <div className="client-desk__care-cell-title">Динамика</div>
                    <div className="client-desk__care-chart">
                      <MoodMiniChart points={moodTrend} height={168} sessionMarkers={moodChartSessionMarkers} />
                    </div>
                  </div>
                  <div className="client-desk__care-cell client-desk__care-cell--notes">
                    <div className="client-desk__care-notes-head">
                      <NotebookPen size={18} strokeWidth={1.6} aria-hidden />
                      <div>
                        <div className="client-desk__care-cell-title">Заметки</div>
                        <p>
                          {journalCount > 0 ? `${journalCount} в дневнике` : 'Быстрая запись в дневник'}
                        </p>
                      </div>
                    </div>
                    <textarea
                      className="client-desk__care-notes-input"
                      value={quickNote}
                      onChange={(e) => setQuickNote(e.target.value)}
                      placeholder="Короткая мысль…"
                      rows={3}
                      disabled={!token || quickNoteSaving}
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                          e.preventDefault();
                          void saveQuickJournalNote();
                        }
                      }}
                    />
                    <div className="client-desk__care-notes-actions">
                      <button
                        type="button"
                        className="button"
                        style={{ padding: '6px 12px', fontSize: 12 }}
                        disabled={!token || !quickNote.trim() || quickNoteSaving}
                        onClick={() => void saveQuickJournalNote()}
                      >
                        {quickNoteSaving ? '…' : 'Сохранить'}
                      </button>
                      <Link to="/client/journal" className="client-desk__path-cta">
                        Дневник →
                      </Link>
                    </div>
                    {quickNoteFlash && <p className="client-desk__care-notes-flash">Сохранено в дневник</p>}
                  </div>
                  <div className="client-desk__care-cell client-desk__care-cell--split">
                    <Link to="/dreams" className="client-desk__care-mini">
                      <CloudMoon size={20} strokeWidth={1.6} />
                      <span>
                        Сны
                        {dreamTotal ? ` · ${dreamTotal}` : ''}
                      </span>
                    </Link>
                    <button type="button" className="client-desk__care-mini" onClick={() => setBreathOpen(true)}>
                      <PauseCircle size={20} strokeWidth={1.6} />
                      <span>Пауза 1 мин</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="client-desk__spaces-inline" aria-labelledby="zone-spaces">
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
              </div>

              <div className="client-desk__quote">
                <div className="client-desk__quote-mark" aria-hidden>
                  “
                </div>
                <p className="client-desk__quote-author">{dailyQuote.author}</p>
                <p className="client-desk__quote-text">{dailyQuote.text}</p>
                <div className="client-desk__quote-actions">
                  <Link
                    to="/client/journal"
                    state={{ prefill: dailyQuote.text }}
                    className="button secondary"
                    style={{ textDecoration: 'none', padding: '8px 16px', fontSize: 13 }}
                  >
                    В дневник
                  </Link>
                </div>
              </div>

              {reflectionEventId && (
                <div className="client-desk__reflect">
                  <p>Прошла сессия — уделите пару минут рефлексии.</p>
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

              <div className="client-desk__pubs-inline" aria-labelledby="zone-pubs">
                <div className="client-desk__section-head">
                  <p id="zone-pubs" className="client-desk__zone-label" style={{ marginBottom: 0 }}>
                    Публикации
                  </p>
                  <Link to="/communities" className="client-desk__path-cta">
                    Все сообщества →
                  </Link>
                </div>
                <div className="client-desk__pubs">
                  {feedPosts.length === 0 ? (
                    <p className="client-desk__empty-soft">Пока нет постов — загляните в каталог сообществ.</p>
                  ) : (
                    feedPosts.map((p) => (
                      <Link key={p.id} to={`/publications/post/${p.id}`} className="client-desk__pub-card">
                        <span className="client-desk__pub-meta">
                          {p.community?.name || 'Сообщество'}
                          {p.flair ? ` · ${p.flair}` : ''}
                        </span>
                        <h3>{p.title || 'Без названия'}</h3>
                        <p>{excerptFromHtml(p.content || '', 140)}</p>
                      </Link>
                    ))
                  )}
                </div>
              </div>

              <div className="client-desk__path-panel client-desk__path-panel--milestones client-desk__milestones-inline">
                <header className="client-desk__path-head">
                  <div>
                    <h3>Вехи</h3>
                    <p>
                      {milestonesDone.filter((m) => m.done).length} из {milestonesDone.length}
                    </p>
                  </div>
                </header>
                {(milestonesComplete || rewardClaimed) && (
                  <div className="client-desk__reward">
                    <span className="client-desk__reward-badge" aria-hidden>
                      ★
                    </span>
                    <div>
                      <strong>Созвездие собрано</strong>
                      <p>Вы отметили все вехи пути. Можно продолжать в своём темпе — это уже ваша опора.</p>
                    </div>
                  </div>
                )}
                <div className="client-desk__path-sky" aria-hidden={!milestonesDone.some((m) => m.done)}>
                  <svg className="client-desk__constellation" viewBox="0 0 320 140" role="img" aria-label="Созвездие вех пути">
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
              </div>
            </div>
          </section>

          <section aria-labelledby="zone-tests">
            <p id="zone-tests" className="client-desk__zone-label">
              Базовые тесты
            </p>
            <div className="client-desk__tests-stub">
              <span className="client-desk__tests-stub-badge">Ведётся разработка</span>
              <p>Каталог скринингов скоро появится здесь. Пока можно вести дневник и отмечать настроение.</p>
            </div>
          </section>

          <section aria-labelledby="zone-acts">
            <p id="zone-acts" className="client-desk__zone-label">
              Активности
            </p>
            <div className="client-desk__acts">
              <article className="client-desk__act-card">
                <h3>Дыхательные практики</h3>
                <p>Короткая пауза на успокоение — пошагово, без приложений.</p>
                <button type="button" className="button secondary" onClick={() => setBreathOpen(true)}>
                  Начать паузу
                </button>
              </article>
              <article className="client-desk__act-card">
                <h3>Медитация и звук</h3>
                <span className="client-desk__tests-stub-badge">Ведётся разработка</span>
                <p>Подборка мягкого звука и коротких медитаций появится здесь позже.</p>
              </article>
              <article className="client-desk__act-card">
                <h3>Лекторий</h3>
                <p>Короткие заметки о мыслителях и психологах.</p>
                <div className="client-desk__act-chips">
                  {LECTURE_STUBS.map((l) => (
                    <button key={l.id} type="button" onClick={() => setLectureId(l.id)}>
                      {l.name.split(' ').slice(-1)[0]}
                    </button>
                  ))}
                </div>
              </article>
              <article className="client-desk__act-card">
                <HabitTrackerMini userId={user?.id} compact />
              </article>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
