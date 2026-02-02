
interface Props {
  data: any;
  size: 'small' | 'medium' | 'large';
  config?: Record<string, any>;
}

export default function SymbolsChartWidget({ data, size }: Props) {
  const topSymbols = data?.topSymbols || [];
  const limit = size === 'small' ? 5 : size === 'medium' ? 8 : 12;
  const maxCount = Math.max(...topSymbols.map((s: any) => s.count), 1);

  return (
    <>
      <h3 style={{ marginTop: 0, marginBottom: 16 }}>🔮 График символов</h3>
      {topSymbols.length === 0 ? (
        <div className="small" style={{ color: 'var(--text-muted)' }}>Нет данных</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {topSymbols.slice(0, limit).map((item: any, idx: number) => {
            const percentage = (item.count / maxCount) * 100;
            return (
              <div key={item.symbol} style={{ display: 'grid', gap: 6 }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  fontSize: 13
                }}>
                  <span style={{ fontWeight: 600 }}>
                    {idx + 1}. {item.symbol}
                  </span>
                  <span style={{ 
                    fontSize: 16, 
                    fontWeight: 700, 
                    color: 'var(--primary)',
                    minWidth: 30,
                    textAlign: 'right'
                  }}>
                    {item.count}
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: size === 'small' ? 6 : 8,
                  background: 'var(--surface-2)',
                  borderRadius: 4,
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  <div
                    style={{
                      width: `${percentage}%`,
                      height: '100%',
                      background: `linear-gradient(90deg, 
                        hsl(${(idx * 30) % 360}, 70%, 60%), 
                        hsl(${(idx * 30 + 30) % 360}, 70%, 50%))`,
                      borderRadius: 4,
                      transition: 'width 0.3s',
                      boxShadow: `0 0 8px hsla(${(idx * 30) % 360}, 70%, 50%, 0.3)`
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
