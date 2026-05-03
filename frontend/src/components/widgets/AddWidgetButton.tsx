
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
        background: 'linear-gradient(180deg, rgba(59,130,246,0.12), rgba(15,23,42,0.2))',
        border: '1px dashed rgba(148,163,184,0.45)',
        borderRadius: 14,
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
        e.currentTarget.style.background = 'linear-gradient(180deg, rgba(59,130,246,0.2), rgba(15,23,42,0.24))';
        e.currentTarget.style.borderColor = 'rgba(59,130,246,0.75)';
        e.currentTarget.style.color = '#c7d2fe';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'linear-gradient(180deg, rgba(59,130,246,0.12), rgba(15,23,42,0.2))';
        e.currentTarget.style.borderColor = 'rgba(148,163,184,0.45)';
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
