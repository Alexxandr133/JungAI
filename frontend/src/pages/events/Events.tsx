import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';
import { VerificationRequired } from '../../components/VerificationRequired';
import { checkVerification } from '../../utils/verification';
import type { VerificationStatus } from '../../utils/verification';

export default function EventsPage() {
  const { token, user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('call');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [durationMin, setDurationMin] = useState<number>(50);
  const [submitting, setSubmitting] = useState(false);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clients, setClients] = useState<Array<{ id: string; name: string; email?: string }>>([]);
  const [viewMode, setViewMode] = useState<'agenda' | 'week' | 'month'>(() => (localStorage.getItem('events.view') as any) || 'agenda');
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [requiresAttention, setRequiresAttention] = useState<{
    clientsWithoutSessions: Array<{ id: string; name: string }>;
  } | null>(null);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const [startingEvents, setStartingEvents] = useState<Record<string, boolean>>({});
  
  const TYPE_OPTIONS = [
    { value: 'call', label: 'Звонок' },
    { value: 'video', label: 'Видеовстреча' },
    { value: 'supervision', label: 'Супервизия' },
    { value: 'webinar', label: 'Вебинар' },
    { value: 'session', label: 'Сессия' },
  ];
  const typeLabel = (v: string) => TYPE_OPTIONS.find(o => o.value === v)?.label || v;

  async function load() {
    try {
      const res = await api<{ items: any[] }>('/api/events', { token: token ?? undefined });
      const incoming = res.items || [];
      setItems(incoming);
    } catch (e: any) { setError(e.message || 'Failed to load'); }
  }

  async function loadClients() {
    if (!token || (user?.role !== 'psychologist' && user?.role !== 'admin')) return;
    try {
      const res = await api<{ items: Array<{ id: string; name: string; email?: string }> }>('/api/clients', { token });
      setClients(res.items || []);
    } catch (e: any) {
      console.error('Failed to load clients:', e);
    }
  }

  async function loadRequiresAttention() {
    if (!token || (user?.role !== 'psychologist' && user?.role !== 'admin')) return;
    try {
      const res = await api<{ requiresAttention: { clientsWithoutSessions: Array<{ id: string; name: string }> } }>('/api/analytics/dashboard', { token });
      setRequiresAttention(res.requiresAttention);
    } catch (e: any) {
      console.error('Failed to load requires attention:', e);
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
  useEffect(() => { loadClients(); }, [token, user]);
  useEffect(() => { loadRequiresAttention(); }, [token, user]);

  async function createEvent(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try {
      setSubmitting(true);
      await api('/api/events', { method: 'POST', token: token ?? undefined, body: { title, type, description, startsAt, endsAt: endsAt || null, clientId: type === 'session' ? selectedClientId : null } });
      setTitle(''); setDescription(''); setStartsAt(''); setEndsAt(''); setSelectedClientId('');
      setShowModal(false);
      await load();
      await loadRequiresAttention();
    } catch (e: any) { setError(e.message || 'Failed to create'); } finally { setSubmitting(false); }
  }

  function openCreateSessionForClient(clientId: string, clientName: string) {
    setSelectedClientId(clientId);
    setType('session');
    setTitle(`Сессия с ${clientName}`);
    // Устанавливаем время на завтра в 10:00 по умолчанию
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    setStartsAt(`${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T${pad(tomorrow.getHours())}:${pad(tomorrow.getMinutes())}`);
    setShowModal(true);
  }

  async function deleteEvent(id: string) {
    if (!confirm('Удалить событие?')) return;
    setError(null);
    try {
      await api(`/api/events/${id}`, { method: 'DELETE', token: token ?? undefined });
      await load();
    } catch (e: any) { setError(e.message || 'Failed to delete'); }
  }

  async function startEventEarly(id: string) {
    if (!token) return;
    setStartingEvents(prev => ({ ...prev, [id]: true }));
    try {
      const updated = await api(`/api/events/${id}/start-early`, { method: 'POST', token });
      // Обновляем локальное состояние
      setItems(prev => prev.map(ev => ev.id === id ? updated : ev));
    } catch (e: any) {
      setError(e.message || 'Не удалось начать сессию');
    } finally {
      setStartingEvents(prev => ({ ...prev, [id]: false }));
    }
  }

  const canCreate = user?.role === 'psychologist' || user?.role === 'researcher' || user?.role === 'admin';


  useEffect(() => { try { localStorage.setItem('events.view', viewMode); } catch {} }, [viewMode]);

  // Helpers for modal
  function toLocalInputValue(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function addMinutesToLocal(input: string, mins: number): string {
    const base = new Date(input);
    if (isNaN(base.getTime())) return '';
    const end = new Date(base.getTime() + mins * 60000);
    return toLocalInputValue(end);
  }
  useEffect(() => {
    if (startsAt && durationMin) {
      setEndsAt(addMinutesToLocal(startsAt, durationMin));
    }
  }, [startsAt, durationMin]);

  // Modal a11y: autofocus and Esc close
  useEffect(() => {
    if (showModal) {
      const t = setTimeout(() => titleRef.current?.focus(), 50);
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false); };
      window.addEventListener('keydown', onKey);
      return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
    }
  }, [showModal]);


  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    // Search is handled by the query state and filtering logic below
  }

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    let filtered = items;
    
    // Filter by type
    if (typeFilters.length) {
      filtered = filtered.filter(ev => typeFilters.includes(String(ev.type)));
    }
    
    // Filter by query (search in title, description, type)
    const queryLower = query.toLowerCase().trim();
    if (queryLower) {
      filtered = filtered.filter(ev => {
        const searchable = [
          ev.title || '',
          ev.description || '',
          typeLabel(String(ev.type)),
          ev.clientId || ''
        ].join(' ').toLowerCase();
        return searchable.includes(queryLower);
      });
    }
    
    for (const ev of filtered) {
      const d = new Date(ev.startsAt);
      const key = d.toISOString().slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b));
  }, [items, typeFilters, query]);

  // Helpers for calendar navigation
  function startOfWeek(d: Date): Date {
    const dt = new Date(d);
    const day = dt.getDay() || 7; // Monday as first, getDay Sunday=0
    if (day !== 1) dt.setDate(dt.getDate() - (day - 1));
    dt.setHours(0,0,0,0);
    return dt;
  }
  function addDays(d: Date, n: number): Date { const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt; }
  function addWeeks(d: Date, n: number): Date { return addDays(d, n * 7); }
  function addMonths(d: Date, n: number): Date { const dt = new Date(d); dt.setMonth(dt.getMonth() + n); return dt; }
  function startOfMonth(d: Date): Date { const dt = new Date(d.getFullYear(), d.getMonth(), 1); dt.setHours(0,0,0,0); return dt; }
  // demo generator removed
  function formatRangeTitle(): string {
    if (viewMode === 'week') {
      const s = startOfWeek(anchorDate);
      const e = addDays(s, 6);
      return `${s.toLocaleDateString()} – ${e.toLocaleDateString()}`;
    }
    if (viewMode === 'month') {
      return anchorDate.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    }
    return 'Список';
  }

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
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Сессии и встречи</h1>
            <span className="small" style={{ color: 'var(--text-muted)' }}>Часовой пояс: {Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <div title="Уведомления" style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', position: 'relative', cursor: 'pointer' }}>🔔</div>
            <div title="Сообщения" style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', position: 'relative', cursor: 'pointer' }}>💬</div>
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <form onSubmit={onSearch} style={{ display: 'flex', gap: 8, alignItems: 'center', maxWidth: 600 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <span style={{ position: 'absolute', left: 12, top: 10, opacity: .7 }}>🔎</span>
              <input style={{ width: '100%', padding: '10px 12px 10px 34px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', minWidth: 0 }} placeholder="Поиск: клиенты, сны, архетипы" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
          </form>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button className="button secondary" onClick={() => { setAnchorDate(new Date()); }} style={{ padding: '6px 10px', fontSize: 13 }}>Сегодня</button>
            <button className="button secondary" onClick={() => setAnchorDate(prev => viewMode === 'month' ? addMonths(prev, -1) : addWeeks(prev, -1))} style={{ padding: '6px 10px', fontSize: 13 }}>‹</button>
            <div className="small" style={{ minWidth: 180, textAlign: 'center' }}>{formatRangeTitle()}</div>
            <button className="button secondary" onClick={() => setAnchorDate(prev => viewMode === 'month' ? addMonths(prev, 1) : addWeeks(prev, 1))} style={{ padding: '6px 10px', fontSize: 13 }}>›</button>
            <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.12)', margin: '0 6px' }} />
            <button className={viewMode === 'agenda' ? 'button' : 'button secondary'} onClick={() => setViewMode('agenda')} style={{ padding: '6px 10px', fontSize: 13 }}>Список</button>
            <button className={viewMode === 'week' ? 'button' : 'button secondary'} onClick={() => setViewMode('week')} style={{ padding: '6px 10px', fontSize: 13 }}>Неделя</button>
            <button className={viewMode === 'month' ? 'button' : 'button secondary'} onClick={() => setViewMode('month')} style={{ padding: '6px 10px', fontSize: 13 }}>Месяц</button>
            {canCreate && <button className="button" onClick={() => setShowModal(true)} style={{ padding: '6px 10px', fontSize: 13, marginLeft: 6 }}>Запланировать</button>}
          </div>
        </div>
        {error && <div style={{ color: 'red', marginTop: 10 }}>{error}</div>}

        {/* Type filters */}
        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['call','video','supervision','webinar','session'].map(t => {
            const active = typeFilters.includes(t);
            return (
              <button key={t} className={active ? 'button' : 'button secondary'} style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => setTypeFilters(prev => active ? prev.filter(x => x !== t) : [...prev, t])}>
                {typeLabel(t)}
              </button>
            );
          })}
          {typeFilters.length > 0 && <button className="button danger" onClick={() => setTypeFilters([])} style={{ padding: '4px 8px', fontSize: 12 }}>Сбросить</button>}
        </div>

        {/* Требуют внимания */}
        {requiresAttention && requiresAttention.clientsWithoutSessions.length > 0 && (
          <div className="card" style={{ marginTop: 16, padding: 20, background: 'rgba(255, 193, 7, 0.1)', border: '1px solid rgba(255, 193, 7, 0.3)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>⚠️ Требуют внимания</h3>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Клиенты без сессий {'>'}2 недель:</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {requiresAttention.clientsWithoutSessions.map(client => (
                  <button
                    key={client.id}
                    onClick={() => openCreateSessionForClient(client.id, client.name)}
                    className="button"
                    style={{ padding: '8px 14px', fontSize: 13 }}
                  >
                    📅 Создать сессию: {client.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Compact agenda view */}
        {viewMode === 'agenda' && (
          <div style={{ marginTop: 12 }}>
            {grouped.length === 0 && (
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Нет запланированных событий</div>
                <div className="small">Нажмите «Запланировать», чтобы создать звонок или встречу.</div>
              </div>
            )}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 0 }}>
                {grouped.map(([day, events]) => (
                  <React.Fragment key={day}>
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>{new Date(day).toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })}</div>
                    <div style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      {events.sort((a: any, b: any) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()).map((ev: any) => {
                        const now = new Date();
                        const startsAt = new Date(ev.startsAt);
                        const actualStartTime = ev.actualStartTime ? new Date(ev.actualStartTime) : null;
                        const isUpcoming = !actualStartTime && startsAt > now;
                        const canStartEarly = isUpcoming && (user?.role === 'psychologist' || user?.role === 'admin') && ev.createdBy === user?.id;
                        
                        return (
                          <div key={ev.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr auto auto auto auto', alignItems: 'center', gap: 8, padding: '4px 12px' }}>
                            <div className="small" style={{ color: 'var(--text)' }}>{new Date(ev.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{ev.endsAt ? `–${new Date(ev.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                              <span className="small" style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, padding: '2px 8px', textTransform: 'capitalize' }}>{typeLabel(String(ev.type))}</span>
                              <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                              {ev.sessionStatus === 'pending' && (
                                <span className="small" style={{ background: 'rgba(255, 193, 7, 0.2)', color: '#ffc107', borderRadius: 999, padding: '2px 8px', fontSize: 11 }}>⏳ Ожидает</span>
                              )}
                              {ev.sessionStatus === 'accepted' && (
                                <span className="small" style={{ background: 'rgba(76, 175, 80, 0.2)', color: '#4caf50', borderRadius: 999, padding: '2px 8px', fontSize: 11 }}>✓ Принята</span>
                              )}
                              {ev.sessionStatus === 'declined' && (
                                <span className="small" style={{ background: 'rgba(244, 67, 54, 0.2)', color: '#f44336', borderRadius: 999, padding: '2px 8px', fontSize: 11 }}>✗ Отклонена</span>
                              )}
                              {actualStartTime && (
                                <span className="small" style={{ background: 'rgba(76, 175, 80, 0.2)', color: '#4caf50', borderRadius: 999, padding: '2px 8px', fontSize: 11 }}>▶ Начата</span>
                              )}
                            </div>
                            {ev.voiceRoom && (
                              <a
                                href={ev.voiceRoom.roomUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="button"
                                style={{ padding: '4px 12px', fontSize: 12, whiteSpace: 'nowrap', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                title="Открыть голосовую комнату"
                              >
                                🎤 Комната
                              </a>
                            )}
                            {canStartEarly && (
                              <button 
                                className="button secondary"
                                onClick={() => startEventEarly(ev.id)}
                                disabled={startingEvents[ev.id]}
                                style={{ padding: '4px 8px', fontSize: 12, whiteSpace: 'nowrap' }}
                                title="Начать сессию раньше запланированного времени"
                              >
                                {startingEvents[ev.id] ? '...' : '▶ Начать'}
                              </button>
                            )}
                            {(user?.role === 'psychologist' || user?.role === 'researcher' || user?.role === 'admin') && (
                              <button className="button danger" onClick={() => deleteEvent(ev.id)} style={{ padding: '4px 8px', fontSize: 12 }}>Удалить</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'week' && (() => {
          const start = startOfWeek(anchorDate);
          const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
          return (
            <div style={{ marginTop: 12 }}>
              <div className="card" style={{ padding: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                  {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((w, i) => (
                    <div key={i} className="small" style={{ textAlign: 'center', opacity: .8 }}>{w}</div>
                  ))}
                  {days.map((d, i) => {
                    const dayKey = d.toISOString().slice(0,10);
                    const queryLower = query.toLowerCase().trim();
                    const evs = (items || []).filter(ev => {
                      const dt = new Date(ev.startsAt).toISOString().slice(0,10);
                      if (dt !== dayKey) return false;
                      if (typeFilters.length && !typeFilters.includes(String(ev.type))) return false;
                      if (queryLower) {
                        const searchable = [
                          ev.title || '',
                          ev.description || '',
                          typeLabel(String(ev.type)),
                          ev.clientId || ''
                        ].join(' ').toLowerCase();
                        if (!searchable.includes(queryLower)) return false;
                      }
                      return true;
                    }).sort((a: any, b: any) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
                    return (
                      <div key={i} className="card" style={{ padding: 8, minHeight: 120, background: 'var(--surface-1)' }}>
                        <div className="small" style={{ opacity: 1 }}>{d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}</div>
                        <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
                          {evs.slice(0,4).map((ev: any) => (
                            <div key={ev.id} className="small" style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '2px 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span>{new Date(ev.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {ev.title}</span>
                            </div>
                          ))}
                          {evs.length > 4 && <div className="small" style={{ opacity: .8 }}>+{evs.length - 4} еще</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {viewMode === 'month' && (() => {
          const start = startOfMonth(anchorDate);
          const firstGrid = startOfWeek(start);
          const days = Array.from({ length: 42 }, (_, i) => addDays(firstGrid, i));
          return (
            <div style={{ marginTop: 12 }}>
              <div className="card" style={{ padding: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                  {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((w, i) => (
                    <div key={i} className="small" style={{ textAlign: 'center', opacity: .8 }}>{w}</div>
                  ))}
                  {days.map((d, i) => {
                    const inMonth = d.getMonth() === anchorDate.getMonth();
                    const dayKey = d.toISOString().slice(0,10);
                    const evs = grouped.find(([k]) => k === dayKey)?.[1] || [];
                    return (
                      <div key={i} className="card" style={{ padding: 8, minHeight: 88, background: inMonth ? 'var(--surface-1)' : 'transparent' }}>
                        <div className="small" style={{ opacity: inMonth ? 1 : .5 }}>{d.getDate()}</div>
                        <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
                          {evs.slice(0,3).map((ev: any) => (
                            <div key={ev.id} className="small" style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '2px 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span>{ev.title}</span>
                            </div>
                          ))}
                          {evs.length > 3 && <div className="small" style={{ opacity: .8 }}>+{evs.length - 3} еще</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Create event modal */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,8,16,0.72)', backdropFilter: 'blur(8px)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 16 }} onClick={() => setShowModal(false)}>
            <div className="card" style={{ width: 'min(800px, 96vw)', padding: 22, border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 26px 80px rgba(0,0,0,0.6)', borderRadius: 18, background: 'linear-gradient(180deg, rgba(30,33,45,0.98), rgba(22,24,33,0.98))' }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="schedule-title">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.14)' }}>📅</div>
                  <div>
                    <div id="schedule-title" style={{ fontWeight: 900, letterSpacing: .2 }}>Запланировать событие</div>
                    <div className="small" style={{ color: 'var(--text-muted)' }}>Звонок, видеовстреча, супервизия или вебинар</div>
                  </div>
                </div>
                <button className="button secondary" onClick={() => setShowModal(false)} style={{ padding: '6px 10px', fontSize: 13 }}>Закрыть</button>
              </div>

              <form onSubmit={createEvent} style={{ display: 'grid', gap: 14, marginTop: 16 }}>
                {/* Row 1: Title + Type */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10, alignItems: 'end' }}>
                  <div style={{ minWidth: 0 }}>
                    <label className="small" style={{ opacity: .8, display: 'block' }}>Название</label>
                    <input ref={titleRef} placeholder="Например: Сессия с Иваном" value={title} onChange={e => setTitle(e.target.value)} required style={{ width: '100%', padding: '12px 12px', borderRadius: 12, marginTop: 6 }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <label className="small" style={{ opacity: .8, display: 'block' }}>Тип</label>
                    <select value={type} onChange={e => { setType(e.target.value); if (e.target.value !== 'session') setSelectedClientId(''); }} style={{ width: '100%', padding: '12px 12px', borderRadius: 12, marginTop: 6 }}>
                      {TYPE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Client selection for session type */}
                {type === 'session' && canCreate && (
                  <div style={{ minWidth: 0 }}>
                    <label className="small" style={{ opacity: .8, display: 'block' }}>Клиент *</label>
                    <select 
                      value={selectedClientId} 
                      onChange={e => setSelectedClientId(e.target.value)} 
                      required
                      style={{ width: '100%', padding: '12px 12px', borderRadius: 12, marginTop: 6 }}
                    >
                      <option value="">Выберите клиента</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>{client.name} {client.email ? `(${client.email})` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Row 2: Start + End + Duration (one line) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(220px, 1fr))', gap: 10, alignItems: 'end' }}>
                  <div style={{ minWidth: 0 }}>
                    <label className="small" style={{ opacity: .8, display: 'block' }}>Начало</label>
                    <input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} required style={{ width: '100%', padding: '12px 12px', borderRadius: 12, marginTop: 6 }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <label className="small" style={{ opacity: .8, display: 'block' }}>Окончание</label>
                    <input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} style={{ width: '100%', padding: '12px 12px', borderRadius: 12, marginTop: 6 }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <label className="small" style={{ opacity: .8, display: 'block' }}>Длительность</label>
                    <select value={String(durationMin)} onChange={e => setDurationMin(Number(e.target.value))} style={{ width: '100%', padding: '12px 12px', borderRadius: 12, marginTop: 6 }}>
                      {[20,30,40,45,50,60,75,90].map(m => (
                        <option key={m} value={m}>{m} мин</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 3: Quick presets */}
                <div style={{ minWidth: 0 }}>
                  <label className="small" style={{ opacity: .8, display: 'block' }}>Быстрый выбор</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {[{t:'Сегодня', addH:1},{t:'Завтра', addH:24},{t:'Через 3 дня', addH:72}].map(p => (
                      <button type="button" key={p.t} className="button secondary" style={{ padding: '6px 10px', fontSize: 12, borderRadius: 999 }} onClick={() => {
                        const base = new Date();
                        base.setHours(base.getHours() + p.addH);
                        base.setMinutes(0,0,0);
                        setStartsAt(toLocalInputValue(base));
                      }}>{p.t}</button>
                    ))}
                  </div>
                </div>

                <div style={{ minWidth: 0 }}>
                  <label className="small" style={{ opacity: .8, display: 'block' }}>Описание / повестка</label>
                  <textarea placeholder="Ключевые пункты, ссылки, заметки" value={description} onChange={e => setDescription(e.target.value)} style={{ width: '100%', padding: '12px 12px', borderRadius: 12, marginTop: 6, minHeight: 96 }} />
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="small" style={{ color: 'var(--text-muted)' }}>Тип: <b>{typeLabel(type)}</b> • Длительность: <b>{durationMin} мин</b></div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="button secondary" onClick={() => { setShowModal(false); setSelectedClientId(''); }} style={{ padding: '8px 12px', fontSize: 13 }}>Отмена</button>
                    <button className="button" type="submit" disabled={!title || !startsAt || submitting || (type === 'session' && !selectedClientId)} style={{ padding: '10px 14px', fontSize: 13, borderRadius: 12, background: 'linear-gradient(135deg, var(--primary), var(--accent))', opacity: (!title || !startsAt || submitting || (type === 'session' && !selectedClientId)) ? .7 : 1 }}>
                      {submitting ? 'Создание…' : 'Создать'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
      )}
      </main>
    </div>
  );
}
