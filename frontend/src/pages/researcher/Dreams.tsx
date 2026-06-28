import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ResearcherNavbar } from '../../components/ResearcherNavbar';
import { PlatformIcon } from '../../components/icons';
import { anonymizeText } from '../../utils/anonymizeText';
import '../../styles/tokens.css';
import './Dreams.css';

type Dream = {
  id: string;
  title: string;
  content?: string;
  symbols?: string[] | any;
  symbolsStatus?: string;
  createdAt: string;
  clientId?: string;
  participantLabel?: string;
  userId?: string;
  source?: 'client' | 'guest' | 'psychologist' | 'other';
};

const FAVORITES_STORAGE_KEY = 'researcher_favorites_dreams';
const GUEST_DREAMS_STORAGE_KEY = 'guest_dreams';

function participantCodeFromQuery(q: string): string | null {
  const trimmed = q.trim();
  const hashMatch = trimmed.match(/^#([A-Za-z0-9]{4,})$/);
  if (hashMatch) return hashMatch[1].toUpperCase();
  if (/^[A-Za-z0-9]{6}$/.test(trimmed)) return trimmed.toUpperCase();
  return null;
}

function dreamParticipantCode(d: Dream): string | null {
  if (!d.clientId) return null;
  return String(d.clientId).slice(-6).toUpperCase();
}

export default function ResearcherDreams() {
  const { token } = useAuth();
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filterSource, setFilterSource] = useState<'all' | 'client' | 'guest' | 'psychologist'>('all');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [selectedDream, setSelectedDream] = useState<Dream | null>(null);

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

  useEffect(() => {
    const hasPending = dreams.some(
      d => d.source !== 'guest' && (d.symbolsStatus === 'pending' || d.symbolsStatus === 'processing')
    );
    if (!hasPending || !token) return;
    const t = window.setInterval(() => loadDreams(), 15000);
    return () => window.clearInterval(t);
  }, [dreams, token]);

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
              id: `guest-${dream.id || Date.now()}-${Math.random()}`,
              title: anonymizeText(dream.title || 'Без названия'),
              content: anonymizeText(dream.content),
              createdAt: dream.createdAt || new Date().toISOString(),
              source: 'guest' as const,
              symbols: Array.isArray(dream.symbols) ? dream.symbols : []
            }));
          }
        } catch (e) {
          console.error('Failed to parse guest dreams:', e);
        }
      }
      
      // Объединяем все сны (сортировка — в filtered: избранное, затем дата)
      const allDreams = [...processedDreams, ...guestDreams];
      
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
    
    const q = query.trim();
    const participantCode = participantCodeFromQuery(q);

    if (participantCode) {
      result = result.filter((d) => dreamParticipantCode(d) === participantCode);
    } else if (q) {
      const qLower = q.toLowerCase();
      result = result.filter(d => 
        (d.title || '').toLowerCase().includes(qLower) || 
        (d.content || '').toLowerCase().includes(qLower) ||
        (d.participantLabel || '').toLowerCase().includes(qLower) ||
        (Array.isArray(d.symbols) && d.symbols.some((s: string) => String(s).toLowerCase().includes(qLower)))
      );
    }

    return [...result].sort((a, b) => {
      const favA = favorites.has(a.id) ? 1 : 0;
      const favB = favorites.has(b.id) ? 1 : 0;
      if (favB !== favA) return favB - favA;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [dreams, query, filterSource, favorites]);

  function formatDateTime(iso: string) {
    const d = new Date(iso);
    const date = d.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
    const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return `${date} · ${time}`;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ResearcherNavbar />
      <main
        style={{
          flex: 1,
          padding: '24px clamp(16px, 5vw, 48px)',
          maxWidth: 1400,
          margin: '0 auto',
          width: '100%'
        }}
      >
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: 'var(--primary)', display: 'inline-flex' }}>
                  <PlatformIcon name="dreams" size={34} strokeWidth={1.5} />
                </span>
                База снов
              </h1>
              <div className="small" style={{ color: 'var(--text-muted)' }}>
                Агрегированный каталог снов платформы · {dreams.length}{' '}
                {dreams.length === 1 ? 'запись' : dreams.length < 5 ? 'записи' : 'записей'}
                {filtered.length !== dreams.length && ` · показано ${filtered.length}`}
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
                placeholder="Поиск… или #VKA8VD (номер участника)"
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

        <div className="researcher-dreams-pii-note">
          Тексты обезличены: имена, города и контакты заменены на маркеры [имя], [место] и т.п. Нажмите на карточку, чтобы прочитать полный текст.
        </div>

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
              const symbolsPending = dream.symbolsStatus === 'pending' || dream.symbolsStatus === 'processing';
              const symbolsFailed = dream.symbolsStatus === 'failed';
              const sourceLabel = dream.source === 'client' ? 'Клиент' : dream.source === 'guest' ? 'Гость' : dream.source === 'psychologist' ? 'Психолог' : 'Другое';
              const sourceColor = dream.source === 'client' ? '#3b82f6' : dream.source === 'guest' ? '#8b5cf6' : dream.source === 'psychologist' ? '#10b981' : '#6b7280';
              
              return (
                <div
                  key={dream.id}
                  className="card card-hover-shimmer researcher-dreams-card"
                  style={{
                    padding: 28,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 18,
                    position: 'relative',
                    transition: 'all 0.3s ease',
                    background: 'var(--surface)',
                    border: '2px solid rgba(255,255,255,0.08)',
                    borderRadius: 20,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
                  }}
                  onClick={() => setSelectedDream(dream)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDream(dream); } }}
                  role="button"
                  tabIndex={0}
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
                    {(dream.participantLabel || dream.clientId) && (
                      <div className="small" style={{ color: 'var(--text-muted)', opacity: 0.9, fontSize: 13 }}>
                        {dream.participantLabel || `Участник #${dream.clientId!.slice(-6).toUpperCase()}`}
                      </div>
                    )}
                  </div>

                  {/* Symbols */}
                  {symbolsPending && (
                    <div className="small" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Символы извлекаются через ИИ…
                    </div>
                  )}
                  {symbolsFailed && (
                    <div className="small" style={{ color: '#f59e0b' }}>
                      Не удалось извлечь символы — повторная попытка автоматически
                    </div>
                  )}
                  {!symbolsPending && !symbolsFailed && symbols.length > 0 && (
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
                    <>
                      <div className="researcher-dreams-card__content">
                        {dream.content}
                      </div>
                      {dream.content.length > 180 && (
                        <div className="researcher-dreams-card__more">Читать полностью →</div>
                      )}
                    </>
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

      {selectedDream && (
        <div
          className="researcher-dreams-modal-overlay"
          onClick={() => setSelectedDream(null)}
          role="presentation"
        >
          <div
            className="researcher-dreams-modal"
            style={{ position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dream-modal-title"
          >
            <button
              type="button"
              className="researcher-dreams-modal__close"
              onClick={() => setSelectedDream(null)}
              aria-label="Закрыть"
            >
              ×
            </button>
            <h2 id="dream-modal-title" className="researcher-dreams-modal__title">
              {selectedDream.title || 'Без названия'}
            </h2>
            {selectedDream.participantLabel && (
              <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
                {selectedDream.participantLabel}
              </div>
            )}
            <div className="researcher-dreams-modal__body">
              {selectedDream.content || 'Нет текста'}
            </div>
            <div className="small" style={{ color: 'var(--text-muted)', marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              {formatDateTime(selectedDream.createdAt)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
