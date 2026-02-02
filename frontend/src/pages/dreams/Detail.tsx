import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { UserMenu } from '../../components/ui';

type Dream = {
  id: string;
  title: string;
  content?: string;
  symbols?: string[];
  createdAt: string;
  userId?: string;
};

export default function DreamDetail() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [dream, setDream] = useState<Dream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (!id) throw new Error('Нет идентификатора');
        // If unauthenticated, use demo data without calling backend
        if (!token) {
          const demo: Dream[] = [
            { id: 'd1', title: 'Лечу над горящим городом', content: 'Город в огне, но нет страха. Чувство свободы. Лечу над улицами, вижу людей, которые спокойно смотрят вверх. В воздухе тепло и светло.', symbols: ['огонь','полёт'], createdAt: new Date().toISOString(), userId: 'c1' },
            { id: 'd2', title: 'Красная дверь и коридор', content: 'Длинный коридор с множеством дверей. Одна дверь красная. Открываю её и слышу шум воды. Внутри комната, наполненная мягким светом.', symbols: ['дверь','вода'], createdAt: new Date().toISOString(), userId: 'c2' },
            { id: 'd3', title: 'Темный лес и зеркало', content: 'Иду по тёмному лесу. На поляне стоит зеркало. Подхожу и вижу отражение, которое улыбается иначе, чем я. Чувство тревоги и любопытства.', symbols: ['лес','зеркало','тень'], createdAt: new Date().toISOString(), userId: 'c3' }
          ];
          const found = demo.find(x => x.id === id) || null;
          setDream(found);
          if (!found) setError('Не удалось загрузить');
          return;
        }
        const res = await api<Dream>(`/api/dreams/${id}`, { token: token ?? undefined });
        setDream(res);
      } catch (e: any) {
        // Fallback for authenticated errors: still try demo
        const demo: Dream[] = [
          { id: 'd1', title: 'Лечу над горящим городом', content: 'Город в огне, но нет страха. Чувство свободы. Лечу над улицами, вижу людей, которые спокойно смотрят вверх. В воздухе тепло и светло.', symbols: ['огонь','полёт'], createdAt: new Date().toISOString(), userId: 'c1' },
          { id: 'd2', title: 'Красная дверь и коридор', content: 'Длинный коридор с множеством дверей. Одна дверь красная. Открываю её и слышу шум воды. Внутри комната, наполненная мягким светом.', symbols: ['дверь','вода'], createdAt: new Date().toISOString(), userId: 'c2' },
          { id: 'd3', title: 'Темный лес и зеркало', content: 'Иду по тёмному лесу. На поляне стоит зеркало. Подхожу и вижу отражение, которое улыбается иначе, чем я. Чувство тревоги и любопытства.', symbols: ['лес','зеркало','тень'], createdAt: new Date().toISOString(), userId: 'c3' }
        ];
        const found = demo.find(x => x.id === id);
        if (found) { setDream(found); setError(null); }
        else setError(e.message || 'Не удалось загрузить');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, token]);

  function formatDateTime(iso?: string) {
    if (!iso) return '';
    const d = new Date(iso);
    const date = d.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
    const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return `${date} · ${time}`;
  }

  return (
    <div style={{ padding: 12 }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>Сон</h3>
          {dream && <span className="small" style={{ color: 'var(--text-muted)' }}>· {formatDateTime(dream.createdAt)}</span>}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Link to="/dreams" className="button secondary" style={{ padding: '6px 10px', fontSize: 13 }}>Назад</Link>
          <UserMenu user={user as any} />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        {loading && (
          <div className="card" style={{ padding: 16 }}>
            <div className="small" style={{ opacity: .8 }}>Загрузка…</div>
          </div>
        )}
        {error && (
          <div className="card" style={{ padding: 16, border: '1px solid rgba(255,0,0,0.3)' }}>
            <div className="small" style={{ color: '#ff7b7b' }}>Ошибка: {error}</div>
          </div>
        )}
        {dream && !loading && !error && (
          <div className="card" style={{ padding: 18, display: 'grid', gap: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{dream.title || 'Без названия'}</div>
            {dream.symbols && dream.symbols.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {dream.symbols.map(s => (
                  <span key={s} className="small" style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: 999 }}>{s}</span>
                ))}
              </div>
            )}
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{dream.content || '—'}</div>
            {dream.userId && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Link className="button secondary" to={`/psychologist/work-area?client=${encodeURIComponent(String(dream.userId))}`} style={{ padding: '6px 10px', fontSize: 13 }}>К рабочей области клиента</Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


