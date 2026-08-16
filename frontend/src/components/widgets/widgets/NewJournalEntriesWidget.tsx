import { PlatformIcon } from '../../icons';

interface Props {
  data: any;
  size: 'small' | 'medium' | 'large';
  config?: Record<string, any>;
}

export default function NewJournalEntriesWidget({ data }: Props) {
  const iconSize = typeof window !== 'undefined' && window.innerWidth <= 640 ? 22 : 32;
  const value = Number(data?.newJournalEntries ?? 0);
  return (
    <>
      <div style={{ marginBottom: 8, color: 'var(--brand, var(--primary))' }}>
        <PlatformIcon name="clipboard" size={iconSize} strokeWidth={1.5} />
      </div>
      {value > 0 ? (
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{value}</div>
      ) : (
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: 'var(--ink-soft, var(--text-muted))' }}>
          Нет новых записей
        </div>
      )}
      <div className="small" style={{ color: 'var(--ink-soft, var(--text-muted))' }}>Записей в дневниках</div>
    </>
  );
}
