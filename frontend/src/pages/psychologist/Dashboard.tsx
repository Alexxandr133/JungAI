import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';
import { VerificationRequired } from '../../components/VerificationRequired';
import { checkVerification } from '../../utils/verification';
import type { VerificationStatus } from '../../utils/verification';
import type { WidgetInstance, WidgetType } from '../../components/widgets/WidgetTypes';
import { WIDGET_DEFINITIONS, WIDGET_STORAGE_KEY } from '../../components/widgets/WidgetTypes';
import WidgetRenderer from '../../components/widgets/WidgetRenderer';
import AddWidgetButton from '../../components/widgets/AddWidgetButton';
import WidgetSelectorModal from '../../components/widgets/WidgetSelectorModal';
import { PlatformIcon } from '../../components/icons';
import { usePsychologistPlatformTour } from '../../hooks/usePsychologistPlatformTour';
import { PSYCHOLOGIST_DASHBOARD_TOUR_STEPS } from '../../lib/psychologistPlatformTourSteps';
import { PsychologistTourHelpButton } from '../../components/PsychologistTourHelpButton';

type DashboardData = {
  totalClients: number;
  activeSessions: number;
  newDreams: number;
  newJournalEntries: number;
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

  // Check verification status
  useEffect(() => {
    if (!token) {
      setIsVerified(null);
      return;
    }
    
    checkVerification(token).then(result => {
      setIsVerified(result.isVerified);
      setVerificationStatus(result.status);
    });
  }, [token]);

  // Load saved widgets from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(WIDGET_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setWidgets(parsed);
        } else {
          // Default widgets for first time
          setDefaultWidgets();
        }
      } else {
        // Default widgets for first time
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

  function setDefaultWidgets() {
    const defaultWidgets: WidgetInstance[] = [
      {
        id: '1',
        type: 'totalClients',
        position: 0,
        size: 'small'
      },
      {
        id: '2',
        type: 'activeSessions',
        position: 1,
        size: 'small'
      },
      {
        id: '3',
        type: 'newDreams',
        position: 2,
        size: 'small'
      },
      {
        id: '4',
        type: 'newJournalEntries',
        position: 3,
        size: 'small'
      }
    ];
    setWidgets(defaultWidgets);
    saveWidgets(defaultWidgets);
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

  async function loadDashboard() {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api<DashboardData>('/api/analytics/dashboard', { token });
      setDashboardData(res);
    } catch (e: any) {
      // Если ошибка верификации, обновляем состояние
      if (e.message?.includes('Verification required')) {
        const result = await checkVerification(token);
        setIsVerified(result.isVerified);
        setVerificationStatus(result.status);
      } else {
        setError(e.message || 'Не удалось загрузить данные дашборда');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleAddWidget(type: WidgetType) {
    const widgetDef = WIDGET_DEFINITIONS[type];
    const newWidget: WidgetInstance = {
      id: `${type}-${Date.now()}`,
      type,
      position: widgets.length,
      size: widgetDef.defaultSize
    };
    const updated = [...widgets, newWidget];
    setWidgets(updated);
    saveWidgets(updated);
  }

  function handleRemoveWidget(id: string) {
    const updated = widgets.filter(w => w.id !== id).map((w, idx) => ({
      ...w,
      position: idx
    }));
    setWidgets(updated);
    saveWidgets(updated);
  }

  function handleResizeWidget(id: string, size: 'small' | 'medium' | 'large') {
    const updated = widgets.map(w => w.id === id ? { ...w, size } : w);
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

    const dragged = widgets.find(w => w.id === draggedWidget);
    if (!dragged) return;

    const otherWidgets = widgets.filter(w => w.id !== draggedWidget);
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

  usePsychologistPlatformTour({
    tourId: 'dashboard',
    userId: user?.id,
    role: user?.role,
    enabled: Boolean(
      token &&
      user?.role === 'psychologist' &&
      isVerified === true &&
      !!dashboardData &&
      !loading
    ),
    steps: PSYCHOLOGIST_DASHBOARD_TOUR_STEPS
  });

  // Show verification required message
  if (isVerified === false && token) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <PsychologistNavbar />
        <VerificationRequired verificationStatus={verificationStatus} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PsychologistNavbar />
      <main
        style={{
          flex: 1,
          padding: '24px clamp(16px, 5vw, 48px)',
          maxWidth: '100%',
          overflowX: 'hidden',
          overflowY: 'auto',
          minHeight: 0
        }}
      >
        <div
          style={{
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap'
          }}
        >
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'var(--primary)', display: 'inline-flex' }}>
              <PlatformIcon name="dashboard" size={34} strokeWidth={1.5} />
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

        {error && (
          <div style={{ marginBottom: 16, padding: 12, background: 'var(--surface-2)', borderRadius: 10, color: '#ff7b7b' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <div className="small" style={{ opacity: 0.7 }}>Загрузка данных...</div>
          </div>
        ) : dashboardData ? (
          <div>
            {/* Hero block */}
            <div
              data-tour="dash-hero"
              className="card"
              style={{
                marginBottom: 14,
                padding: 16,
                borderRadius: 14,
                background: 'linear-gradient(120deg, rgba(59,130,246,0.12), rgba(16,185,129,0.08))'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{activeGreeting}</div>
                  <div className="small" style={{ color: 'var(--text-muted)', maxWidth: 760 }}>
                    Это ваш рабочий стол. Отсюда можно быстро перейти в ключевые разделы, открыть клиентов, события и AI-инструменты.
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowNotebook((prev) => !prev)}
                    title="Открыть блокнот"
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: '50%',
                      border: showNotebook ? '1px solid var(--primary)' : '1px solid rgba(148,163,184,0.35)',
                      background: showNotebook ? 'rgba(59,130,246,0.2)' : 'var(--surface-2)',
                      color: showNotebook ? '#c7d2fe' : 'var(--text)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ fontSize: 22, lineHeight: 1, fontWeight: 700 }}>✎</span>
                  </button>
                  <button className="button" onClick={() => navigate('/events')} style={{ whiteSpace: 'nowrap' }}>
                    Звонки
                  </button>
                </div>
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div className="small" style={{ padding: '6px 10px', borderRadius: 999, background: 'var(--surface-2)' }}>Клиентов: <b>{dashboardData.totalClients}</b></div>
                <div className="small" style={{ padding: '6px 10px', borderRadius: 999, background: 'var(--surface-2)' }}>Активных сессий: <b>{dashboardData.activeSessions}</b></div>
                <div className="small" style={{ padding: '6px 10px', borderRadius: 999, background: 'var(--surface-2)' }}>Новых снов: <b>{dashboardData.newDreams}</b></div>
              </div>
            </div>

            {showNotebook && (
              <div
                className="card"
                style={{
                  marginBottom: 14,
                  borderRadius: 14,
                  border: '1px solid rgba(148,163,184,0.25)',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))',
                  padding: 14,
                  overflowX: 'hidden'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, lineHeight: 1 }}>✎</span>
                    Блокнот
                  </div>
                  <button
                    type="button"
                    onClick={handleAddNote}
                    className="button secondary"
                    style={{ width: 34, height: 34, borderRadius: '50%', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Добавить заметку"
                  >
                    <PlatformIcon name="plus" size={16} />
                  </button>
                </div>

                <div style={{ display: 'grid', gap: 4, maxHeight: 380, overflowY: 'auto', overflowX: 'hidden', paddingRight: 2 }}>
                  {notes.length === 0 ? (
                    <div className="small" style={{ color: 'var(--text-muted)' }}>
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
                          border: dragOverNoteId === note.id ? '1px dashed var(--primary)' : '1px dashed transparent',
                          background: draggedNoteId === note.id ? 'rgba(59,130,246,0.1)' : 'transparent'
                        }}
                      >
                        <div
                          style={{
                            color: 'var(--text-muted)',
                            cursor: 'grab',
                            textAlign: 'center',
                            alignSelf: 'start',
                            marginTop: 2,
                            lineHeight: 1.3
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
                            color: 'var(--text)',
                            lineHeight: '24px',
                            borderBottom: '1px solid rgba(59,130,246,0.25)',
                            padding: '0 2px',
                            fontSize: 14,
                            fontFamily: 'inherit'
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
                            color: '#ef4444',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            marginTop: 0
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

            {/* Quick actions */}
            <div data-tour="dash-quick" style={{ marginBottom: 14, display: 'grid', gap: 10, gridTemplateColumns: isSmallMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <button className={isSmallMobile ? 'card' : 'button secondary'} style={isSmallMobile ? { textAlign: 'left', padding: 12, minHeight: 92, border: '1px solid rgba(148,163,184,0.3)' } : { justifyContent: 'flex-start', padding: '12px 14px' }} onClick={() => navigate('/events')}>
                <span style={{ display: 'inline-flex', alignItems: isSmallMobile ? 'flex-start' : 'center', gap: 8, flexDirection: isSmallMobile ? 'column' : 'row' }}>
                  <PlatformIcon name="calendar" size={isSmallMobile ? 14 : 16} /> Запланировать встречу
                </span>
              </button>
              <button className={isSmallMobile ? 'card' : 'button secondary'} style={isSmallMobile ? { textAlign: 'left', padding: 12, minHeight: 92, border: '1px solid rgba(148,163,184,0.3)' } : { justifyContent: 'flex-start', padding: '12px 14px' }} onClick={() => navigate('/clients')}>
                <span style={{ display: 'inline-flex', alignItems: isSmallMobile ? 'flex-start' : 'center', gap: 8, flexDirection: isSmallMobile ? 'column' : 'row' }}>
                  <PlatformIcon name="users" size={isSmallMobile ? 14 : 16} /> Открыть клиентов
                </span>
              </button>
              <button className={isSmallMobile ? 'card' : 'button secondary'} style={isSmallMobile ? { textAlign: 'left', padding: 12, minHeight: 92, border: '1px solid rgba(148,163,184,0.3)' } : { justifyContent: 'flex-start', padding: '12px 14px' }} onClick={() => navigate('/psychologist/work-area')}>
                <span style={{ display: 'inline-flex', alignItems: isSmallMobile ? 'flex-start' : 'center', gap: 8, flexDirection: isSmallMobile ? 'column' : 'row' }}>
                  <PlatformIcon name="book" size={isSmallMobile ? 14 : 16} /> Перейти в рабочую зону
                </span>
              </button>
              <button className={isSmallMobile ? 'card' : 'button secondary'} style={isSmallMobile ? { textAlign: 'left', padding: 12, minHeight: 92, border: '1px solid rgba(148,163,184,0.3)' } : { justifyContent: 'flex-start', padding: '12px 14px' }} onClick={() => navigate('/psychologist/ai')}>
                <span style={{ display: 'inline-flex', alignItems: isSmallMobile ? 'flex-start' : 'center', gap: 8, flexDirection: isSmallMobile ? 'column' : 'row' }}>
                  <PlatformIcon name="sparkles" size={isSmallMobile ? 14 : 16} /> AI-ассистент психолога
                </span>
              </button>
            </div>

            {/* Quick navigation cards */}
            <div data-tour="dash-cards" style={{ marginBottom: 14, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              {[
                { title: 'События', note: 'Сессии, история и приглашения', to: '/events', icon: 'calendar' },
                { title: 'Клиенты', note: 'Карточки клиентов и прогресс', to: '/clients', icon: 'users' },
                { title: 'Сны', note: 'Новые записи и анализ', to: '/dreams', icon: 'moon' },
                { title: 'Публикации', note: 'Лента и сообщества', to: '/publications', icon: 'message' }
              ].map((item) => (
                <button
                  key={item.to}
                  type="button"
                  className="card card-hover-shimmer"
                  onClick={() => navigate(item.to)}
                  style={{ textAlign: 'left', padding: 14, cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, marginBottom: 4 }}>
                    <PlatformIcon name={item.icon as any} size={16} />
                    {item.title}
                  </div>
                  <div className="small" style={{ color: 'var(--text-muted)' }}>{item.note}</div>
                </button>
              ))}
            </div>

            <div data-tour="dash-widgets">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 800 }}>Виджеты рабочего стола</div>
              <div className="small" style={{ color: 'var(--text-muted)' }}>Можно добавлять, удалять и перетаскивать</div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isSmallMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
                gap: 12,
                marginBottom: 0,
                paddingBottom: 12,
                overflowX: 'hidden'
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
                      onClick={(widgetType) => {
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
                      }}
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
                      onClick={(widgetType) => {
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
                      }}
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
                  onClick={(widgetType) => {
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
                  }}
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
                  onClick={(widgetType) => {
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
                  }}
                />
              ))}
              </>
              )}
            </div>
            </div>
          </div>
        ) : null}

        {/* Widget selector modal */}
        {showWidgetSelector && (
          <WidgetSelectorModal
            onClose={() => setShowWidgetSelector(false)}
            onAdd={handleAddWidget}
            existingWidgets={widgets.map(w => w.type)}
          />
                )}
      </main>
    </div>
  );
}

