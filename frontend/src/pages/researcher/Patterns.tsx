import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ResearcherNavbar } from '../../components/ResearcherNavbar';

export default function ResearcherPatterns() {
  const { token } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [matrix, setMatrix] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [statsRes, matrixRes] = await Promise.all([
        api('/api/research/stats', { token }),
        api('/api/research/matrix', { token })
      ]);
      setStats(statsRes);
      setMatrix(matrixRes);
    } catch (e: any) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [token]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ResearcherNavbar />
      <main style={{ flex: 1, padding: '32px 48px', maxWidth: '100%', overflowX: 'hidden' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Паттерны и тренды</h1>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: 48 }}>Загрузка...</div>}
        {error && <div style={{ padding: 16, background: 'var(--error)', color: '#fff', borderRadius: 12, marginBottom: 24 }}>{error}</div>}

        {stats && matrix && (
          <div style={{ display: 'grid', gap: 32 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Топ коррелирующих символов</h2>
              <div style={{ display: 'grid', gap: 16 }}>
                {matrix.cooccurrence.slice(0, 10).map((item: any) => (
                  <div key={item.symbol} style={{ padding: 20, background: 'var(--surface-2)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>{item.symbol}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {item.correlations.slice(0, 5).map((corr: any) => (
                        <div key={corr.symbol} style={{ padding: '8px 12px', background: 'var(--surface-1)', borderRadius: 8, fontSize: 14 }}>
                          {corr.symbol} ({corr.count})
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Динамика появления снов</h2>
              <div style={{ padding: 20, background: 'var(--surface-2)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                  {matrix.timeSeries.slice(-30).map((item: any) => (
                    <div key={item.date} style={{ padding: 12, background: 'var(--surface-1)', borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{new Date(item.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{item.count}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

