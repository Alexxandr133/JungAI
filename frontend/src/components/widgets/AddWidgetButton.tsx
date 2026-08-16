interface AddWidgetButtonProps {
  onClick: () => void;
}

export default function AddWidgetButton({ onClick }: AddWidgetButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        minHeight: 120,
        padding: 20,
        background: 'var(--card, var(--surface-2))',
        border: '1px dashed var(--card-border, var(--line))',
        borderRadius: 14,
        color: 'var(--ink, var(--text))',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        transition: 'border-color 0.15s ease, background 0.15s ease, box-shadow 0.18s ease',
        fontSize: 16,
        fontWeight: 600,
        boxShadow: 'var(--shadow-card, none)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--surface-2)';
        e.currentTarget.style.borderColor = 'var(--brand, var(--primary))';
        e.currentTarget.style.boxShadow = 'var(--shadow-card-hover, var(--shadow-card))';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--card, var(--surface-2))';
        e.currentTarget.style.borderColor = 'var(--card-border, var(--line))';
        e.currentTarget.style.boxShadow = 'var(--shadow-card, none)';
      }}
    >
      <div style={{ fontSize: 32, color: 'var(--brand, var(--primary))' }}>+</div>
      <div>Добавить виджет</div>
      <div
        className="small"
        style={{
          color: 'var(--ink-soft, var(--text-muted))',
          fontSize: 13,
          marginTop: 4,
        }}
      >
        Нажмите, чтобы выбрать виджет для добавления
      </div>
    </button>
  );
}
