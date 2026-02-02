import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ResearcherNavbar } from '../../components/ResearcherNavbar';

export default function ResearcherStats() {
  const { token } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadStats() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api('/api/research/stats', { token });
      setStats(res);
    } catch (e: any) {
      setError(e.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStats();
  }, [token]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ResearcherNavbar />
      <main style={{ flex: 1, padding: '32px 48px', maxWidth: '100%', overflowX: 'hidden' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Статистика</h1>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: 48 }}>Загрузка...</div>}
        {error && <div style={{ padding: 16, background: 'var(--error)', color: '#fff', borderRadius: 12, marginBottom: 24 }}>{error}</div>}

        {stats && (
          <div style={{ display: 'grid', gap: 24 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Общая статистика</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                {Object.entries(stats.counts).map(([key, value]) => (
                  <div key={key} style={{ padding: 20, background: 'var(--surface-2)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'capitalize' }}>{key}</div>
                    <div style={{ fontSize: 32, fontWeight: 700 }}>{String(value)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Распределение символов</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {stats.distributions.symbols.map((item: any) => (
                  <div key={item.symbol} style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{item.symbol}</div>
                    <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Встречается: {item.count} раз</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Распределение по категориям амплификаций</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {Object.entries(stats.distributions.categories).map(([category, count]) => (
                  <div key={category} style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{category}</div>
                    <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Количество: {String(count)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

