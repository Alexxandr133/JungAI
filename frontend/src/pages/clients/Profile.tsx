import { useEffect, useState, type FormEvent } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useMessengerUi } from '../../context/MessengerUiContext';
import { api } from '../../lib/api';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';
import { PlatformIcon } from '../../components/icons';
import { VerificationRequired } from '../../components/VerificationRequired';
import { checkVerification } from '../../utils/verification';
import type { VerificationStatus } from '../../utils/verification';
import './ClientProfile.css';

type TabId = 'overview' | 'timeline' | 'notes' | 'tasks' | 'info' | 'stats' | 'sessions' | 'journal';

type ActivityItem = {
  id: string;
  type: string;
  title: string;
  preview?: string | null;
  at: string;
  meta?: Record<string, unknown>;
};

type NoteItem = { id: string; content: string; createdAt: string };
type TaskItem = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  dueAt?: string | null;
  createdAt: string;
};

const TASK_PRESETS = [
  'Записать сон в дневник',
  'Отметить настроение',
  'Практика дыхания 5 мин',
  'Записать ассоциации к сну',
  'Подготовиться к сессии',
];

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Обзор' },
  { id: 'timeline', label: 'Таймлайн' },
  { id: 'notes', label: 'Заметки' },
  { id: 'tasks', label: 'Задания' },
  { id: 'info', label: 'Информация' },
  { id: 'stats', label: 'Статистика' },
  { id: 'sessions', label: 'Сессии' },
  { id: 'journal', label: 'Дневник' },
];

function formatDateTime(value?: string | Date | null) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function activityTypeLabel(type: string) {
  switch (type) {
    case 'note':
      return 'Заметка';
    case 'session':
      return 'Сессия';
    case 'document':
      return 'Документ';
    case 'dream':
      return 'Сон';
    case 'journal':
      return 'Дневник';
    case 'task':
      return 'Задача';
    default:
      return type;
  }
}

export default function ClientProfileView() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token } = useAuth();
  const { openMessenger } = useMessengerUi();
  const [client, setClient] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  const getAvatarUrl = (url: string | null | undefined, clientId?: string) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const env = (import.meta as any).env || {};
    let baseOrigin: string = env.VITE_API_ORIGIN || env.VITE_API_URL || '';
    if (!baseOrigin && env.DEV && typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port !== '4000') {
      baseOrigin = 'http://localhost:4000';
    }
    if (!baseOrigin && typeof window !== 'undefined') {
      baseOrigin = window.location.origin;
    }
    const separator = url.includes('?') ? '&' : '?';
    const params = new URLSearchParams();
    if (clientId) params.set('clientId', clientId);
    params.set('t', Date.now().toString());
    return `${baseOrigin}${url}${separator}${params.toString()}`;
  };

  const [stats, setStats] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [nextEventAt, setNextEventAt] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [taskDraft, setTaskDraft] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const tabFromUrl = searchParams.get('tab');
  const initialTab: TabId =
    tabFromUrl && TABS.some((t) => t.id === tabFromUrl) ? (tabFromUrl as TabId) : 'overview';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && TABS.some((x) => x.id === t)) {
      setActiveTab(t as TabId);
    }
  }, [searchParams]);

  function selectTab(tab: TabId) {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    if (tab === 'overview') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next, { replace: true });
  }

  useEffect(() => {
    if (!token) {
      setIsVerified(null);
      return;
    }
    checkVerification(token).then((result) => {
      setIsVerified(result.isVerified);
      setVerificationStatus(result.status);
    });
  }, [token]);

  useEffect(() => {
    if (isVerified !== false && id) {
      loadClient();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token, isVerified]);

  useEffect(() => {
    const handleFocus = () => {
      if (isVerified !== false && token && id) {
        loadClient();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id, isVerified]);

  async function loadCrmExtras() {
    if (!token || !id) return;
    const [activityRes, notesRes, tasksRes, eventsRes] = await Promise.all([
      api<{ items: ActivityItem[] }>(`/api/clients/${id}/activity`, { token }).catch(() => ({ items: [] })),
      api<{ items: NoteItem[] }>(`/api/clients/${id}/notes`, { token }).catch(() => ({ items: [] })),
      api<{ items: TaskItem[] }>(`/api/tasks?clientId=${id}`, { token }).catch(() => ({ items: [] })),
      api<{ items: any[] }>('/api/events', { token }).catch(() => ({ items: [] })),
    ]);
    setActivity(activityRes.items || []);
    setNotes(notesRes.items || []);
    setTasks(tasksRes.items || []);
    const now = Date.now();
    const upcoming = (eventsRes.items || [])
      .filter(
        (ev) =>
          ev.clientId === id &&
          new Date(ev.startsAt).getTime() >= now &&
          (!ev.sessionStatus || ev.sessionStatus === 'accepted' || ev.sessionStatus === 'pending')
      )
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    setNextEventAt(upcoming[0]?.startsAt ?? null);
  }

  async function loadClient() {
    if (!token || !id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [clientRes, sessionsRes, journalRes] = await Promise.all([
        api<any>(`/api/clients/${id}`, { token }),
        api<{ items: any[] }>(`/api/clients/${id}/sessions`, { token }).catch(() => ({ items: [] })),
        api<{ items: any[] }>(`/api/clients/${id}/journal`, { token }).catch(() => ({ items: [] })),
      ]);

      setClient(clientRes);
      setProfile(clientRes.profile);
      setSessions(sessionsRes.items || []);
      setJournalEntries(journalRes.items || []);

      const dreamsRes = await api<{ items: any[] }>(`/api/dreams?clientId=${id}`, { token }).catch(() => ({ items: [] }));
      setStats({
        dreams: dreamsRes.items?.length || 0,
        sessions: sessionsRes.items?.length || 0,
        journalEntries: journalRes.items?.length || 0,
      });

      await loadCrmExtras();
    } catch (e: any) {
      setError(e.message || 'Не удалось загрузить данные клиента');
    } finally {
      setLoading(false);
    }
  }

  async function createNote(e: FormEvent) {
    e.preventDefault();
    if (!token || !id || !noteDraft.trim()) return;
    setSavingNote(true);
    setError(null);
    try {
      await api(`/api/clients/${id}/notes`, {
        method: 'POST',
        token,
        body: { content: noteDraft.trim() },
      });
      setNoteDraft('');
      await loadCrmExtras();
    } catch (err: any) {
      setError(err.message || 'Не удалось сохранить заметку');
    } finally {
      setSavingNote(false);
    }
  }

  async function deleteNote(noteId: string) {
    if (!token || !id) return;
    try {
      await api(`/api/clients/${id}/notes/${noteId}`, { method: 'DELETE', token });
      await loadCrmExtras();
    } catch (err: any) {
      setError(err.message || 'Не удалось удалить заметку');
    }
  }

  async function createTask(e: FormEvent) {
    e.preventDefault();
    if (!token || !id || !taskDraft.trim()) return;
    setSavingTask(true);
    setError(null);
    try {
      const created = await api<TaskItem>('/api/tasks', {
        method: 'POST',
        token,
        body: {
          clientId: id,
          title: taskDraft.trim(),
          dueAt: taskDue ? new Date(taskDue).toISOString() : null,
        },
      });
      setTaskDraft('');
      setTaskDue('');
      setTasks((prev) => [created, ...prev]);
    } catch (err: any) {
      setError(err.message || 'Не удалось создать задачу');
    } finally {
      setSavingTask(false);
    }
  }

  async function toggleTaskDone(task: TaskItem) {
    if (!token) return;
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));
    try {
      await api(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        token,
        body: { status: nextStatus },
      });
    } catch (err: any) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)));
      setError(err.message || 'Не удалось обновить задачу');
    }
  }

  async function deleteTask(taskId: string) {
    if (!token) return;
    if (!window.confirm('Удалить задание?')) return;
    const prev = tasks;
    setTasks((list) => list.filter((t) => t.id !== taskId));
    try {
      await api(`/api/tasks/${taskId}`, { method: 'DELETE', token });
    } catch (err: any) {
      setTasks(prev);
      setError(err.message || 'Не удалось удалить задание');
    }
  }

  if (isVerified === false && token) {
    return (
      <div className="client-profile">
        <PsychologistNavbar />
        <VerificationRequired verificationStatus={verificationStatus} />
      </div>
    );
  }

  const profileData = profile?.bio ? (typeof profile.bio === 'string' ? JSON.parse(profile.bio) : profile.bio) : {};
  const openTasks = tasks.filter((t) => t.status !== 'done');
  const lastSession = sessions
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  const clientTags: Array<{ label: string; color?: string }> = Array.isArray(client?.tags) ? client.tags : [];
  const discussDreams: Array<{ id: string; title?: string; createdAt?: string }> = Array.isArray(
    client?.discussOnSessionDreams
  )
    ? client.discussOnSessionDreams
    : [];
  const lastMood = client?.lastMoodCheckIn ?? null;
  const avatarSrc = getAvatarUrl(client?.avatarUrl || profile?.avatarUrl, id);

  return (
    <div className="client-profile">
      <PsychologistNavbar />
      <main className="client-profile__main">
        <div className="client-profile__head">
          <div className="client-profile__head-top">
            <Link to="/clients" className="client-profile__btn client-profile__btn--secondary">
              ← Назад к списку
            </Link>
            <h1 className="client-profile__h1">Профиль клиента</h1>
          </div>
          {client && (
            <div className="client-profile__identity">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  key={`avatar-${id}-${client.avatarUrl || profile?.avatarUrl || 'none'}`}
                  alt={client.name || 'Аватар'}
                  className="client-profile__avatar"
                />
              ) : (
                <div className="client-profile__avatar-fallback">
                  {(client.name || '?').trim().charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="client-profile__name">{client.name}</div>
                <div className="client-profile__meta">
                  {client.email && <span>{client.email}</span>}
                  {client.phone && (
                    <span>
                      {client.email ? ' • ' : ''}
                      {client.phone}
                    </span>
                  )}
                </div>
                {clientTags.length > 0 && (
                  <div className="client-profile__tags">
                    {clientTags.map((t, i) => (
                      <span
                        key={`${t.label}-${i}`}
                        className="client-profile__tag"
                        style={
                          t.color
                            ? {
                                background: `color-mix(in srgb, ${t.color} 16%, var(--surface-2))`,
                                borderColor: `color-mix(in srgb, ${t.color} 35%, var(--line))`,
                                color: 'var(--ink)',
                              }
                            : undefined
                        }
                      >
                        {t.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="client-profile__btn client-profile__btn--secondary"
                  onClick={() => openMessenger({ clientName: client.name || null, roomId: null })}
                >
                  Написать
                </button>
                <Link
                  to={`/psychologist/work-area?client=${id}`}
                  className="client-profile__btn"
                >
                  Рабочая область
                </Link>
              </div>
            </div>
          )}
        </div>

        {error && <div className="client-profile__error">{error}</div>}

        {loading ? (
          <div className="client-profile__loading">Загрузка данных...</div>
        ) : client ? (
          <div>
            <div className="client-profile-tabs" role="tablist" aria-label="Разделы профиля">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`client-profile-tabs__btn${activeTab === tab.id ? ' is-active' : ''}`}
                  onClick={() => selectTab(tab.id)}
                >
                  {tab.label}
                  {tab.id === 'tasks' && openTasks.length > 0 ? ` (${openTasks.length})` : ''}
                  {tab.id === 'notes' && notes.length > 0 ? ` (${notes.length})` : ''}
                </button>
              ))}
            </div>

            {activeTab === 'overview' && (
              <div className="client-profile__panel">
                <h2>Обзор</h2>
                <div className="client-profile-overview-grid">
                  <div className="client-profile-stat">
                    <div className="client-profile-stat__label">Контакты</div>
                    <div className="client-profile-stat__value">{client.email || '—'}</div>
                    {client.phone && (
                      <div className="client-profile-stat__muted">{client.phone}</div>
                    )}
                    {(client.city || client.age) && (
                      <div className="client-profile-stat__muted">
                        {[client.city, client.age ? `${client.age} лет` : null].filter(Boolean).join(' • ')}
                      </div>
                    )}
                  </div>
                  <div className="client-profile-stat">
                    <div className="client-profile-stat__label">Следующая сессия</div>
                    <div className="client-profile-stat__value">
                      {nextEventAt ? formatDateTime(nextEventAt) : 'Не запланирована'}
                    </div>
                    <div className="client-profile-stat__muted">
                      Последняя: {lastSession ? formatDateTime(lastSession.date) : '—'}
                    </div>
                  </div>
                  <div className="client-profile-stat">
                    <div className="client-profile-stat__label">Открытые задачи</div>
                    {openTasks.length > 0 ? (
                      <div className="client-profile-stat__value" style={{ fontSize: 28 }}>
                        {openTasks.length}
                      </div>
                    ) : (
                      <div className="client-profile-stat__muted" style={{ fontWeight: 600, color: 'var(--ink-soft)' }}>
                        Нет открытых задач
                      </div>
                    )}
                    <button
                      type="button"
                      className="client-profile__btn client-profile__btn--secondary"
                      style={{ marginTop: 8, padding: '6px 10px', fontSize: 12 }}
                      onClick={() => selectTab('tasks')}
                    >
                      {openTasks.length > 0 ? 'К задачам' : 'Поставить задачу'}
                    </button>
                  </div>
                  <div className="client-profile-stat">
                    <div className="client-profile-stat__label">Активность</div>
                    <div className="client-profile-stat__value">
                      {activity.length ? formatDateTime(activity[0].at) : 'Пока нет событий'}
                    </div>
                    <button
                      type="button"
                      className="client-profile__btn client-profile__btn--secondary"
                      style={{ marginTop: 8, padding: '6px 10px', fontSize: 12 }}
                      onClick={() => selectTab('timeline')}
                    >
                      Открыть таймлайн
                    </button>
                  </div>
                </div>

                <div className="client-profile-block">
                  <div className="client-profile-block__title">Сны к обсуждению</div>
                  {discussDreams.length === 0 ? (
                    <div className="client-profile-stat__muted">Нет снов с отметкой «обсудить на сессии»</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {discussDreams.map((d) => (
                        <div key={d.id} className="client-profile-list-item">
                          <span style={{ fontWeight: 600 }}>{d.title || 'Без названия'}</span>
                          <span className="client-profile-stat__muted">
                            {d.createdAt ? formatDateTime(d.createdAt) : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="client-profile-block">
                  <div className="client-profile-block__title">Последние заметки</div>
                  {notes.length === 0 ? (
                    <div className="client-profile-stat__muted">Пока нет заметок</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {notes.slice(0, 3).map((n) => (
                        <div key={n.id} className="client-profile-list-item client-profile-list-item--stack">
                          <div className="client-profile-stat__muted">{formatDateTime(n.createdAt)}</div>
                          <div style={{ whiteSpace: 'pre-wrap' }}>
                            {n.content.length > 180 ? `${n.content.slice(0, 180)}…` : n.content}
                          </div>
                        </div>
                      ))}
                      {notes.length > 3 && (
                        <button
                          type="button"
                          className="client-profile__btn client-profile__btn--ghost"
                          style={{ alignSelf: 'start' }}
                          onClick={() => selectTab('notes')}
                        >
                          Все заметки →
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="client-profile-block">
                  <div className="client-profile-block__title">Wellness: последний check-in</div>
                  {!lastMood ? (
                    <div className="client-profile-stat__muted">Клиент ещё не отмечал состояние</div>
                  ) : (
                    <div className="client-profile-stat">
                      <div className="client-profile-stat__value">
                        Настроение {lastMood.mood}/5 · Энергия {lastMood.energy}/5 · Тревога{' '}
                        {lastMood.anxiety}/5
                      </div>
                      <div className="client-profile-stat__muted">
                        {formatDateTime(lastMood.createdAt)}
                        {lastMood.note ? ` · ${lastMood.note}` : ''}
                      </div>
                    </div>
                  )}
                </div>

                {openTasks.length > 0 && (
                  <div className="client-profile-block">
                    <div className="client-profile-block__title">Ближайшие задачи</div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {openTasks.slice(0, 3).map((t) => (
                        <div key={t.id} className="client-profile-list-item">
                          <span>{t.title}</span>
                          {t.dueAt && (
                            <span className="client-profile-stat__muted">до {formatDateTime(t.dueAt)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'timeline' && (
              <div className="client-profile__panel">
                <h2>Таймлайн</h2>
                {activity.length === 0 ? (
                  <div className="client-profile-empty">Пока нет событий</div>
                ) : (
                  <div className="client-profile-timeline">
                    {activity.map((item) => (
                      <div key={item.id} className="client-profile-timeline__item">
                        <div className="client-profile-timeline__meta">
                          <span className="client-profile-timeline__type">{activityTypeLabel(item.type)}</span>
                          <span className="client-profile-stat__muted">{formatDateTime(item.at)}</span>
                        </div>
                        <div style={{ fontWeight: 700 }}>{item.title}</div>
                        {item.preview && (
                          <div className="client-profile-stat__muted" style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>
                            {item.preview}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="client-profile__panel">
                <h2>Заметки</h2>
                <form onSubmit={createNote} className="client-profile-form">
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Новая заметка о клиенте…"
                    rows={3}
                    required
                  />
                  <button type="submit" className="client-profile__btn" disabled={savingNote || !noteDraft.trim()}>
                    {savingNote ? 'Сохранение…' : 'Добавить заметку'}
                  </button>
                </form>
                {notes.length === 0 ? (
                  <div className="client-profile-empty">Пока нет заметок</div>
                ) : (
                  <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                    {notes.map((n) => (
                      <div key={n.id} className="client-profile-list-item client-profile-list-item--stack">
                        <div className="client-profile-stat__muted">{formatDateTime(n.createdAt)}</div>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{n.content}</div>
                        <button
                          type="button"
                          className="client-profile__btn client-profile__btn--secondary"
                          style={{ padding: '4px 8px', fontSize: 12, alignSelf: 'start' }}
                          onClick={() => deleteNote(n.id)}
                        >
                          Удалить
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'tasks' && (
              <div className="client-profile__panel">
                <h2>Задания клиенту</h2>
                <p className="client-profile-stat__muted" style={{ marginTop: 0, marginBottom: 14, lineHeight: 1.45 }}>
                  Короткие задания. Клиент увидит их на рабочем столе и во вкладке «Забота» и сможет отметить выполнение.
                </p>
                <form onSubmit={createTask} className="client-profile-form client-profile-form--task">
                  <input
                    type="text"
                    value={taskDraft}
                    onChange={(e) => setTaskDraft(e.target.value)}
                    placeholder="Название задания"
                    required
                    maxLength={200}
                  />
                  <input
                    type="datetime-local"
                    value={taskDue}
                    onChange={(e) => setTaskDue(e.target.value)}
                    aria-label="Срок"
                  />
                  <button type="submit" className="client-profile__btn" disabled={savingTask || !taskDraft.trim()}>
                    {savingTask ? '…' : 'Выдать'}
                  </button>
                </form>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {TASK_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="client-profile__btn client-profile__btn--secondary"
                      style={{ fontSize: 12, padding: '6px 10px' }}
                      onClick={() => setTaskDraft(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 16, fontSize: 13, color: 'var(--ink-muted, var(--text-muted))' }}>
                  <span>Открыто: {openTasks.length}</span>
                  <span>Выполнено: {tasks.filter((t) => t.status === 'done').length}</span>
                </div>
                {tasks.length === 0 ? (
                  <div className="client-profile-empty">Пока нет заданий — добавьте первое выше</div>
                ) : (
                  <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                    {tasks.map((t) => (
                      <div key={t.id} className={`client-profile-task-card${t.status === 'done' ? ' is-done' : ''}`}>
                        <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flex: 1, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={t.status === 'done'}
                            onChange={() => toggleTaskDone(t)}
                            style={{ marginTop: 5 }}
                          />
                          <div>
                            <div className="client-profile-task-card__title">{t.title}</div>
                            {t.dueAt ? (
                              <div className="client-profile-task-card__meta">Срок: {formatDateTime(t.dueAt)}</div>
                            ) : (
                              <div className="client-profile-task-card__meta">
                                Создано: {formatDateTime(t.createdAt)}
                              </div>
                            )}
                          </div>
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                          <span className={`client-profile-task-card__badge${t.status === 'done' ? ' is-done' : ''}`}>
                            {t.status === 'done' ? 'Сделано' : 'Открыто'}
                          </span>
                          <button
                            type="button"
                            className="client-profile__btn client-profile__btn--secondary"
                            style={{ fontSize: 12, padding: '4px 8px' }}
                            onClick={() => void deleteTask(t.id)}
                          >
                            Удалить
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'info' && (
              <div className="client-profile__panel">
                <h2>Основная информация</h2>
                <div style={{ display: 'grid', gap: 16 }}>
                  {profile?.age && (
                    <div>
                      <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>
                        Возраст
                      </div>
                      <div style={{ fontSize: 16 }}>{profile.age} лет</div>
                    </div>
                  )}
                  {profile?.gender && (
                    <div>
                      <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>
                        Пол
                      </div>
                      <div style={{ fontSize: 16 }}>
                        {profile.gender === 'male' ? 'Мужской' : profile.gender === 'female' ? 'Женский' : profile.gender}
                      </div>
                    </div>
                  )}
                  {profileData.archetype && (
                    <div>
                      <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>
                        Архетип
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{profileData.archetype}</div>
                    </div>
                  )}
                  {profileData.diagnosis && (
                    <div>
                      <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>
                        Диагноз
                      </div>
                      <div style={{ fontSize: 16 }}>{profileData.diagnosis}</div>
                    </div>
                  )}
                  {profileData.therapyGoal && (
                    <div>
                      <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>
                        Цель терапии
                      </div>
                      <div style={{ fontSize: 16, whiteSpace: 'pre-wrap' }}>{profileData.therapyGoal}</div>
                    </div>
                  )}
                  {profileData.request && (
                    <div>
                      <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>
                        Запрос
                      </div>
                      <div style={{ fontSize: 16, whiteSpace: 'pre-wrap' }}>{profileData.request}</div>
                    </div>
                  )}
                  {profileData.values && (
                    <div>
                      <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>
                        Ценности / Кредо
                      </div>
                      <div style={{ fontSize: 16, whiteSpace: 'pre-wrap' }}>{profileData.values}</div>
                    </div>
                  )}
                  {profileData.irritants && (
                    <div>
                      <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>
                        Раздражители
                      </div>
                      <div style={{ fontSize: 16, whiteSpace: 'pre-wrap' }}>{profileData.irritants}</div>
                    </div>
                  )}
                  {!profile && (
                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div className="small">Клиент еще не заполнил свой профиль</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="client-profile__panel">
                <h2>Статистика</h2>
                <div className="client-profile-overview-grid">
                  <Link to={`/dreams?client=${id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="client-profile-stat" style={{ textAlign: 'center', cursor: 'pointer' }}>
                      <div style={{ marginBottom: 8, color: 'var(--brand)' }}>
                        <PlatformIcon name="dreams" size={32} strokeWidth={1.4} />
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand)' }}>{stats?.dreams || 0}</div>
                      <div className="client-profile-stat__muted">Снов</div>
                    </div>
                  </Link>
                  <button
                    type="button"
                    className="client-profile-stat"
                    style={{ textAlign: 'center', cursor: 'pointer', width: '100%' }}
                    onClick={() => selectTab('sessions')}
                  >
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand)' }}>{stats?.sessions || 0}</div>
                    <div className="client-profile-stat__muted">Сессий</div>
                  </button>
                  <button
                    type="button"
                    className="client-profile-stat"
                    style={{ textAlign: 'center', cursor: 'pointer', width: '100%' }}
                    onClick={() => selectTab('journal')}
                  >
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand)' }}>{stats?.journalEntries || 0}</div>
                    <div className="client-profile-stat__muted">Записей в дневнике</div>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'sessions' && (
              <div className="client-profile__panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0 }}>Сессии</h2>
                  <Link to={`/psychologist/work-area?client=${id}`} className="client-profile__btn" style={{ padding: '8px 16px', fontSize: 14 }}>
                    Открыть рабочую область
                  </Link>
                </div>
                {sessions.length === 0 ? (
                  <div className="client-profile-empty">Пока нет сессий</div>
                ) : (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {sessions.slice(0, 10).map((session: any) => (
                      <div key={session.id} style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 10 }}>
                        <div style={{ fontWeight: 600 }}>{formatDateTime(session.date)}</div>
                        {session.summary && (
                          <div style={{ fontSize: 14, color: 'var(--text)', whiteSpace: 'pre-wrap', marginTop: 8 }}>
                            {session.summary}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'journal' && (
              <div className="client-profile__panel">
                <h2 style={{ marginTop: 0, marginBottom: 20 }}>Дневник клиента</h2>
                {journalEntries.length === 0 ? (
                  <div className="client-profile-empty">Пока нет записей в дневнике</div>
                ) : (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {journalEntries.slice(0, 10).map((entry: any) => (
                      <div key={entry.id} className="client-profile-list-item client-profile-list-item--stack">
                        <div className="client-profile-stat__muted">
                          {formatDateTime(entry.createdAt)}
                        </div>
                        <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{entry.content}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
