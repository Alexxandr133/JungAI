import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { UniversalNavbar } from '../../components/UniversalNavbar';

export default function MaterialsList() {
  const { token } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [query, setQuery] = useState('');

  async function load() {
    try {
      const res = await api<{ items: any[] }>('/api/materials', { token: token ?? undefined });
      const list = res.items || [];
      if (list.length) { setItems(list); return; }
      // Demo fallback
      setItems([
        { id: 'b1', title: 'Юнг — Архетип и символ', type: 'book', tags: ['архетипы'], cover: null },
        { id: 'b2', title: 'Введение в анализ сновидений', type: 'book', tags: ['сны'], cover: null },
        { id: 'a1', title: 'Символ «дверь»: переход и порог', type: 'article', tags: ['символы'], cover: null },
        { id: 'v1', title: 'Лекция: Коллективное бессознательное', type: 'video', tags: ['лекция'], cover: null }
      ]);
    } catch (e: any) { console.error('Failed to load:', e); }
  }

  useEffect(() => { load(); }, [token]);


  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((m: any) => (m.title || '').toLowerCase().includes(q) || (m.tags || []).some((t: string) => t.toLowerCase().includes(q)));
  }, [items, query]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <UniversalNavbar />
      <main style={{ flex: 1, padding: '32px 48px', maxWidth: '100%', overflowX: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>Библиотека</h1>
            <span className="small" style={{ color: 'var(--text-muted)' }}>· {items.length}</span>
            <div>
              <input placeholder="Поиск по названию/тегам" value={query} onChange={e => setQuery(e.target.value)} style={{ width: 280, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)' }} />
            </div>
          </div>
        </div>

        {/* Collections */}
        <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
          <section className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 800 }}>Книги</div>
              <Link to="/materials" className="button secondary" style={{ padding: '6px 10px', fontSize: 13 }}>Все</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginTop: 10 }}>
              {filtered.filter((m: any) => m.type === 'book').map(m => (
                <Link key={m.id} to={`/materials/${m.id}`} className="card" style={{ padding: 12, textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</div>
                  <div className="small" style={{ color: 'var(--text-muted)', marginTop: 6 }}>{(m.tags || []).join(', ')}</div>
                </Link>
              ))}
              {filtered.filter((m: any) => m.type === 'book').length === 0 && <div className="small" style={{ opacity: .8 }}>Нет книг</div>}
            </div>
          </section>

          <section className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 800 }}>Материалы</div>
              <Link to="/materials" className="button secondary" style={{ padding: '6px 10px', fontSize: 13 }}>Все</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginTop: 10 }}>
              {filtered.filter((m: any) => m.type === 'article' || m.type === 'course' || m.type === 'lecture').map(m => (
                <Link key={m.id} to={`/materials/${m.id}`} className="card" style={{ padding: 12, textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</div>
                  <div className="small" style={{ color: 'var(--text-muted)', marginTop: 6 }}>{m.type}</div>
                </Link>
              ))}
              {filtered.filter((m: any) => m.type === 'article' || m.type === 'course' || m.type === 'lecture').length === 0 && <div className="small" style={{ opacity: .8 }}>Нет материалов</div>}
            </div>
          </section>

          <section className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 800 }}>Видео</div>
              <Link to="/materials" className="button secondary" style={{ padding: '6px 10px', fontSize: 13 }}>Все</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginTop: 10 }}>
              {filtered.filter((m: any) => m.type === 'video').map(m => (
                <Link key={m.id} to={`/materials/${m.id}`} className="card" style={{ padding: 12, textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</div>
                  <div className="small" style={{ color: 'var(--text-muted)', marginTop: 6 }}>{(m.tags || []).join(', ')}</div>
                </Link>
              ))}
              {filtered.filter((m: any) => m.type === 'video').length === 0 && <div className="small" style={{ opacity: .8 }}>Нет видео</div>}
            </div>
          </section>
        </div>

        {/* Публикация скрыта по требованию */}
      </main>
    </div>
  );
}
