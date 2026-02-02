import { useState, useRef } from 'react';
import type { ResearcherWidgetInstance } from '../ResearcherWidgetTypes';
import TotalDreamsWidget from './TotalDreamsWidget';
import TotalClientsWidget from './TotalClientsWidget';
import TotalSessionsWidget from './TotalSessionsWidget';
import TotalAmplificationsWidget from './TotalAmplificationsWidget';
import SymbolFrequencyWidget from './SymbolFrequencyWidget';
import TestDistributionWidget from './TestDistributionWidget';
import CategoryDistributionWidget from './CategoryDistributionWidget';
import CreateWidgetRequestWidget from './CreateWidgetRequestWidget';

interface ResearcherWidgetRendererProps {
  widget: ResearcherWidgetInstance;
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

export default function ResearcherWidgetRenderer({ 
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
}: ResearcherWidgetRendererProps) {
  const [showControls, setShowControls] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);

  const renderWidget = () => {
    const commonProps = { data, size: widget.size, config: widget.config };
    
    switch (widget.type) {
      case 'totalDreams':
        return <TotalDreamsWidget {...commonProps} />;
      case 'totalClients':
        return <TotalClientsWidget {...commonProps} />;
      case 'totalSessions':
        return <TotalSessionsWidget {...commonProps} />;
      case 'totalAmplifications':
        return <TotalAmplificationsWidget {...commonProps} />;
      case 'symbolFrequency':
        return <SymbolFrequencyWidget {...commonProps} />;
      case 'testDistribution':
        return <TestDistributionWidget {...commonProps} />;
      case 'categoryDistribution':
        return <CategoryDistributionWidget {...commonProps} />;
      case 'customWidget':
        return <CreateWidgetRequestWidget {...commonProps} />;
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
    e.stopPropagation();
    if (!onResize) return;
    
    const sizes: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large'];
    const currentIndex = sizes.indexOf(widget.size);
    const nextIndex = (currentIndex + 1) % sizes.length;
    onResize(widget.id, sizes[nextIndex]);
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (onDragStart) {
      onDragStart(widget.id);
    }
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      ref={widgetRef}
      style={{
        ...getGridStyle(),
        position: 'relative',
        opacity: isDragged ? 0.5 : 1,
        border: isDragOver ? '2px solid var(--primary)' : 'none',
        borderRadius: 12,
        transition: 'all 0.2s'
      }}
      draggable={!!onDragStart}
      onDragStart={handleDragStart}
      onDragOver={onDragOver ? (e) => onDragOver(e, position) : undefined}
      onDragLeave={onDragLeave}
      onDrop={onDrop ? (e) => onDrop(e, position) : undefined}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <div
        className="card"
        style={{
          height: '100%',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}
      >
        {showControls && (onRemove || onResize) && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              display: 'flex',
              gap: 4,
              zIndex: 10
            }}
          >
            {onResize && (
              <button
                onClick={handleResizeClick}
                style={{
                  padding: '4px 8px',
                  background: 'var(--surface-2)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6,
                  color: 'var(--text)',
                  cursor: 'pointer',
                  fontSize: 12
                }}
                title="Изменить размер"
              >
                ⤢
              </button>
            )}
            {onRemove && (
              <button
                onClick={() => onRemove(widget.id)}
                style={{
                  padding: '4px 8px',
                  background: 'var(--surface-2)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6,
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontSize: 12
                }}
                title="Удалить"
              >
                ✕
              </button>
            )}
          </div>
        )}
        {renderWidget()}
      </div>
    </div>
  );
}
