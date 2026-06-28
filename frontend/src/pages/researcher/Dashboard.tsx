import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ResearcherNavbar } from '../../components/ResearcherNavbar';
import type { ResearcherWidgetInstance, ResearcherWidgetType } from '../../components/widgets/ResearcherWidgetTypes';
import { RESEARCHER_WIDGET_STORAGE_KEY } from '../../components/widgets/ResearcherWidgetTypes';
import ResearcherWidgetRenderer from '../../components/widgets/researcher/ResearcherWidgetRenderer';
import AddWidgetButton from '../../components/widgets/AddWidgetButton';
import ResearcherWidgetSelectorModal from '../../components/widgets/ResearcherWidgetSelectorModal';
import { PlatformIcon, type PlatformIconName } from '../../components/icons';
import './ResearcherDashboard.css';

type DashboardData = {
  counts: {
    dreams: number;
    clients: number;
    sessions: number;
    amplifications: number;
    journalEntries: number;
    testResults: number;
  };
  distributions: {
    symbols: Array<{ symbol: string; count: number }>;
    tests: Record<string, number>;
    categories: Record<string, number>;
  };
};

const DEFAULT_WIDGETS: ResearcherWidgetInstance[] = [
  { id: 'totalDreams-default', type: 'totalDreams', position: 0, size: 'small' },
  { id: 'totalClients-default', type: 'totalClients', position: 1, size: 'small' },
  { id: 'totalSessions-default', type: 'totalSessions', position: 2, size: 'small' },
  { id: 'symbolFrequency-default', type: 'symbolFrequency', position: 3, size: 'medium' }
];

const QUICK_LINKS: Array<{
  icon: PlatformIconName;
  title: string;
  description: string;
  path: string;
}> = [
  {
    icon: 'dreams',
    title: 'База снов',
    description: 'Поиск и фильтрация сновидений для анализа символов и паттернов.',
    path: '/researcher/dreams'
  },
  {
    icon: 'users',
    title: 'Участники',
    description: 'Обезличенные профили клиентов с ценностями и раздражителями.',
    path: '/researcher/people'
  },
  {
    icon: 'bot',
    title: 'ИИ-ассистент',
    description: 'Гипотезы, интерпретации и структурирование исследовательских выводов.',
    path: '/researcher/ai'
  },
  {
    icon: 'orbit',
    title: 'Амплификации',
    description: 'Словарь символов, архетипов и интерпретационных связей.',
    path: '/research/amplifications'
  },
  {
    icon: 'file',
    title: 'Публикации',
    description: 'Статьи, черновики и материалы для сообществ.',
    path: '/publications'
  },
  {
    icon: 'messages',
    title: 'Лента',
    description: 'Общая лента постов психологов и исследователей.',
    path: '/feed'
  },
  {
    icon: 'orbit',
    title: 'Модель индивидуации',
    description: 'Гексаграмма шести ступеней: явление × шаблон, I Ching, MBTI.',
    path: '/researcher/individuation'
  },
  {
    icon: 'microscope',
    title: 'Проекты',
    description: 'Экспорт данных, матрица символов и заметки по исследованиям.',
    path: '/researcher/projects'
  },
  {
    icon: 'library',
    title: 'Библиотека',
    description: 'Материалы и справочные документы платформы.',
    path: '/materials'
  },
  {
    icon: 'user',
    title: 'Профиль',
    description: 'Реквизиты, специализация и верификация исследователя.',
    path: '/researcher/profile'
  }
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'Доброй ночи';
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function setDefaultWidgets(setter: (w: ResearcherWidgetInstance[]) => void) {
  setter(DEFAULT_WIDGETS.map((w, i) => ({ ...w, position: i })));
}

export function ResearcherDashboard() {
  const { token, user, profile } = useAuth();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<ResearcherWidgetInstance[]>([]);
  const [showWidgetSelector, setShowWidgetSelector] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<number | null>(null);

  const displayName = profile?.name || user?.name || 'коллега';
  const greeting = useMemo(() => `${getGreeting()}, ${displayName}`, [displayName]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(RESEARCHER_WIDGET_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setWidgets(parsed);
          return;
        }
      }
      setDefaultWidgets(setWidgets);
    } catch (e) {
      console.error('Failed to load widgets:', e);
      setDefaultWidgets(setWidgets);
    }
  }, []);

  function saveWidgets(widgetsToSave: ResearcherWidgetInstance[]) {
    try {
      localStorage.setItem(RESEARCHER_WIDGET_STORAGE_KEY, JSON.stringify(widgetsToSave));
    } catch (e) {
      console.error('Failed to save widgets:', e);
    }
  }

  useEffect(() => {
    if (token) {
      loadDashboard();
    }
  }, [token]);

  async function loadDashboard() {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api<DashboardData>('/api/research/stats', { token });
      setDashboardData(res);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Не удалось загрузить данные дашборда';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleAddWidget(type: ResearcherWidgetType) {
    const newWidget: ResearcherWidgetInstance = {
      id: `${type}-${Date.now()}`,
      type,
      position: widgets.length,
      size: 'small'
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

  const topSymbols = dashboardData?.distributions.symbols.slice(0, 3) ?? [];

  return (
    <div className="researcher-home" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <ResearcherNavbar />
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
        <div style={{ maxWidth: 'var(--rh-max)', margin: '0 auto' }}>
          <header className="researcher-home__hero">
            <h1 className="researcher-home__title">{greeting}</h1>
            <p className="researcher-home__lead">
              Исследовательский контур JungAI: данные платформы, символы снов, амплификации,
              публикации и ИИ — в одном пространстве для аналитической работы.
            </p>
          </header>

          {error && (
            <div style={{ marginBottom: 16, padding: 12, background: 'var(--surface-2)', borderRadius: 10, color: '#ff7b7b' }}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <div className="small" style={{ opacity: 0.7 }}>Загрузка данных…</div>
            </div>
          ) : dashboardData ? (
            <>
              <div className="researcher-home__stats">
                {[
                  { label: 'Снов в базе', value: dashboardData.counts.dreams },
                  { label: 'Участников', value: dashboardData.counts.clients },
                  { label: 'Сессий', value: dashboardData.counts.sessions },
                  { label: 'Амплификаций', value: dashboardData.counts.amplifications },
                  { label: 'Результатов тестов', value: dashboardData.counts.testResults }
                ].map((stat) => (
                  <div key={stat.label} className="researcher-home__stat">
                    <div className="researcher-home__stat-value">{stat.value}</div>
                    <div className="researcher-home__stat-label">{stat.label}</div>
                  </div>
                ))}
              </div>

              {topSymbols.length > 0 && (
                <div
                  className="small"
                  style={{
                    marginBottom: 28,
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'var(--surface)',
                    color: 'var(--text-muted)'
                  }}
                >
                  <strong style={{ color: 'var(--text)' }}>Топ символов сегодня: </strong>
                  {topSymbols.map((s) => `${s.symbol} (${s.count})`).join(' · ')}
                </div>
              )}

              <section style={{ marginBottom: 36 }}>
                <h2 className="researcher-home__section-title">Быстрый доступ</h2>
                <div className="researcher-home__quick">
                  {QUICK_LINKS.map((link) => (
                    <button
                      key={link.path}
                      type="button"
                      className="researcher-home__quick-card"
                      onClick={() => navigate(link.path)}
                    >
                      <span className="researcher-home__quick-icon">
                        <PlatformIcon name={link.icon} size={22} strokeWidth={1.7} />
                      </span>
                      <span>
                        <div className="researcher-home__quick-title">{link.title}</div>
                        <p className="researcher-home__quick-text">{link.description}</p>
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="researcher-home__widgets-head">
                  <h2 className="researcher-home__section-title" style={{ margin: 0 }}>
                    Аналитические виджеты
                  </h2>
                  <span className="small" style={{ color: 'var(--text-muted)' }}>
                    Перетаскивайте карточки · настройте под свои задачи
                  </span>
                </div>
                <div className="researcher-home__widgets-grid">
                  {widgets
                    .sort((a, b) => a.position - b.position)
                    .map((widget, index) => (
                      <ResearcherWidgetRenderer
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
                      />
                    ))}
                  <AddWidgetButton onClick={() => setShowWidgetSelector(true)} />
                </div>
              </section>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <div className="small" style={{ opacity: 0.7 }}>Нет данных для отображения</div>
            </div>
          )}
        </div>

        {showWidgetSelector && (
          <ResearcherWidgetSelectorModal
            onClose={() => setShowWidgetSelector(false)}
            onAdd={handleAddWidget}
            existingWidgets={widgets.map(w => w.type)}
          />
        )}
      </main>
    </div>
  );
}
