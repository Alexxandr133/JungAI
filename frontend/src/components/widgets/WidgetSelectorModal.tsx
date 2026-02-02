import { useState } from 'react';
import type { WidgetType } from './WidgetTypes';
import { WIDGET_DEFINITIONS } from './WidgetTypes';

interface WidgetSelectorModalProps {
  onClose: () => void;
  onAdd: (type: WidgetType) => void;
  existingWidgets: WidgetType[];
}

export default function WidgetSelectorModal({
  onClose,
  onAdd,
  existingWidgets
}: WidgetSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const availableWidgets = Object.values(WIDGET_DEFINITIONS).filter(
    (widget) =>
      !existingWidgets.includes(widget.type) &&
      (widget.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        widget.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleAdd = (type: WidgetType) => {
    onAdd(type);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5,8,16,0.75)',
        backdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 1000,
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: 'min(800px, 94vw)',
          maxHeight: '80vh',
          overflow: 'hidden',
          padding: 0,
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          background: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>
              Добавить виджет
            </div>
            <div className="small" style={{ color: 'var(--text-muted)' }}>
              Выберите виджет для добавления на дашборд
            </div>
          </div>
          <button
            className="button secondary"
            onClick={onClose}
            style={{
              padding: '8px 12px',
              fontSize: 13,
              borderRadius: 8
            }}
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <input
            placeholder="Поиск виджетов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'var(--surface-2)',
              color: 'var(--text)',
              fontSize: 14
            }}
          />
        </div>

        {/* Widgets list */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 24px',
            display: 'grid',
            gap: 12
          }}
        >
          {availableWidgets.length === 0 ? (
            <div
              className="small"
              style={{
                opacity: 0.7,
                padding: '40px 20px',
                textAlign: 'center',
                color: 'var(--text-muted)'
              }}
            >
              {searchQuery
                ? 'Не найдено виджетов по запросу'
                : 'Все доступные виджеты уже добавлены'}
            </div>
          ) : (
            availableWidgets.map((widget) => (
              <button
                key={widget.id}
                onClick={() => handleAdd(widget.type)}
                style={{
                  width: '100%',
                  padding: 16,
                  background: 'var(--surface-2)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  color: 'var(--text)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 16
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--surface)';
                  e.currentTarget.style.borderColor = 'var(--primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--surface-2)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                }}
              >
                <div style={{ fontSize: 32, flexShrink: 0 }}>{widget.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 16,
                      marginBottom: 4
                    }}
                  >
                    {widget.title}
                  </div>
                  <div
                    className="small"
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: 13,
                      lineHeight: 1.5
                    }}
                  >
                    {widget.description}
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center'
                    }}
                  >
                    <span>Размер: {widget.defaultSize}</span>
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 20,
                    color: 'var(--primary)',
                    flexShrink: 0
                  }}
                >
                  +
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
