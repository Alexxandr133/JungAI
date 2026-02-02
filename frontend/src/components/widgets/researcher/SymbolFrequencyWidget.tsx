
interface Props {
  data: any;
  size: 'small' | 'medium' | 'large';
}

export default function SymbolFrequencyWidget({ data, size }: Props) {
  const symbols = data?.distributions?.symbols || [];
  const topSymbols = symbols.slice(0, size === 'small' ? 5 : size === 'medium' ? 10 : 15);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ fontSize: 16, fontWeight: 700 }}>Частота символов</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
        {topSymbols.length === 0 ? (
          <div className="small" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>Нет данных</div>
        ) : (
          topSymbols.map((item: { symbol: string; count: number }, idx: number) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                background: 'var(--surface-2)',
                borderRadius: 8
              }}
            >
              <div style={{ fontWeight: 600 }}>{item.symbol}</div>
              <div className="small" style={{ color: 'var(--text-muted)' }}>{item.count}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
