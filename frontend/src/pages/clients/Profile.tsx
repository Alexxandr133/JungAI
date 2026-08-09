import { useEffect, useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Обзор' },
  { id: 'timeline', label: 'Таймлайн' },
  { id: 'notes', label: 'Заметки' },
  { id: 'tasks', label: 'Задачи' },
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
  const { token } = useAuth();
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
  const [activeTab, setActiveTab] = useState<TabId>('overview');

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
      await api('/api/tasks', {
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
      await loadCrmExtras();
    } catch (err: any) {
      setError(err.message || 'Не удалось создать задачу');
    } finally {
      setSavingTask(false);
    }
  }

  async function toggleTaskDone(task: TaskItem) {
    if (!token) return;
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    try {
      await api(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        token,
        body: { status: nextStatus },
      });
      await loadCrmExtras();
    } catch (err: any) {
      setError(err.message || 'Не удалось обновить задачу');
    }
  }

  if (isVerified === false && token) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PsychologistNavbar />
      <main
        style={{
          flex: 1,
          padding: '24px clamp(16px, 5vw, 48px)',
          maxWidth: '100%',
          overflowX: 'hidden',
        }}
      >
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
            <Link to="/clients" className="button secondary" style={{ padding: '8px 16px', fontSize: 14 }}>
              ← Назад к списку
            </Link>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>Профиль клиента</h1>
          </div>
          {client && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
              {getAvatarUrl(client.avatarUrl || profile?.avatarUrl, id) ? (
                <img
                  src={getAvatarUrl(client.avatarUrl || profile?.avatarUrl, id) || ''}
                  key={`avatar-${id}-${client.avatarUrl || profile?.avatarUrl || 'none'}`}
                  alt={client.name || 'Аватар'}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent && !parent.querySelector('.avatar-fallback')) {
                      const fallback = document.createElement('div');
                      fallback.className = 'avatar-fallback';
                      fallback.style.cssText =
                        'width: 64px; height: 64px; border-radius: 999px; background: linear-gradient(135deg, var(--primary), var(--accent)); color: #0b0f1a; display: grid; place-items: center; font-weight: 800; font-size: 24px;';
                      fallback.textContent = (client.name || '?').trim().charAt(0).toUpperCase();
                      parent.appendChild(fallback);
                    }
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 999,
                    background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                    color: '#0b0f1a',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                    fontSize: 24,
                  }}
                >
                  {(client.name || '?').trim().charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{client.name}</div>
                <div className="small" style={{ color: 'var(--text-muted)' }}>
                  {client.email && <span>{client.email}</span>}
                  {client.phone && (
                    <span>
                      {client.email ? ' • ' : ''}
                      {client.phone}
                    </span>
                  )}
                </div>
              </div>
              <Link
                to={`/psychologist/work-area?client=${id}`}
                className="button"
                style={{ marginLeft: 'auto', padding: '8px 14px', fontSize: 13 }}
              >
                Рабочая область
              </Link>
            </div>
          )}
        </div>

        {error && (
          <div style={{ marginBottom: 16, padding: 12, background: 'var(--surface-2)', borderRadius: 10, color: '#ff7b7b' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <div className="small" style={{ opacity: 0.7 }}>
              Загрузка данных...
            </div>
          </div>
        ) : client ? (
          <div>
            <div className="client-profile-tabs">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={activeTab === tab.id ? 'button' : 'button secondary'}
                  onClick={() => setActiveTab(tab.id)}
                  style={{ padding: '8px 14px', fontSize: 13 }}
                >
                  {tab.label}
                  {tab.id === 'tasks' && openTasks.length > 0 ? ` (${openTasks.length})` : ''}
                  {tab.id === 'notes' && notes.length > 0 ? ` (${notes.length})` : ''}
                </button>
              ))}
            </div>

            {activeTab === 'overview' && (
              <div className="card" style={{ padding: 24 }}>
                <h2 style={{ marginTop: 0, marginBottom: 20 }}>Обзор</h2>
                <div className="client-profile-overview-grid">
                  <div className="client-profile-stat">
                    <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 6 }}>
                      Контакты
                    </div>
                    <div>{client.email || '—'}</div>
                    <div className="small" style={{ marginTop: 4 }}>
                      {client.phone || 'Телефон не указан'}
                    </div>
                    {(client.city || client.age) && (
                      <div className="small" style={{ marginTop: 4, color: 'var(--text-muted)' }}>
                        {[client.city, client.age ? `${client.age} лет` : null].filter(Boolean).join(' • ')}
                      </div>
                    )}
                  </div>
                  <div className="client-profile-stat">
                    <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 6 }}>
                      Следующая сессия
                    </div>
                    <div style={{ fontWeight: 700 }}>
                      {nextEventAt ? formatDateTime(nextEventAt) : 'Не запланирована'}
                    </div>
                    <div className="small" style={{ marginTop: 4, color: 'var(--text-muted)' }}>
                      Последняя: {lastSession ? formatDateTime(lastSession.date) : '—'}
                    </div>
                  </div>
                  <div className="client-profile-stat">
                    <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 6 }}>
                      Открытые задачи
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800 }}>{openTasks.length}</div>
                    <button
                      type="button"
                      className="button secondary"
                      style={{ marginTop: 8, padding: '6px 10px', fontSize: 12 }}
                      onClick={() => setActiveTab('tasks')}
                    >
                      К задачам
                    </button>
                  </div>
                  <div className="client-profile-stat">
                    <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 6 }}>
                      Активность
                    </div>
                    <div style={{ fontWeight: 700 }}>{activity.length ? formatDateTime(activity[0].at) : 'Пока нет событий'}</div>
                    <button
                      type="button"
                      className="button secondary"
                      style={{ marginTop: 8, padding: '6px 10px', fontSize: 12 }}
                      onClick={() => setActiveTab('timeline')}
                    >
                      Открыть таймлайн
                    </button>
                  </div>
                </div>
                {openTasks.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
                      Ближайшие задачи
                    </div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {openTasks.slice(0, 3).map((t) => (
                        <div key={t.id} className="client-profile-list-item">
                          <span>{t.title}</span>
                          {t.dueAt && (
                            <span className="small" style={{ color: 'var(--text-muted)' }}>
                              до {formatDateTime(t.dueAt)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'timeline' && (
              <div className="card" style={{ padding: 24 }}>
                <h2 style={{ marginTop: 0, marginBottom: 20 }}>Таймлайн</h2>
                {activity.length === 0 ? (
                  <div className="client-profile-empty">Пока нет событий</div>
                ) : (
                  <div className="client-profile-timeline">
                    {activity.map((item) => (
                      <div key={item.id} className="client-profile-timeline__item">
                        <div className="client-profile-timeline__meta">
                          <span className="client-profile-timeline__type">{activityTypeLabel(item.type)}</span>
                          <span className="small" style={{ color: 'var(--text-muted)' }}>
                            {formatDateTime(item.at)}
                          </span>
                        </div>
                        <div style={{ fontWeight: 700 }}>{item.title}</div>
                        {item.preview && (
                          <div className="small" style={{ marginTop: 6, whiteSpace: 'pre-wrap', color: 'var(--text-muted)' }}>
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
              <div className="card" style={{ padding: 24 }}>
                <h2 style={{ marginTop: 0, marginBottom: 16 }}>Заметки</h2>
                <form onSubmit={createNote} className="client-profile-form">
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Новая заметка о клиенте…"
                    rows={3}
                    required
                  />
                  <button type="submit" className="button" disabled={savingNote || !noteDraft.trim()}>
                    {savingNote ? 'Сохранение…' : 'Добавить заметку'}
                  </button>
                </form>
                {notes.length === 0 ? (
                  <div className="client-profile-empty">Пока нет заметок</div>
                ) : (
                  <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                    {notes.map((n) => (
                      <div key={n.id} className="client-profile-list-item client-profile-list-item--stack">
                        <div className="small" style={{ color: 'var(--text-muted)' }}>
                          {formatDateTime(n.createdAt)}
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{n.content}</div>
                        <button
                          type="button"
                          className="button secondary"
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
              <div className="card" style={{ padding: 24 }}>
                <h2 style={{ marginTop: 0, marginBottom: 16 }}>Задачи</h2>
                <form onSubmit={createTask} className="client-profile-form">
                  <input
                    value={taskDraft}
                    onChange={(e) => setTaskDraft(e.target.value)}
                    placeholder="Название задачи"
                    required
                  />
                  <input
                    type="datetime-local"
                    value={taskDue}
                    onChange={(e) => setTaskDue(e.target.value)}
                  />
                  <button type="submit" className="button" disabled={savingTask || !taskDraft.trim()}>
                    {savingTask ? 'Создание…' : 'Создать задачу'}
                  </button>
                </form>
                {tasks.length === 0 ? (
                  <div className="client-profile-empty">Пока нет задач</div>
                ) : (
                  <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                    {tasks.map((t) => (
                      <div key={t.id} className="client-profile-list-item">
                        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flex: 1, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={t.status === 'done'}
                            onChange={() => toggleTaskDone(t)}
                            style={{ marginTop: 4 }}
                          />
                          <div>
                            <div style={{ fontWeight: 600, textDecoration: t.status === 'done' ? 'line-through' : 'none', opacity: t.status === 'done' ? 0.65 : 1 }}>
                              {t.title}
                            </div>
                            {t.dueAt && (
                              <div className="small" style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                                Срок: {formatDateTime(t.dueAt)}
                              </div>
                            )}
                          </div>
                        </label>
                        <span className="small" style={{ color: 'var(--text-muted)' }}>
                          {t.status === 'done' ? 'Готово' : 'Открыта'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'info' && (
              <div className="card" style={{ padding: 24 }}>
                <h2 style={{ marginTop: 0, marginBottom: 20 }}>Основная информация</h2>
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
              <div className="card" style={{ padding: 24 }}>
                <h2 style={{ marginTop: 0, marginBottom: 20 }}>Статистика</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                  <Link to={`/dreams?client=${id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="card" style={{ padding: 20, textAlign: 'center', cursor: 'pointer' }}>
                      <div style={{ marginBottom: 8, color: 'var(--primary)' }}>
                        <PlatformIcon name="dreams" size={32} strokeWidth={1.4} />
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)' }}>{stats?.dreams || 0}</div>
                      <div className="small" style={{ color: 'var(--text-muted)' }}>
                        Снов
                      </div>
                    </div>
                  </Link>
                  <button type="button" className="card" style={{ padding: 20, textAlign: 'center', cursor: 'pointer', border: 'none' }} onClick={() => setActiveTab('sessions')}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)' }}>{stats?.sessions || 0}</div>
                    <div className="small" style={{ color: 'var(--text-muted)' }}>
                      Сессий
                    </div>
                  </button>
                  <button type="button" className="card" style={{ padding: 20, textAlign: 'center', cursor: 'pointer', border: 'none' }} onClick={() => setActiveTab('journal')}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)' }}>{stats?.journalEntries || 0}</div>
                    <div className="small" style={{ color: 'var(--text-muted)' }}>
                      Записей в дневнике
                    </div>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'sessions' && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h2 style={{ marginTop: 0 }}>Сессии</h2>
                  <Link to={`/psychologist/work-area?client=${id}`} className="button" style={{ padding: '8px 16px', fontSize: 14 }}>
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
              <div className="card" style={{ padding: 24 }}>
                <h2 style={{ marginTop: 0, marginBottom: 20 }}>Дневник клиента</h2>
                {journalEntries.length === 0 ? (
                  <div className="client-profile-empty">Пока нет записей в дневнике</div>
                ) : (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {journalEntries.slice(0, 10).map((entry: any) => (
                      <div key={entry.id} style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 10 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                          {formatDateTime(entry.createdAt)}
                        </div>
                        <div style={{ fontSize: 14, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{entry.content}</div>
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
