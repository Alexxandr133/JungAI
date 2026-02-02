
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
        padding: 24,
        background: 'var(--surface-2)',
        border: '2px dashed rgba(255,255,255,0.2)',
        borderRadius: 12,
        color: 'var(--text)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        transition: 'all 0.2s',
        fontSize: 16,
        fontWeight: 600
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--surface)';
        e.currentTarget.style.borderColor = 'var(--primary)';
        e.currentTarget.style.color = 'var(--primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--surface-2)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
        e.currentTarget.style.color = 'var(--text)';
      }}
    >
      <div style={{ fontSize: 32 }}>+</div>
      <div>Добавить виджет</div>
      <div
        className="small"
        style={{
          color: 'var(--text-muted)',
          fontSize: 13,
          marginTop: 4
        }}
      >
        Нажмите, чтобы выбрать виджет для добавления
      </div>
    </button>
  );
}
