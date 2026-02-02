import { useState, useRef } from 'react';
import type { WidgetInstance } from './WidgetTypes';
import TotalClientsWidget from './widgets/TotalClientsWidget.tsx';
import ActiveSessionsWidget from './widgets/ActiveSessionsWidget.tsx';
import NewDreamsWidget from './widgets/NewDreamsWidget.tsx';
import NewJournalEntriesWidget from './widgets/NewJournalEntriesWidget.tsx';
import TopClientsWidget from './widgets/TopClientsWidget.tsx';
import TopSymbolsWidget from './widgets/TopSymbolsWidget.tsx';
import RequiresAttentionWidget from './widgets/RequiresAttentionWidget.tsx';
import ActivityChartWidget from './widgets/ActivityChartWidget.tsx';
import RecentActivityWidget from './widgets/RecentActivityWidget.tsx';
import SessionsCalendarWidget from './widgets/SessionsCalendarWidget.tsx';
import DreamsStatsWidget from './widgets/DreamsStatsWidget.tsx';
import ClientProgressWidget from './widgets/ClientProgressWidget.tsx';
import MonthlyStatsWidget from './widgets/MonthlyStatsWidget.tsx';
import SymbolsChartWidget from './widgets/SymbolsChartWidget.tsx';

interface WidgetRendererProps {
  widget: WidgetInstance;
  data: any;
  onRemove?: (id: string) => void;
  onResize?: (id: string, size: 'small' | 'medium' | 'large') => void;
  onDragStart?: (id: string) => void;
  onDragOver?: (e: React.DragEvent, position: number) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent, position: number) => void;
  onDragEnd?: () => void;
  isDragged?: boolean;
  isDragOver?: boolean;
  position?: number;
}

export default function WidgetRenderer({ 
  widget, 
  data, 
  onRemove, 
  onResize,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  isDragged = false,
  isDragOver = false,
  position = 0
}: WidgetRendererProps) {
  const [showControls, setShowControls] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);

  const renderWidget = () => {
    const commonProps = { data, size: widget.size, config: widget.config };
    
    switch (widget.type) {
      case 'totalClients':
        return <TotalClientsWidget {...commonProps} />;
      case 'activeSessions':
        return <ActiveSessionsWidget {...commonProps} />;
      case 'newDreams':
        return <NewDreamsWidget {...commonProps} />;
      case 'newJournalEntries':
        return <NewJournalEntriesWidget {...commonProps} />;
      case 'topClients':
        return <TopClientsWidget {...commonProps} />;
      case 'topSymbols':
        return <TopSymbolsWidget {...commonProps} />;
      case 'requiresAttention':
        return <RequiresAttentionWidget {...commonProps} />;
      case 'activityChart':
        return <ActivityChartWidget {...commonProps} />;
      case 'recentActivity':
        return <RecentActivityWidget {...commonProps} />;
      case 'sessionsCalendar':
        return <SessionsCalendarWidget {...commonProps} />;
      case 'dreamsStats':
        return <DreamsStatsWidget {...commonProps} />;
      case 'clientProgress':
        return <ClientProgressWidget {...commonProps} />;
      case 'monthlyStats':
        return <MonthlyStatsWidget {...commonProps} />;
      case 'symbolsChart':
        return <SymbolsChartWidget {...commonProps} />;
      default:
        return <div>Неизвестный виджет</div>;
    }
  };

  const getGridStyle = () => {
    switch (widget.size) {
      case 'small':
        return { gridColumn: 'span 1', gridRow: 'span 1' };
      case 'medium':
        return { gridColumn: 'span 2', gridRow: 'span 1' };
      case 'large':
        return { gridColumn: 'span 2', gridRow: 'span 2' };
      default:
        return { gridColumn: 'span 1', gridRow: 'span 1' };
    }
  };

  const handleResizeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onResize) return;
    
    const sizes: ('small' | 'medium' | 'large')[] = ['small', 'medium', 'large'];
    const currentIndex = sizes.indexOf(widget.size);
    const nextIndex = (currentIndex + 1) % sizes.length;
    onResize(widget.id, sizes[nextIndex]);
  };

  return (
    <div
      ref={widgetRef}
      className="card"
      draggable={!!onDragStart}
      onDragStart={() => onDragStart?.(widget.id)}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver?.(e, position);
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        onDrop?.(e, position);
      }}
      onDragEnd={onDragEnd}
      style={{
        padding: 20,
        position: 'relative',
        cursor: isDragged ? 'grabbing' : 'grab',
        opacity: isDragged ? 0.5 : 1,
        transform: isDragOver ? 'scale(1.02)' : 'none',
        transition: isDragged ? 'none' : 'transform 0.2s, opacity 0.2s',
        border: isDragOver ? '2px solid var(--primary)' : 'none',
        ...getGridStyle()
      }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Drag handle */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          width: 24,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'grab',
          opacity: showControls ? 1 : 0,
          transition: 'opacity 0.2s',
          zIndex: 10,
          color: 'var(--text-muted)',
          fontSize: 16
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
      >
        ⋮⋮
      </div>

      {/* Widget controls */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          display: 'flex',
          gap: 4,
          opacity: showControls ? 1 : 0,
          transition: 'opacity 0.2s',
          zIndex: 10
        }}
      >
        {onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Удалить этот виджет?')) {
                onRemove(widget.id);
              }
            }}
            style={{
              padding: '6px 10px',
              fontSize: 12,
              background: 'rgba(255, 107, 107, 0.2)',
              border: '1px solid rgba(255, 107, 107, 0.3)',
              borderRadius: 6,
              color: '#ff6b6b',
              cursor: 'pointer',
              fontWeight: 600
            }}
            title="Удалить виджет"
          >
            ×
          </button>
        )}
      </div>

      {/* Resize handle (bottom-right corner) */}
      {onResize && (
        <div
          onClick={handleResizeClick}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 24,
            height: 24,
            cursor: 'pointer',
            opacity: showControls ? 1 : 0,
            transition: 'opacity 0.2s',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--surface-2)',
            borderTopLeftRadius: 8,
            color: 'var(--text-muted)',
            fontSize: 14,
            fontWeight: 600
          }}
          title="Изменить размер (клик для переключения)"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--primary)';
            e.currentTarget.style.color = '#0b0f1a';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--surface-2)';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
        >
          ⤢
        </div>
      )}

      {renderWidget()}
    </div>
  );
}
