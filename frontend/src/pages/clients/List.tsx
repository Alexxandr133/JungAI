import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';
import { VerificationRequired } from '../../components/VerificationRequired';
import { checkVerification } from '../../utils/verification';
import type { VerificationStatus } from '../../utils/verification';

export default function ClientsList() {
  const { token } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  
  const getAvatarUrl = (url: string | null | undefined, clientId?: string) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const env = (import.meta as any).env || {};
    let baseOrigin: string = env.VITE_API_ORIGIN || env.VITE_API_URL || '';
    if (!baseOrigin && env.DEV && typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port !== '4000') {
      baseOrigin = 'http://localhost:4000';
    }
    if (!baseOrigin && typeof window !== 'undefined') {
      baseOrigin = window.location.origin;
    }
    // Добавляем параметры для предотвращения кэширования и уникальности для каждого клиента
    const separator = url.includes('?') ? '&' : '?';
    const params = new URLSearchParams();
    if (clientId) params.set('clientId', clientId);
    params.set('t', Date.now().toString());
    return `${baseOrigin}${url}${separator}${params.toString()}`;
  };
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [tags, setTags] = useState<{ label: string; color: string }[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tagColor, setTagColor] = useState('#7c5cff');
  const [showModal, setShowModal] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createdClientLink, setCreatedClientLink] = useState<string | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const location = useLocation();
  function saveItemsToStorage(data: any[]) {
    try { localStorage.setItem('clients.items', JSON.stringify(data)); } catch {}
  }
  function readItemsFromStorage(): any[] {
    try {
      const raw = localStorage.getItem('clients.items');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  function readOverrides(): Record<string, any> {
    try { const raw = localStorage.getItem('clients.overrides'); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  }
  function saveOverrides(map: Record<string, any>) {
    try { localStorage.setItem('clients.overrides', JSON.stringify(map)); } catch {}
  }
  function saveDeletedToStorage(ids: string[]) {
    try { localStorage.setItem('clients.deletedIds', JSON.stringify(ids)); } catch {}
  }
  function readDeletedFromStorage(): string[] {
    try {
      const raw = localStorage.getItem('clients.deletedIds');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch { return []; }
  }

  // Tag system: presets, selection and mode
  const PRESET_TAGS: { label: string; color: string }[] = [
    { label: 'Тревога', color: '#ffcc66' },
    { label: 'PTSD', color: '#ff6b6b' },
    { label: 'Сноведение', color: '#19e0ff' },
    { label: 'Депрессия', color: '#7c5cff' },
    { label: 'Анима', color: '#00d1b2' },
    { label: 'Тень', color: '#ff8b94' },
  ];
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  function hashColorFromLabel(label: string): string {
    const palette = ['#ff6b6b', '#ffcc66', '#19e0ff', '#7c5cff', '#3ddc97', '#f08cff', '#ffd166'];
    let h = 0;
    for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  }
  function getColorForLabel(label: string): string {
    const preset = PRESET_TAGS.find(t => t.label.toLowerCase() === label.trim().toLowerCase());
    return preset?.color || hashColorFromLabel(label);
  }

  async function load() {
    const demo: any[] = [
      { id: 'c1', name: 'Иван Петров', email: 'ivan@example.com', phone: '+7 900 111-22-33', age: 34, city: 'Москва', tags: [{ label: 'PTSD', color: '#ff6b6b' }, { label: 'Сноведение', color: '#19e0ff' }] },
      { id: 'c2', name: 'Анна Смирнова', email: 'anna@example.com', phone: '+7 900 222-33-44', age: 29, city: 'СПб', tags: [{ label: 'Тревога', color: '#ffcc66' }] },
      { id: 'c3', name: 'Мария Коваль', email: 'maria@example.com', phone: '+7 900 333-44-55', age: 41, city: 'Казань', tags: [{ label: 'Депрессия', color: '#7c5cff' }] },
    ];
    const stored = readItemsFromStorage();
    const deletedIds = new Set(readDeletedFromStorage());
    if (!token) {
      // fallback demo data when unauthenticated / backend unavailable
      const local = (stored.length > 0 ? stored : demo).filter(c => !deletedIds.has(String(c.id)));
      setItems(local);
      setError(null);
      return;
    }
    try {
      const res = await api<{ items: any[] }>('/api/clients', { token });
      // Обогащаем карточки витринными полями, если их нет в БД
      const enriched = (res.items || []).map((c, idx) => ({
        ...c,
        city: c.city ?? ['Москва', 'СПб', 'Казань', 'Екатеринбург', 'Новосибирск'][idx % 5],
        age: c.age ?? (28 + (idx % 12)),
        tags: Array.isArray(c.tags) && c.tags.length > 0 ? c.tags : [
          { label: ['Тревога', 'PTSD', 'Сноведение', 'Депрессия'][idx % 4], color: ['#ffcc66', '#ff6b6b', '#19e0ff', '#7c5cff'][idx % 4] }
        ],
      }));
      // apply local overrides (e.g., custom tags) for server ids
      const overrides = readOverrides();
      const withOverrides = enriched.map(c => overrides[c.id] ? { ...c, ...overrides[c.id] } : c);
      // merge stored local clients (created offline) with server ones by id
      // Приоритет у данных с сервера - они идут первыми
      const serverIds = new Set(withOverrides.map(c => String(c.id)));
      const byId: Record<string, any> = {};
      // Сначала добавляем данные с сервера (приоритет)
      withOverrides.forEach(it => { byId[String(it.id)] = it; });
      // Затем добавляем только локальные клиенты, которых нет на сервере (созданные оффлайн)
      stored.forEach(it => {
        if (!serverIds.has(String(it.id))) {
          byId[String(it.id)] = it;
        }
      });
      const combined = Object.values(byId).filter(it => !deletedIds.has(String(it.id)));
      setItems(combined.length > 0 ? combined : demo);
      setError(null);
    } catch (e: any) {
      // backend not reachable or 404 -> show demo data
      const local = (stored.length > 0 ? stored : demo).filter(c => !deletedIds.has(String(c.id)));
      setItems(local);
      setError(null);
    }
  }

  // Check verification status
  useEffect(() => {
    if (!token) {
      setIsVerified(null);
      return;
    }
    
    checkVerification(token).then(result => {
      setIsVerified(result.isVerified);
      setVerificationStatus(result.status);
    });
  }, [token]);

  useEffect(() => {
    if (isVerified !== false) {
      load();
    }
  }, [token, isVerified]);

  // Обновление данных при возврате на страницу
  useEffect(() => {
    if (isVerified !== false) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, isVerified]);

  // Обновление данных при фокусе окна (когда пользователь возвращается на вкладку)
  useEffect(() => {
    const handleFocus = () => {
      if (isVerified !== false && token) {
        load();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isVerified]);

  // Initialize tag filters from URL or localStorage
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlTags = params.get('tags');
    const stored = localStorage.getItem('clients.tagFilter');
    if (urlTags) setSelectedTags(urlTags.split(',').filter(Boolean));
    else if (stored) {
      try { const parsed = JSON.parse(stored); if (Array.isArray(parsed?.tags)) setSelectedTags(parsed.tags); } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist tag filters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (selectedTags.length > 0) params.set('tags', selectedTags.join(',')); else params.delete('tags');
    const qs = params.toString();
    window.history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}`);
    localStorage.setItem('clients.tagFilter', JSON.stringify({ tags: selectedTags }));
  }, [selectedTags, location.pathname, location.search]);

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const normalizedTags = tags.map(t => ({ label: t.label.trim(), color: t.color }));
    const newClient = { id: Math.random().toString(36).slice(2), name, email, phone, age: age ? Number(age) : undefined, city, tags: normalizedTags };
    if (!token) {
      // local add in demo mode
      setItems(prev => { const next = [newClient, ...prev]; saveItemsToStorage(next); return next; });
      // ensure new id is not considered deleted
      const ids = readDeletedFromStorage().filter(x => x !== newClient.id);
      saveDeletedToStorage(ids);
      setName(''); setUsername(''); setEmail(''); setPhone(''); setAge(''); setCity(''); setTags([]); setTagInput('');
      setShowModal(false);
      return;
    }
    try {
      const created = await api<any>('/api/clients', { method: 'POST', token: token, body: { name, username, email, phone, age: age ? Number(age) : undefined, city, tags: normalizedTags } });
      const serverId = created?.id || newClient.id;
      const clientFinal = { ...newClient, id: serverId };
      // optimistic update to preserve chosen tags immediately
      setItems(prev => { const next = [clientFinal, ...prev.filter(c => c.id !== serverId)]; saveItemsToStorage(next); return next; });
      const ids = readDeletedFromStorage().filter(x => x !== serverId);
      saveDeletedToStorage(ids);
      // store overrides for server entity (e.g., tags, city, age) to prevent fallback overwriting
      const overrides = readOverrides();
      overrides[serverId] = { tags: normalizedTags, city, age: age ? Number(age) : undefined };
      saveOverrides(overrides);
      setName(''); setUsername(''); setEmail(''); setPhone(''); setAge(''); setCity(''); setTags([]); setTagInput('');
      setShowModal(false);
      
      // Показываем ссылку для регистрации
      if (created?.registrationLink) {
        setCreatedClientLink(created.registrationLink);
        setShowLinkModal(true);
      }
    } catch (e: any) {
      // still add locally so UI is usable
      setItems(prev => { const next = [newClient, ...prev]; saveItemsToStorage(next); return next; });
      const ids = readDeletedFromStorage().filter(x => x !== newClient.id);
      saveDeletedToStorage(ids);
      setName(''); setUsername(''); setEmail(''); setPhone(''); setAge(''); setCity(''); setTags([]); setTagInput('');
      setShowModal(false);
    }
  }

  async function deleteClient(id: string) {
    if (!token) {
      setItems(prev => { const next = prev.filter(c => c.id !== id); saveItemsToStorage(next); return next; });
      const ids = Array.from(new Set([...readDeletedFromStorage(), String(id)]));
      saveDeletedToStorage(ids);
      return;
    }
    try {
      await api(`/api/clients/${id}`, { method: 'DELETE', token });
      setItems(prev => { const next = prev.filter(c => c.id !== id); saveItemsToStorage(next); return next; });
      const ids = Array.from(new Set([...readDeletedFromStorage(), String(id)]));
      saveDeletedToStorage(ids);
    } catch (e) {
      // noop: keep UI responsive
      setItems(prev => { const next = prev.filter(c => c.id !== id); saveItemsToStorage(next); return next; });
      const ids = Array.from(new Set([...readDeletedFromStorage(), String(id)]));
      saveDeletedToStorage(ids);
    }
  }

  function addTag(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    const color = tagColor || getColorForLabel(trimmed);
    setTags(prev => [...prev, { label: trimmed, color }]);
    setTagInput('');
  }

  function removeTag(index: number) {
    setTags(prev => prev.filter((_, i) => i !== index));
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    // Search is handled by the query state and filteredItems logic below
  }

  // Derived: all tags in dataset and filtered items
  const allExistingTags: string[] = Array.from(new Set(items.flatMap(c => (Array.isArray(c.tags) ? c.tags.map((t: any) => String(t.label)) : []))));
  const filtersToUse = Array.from(new Set([...selectedTags]));
  const queryLower = query.toLowerCase().trim();
  const filteredItems = items.filter(c => {
    // Filter by tags
    if (filtersToUse.length > 0) {
      const labels: string[] = Array.isArray(c.tags) ? c.tags.map((t: any) => String(t.label)) : [];
      if (!filtersToUse.some(t => labels.includes(t))) return false;
    }
    // Filter by query (search in name, email, phone, city)
    if (queryLower) {
      const searchable = [
        c.name || '',
        c.email || '',
        c.phone || '',
        c.city || '',
        ...(Array.isArray(c.tags) ? c.tags.map((t: any) => String(t.label)) : [])
      ].join(' ').toLowerCase();
      if (!searchable.includes(queryLower)) return false;
    }
    return true;
  });

  // Show verification required message
  if (token && isVerified === false) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <PsychologistNavbar />
        <VerificationRequired verificationStatus={verificationStatus} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PsychologistNavbar />
      <main style={{ flex: 1, padding: '32px 48px', maxWidth: '100%', overflowX: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Мои клиенты</h1>
            <form onSubmit={onSearch} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, maxWidth: 600 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: 12, top: 10, opacity: .7 }}>🔎</span>
                <input style={{ width: '100%', padding: '10px 12px 10px 34px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', minWidth: 0 }} placeholder="Поиск: клиенты, сны, архетипы" value={query} onChange={e => setQuery(e.target.value)} />
              </div>
            </form>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button className="button secondary" onClick={() => load()} style={{ padding: '10px 20px' }} title="Обновить данные">🔄</button>
            <button className="button" onClick={() => setShowModal(true)} style={{ padding: '10px 20px' }}>Добавить клиента</button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <span className="small" style={{ color: 'var(--text-muted)' }}>Показано: {filteredItems.length}<span style={{ opacity: .6 }}>/ {items.length}</span></span>
        </div>
        {error && <div style={{ color: 'red', marginTop: 10 }}>{error}</div>}

        {/* Tag filters */}
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="small" style={{ opacity: .8 }}>Фильтр по тегам:</div>
          {[...PRESET_TAGS, ...allExistingTags.filter(l => !PRESET_TAGS.some(p => p.label === l)).map(l => ({ label: l, color: getColorForLabel(l) }))].slice(0, 24).map(t => {
            const active = selectedTags.includes(t.label);
            return (
              <button key={t.label} onClick={() => setSelectedTags(prev => active ? prev.filter(x => x !== t.label) : [...prev, t.label])} className={active ? 'button' : 'button secondary'} style={{ padding: '4px 8px', fontSize: 12, color: t.color }}>
                {t.label}
              </button>
            );
          })}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {selectedTags.length > 0 && <button className="button danger" onClick={() => setSelectedTags([])} style={{ padding: '4px 8px', fontSize: 12 }}>Сбросить</button>}
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {filteredItems.map(c => (
            <div key={c.id} className="card" style={{ padding: 16, display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14, alignItems: 'center' }}>
                {getAvatarUrl(c.avatarUrl || c.profile?.avatarUrl, c.id) ? (
                  <img
                    src={getAvatarUrl(c.avatarUrl || c.profile?.avatarUrl, c.id) || ''}
                    key={`avatar-${c.id}-${c.avatarUrl || c.profile?.avatarUrl || 'none'}`}
                    alt={c.name || 'Аватар'}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid rgba(255,255,255,0.1)'
                    }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent && !parent.querySelector('.avatar-fallback')) {
                        const fallback = document.createElement('div');
                        fallback.className = 'avatar-fallback';
                        fallback.style.cssText = 'width: 48px; height: 48px; border-radius: 999px; background: linear-gradient(135deg, var(--primary), var(--accent)); color: #0b0f1a; display: grid; place-items: center; font-weight: 800;';
                        fallback.textContent = (c.name || '?').trim().charAt(0).toUpperCase();
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: 999, background: 'linear-gradient(135deg, var(--primary), var(--accent))', color: '#0b0f1a', display: 'grid', placeItems: 'center', fontWeight: 800 }}>
                    {(c.name || '?').trim().charAt(0).toUpperCase()}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{c.name}</div>
                  <div className="small" style={{ color: 'var(--text-muted)' }}>{c.city || '—'}{c.age ? ` • ${c.age} лет` : ''}</div>
                </div>
              </div>
              {c.email && <div className="small" style={{ wordBreak: 'break-word' }}>{c.email}</div>}
              {c.phone && <div className="small" style={{ color: 'var(--text-muted)' }}>{c.phone}</div>}
              {Array.isArray(c.tags) && c.tags.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {c.tags.map((t: any, idx: number) => (
                    <span key={idx} className="small" style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: 999, color: t.color }}>{t.label}</span>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <Link to={`/clients/${c.id}/profile`} className="button secondary" style={{ padding: '6px 10px', fontSize: 13 }}>Профиль</Link>
                <Link to={`/psychologist/work-area?client=${c.id}`} className="button" style={{ padding: '6px 10px', fontSize: 13 }}>Рабочая область</Link>
                <button onClick={() => deleteClient(c.id)} className="button danger" style={{ padding: '6px 10px', marginLeft: 'auto', fontSize: 13 }}>Удалить</button>
              </div>
            </div>
          ))}

          {items.length === 0 && (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Пока нет клиентов</div>
              <div className="small">Добавьте первого клиента с помощью формы ниже.</div>
            </div>
          )}
        </div>

        {/* Modal for showing registration link */}
        {showLinkModal && createdClientLink && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,8,16,0.75)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', zIndex: 1001, padding: 16 }} onClick={() => { setShowLinkModal(false); setCreatedClientLink(null); }}>
            <div className="card" style={{ width: 'min(600px, 94vw)', padding: 24, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 60px rgba(0,0,0,0.45)', borderRadius: 16 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 20 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Клиент создан!</div>
                  <div className="small" style={{ color: 'var(--text-muted)' }}>Отправьте эту ссылку клиенту для регистрации</div>
                </div>
                <button className="button secondary" onClick={() => { setShowLinkModal(false); setCreatedClientLink(null); }} style={{ padding: '6px 10px', fontSize: 13 }}>✕</button>
              </div>
              
              <div style={{ marginBottom: 16 }}>
                <div className="small" style={{ marginBottom: 8, color: 'var(--text-muted)' }}>Ссылка для регистрации:</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input 
                    readOnly
                    value={createdClientLink}
                    style={{ 
                      flex: 1, 
                      padding: '12px 16px', 
                      borderRadius: 10, 
                      border: '1px solid rgba(255,255,255,0.12)', 
                      background: 'var(--surface-2)', 
                      color: 'var(--text)',
                      fontSize: 13,
                      fontFamily: 'monospace'
                    }}
                  />
                  <button
                    className="button"
                    onClick={() => {
                      navigator.clipboard.writeText(createdClientLink);
                      alert('Ссылка скопирована!');
                    }}
                    style={{ padding: '12px 20px', fontSize: 13, whiteSpace: 'nowrap' }}
                  >
                    Копировать
                  </button>
                </div>
              </div>
              
              <div style={{ padding: 12, background: 'rgba(91, 124, 250, 0.1)', borderRadius: 10, border: '1px solid rgba(91, 124, 250, 0.2)' }}>
                <div className="small" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  <strong>Важно:</strong> Клиент должен пройти регистрацию по этой ссылке, чтобы получить доступ к своему профилю. 
                  Ссылка действительна 7 дней.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal for adding client */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,8,16,0.75)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 16 }} onClick={() => setShowModal(false)}>
            <div className="card" style={{ width: 'min(720px, 94vw)', padding: 20, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 60px rgba(0,0,0,0.45)', borderRadius: 16 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontWeight: 800 }}>Добавить клиента</div>
                <button className="button secondary" onClick={() => setShowModal(false)} style={{ padding: '6px 10px', fontSize: 13 }}>Закрыть</button>
              </div>
              <form onSubmit={createClient} style={{ display: 'grid', gap: 12, marginTop: 12 }}>
                <div>
                  <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)' }}>Логин *</div>
                  <input 
                    placeholder="Логин для регистрации" 
                    value={username} 
                    onChange={e => setUsername(e.target.value)} 
                    required
                    minLength={3}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)' }} 
                  />
                  <div className="small" style={{ marginTop: 4, color: 'var(--text-muted)' }}>
                    Минимум 3 символа. Будет использован для входа клиента
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <input placeholder="Имя" value={name} onChange={e => setName(e.target.value)} required style={{ padding: '10px 12px', borderRadius: 10 }} />
                  <input placeholder="Город" value={city} onChange={e => setCity(e.target.value)} style={{ padding: '10px 12px', borderRadius: 10 }} />
                  <input placeholder="Email (опционально)" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: '10px 12px', borderRadius: 10 }} />
                  <input placeholder="Телефон" value={phone} onChange={e => setPhone(e.target.value)} style={{ padding: '10px 12px', borderRadius: 10 }} />
                  <input placeholder="Возраст" value={age} onChange={e => setAge(e.target.value)} style={{ padding: '10px 12px', borderRadius: 10 }} />
                </div>
                <div>
                  <div className="small" style={{ marginBottom: 6 }}>Теги</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input placeholder="Новый тег" value={tagInput} onChange={e => setTagInput(e.target.value)} style={{ flex: '1 1 200px', padding: '10px 12px', borderRadius: 10 }} />
                    <input type="color" value={tagColor} onChange={e => setTagColor(e.target.value)} title="Цвет тега" />
                    <button type="button" className="button secondary" onClick={addTag} style={{ padding: '6px 10px', fontSize: 13 }}>Добавить тег</button>
                  </div>
                  {/* Suggestions */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {PRESET_TAGS.map(s => (
                      <button key={s.label} type="button" className="button secondary" style={{ padding: '4px 8px', fontSize: 12, color: s.color }} onClick={() => { setTags(prev => [...prev, { label: s.label, color: s.color }]); }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                  {tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      {tags.map((t, i) => (
                        <span key={`${t.label}-${i}`} className="small" style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.08)', padding: '4px 10px', borderRadius: 999, color: t.color, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          {t.label}
                          <button type="button" onClick={() => removeTag(i)} style={{ background: 'transparent', border: 'none', color: t.color, cursor: 'pointer' }}>✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" className="button secondary" onClick={() => setShowModal(false)} style={{ padding: '8px 12px', fontSize: 13 }}>Отмена</button>
                  <button className="button" type="submit" style={{ padding: '8px 12px', fontSize: 13 }}>Создать</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
