import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ResearcherNavbar } from '../../components/ResearcherNavbar';
import '../../styles/tokens.css';

type Dream = {
  id: string;
  title: string;
  content?: string;
  symbols?: string[] | any;
  createdAt: string;
  clientId?: string;
  userId?: string;
  client?: {
    id: string;
    name?: string;
  };
  source?: 'client' | 'guest' | 'psychologist' | 'other';
};

const FAVORITES_STORAGE_KEY = 'researcher_favorites_dreams';
const GUEST_DREAMS_STORAGE_KEY = 'guest_dreams';

export default function ResearcherDreams() {
  const { token } = useAuth();
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filterSource, setFilterSource] = useState<'all' | 'client' | 'guest' | 'psychologist'>('all');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Load favorites from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setFavorites(new Set(parsed));
        }
      }
    } catch (e) {
      console.error('Failed to load favorites:', e);
    }
  }, []);

  // Save favorites to localStorage
  const saveFavorites = (newFavorites: Set<string>) => {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(newFavorites)));
    } catch (e) {
      console.error('Failed to save favorites:', e);
    }
  };

  useEffect(() => {
    if (token) {
      loadDreams();
    }
  }, [token]);

  async function loadDreams() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      // Получаем все сны через эндпоинт исследователя
      const res = await api<{ items: Dream[] }>('/api/research/dreams', { token });
      
      // Обрабатываем символы (могут быть массивом или объектом)
      const processedDreams = (res.items || []).map(dream => ({
        ...dream,
        symbols: Array.isArray(dream.symbols) 
          ? dream.symbols 
          : typeof dream.symbols === 'object' && dream.symbols !== null
          ? Object.keys(dream.symbols)
          : [],
        source: 'client' as const
      }));
      
      // Загружаем сны гостей из localStorage
      const guestDreamsStr = localStorage.getItem(GUEST_DREAMS_STORAGE_KEY);
      let guestDreams: Dream[] = [];
      if (guestDreamsStr) {
        try {
          const parsed = JSON.parse(guestDreamsStr);
          if (Array.isArray(parsed)) {
            guestDreams = parsed.map((dream: any) => ({
              ...dream,
              id: `guest-${dream.id || Date.now()}-${Math.random()}`,
              source: 'guest' as const,
              symbols: Array.isArray(dream.symbols) ? dream.symbols : []
            }));
          }
        } catch (e) {
          console.error('Failed to parse guest dreams:', e);
        }
      }
      
      // Объединяем все сны
      const allDreams = [...processedDreams, ...guestDreams].sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA; // Сначала новые
      });
      
      setDreams(allDreams);
    } catch (e: any) {
      setError(e.message || 'Не удалось загрузить сны');
    } finally {
      setLoading(false);
    }
  }

  const toggleFavorite = (dreamId: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(dreamId)) {
      newFavorites.delete(dreamId);
    } else {
      newFavorites.add(dreamId);
    }
    setFavorites(newFavorites);
    saveFavorites(newFavorites);
  };

  const filtered = useMemo(() => {
    let result = dreams;
    
    // Фильтр по источнику
    if (filterSource !== 'all') {
      result = result.filter(d => d.source === filterSource);
    }
    
    // Поиск
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(d => 
        (d.title || '').toLowerCase().includes(q) || 
        (d.content || '').toLowerCase().includes(q) ||
        (Array.isArray(d.symbols) && d.symbols.some((s: string) => s.toLowerCase().includes(q)))
      );
    }
    
    return result;
  }, [dreams, query, filterSource]);

  function formatDateTime(iso: string) {
    const d = new Date(iso);
    const date = d.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
    const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return `${date} · ${time}`;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ResearcherNavbar />
      <main style={{ flex: 1, padding: '32px 48px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>💭 База снов</h1>
              <div className="small" style={{ color: 'var(--text-muted)' }}>
                Все сны в системе · {dreams.length} {dreams.length === 1 ? 'сон' : dreams.length < 5 ? 'сна' : 'снов'} · {filtered.length} {filtered.length === 1 ? 'отображается' : filtered.length < 5 ? 'отображается' : 'отображается'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {/* Фильтр по источнику */}
              <div style={{ display: 'flex', gap: 8, background: 'var(--surface-2)', padding: 4, borderRadius: 12 }}>
                {(['all', 'client', 'guest', 'psychologist'] as const).map(source => (
                  <button
                    key={source}
                    onClick={() => setFilterSource(source)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: 'none',
                      background: filterSource === source ? 'var(--primary)' : 'transparent',
                      color: filterSource === source ? '#0b0f1a' : 'var(--text)',
                      fontSize: 13,
                      fontWeight: filterSource === source ? 600 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {source === 'all' ? 'Все' : source === 'client' ? 'Клиенты' : source === 'guest' ? 'Гости' : 'Психологи'}
                  </button>
                ))}
              </div>
              <input
                placeholder="Поиск по названию, тексту или символам..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                style={{
                  width: 320,
                  padding: '10px 16px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  fontSize: 14
                }}
              />
            </div>
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: 16, padding: 12, background: 'var(--surface-2)', borderRadius: 10, color: '#ff7b7b' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <div className="small" style={{ opacity: 0.7 }}>Загрузка снов...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: 'center' }}>
            <div className="small" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
              {query ? 'Не найдено снов по запросу' : 'Нет снов в системе'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 24 }}>
            {filtered.map(dream => {
              const isFavorite = favorites.has(dream.id);
              const symbols = Array.isArray(dream.symbols) ? dream.symbols : [];
              const sourceLabel = dream.source === 'client' ? 'Клиент' : dream.source === 'guest' ? 'Гость' : dream.source === 'psychologist' ? 'Психолог' : 'Другое';
              const sourceColor = dream.source === 'client' ? '#3b82f6' : dream.source === 'guest' ? '#8b5cf6' : dream.source === 'psychologist' ? '#10b981' : '#6b7280';
              
              return (
                <div
                  key={dream.id}
                  className="card card-hover-shimmer"
                  style={{
                    padding: 28,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 18,
                    position: 'relative',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    background: 'var(--surface)',
                    border: '2px solid rgba(255,255,255,0.08)',
                    borderRadius: 20,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.25)';
                    e.currentTarget.style.borderColor = 'rgba(91, 124, 250, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                  }}
                >
                  {/* Favorite button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(dream.id);
                    }}
                    style={{
                      position: 'absolute',
                      top: 16,
                      right: 16,
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      border: 'none',
                      background: isFavorite ? 'rgba(255, 193, 7, 0.2)' : 'var(--surface-2)',
                      color: isFavorite ? '#ffc107' : 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      transition: 'all 0.2s',
                      zIndex: 10
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isFavorite ? 'rgba(255, 193, 7, 0.3)' : 'var(--surface)';
                      e.currentTarget.style.transform = 'scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isFavorite ? 'rgba(255, 193, 7, 0.2)' : 'var(--surface-2)';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                    title={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
                  >
                    {isFavorite ? '⭐' : '☆'}
                  </button>

                  {/* Source badge */}
                  <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      background: `${sourceColor}22`,
                      color: sourceColor,
                      border: `1px solid ${sourceColor}44`
                    }}>
                      {sourceLabel}
                    </span>
                  </div>

                  {/* Title */}
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 10, paddingRight: 100, lineHeight: 1.4, color: 'var(--text)' }}>
                      {dream.title || 'Без названия'}
                    </div>
                    {dream.client?.name && (
                      <div className="small" style={{ color: 'var(--text-muted)', opacity: 0.9, fontSize: 13 }}>
                        👤 {dream.client.name}
                      </div>
                    )}
                  </div>

                  {/* Symbols */}
                  {symbols.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {symbols.slice(0, 8).map((symbol: string, idx: number) => (
                        <span
                          key={idx}
                          className="small"
                          style={{
                            background: 'var(--surface-2)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            padding: '4px 12px',
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 500
                          }}
                        >
                          {symbol}
                        </span>
                      ))}
                      {symbols.length > 8 && (
                        <span className="small" style={{ opacity: 0.7, alignSelf: 'center' }}>
                          +{symbols.length - 8}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Content */}
                  {dream.content && (
                    <div
                      style={{
                        color: 'rgba(255,255,255,0.85)',
                        lineHeight: 1.8,
                        fontSize: 15,
                        maxHeight: 160,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 6,
                        WebkitBoxOrient: 'vertical',
                        opacity: 0.9,
                        marginTop: 4
                      }}
                    >
                      {dream.content}
                    </div>
                  )}

                  {/* Date and favorite */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="small" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      📅 {formatDateTime(dream.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
