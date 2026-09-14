import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';
import { VerificationRequired } from '../../components/VerificationRequired';
import { checkVerification } from '../../utils/verification';
import type { VerificationStatus } from '../../utils/verification';
import type { WidgetInstance, WidgetType } from '../../components/widgets/WidgetTypes';
import {
  WIDGET_DEFINITIONS,
  WIDGET_LAYOUT_VERSION,
  WIDGET_LAYOUT_VERSION_KEY,
  WIDGET_STORAGE_KEY,
} from '../../components/widgets/WidgetTypes';
import WidgetRenderer from '../../components/widgets/WidgetRenderer';
import AddWidgetButton from '../../components/widgets/AddWidgetButton';
import WidgetSelectorModal from '../../components/widgets/WidgetSelectorModal';
import { PlatformIcon } from '../../components/icons';
import { usePsychologistPlatformTour } from '../../hooks/usePsychologistPlatformTour';
import { PSYCHOLOGIST_DASHBOARD_TOUR_STEPS } from '../../lib/psychologistPlatformTourSteps';
import { PsychologistTourHelpButton } from '../../components/PsychologistTourHelpButton';
import './Dashboard.css';

type NextSession = {
  id: string;
  title: string;
  startsAt: string;
  clientId?: string | null;
  clientName?: string | null;
  type?: string;
  sessionStatus?: string | null;
  roomUrl?: string | null;
  roomId?: string | null;
};

type DashboardData = {
  totalClients: number;
  activeClients: number;
  activeSessions: number;
  newDreams: number;
  newJournalEntries: number;
  nextSession: NextSession | null;
  pendingBookingRequests: number;
  discussOnSessionDreams: number;
  publicationDrafts: number;
  openClientTasks?: {
    count: number;
    items: Array<{
      id: string;
      title: string;
      clientId: string;
      clientName: string;
      dueAt?: string | null;
      status?: string;
    }>;
  };
  topClients: Array<{
    id: string;
    name: string;
    email: string;
    dreamsCount: number;
    sessionsCount: number;
    totalActivity: number;
  }>;
  topSymbols: Array<{ symbol: string; count: number }>;
  requiresAttention: {
    clientsWithoutSessions: Array<{ id: string; name: string }>;
    dreamsWithoutAnalysis: Array<{ id: string; title: string; clientId: string }>;
  };
};

function formatLongDate(d: Date) {
  return d.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function formatSessionWhen(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function canJoinSession(session: NextSession) {
  if (!session.roomUrl && !session.roomId) return false;
  const start = new Date(session.startsAt).getTime();
  const now = Date.now();
  const thirtyMin = 30 * 60 * 1000;
  const twoHours = 2 * 60 * 60 * 1000;
  return now >= start - thirtyMin && now <= start + twoHours;
}

function roomPath(session: NextSession) {
  if (session.roomId) return `/room/${session.roomId}`;
  if (session.roomUrl) {
    const m = String(session.roomUrl).match(/\/room\/([^/?#]+)/);
    if (m?.[1]) return `/room/${m[1]}`;
  }
  return '/events';
}

function pluralRequests(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} заявка на запись`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} заявки на запись`;
  return `${n} заявок на запись`;
}

export default function PsychologistDashboard() {
  const { token, user, profile } = useAuth();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const [widgets, setWidgets] = useState<WidgetInstance[]>([]);
  const [showWidgetSelector, setShowWidgetSelector] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<number | null>(null);
  const [showNotebook, setShowNotebook] = useState(false);
  const [notes, setNotes] = useState<Array<{ id: string; text: string }>>([]);
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [dragOverNoteId, setDragOverNoteId] = useState<string | null>(null);
  const [isSmallMobile, setIsSmallMobile] = useState(false);
  const NOTEBOOK_STORAGE_KEY = 'psychologist_dashboard_notebook_notes';
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  const displayName = profile?.name || user?.name || 'коллега';
  const activeGreeting = `${greeting}, ${displayName}`;
  const sortedWidgets = useMemo(() => [...widgets].sort((a, b) => a.position - b.position), [widgets]);
  const pinnedWidgets = useMemo(() => sortedWidgets.slice(0, 3), [sortedWidgets]);
  const overflowWidgets = useMemo(() => sortedWidgets.slice(3), [sortedWidgets]);
  const pinnedPlaceholders = useMemo(
    () => Array.from({ length: Math.max(0, 3 - pinnedWidgets.length) }),
    [pinnedWidgets.length]
  );
  const mobileWidgets = useMemo(() => {
    if (!isSmallMobile) return [];
    if (sortedWidgets.length === 0) return [];
    const [first, ...rest] = sortedWidgets;
    return [first, ...rest];
  }, [isSmallMobile, sortedWidgets]);

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
    try {
      const saved = localStorage.getItem(WIDGET_STORAGE_KEY);
      const layoutVersion = Number(localStorage.getItem(WIDGET_LAYOUT_VERSION_KEY) || '0');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const next =
            layoutVersion < WIDGET_LAYOUT_VERSION
              ? placeOpenClientTasksThird(parsed as WidgetInstance[])
              : (parsed as WidgetInstance[]);
          setWidgets(next);
          if (layoutVersion < WIDGET_LAYOUT_VERSION) {
            saveWidgets(next);
            localStorage.setItem(WIDGET_LAYOUT_VERSION_KEY, String(WIDGET_LAYOUT_VERSION));
          }
        } else {
          setDefaultWidgets();
        }
      } else {
        setDefaultWidgets();
      }
    } catch (e) {
      console.error('Failed to load widgets:', e);
      setDefaultWidgets();
    }
  }, []);

  useEffect(() => {
    const updateViewport = () => setIsSmallMobile(window.innerWidth <= 640);
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    try {
      localStorage.removeItem('psychologist_dashboard_notes');
      const savedNotes = localStorage.getItem(NOTEBOOK_STORAGE_KEY);
      if (!savedNotes) return;
      const parsed = JSON.parse(savedNotes);
      if (Array.isArray(parsed)) {
        setNotes(parsed);
      }
    } catch (e) {
      console.error('Failed to load notes:', e);
    }
  }, []);

  function placeOpenClientTasksThird(list: WidgetInstance[]): WidgetInstance[] {
    const without = list.filter((w) => w.type !== 'openClientTasks');
    const existing = list.find((w) => w.type === 'openClientTasks');
    const taskWidget: WidgetInstance = existing
      ? { ...existing, position: 2 }
      : {
          id: `openClientTasks-${Date.now()}`,
          type: 'openClientTasks',
          position: 2,
          size: WIDGET_DEFINITIONS.openClientTasks.defaultSize,
        };
    return [...without.slice(0, 2), taskWidget, ...without.slice(2)].map((w, idx) => ({
      ...w,
      position: idx,
    }));
  }

  function setDefaultWidgets() {
    const defaultWidgets: WidgetInstance[] = [
      { id: '1', type: 'totalClients', position: 0, size: 'small' },
      { id: '2', type: 'activeSessions', position: 1, size: 'small' },
      {
        id: '3',
        type: 'openClientTasks',
        position: 2,
        size: WIDGET_DEFINITIONS.openClientTasks.defaultSize,
      },
      { id: '4', type: 'newDreams', position: 3, size: 'small' },
      { id: '5', type: 'newJournalEntries', position: 4, size: 'small' },
    ];
    setWidgets(defaultWidgets);
    saveWidgets(defaultWidgets);
    try {
      localStorage.setItem(WIDGET_LAYOUT_VERSION_KEY, String(WIDGET_LAYOUT_VERSION));
    } catch {
      /* ignore */
    }
  }

  function saveWidgets(widgetsToSave: WidgetInstance[]) {
    try {
      localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(widgetsToSave));
    } catch (e) {
      console.error('Failed to save widgets:', e);
    }
  }

  function saveNotes(notesToSave: Array<{ id: string; text: string }>) {
    try {
      localStorage.setItem(NOTEBOOK_STORAGE_KEY, JSON.stringify(notesToSave));
    } catch (e) {
      console.error('Failed to save notes:', e);
    }
  }

  useEffect(() => {
    if (isVerified !== false) {
      loadDashboard();
    }
  }, [token, isVerified]);

  async function loadDashboard(opts?: { silent?: boolean }) {
    if (!token) {
      setLoading(false);
      return;
    }
    if (!opts?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await api<DashboardData>('/api/analytics/dashboard', { token });
      setDashboardData(res);
    } catch (e: any) {
      if (e.message?.includes('Verification required')) {
        const result = await checkVerification(token);
        setIsVerified(result.isVerified);
        setVerificationStatus(result.status);
      } else if (!opts?.silent) {
        setError(e.message || 'Не удалось загрузить данные дашборда');
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }

  function handleAddWidget(type: WidgetType) {
    const widgetDef = WIDGET_DEFINITIONS[type];
    const newWidget: WidgetInstance = {
      id: `${type}-${Date.now()}`,
      type,
      position: widgets.length,
      size: widgetDef.defaultSize,
    };
    const updated = [...widgets, newWidget];
    setWidgets(updated);
    saveWidgets(updated);
  }

  function handleRemoveWidget(id: string) {
    const updated = widgets
      .filter((w) => w.id !== id)
      .map((w, idx) => ({
        ...w,
        position: idx,
      }));
    setWidgets(updated);
    saveWidgets(updated);
  }

  function handleResizeWidget(id: string, size: 'small' | 'medium' | 'large') {
    const updated = widgets.map((w) => (w.id === id ? { ...w, size } : w));
    setWidgets(updated);
    saveWidgets(updated);
  }

  function handleDragStart(widgetId: string) {
    setDraggedWidget(widgetId);
  }

  function handleDragOver(e: React.DragEvent, position: number) {
    e.preventDefault();
    e.stopPropagation();
    if (draggedWidget) {
      setDragOverPosition(position);
    }
  }

  function handleDragLeave() {
    setDragOverPosition(null);
  }

  function handleDrop(e: React.DragEvent, targetPosition: number) {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedWidget) return;

    const dragged = widgets.find((w) => w.id === draggedWidget);
    if (!dragged) return;

    const otherWidgets = widgets.filter((w) => w.id !== draggedWidget);
    const newWidgets = [...otherWidgets];
    newWidgets.splice(targetPosition, 0, { ...dragged, position: targetPosition });

    const updated = newWidgets.map((w, idx) => ({ ...w, position: idx }));
    setWidgets(updated);
    saveWidgets(updated);

    setDraggedWidget(null);
    setDragOverPosition(null);
  }

  function handleDragEnd() {
    setDraggedWidget(null);
    setDragOverPosition(null);
  }

  function handleAddNote() {
    const next = [...notes, { id: `note-${Date.now()}`, text: '' }];
    setNotes(next);
    saveNotes(next);
  }

  function handleUpdateNote(id: string, text: string) {
    const next = notes.map((note) => (note.id === id ? { ...note, text } : note));
    setNotes(next);
    saveNotes(next);
  }

  function handleDeleteNote(id: string) {
    const next = notes.filter((note) => note.id !== id);
    setNotes(next);
    saveNotes(next);
  }

  function handleNoteDragStart(noteId: string) {
    setDraggedNoteId(noteId);
  }

  function handleNoteDragOver(e: React.DragEvent, noteId: string) {
    e.preventDefault();
    if (draggedNoteId && draggedNoteId !== noteId) {
      setDragOverNoteId(noteId);
    }
  }

  function handleNoteDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!draggedNoteId || draggedNoteId === targetId) return;
    const draggedIndex = notes.findIndex((note) => note.id === draggedNoteId);
    const targetIndex = notes.findIndex((note) => note.id === targetId);
    if (draggedIndex < 0 || targetIndex < 0) return;
    const reordered = [...notes];
    const [draggedNote] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, draggedNote);
    setNotes(reordered);
    saveNotes(reordered);
    setDraggedNoteId(null);
    setDragOverNoteId(null);
  }

  function handleNoteDragEnd() {
    setDraggedNoteId(null);
    setDragOverNoteId(null);
  }

  function autoResizeTextarea(target: HTMLTextAreaElement) {
    target.style.height = '0px';
    target.style.height = `${target.scrollHeight}px`;
  }

  function handleWidgetClick(widgetType: string) {
    switch (widgetType) {
      case 'totalClients':
      case 'newJournalEntries':
      case 'topClients':
      case 'requiresAttention':
      case 'attentionClients':
        navigate('/clients');
        break;
      case 'activeSessions':
      case 'sessionsCalendar':
        navigate('/events');
        break;
      case 'newDreams':
      case 'dreamsStats':
      case 'topSymbols':
      case 'unanalyzedDreams':
        navigate('/dreams');
        break;
      default:
        break;
    }
  }

  function handleNextSessionAction(session: NextSession) {
    if (canJoinSession(session)) {
      navigate(roomPath(session));
      return;
    }
    navigate('/events');
  }

  usePsychologistPlatformTour({
    tourId: 'dashboard',
    userId: user?.id,
    role: user?.role,
    enabled: Boolean(
      token && user?.role === 'psychologist' && isVerified === true && !!dashboardData && !loading
    ),
    steps: PSYCHOLOGIST_DASHBOARD_TOUR_STEPS,
  });

  if (isVerified === false && token) {
    return (
      <div className="psy-desk">
        <PsychologistNavbar />
        <VerificationRequired verificationStatus={verificationStatus} />
      </div>
    );
  }

  const nextSession = dashboardData?.nextSession ?? null;
  const pendingBookings = dashboardData?.pendingBookingRequests ?? 0;

  return (
    <div className="psy-desk">
      <PsychologistNavbar />
      <main className="psy-desk__main">
        <div className="psy-desk__header">
          <h1 className="psy-desk__h1">
            <span className="psy-desk__h1-icon">
              <PlatformIcon name="dashboard" size={28} strokeWidth={1.5} />
            </span>
            Рабочий стол
          </h1>
          <PsychologistTourHelpButton
            tourId="dashboard"
            steps={PSYCHOLOGIST_DASHBOARD_TOUR_STEPS}
            userId={user?.id}
            role={user?.role}
          />
        </div>

        {error && <div className="psy-desk__error">{error}</div>}

        {loading ? (
          <div className="psy-desk__loading">Загрузка данных...</div>
        ) : dashboardData ? (
          <div>
            <div data-tour="dash-hero" className="psy-desk__welcome">
              <div className="psy-desk__welcome-top">
                <div>
                  <div className="psy-desk__date">{formatLongDate(now)}</div>
                  <h2 className="psy-desk__greeting">{activeGreeting}</h2>
                </div>
                <div className="psy-desk__welcome-actions">
                  <button
                    type="button"
                    onClick={() => setShowNotebook((prev) => !prev)}
                    title="Быстрые заметки"
                    aria-label="Быстрые заметки"
                    data-tooltip="Быстрые заметки"
                    className={`psy-desk__note-btn${showNotebook ? ' psy-desk__note-btn--open' : ''}`}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="psy-desk__btn psy-desk__btn--primary"
                    onClick={() => navigate('/events')}
                  >
                    Звонки
                  </button>
                </div>
              </div>

              <div className="psy-desk__session">
                {nextSession ? (
                  <>
                    <div>
                      <div className="psy-desk__session-label">Ближайшая сессия</div>
                      <div className="psy-desk__session-title">
                        {nextSession.clientName || nextSession.title}
                      </div>
                      <div className="psy-desk__session-meta">
                        {formatSessionWhen(nextSession.startsAt)}
                        {nextSession.clientName && nextSession.title !== nextSession.clientName
                          ? ` · ${nextSession.title}`
                          : ''}
                      </div>
                    </div>
                    <div className="psy-desk__session-side">
                      {pendingBookings > 0 && (
                        <Link to="/events#requests" className="psy-desk__chip psy-desk__chip--accent">
                          {pluralRequests(pendingBookings)}
                        </Link>
                      )}
                      <button
                        type="button"
                        className="psy-desk__btn psy-desk__btn--primary"
                        onClick={() => handleNextSessionAction(nextSession)}
                      >
                        {canJoinSession(nextSession) ? 'Подключиться' : 'Открыть'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="psy-desk__session-label">Ближайшая сессия</div>
                      <div className="psy-desk__session-title">Пока ничего не запланировано</div>
                      <div className="psy-desk__session-meta">
                        Назначьте встречу — она появится здесь
                      </div>
                    </div>
                    <div className="psy-desk__session-side">
                      {pendingBookings > 0 && (
                        <Link to="/events#requests" className="psy-desk__chip psy-desk__chip--accent">
                          {pluralRequests(pendingBookings)}
                        </Link>
                      )}
                      <button
                        type="button"
                        className="psy-desk__btn psy-desk__btn--primary"
                        onClick={() => navigate('/events')}
                      >
                        Запланировать встречу
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {showNotebook && (
              <div className="psy-desk__card psy-desk__notebook">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 10,
                  }}
                >
                  <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, lineHeight: 1 }}>✎</span>
                    Быстрые заметки
                  </div>
                  <button
                    type="button"
                    onClick={handleAddNote}
                    className="psy-desk__btn psy-desk__btn--ghost"
                    style={{ width: 34, height: 34, borderRadius: '50%', padding: 0 }}
                    title="Добавить заметку"
                  >
                    <PlatformIcon name="plus" size={16} />
                  </button>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gap: 4,
                    maxHeight: 380,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    paddingRight: 2,
                  }}
                >
                  {notes.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                      Нажмите на плюс, чтобы добавить заметку. Текст сохраняется автоматически.
                    </div>
                  ) : (
                    notes.map((note) => (
                      <div
                        key={note.id}
                        draggable
                        onDragStart={() => handleNoteDragStart(note.id)}
                        onDragOver={(e) => handleNoteDragOver(e, note.id)}
                        onDrop={(e) => handleNoteDrop(e, note.id)}
                        onDragEnd={handleNoteDragEnd}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '24px 1fr 28px',
                          gap: 6,
                          alignItems: 'start',
                          padding: '2px 2px',
                          borderRadius: 8,
                          border:
                            dragOverNoteId === note.id
                              ? '1px dashed var(--brand)'
                              : '1px dashed transparent',
                          background:
                            draggedNoteId === note.id ? 'var(--brand-soft)' : 'transparent',
                        }}
                      >
                        <div
                          style={{
                            color: 'var(--ink-soft)',
                            cursor: 'grab',
                            textAlign: 'center',
                            alignSelf: 'start',
                            marginTop: 2,
                            lineHeight: 1.3,
                          }}
                        >
                          ⋮⋮
                        </div>
                        <textarea
                          value={note.text}
                          onChange={(e) => {
                            handleUpdateNote(note.id, e.target.value);
                            autoResizeTextarea(e.currentTarget);
                          }}
                          onInput={(e) => autoResizeTextarea(e.currentTarget)}
                          placeholder="Текст заметки..."
                          rows={1}
                          style={{
                            width: '100%',
                            minWidth: 0,
                            boxSizing: 'border-box',
                            resize: 'none',
                            overflow: 'hidden',
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            color: 'var(--ink)',
                            lineHeight: '24px',
                            borderBottom: '1px solid var(--line)',
                            padding: '0 2px',
                            fontSize: 14,
                            fontFamily: 'inherit',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(note.id)}
                          title="Удалить заметку"
                          style={{
                            width: 28,
                            height: 28,
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--danger)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            marginTop: 0,
                          }}
                        >
                          <span style={{ fontSize: 20, lineHeight: 1, fontWeight: 700 }}>×</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div data-tour="dash-quick" className="psy-desk__quick">
              <button type="button" className="psy-desk__quick-btn" onClick={() => navigate('/events')}>
                <PlatformIcon name="calendar" size={16} /> Запланировать встречу
              </button>
              <button type="button" className="psy-desk__quick-btn" onClick={() => navigate('/clients')}>
                <PlatformIcon name="users" size={16} /> Открыть клиентов
              </button>
              <button
                type="button"
                className="psy-desk__quick-btn"
                onClick={() => navigate('/psychologist/work-area')}
              >
                <PlatformIcon name="book" size={16} /> Перейти в рабочую зону
              </button>
              <button
                type="button"
                className="psy-desk__quick-btn"
                onClick={() => navigate('/psychologist/ai')}
              >
                <PlatformIcon name="sparkles" size={16} /> AI-ассистент психолога
              </button>
              <button
                type="button"
                className="psy-desk__quick-btn"
                onClick={() => navigate('/psychologist/ai?screen=transcription')}
              >
                <PlatformIcon name="mic" size={16} /> Транскрибация сессии
              </button>
            </div>

            <div data-tour="dash-cards" className="psy-desk__nav">
              {(
                [
                  {
                    to: '/events',
                    icon: 'calendar' as const,
                    title: 'События',
                    note: 'Сессии, история и приглашения',
                    live: nextSession
                      ? `Ближайшая: ${formatSessionWhen(nextSession.startsAt)}`
                      : 'Нет ближайшей сессии',
                    hasData: Boolean(nextSession),
                  },
                  {
                    to: '/clients',
                    icon: 'users' as const,
                    title: 'Клиенты',
                    note: 'Карточки клиентов и прогресс',
                    live:
                      dashboardData.activeClients > 0
                        ? `Активных: ${dashboardData.activeClients}`
                        : 'Пока нет активных клиентов',
                    hasData: dashboardData.activeClients > 0,
                  },
                  {
                    to: '/dreams',
                    icon: 'moon' as const,
                    title: 'Сны',
                    note: 'Новые записи и анализ',
                    live:
                      dashboardData.discussOnSessionDreams > 0
                        ? `К сессии: ${dashboardData.discussOnSessionDreams}`
                        : 'Нет снов к обсуждению на сессии',
                    hasData: dashboardData.discussOnSessionDreams > 0,
                  },
                  {
                    to: '/communities',
                    icon: 'message' as const,
                    title: 'Сообщества',
                    note: 'Лента постов и сообщества',
                    live:
                      dashboardData.publicationDrafts > 0
                        ? `Черновиков: ${dashboardData.publicationDrafts}`
                        : 'Нет черновиков',
                    hasData: dashboardData.publicationDrafts > 0,
                  },
                ] as const
              ).map((item) => (
                <div key={item.to} className="psy-desk__nav-card">
                  <button
                    type="button"
                    className="psy-desk__nav-main"
                    onClick={() => navigate(item.to)}
                  >
                    <div className="psy-desk__nav-title">
                      <PlatformIcon name={item.icon} size={16} />
                      {item.title}
                    </div>
                    <div className="psy-desk__nav-note">{item.note}</div>
                  </button>
                  {item.hasData ? (
                    <button
                      type="button"
                      className="psy-desk__nav-live psy-desk__nav-live--active"
                      onClick={() => navigate(item.to)}
                    >
                      {item.live}
                    </button>
                  ) : (
                    <div className="psy-desk__nav-live psy-desk__nav-live--empty">
                      {item.live}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div data-tour="dash-widgets">
              <div className="psy-desk__widgets-head">
                <div className="psy-desk__widgets-title">Виджеты рабочего стола</div>
                <div className="psy-desk__widgets-hint">Можно добавлять, удалять и перетаскивать</div>
              </div>
              <div
                className="psy-desk__widgets-grid"
                style={{
                  gridTemplateColumns: isSmallMobile
                    ? 'repeat(2, minmax(0, 1fr))'
                    : 'repeat(4, minmax(0, 1fr))',
                }}
              >
                {isSmallMobile ? (
                  <>
                    {mobileWidgets.slice(0, 1).map((widget, index) => (
                      <WidgetRenderer
                        key={widget.id}
                        widget={widget}
                        data={dashboardData}
                        onRemove={handleRemoveWidget}
                        onResize={handleResizeWidget}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onDragEnd={handleDragEnd}
                        isDragged={draggedWidget === widget.id}
                        isDragOver={dragOverPosition === index}
                        position={index}
                        onClick={handleWidgetClick}
                        onRefresh={() => void loadDashboard({ silent: true })}
                      />
                    ))}
                    <AddWidgetButton onClick={() => setShowWidgetSelector(true)} />
                    {mobileWidgets.slice(1).map((widget, index) => (
                      <WidgetRenderer
                        key={widget.id}
                        widget={widget}
                        data={dashboardData}
                        onRemove={handleRemoveWidget}
                        onResize={handleResizeWidget}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onDragEnd={handleDragEnd}
                        isDragged={draggedWidget === widget.id}
                        isDragOver={dragOverPosition === index + 1}
                        position={index + 1}
                        onClick={handleWidgetClick}
                        onRefresh={() => void loadDashboard({ silent: true })}
                      />
                    ))}
                  </>
                ) : (
                  <>
                    {pinnedWidgets.map((widget, index) => (
                      <WidgetRenderer
                        key={widget.id}
                        widget={widget}
                        data={dashboardData}
                        onRemove={handleRemoveWidget}
                        onResize={handleResizeWidget}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onDragEnd={handleDragEnd}
                        isDragged={draggedWidget === widget.id}
                        isDragOver={dragOverPosition === index}
                        position={index}
                        onClick={handleWidgetClick}
                        onRefresh={() => void loadDashboard({ silent: true })}
                      />
                    ))}
                    {pinnedPlaceholders.map((_, idx) => (
                      <div key={`widget-placeholder-${idx}`} aria-hidden />
                    ))}
                    <AddWidgetButton onClick={() => setShowWidgetSelector(true)} />
                    {overflowWidgets.map((widget, index) => (
                      <WidgetRenderer
                        key={widget.id}
                        widget={widget}
                        data={dashboardData}
                        onRemove={handleRemoveWidget}
                        onResize={handleResizeWidget}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onDragEnd={handleDragEnd}
                        isDragged={draggedWidget === widget.id}
                        isDragOver={dragOverPosition === index + 3}
                        position={index + 3}
                        onClick={handleWidgetClick}
                        onRefresh={() => void loadDashboard({ silent: true })}
                      />
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {showWidgetSelector && (
          <WidgetSelectorModal
            onClose={() => setShowWidgetSelector(false)}
            onAdd={handleAddWidget}
            existingWidgets={widgets.map((w) => w.type)}
          />
        )}
      </main>
    </div>
  );
}
