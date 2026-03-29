import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ResearcherNavbar } from '../../components/ResearcherNavbar';
import type { ResearcherWidgetInstance, ResearcherWidgetType } from '../../components/widgets/ResearcherWidgetTypes';
import { RESEARCHER_WIDGET_STORAGE_KEY } from '../../components/widgets/ResearcherWidgetTypes';
import ResearcherWidgetRenderer from '../../components/widgets/researcher/ResearcherWidgetRenderer';
import AddWidgetButton from '../../components/widgets/AddWidgetButton';
import ResearcherWidgetSelectorModal from '../../components/widgets/ResearcherWidgetSelectorModal';
import { PlatformIcon } from '../../components/icons';

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

export function ResearcherDashboard() {
  const { token } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<ResearcherWidgetInstance[]>([]);
  const [showWidgetSelector, setShowWidgetSelector] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<number | null>(null);

  // Load saved widgets from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RESEARCHER_WIDGET_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setWidgets(parsed);
        }
      }
      // Пустой дашборд по умолчанию - не устанавливаем виджеты
    } catch (e) {
      console.error('Failed to load widgets:', e);
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
    } catch (e: any) {
      setError(e.message || 'Не удалось загрузить данные дашборда');
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'var(--primary)', display: 'inline-flex' }}>
              <PlatformIcon name="dashboard" size={34} strokeWidth={1.5} />
            </span>
            Дашборд
          </h1>
          <div className="small" style={{ color: 'var(--text-muted)' }}>Обзор данных для исследований</div>
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
            {/* Widgets grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 16,
                marginBottom: 0,
                paddingBottom: 16
              }}
            >
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
              {/* Add widget button */}
              <AddWidgetButton onClick={() => setShowWidgetSelector(true)} />
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <div className="small" style={{ opacity: 0.7 }}>Нет данных для отображения</div>
          </div>
        )}

        {/* Widget selector modal */}
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
