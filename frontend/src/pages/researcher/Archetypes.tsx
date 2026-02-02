import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ResearcherNavbar } from '../../components/ResearcherNavbar';

export default function ResearcherArchetypes() {
  const { token } = useAuth();
  const [archetypes, setArchetypes] = useState<Array<{
    symbol: string;
    title: string;
    category: string | null;
    content: string;
    usageCount: number;
    tags: any;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadArchetypes() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ items: typeof archetypes }>('/api/research/archetypes', { token });
      setArchetypes(res.items);
    } catch (e: any) {
      setError(e.message || 'Failed to load archetypes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadArchetypes();
  }, [token]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ResearcherNavbar />
      <main style={{ flex: 1, padding: '32px 48px', maxWidth: '100%', overflowX: 'hidden' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Архетипы и символы</h1>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: 48 }}>Загрузка...</div>}
        {error && <div style={{ padding: 16, background: 'var(--error)', color: '#fff', borderRadius: 12, marginBottom: 24 }}>{error}</div>}

        {archetypes.length > 0 && (
          <div style={{ display: 'grid', gap: 20 }}>
            {archetypes.map((arch) => (
              <div key={arch.symbol} style={{ padding: 24, background: 'var(--surface-2)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{arch.symbol}</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>{arch.title}</div>
                    {arch.category && (
                      <div style={{ display: 'inline-block', padding: '4px 12px', background: 'var(--surface-1)', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
                        {arch.category}
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '8px 16px', background: 'var(--primary-ghost)', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>
                    Использований: {arch.usageCount}
                  </div>
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{arch.content}</div>
                {arch.tags && Array.isArray(arch.tags) && arch.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    {arch.tags.map((tag: string, i: number) => (
                      <span key={i} style={{ padding: '4px 8px', background: 'var(--surface-1)', borderRadius: 6, fontSize: 12 }}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

