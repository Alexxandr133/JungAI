import { useEffect, useState } from 'react';
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
  const { token } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const [widgets, setWidgets] = useState<WidgetInstance[]>([]);
  const [showWidgetSelector, setShowWidgetSelector] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<number | null>(null);

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
      <main style={{ flex: 1, padding: '32px 48px', maxWidth: '100%', overflowX: 'hidden', overflowY: 'auto', minHeight: 0 }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>📊 Дашборд</h1>
          <div className="small" style={{ color: 'var(--text-muted)' }}>Обзор вашей практики</div>
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
                  />
                ))}
              {/* Add widget button */}
              <AddWidgetButton onClick={() => setShowWidgetSelector(true)} />
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

