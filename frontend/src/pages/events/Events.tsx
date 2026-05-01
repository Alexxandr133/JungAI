import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';
import { VerificationRequired } from '../../components/VerificationRequired';
import { checkVerification } from '../../utils/verification';
import type { VerificationStatus } from '../../utils/verification';
import { useAppearance } from '../../context/AppearanceContext';
import { CalendarClock, CalendarPlus, CircleAlert, Clock3, Video } from 'lucide-react';

export default function EventsPage() {
  const { token, user } = useAuth();
  const { appearance } = useAppearance();
  const isLight = appearance.colorMode === 'light';
  const [items, setItems] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('video');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [durationMin, setDurationMin] = useState<number>(60);
  const [submitting, setSubmitting] = useState(false);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clients, setClients] = useState<Array<{ id: string; name: string; email?: string }>>([]);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [requiresAttention, setRequiresAttention] = useState<{
    clientsWithoutSessions: Array<{ id: string; name: string }>;
  } | null>(null);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const TYPE_OPTIONS = [
    { value: 'video', label: 'Видеовстреча' },
    { value: 'supervision', label: 'Супервизия' },
    { value: 'webinar', label: 'Вебинар' },
    { value: 'session', label: 'Сессия' },
  ];
  const typeLabel = (v: string) => {
    if (v === 'call') return 'Видеовстреча';
    return TYPE_OPTIONS.find(o => o.value === v)?.label || v;
  };

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
      setTitle(''); setDescription(''); setStartsAt(''); setEndsAt(''); setSelectedClientId(''); setStartDate(''); setStartTime(''); setDurationMin(60);
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
    setDurationMin(60);
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
  async function copyGuestInviteLink(roomUrl?: string | null) {
    if (!roomUrl) return;
    const invite = `${roomUrl}${roomUrl.includes('?') ? '&' : '?'}guest=1`;
    try {
      await navigator.clipboard.writeText(invite);
      setError('Ссылка приглашения скопирована');
      setTimeout(() => setError(null), 1800);
    } catch {
      setError('Не удалось скопировать ссылку');
      setTimeout(() => setError(null), 1800);
    }
  }

  const canCreate = user?.role === 'psychologist' || user?.role === 'researcher' || user?.role === 'admin';


  // Helpers for modal
  function toLocalInputValue(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function splitLocalInputValue(v: string): { date: string; time: string } {
    if (!v || !v.includes('T')) return { date: '', time: '' };
    const [date, time] = v.split('T');
    return { date, time: (time || '').slice(0, 5) };
  }
  function composeLocalInputValue(date: string, time: string): string {
    if (!date || !time) return '';
    return `${date}T${time}`;
  }
  useEffect(() => {
    if (!startsAt || !durationMin) {
      if (endsAt) setEndsAt('');
      return;
    }
    const base = new Date(startsAt);
    if (Number.isNaN(base.getTime())) return;
    const nextEndDate = new Date(base.getTime() + durationMin * 60000);
    const nextEnd = toLocalInputValue(nextEndDate);
    if (nextEnd !== endsAt) setEndsAt(nextEnd);
  }, [startsAt, durationMin, endsAt]);
  useEffect(() => {
    const next = composeLocalInputValue(startDate, startTime);
    if (next !== startsAt) setStartsAt(next);
  }, [startDate, startTime]);
  useEffect(() => {
    const s = splitLocalInputValue(startsAt);
    if (s.date !== startDate) setStartDate(s.date);
    if (s.time !== startTime) setStartTime(s.time);
  }, [startsAt]);

  // Modal a11y: autofocus and Esc close
  useEffect(() => {
    if (showModal) {
      const t = setTimeout(() => titleRef.current?.focus(), 50);
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false); };
      window.addEventListener('keydown', onKey);
      return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
    }
  }, [showModal]);


  const activeItems = useMemo(() => {
    const now = Date.now();
    return (items || []).filter((ev: any) => {
      const endTs = new Date(ev.endsAt || ev.startsAt).getTime();
      return endTs >= now;
    });
  }, [items]);
  const historyItems = useMemo(() => {
    const now = Date.now();
    return (items || []).filter((ev: any) => {
      const endTs = new Date(ev.endsAt || ev.startsAt).getTime();
      return endTs < now;
    });
  }, [items]);
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    let filtered = activeItems;
    
    // Filter by type
    if (typeFilters.length) {
      filtered = filtered.filter(ev => typeFilters.includes(String(ev.type)));
    }
    
    for (const ev of filtered) {
      const d = new Date(ev.startsAt);
      const key = d.toISOString().slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b));
  }, [activeItems, typeFilters]);
  const historyGrouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    let filtered = historyItems;

    if (typeFilters.length) {
      filtered = filtered.filter(ev => typeFilters.includes(String(ev.type)));
    }

    for (const ev of filtered) {
      const d = new Date(ev.startsAt);
      const key = d.toISOString().slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [historyItems, typeFilters]);
  const nearestUpcoming = useMemo(() => {
    const now = Date.now();
    return (activeItems || [])
      .filter(ev => new Date(ev.startsAt).getTime() > now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0] || null;
  }, [activeItems]);

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
      <main
        style={{
          flex: 1,
          padding: '24px clamp(16px, 5vw, 48px)',
          maxWidth: '100%',
          overflowX: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Сессии и встречи</h1>
            <span className="small" style={{ color: 'var(--text-muted)' }}>Часовой пояс: {Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
          </div>
        </div>

        {error && <div style={{ color: 'red', marginTop: 10 }}>{error}</div>}

        {/* Type filters */}
        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {['video','supervision','webinar','session'].map(t => {
            const active = typeFilters.includes(t);
            return (
              <button key={t} className={active ? 'button' : 'button secondary'} style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => setTypeFilters(prev => active ? prev.filter(x => x !== t) : [...prev, t])}>
                {typeLabel(t)}
              </button>
            );
          })}
          {typeFilters.length > 0 && <button className="button danger" onClick={() => setTypeFilters([])} style={{ padding: '4px 8px', fontSize: 12 }}>Сбросить</button>}
          {canCreate && (
            <button
              className={showHistory ? 'button' : 'button secondary'}
              onClick={() => setShowHistory(prev => !prev)}
              style={{ padding: '10px 14px', fontSize: 13, borderRadius: 12, marginLeft: 'auto' }}
            >
              {showHistory ? 'Актуальные' : 'История'}
            </button>
          )}
          {canCreate && (
            <button
              className="button"
              onClick={() => setShowModal(true)}
              style={{
                padding: '10px 18px',
                fontSize: 14,
                borderRadius: 12,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                boxShadow: isLight ? '0 8px 20px rgba(79,70,229,0.2)' : '0 10px 24px rgba(79,70,229,0.3)'
              }}
            >
              <CalendarPlus size={16} />
              Запланировать
            </button>
          )}
        </div>
        {nearestUpcoming && (
          <div className="card" style={{ marginTop: 14, padding: 14, border: '1px solid rgba(59,130,246,0.28)', background: isLight ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.14)' }}>
            <div style={{ fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}><CalendarClock size={16} />Ближайшая предстоящая</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{nearestUpcoming.title}</div>
                <div className="small" style={{ color: 'var(--text-muted)', marginTop: 4 }}>{new Date(nearestUpcoming.startsAt).toLocaleString('ru-RU', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <span className="small" style={{ background: 'var(--surface-2)', borderRadius: 999, padding: '5px 10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{typeLabel(String(nearestUpcoming.type))}</span>
            </div>
          </div>
        )}

        {/* Требуют внимания */}
        {!showHistory && requiresAttention && requiresAttention.clientsWithoutSessions.length > 0 && (
          <div className="card" style={{ marginTop: 16, padding: 20, background: 'rgba(255, 193, 7, 0.1)', border: '1px solid rgba(255, 193, 7, 0.3)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><CircleAlert size={18} />Требуют внимания</h3>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Клиенты без сессий {'>'}2 недель:</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {requiresAttention.clientsWithoutSessions.map(client => (
                  <button
                    key={client.id}
                    onClick={() => openCreateSessionForClient(client.id, client.name)}
                    className="button"
                    style={{ padding: '8px 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8 }}
                  >
                    <CalendarPlus size={14} />
                    Создать сессию: {client.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Compact agenda view */}
        <div style={{ marginTop: 12 }}>
          {!showHistory && grouped.length === 0 && (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Нет запланированных событий</div>
              <div className="small">Нажмите «Запланировать», чтобы создать звонок или встречу.</div>
            </div>
          )}
          {!showHistory && grouped.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 0 }}>
                {grouped.map(([day, events]) => (
                  <React.Fragment key={day}>
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>{new Date(day).toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })}</div>
                    <div style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      {events.sort((a: any, b: any) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()).map((ev: any) => {
                        const actualStartTime = ev.actualStartTime ? new Date(ev.actualStartTime) : null;
                        
                        return (
                          <div key={ev.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr auto auto auto', alignItems: 'center', gap: 8, padding: '4px 12px' }}>
                            <div className="small" style={{ color: 'var(--text)' }}>{new Date(ev.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{ev.endsAt ? `–${new Date(ev.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                              <span className="small" style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, padding: '2px 8px', textTransform: 'capitalize', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{typeLabel(String(ev.type))}</span>
                              <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                              {ev.sessionStatus === 'pending' && (
                                <span className="small" style={{ background: 'rgba(255, 193, 7, 0.2)', color: '#ffc107', borderRadius: 999, padding: '2px 8px', fontSize: 11 }}>Ожидает</span>
                              )}
                              {ev.sessionStatus === 'accepted' && (
                                <span className="small" style={{ background: 'rgba(76, 175, 80, 0.2)', color: '#4caf50', borderRadius: 999, padding: '2px 8px', fontSize: 11 }}>Принята</span>
                              )}
                              {ev.sessionStatus === 'declined' && (
                                <span className="small" style={{ background: 'rgba(244, 67, 54, 0.2)', color: '#f44336', borderRadius: 999, padding: '2px 8px', fontSize: 11 }}>Отклонена</span>
                              )}
                              {actualStartTime && (
                                <span className="small" style={{ background: 'rgba(76, 175, 80, 0.2)', color: '#4caf50', borderRadius: 999, padding: '2px 8px', fontSize: 11 }}>Начата</span>
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
                                <Video size={14} />
                                Комната
                              </a>
                            )}
                            {(String(ev.type) === 'video' || String(ev.type) === 'call') && ev.voiceRoom?.roomUrl && (
                              <button
                                className="button secondary"
                                onClick={() => copyGuestInviteLink(ev.voiceRoom.roomUrl)}
                                style={{ padding: '4px 10px', fontSize: 12, whiteSpace: 'nowrap' }}
                                title="Скопировать ссылку для гостевого доступа"
                              >
                                Скопировать приглашение
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
          )}
          {showHistory && historyGrouped.length === 0 && (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>История пока пуста</div>
              <div className="small">Прошедшие встречи будут отображаться здесь.</div>
            </div>
          )}
          {showHistory && historyGrouped.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', background: isLight ? 'rgba(148,163,184,0.08)' : 'rgba(100,116,139,0.12)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 0 }}>
                {historyGrouped.map(([day, events]) => (
                  <React.Fragment key={day}>
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(148,163,184,0.18)', color: 'var(--text-muted)' }}>{new Date(day).toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })}</div>
                    <div style={{ padding: '6px 0', borderBottom: '1px solid rgba(148,163,184,0.18)' }}>
                      {events.sort((a: any, b: any) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()).map((ev: any) => (
                        <div key={ev.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr auto', alignItems: 'center', gap: 8, padding: '4px 12px', opacity: 0.75 }}>
                          <div className="small" style={{ color: 'var(--text-muted)' }}>{new Date(ev.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span className="small" style={{ background: 'rgba(148,163,184,0.2)', borderRadius: 999, padding: '2px 8px', display: 'inline-flex', alignItems: 'center' }}>{typeLabel(String(ev.type))}</span>
                            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                          </div>
                          <span className="small" style={{ color: 'var(--text-muted)' }}>Прошла</span>
                        </div>
                      ))}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Create event modal */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: isLight ? 'rgba(15,23,42,0.28)' : 'rgba(5,8,16,0.72)', backdropFilter: 'blur(8px)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 16 }}>
            <div className="card" style={{ width: 'min(680px, 94vw)', maxHeight: 'min(760px, 92vh)', overflowY: 'auto', padding: 0, border: isLight ? '1px solid rgba(15,23,42,0.15)' : '1px solid rgba(255,255,255,0.12)', boxShadow: isLight ? '0 24px 60px rgba(15,23,42,0.18)' : '0 26px 80px rgba(0,0,0,0.6)', borderRadius: 18, background: isLight ? '#ffffff' : 'linear-gradient(180deg, rgba(30,33,45,0.98), rgba(22,24,33,0.98))' }} role="dialog" aria-modal="true" aria-labelledby="schedule-title">
              <div style={{ padding: '18px 22px', borderBottom: isLight ? '1px solid rgba(15,23,42,0.1)' : '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', background: isLight ? '#eef2ff' : 'var(--surface-2)', border: isLight ? '1px solid rgba(79,70,229,0.22)' : '1px solid rgba(255,255,255,0.14)' }}>
                    <CalendarPlus size={18} color={isLight ? '#4f46e5' : '#c7d2fe'} />
                  </div>
                  <div>
                    <div id="schedule-title" style={{ fontWeight: 900, letterSpacing: .2 }}>Планирование встречи</div>
                    <div className="small" style={{ color: 'var(--text-muted)' }}>Заполните ключевые поля и отправьте приглашение</div>
                  </div>
                </div>
                <button className="button secondary" onClick={() => setShowModal(false)} style={{ padding: '6px 10px', fontSize: 13 }}>Закрыть</button>
              </div>

              <form onSubmit={createEvent} style={{ display: 'grid', gap: 16, padding: 22 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, alignItems: 'end' }}>
                  <div style={{ minWidth: 0 }}>
                    <label className="small" style={{ opacity: .8, display: 'block' }}>Название встречи</label>
                    <input ref={titleRef} placeholder="Например: Сессия с Иваном" value={title} onChange={e => setTitle(e.target.value)} required style={{ width: '100%', padding: '12px 12px', borderRadius: 12, marginTop: 6 }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <label className="small" style={{ opacity: .8, display: 'block' }}>Формат</label>
                    <select value={type} onChange={e => { setType(e.target.value); if (e.target.value !== 'session') setSelectedClientId(''); }} style={{ width: '100%', padding: '12px 12px', borderRadius: 12, marginTop: 6 }}>
                      {TYPE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

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

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, alignItems: 'end' }}>
                  <div style={{ minWidth: 0 }}>
                    <label className="small" style={{ opacity: .8, display: 'block' }}>Дата начала</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required style={{ width: '100%', padding: '12px 12px', borderRadius: 12, marginTop: 6 }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <label className="small" style={{ opacity: .8, display: 'block' }}>Время начала</label>
                    <input type="time" step={300} value={startTime} onChange={e => setStartTime(e.target.value)} required style={{ width: '100%', padding: '12px 12px', borderRadius: 12, marginTop: 6 }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <label className="small" style={{ opacity: .8, display: 'block' }}>Продолжительность</label>
                    <select value={String(durationMin)} onChange={e => setDurationMin(Number(e.target.value))} style={{ width: '100%', padding: '12px 12px', borderRadius: 12, marginTop: 6 }}>
                      {Array.from({ length: 12 }, (_, i) => (i + 1) * 30).map(m => (
                        <option key={m} value={m}>{m / 60} ч</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <label className="small" style={{ opacity: .8, display: 'block' }}>Быстрый выбор старта</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    {[{ t: 'Сегодня', addH: 1 }, { t: 'Завтра', addH: 24 }, { t: 'Через 3 дня', addH: 72 }].map(p => (
                      <button type="button" key={p.t} className="button secondary" style={{ padding: '7px 12px', fontSize: 12, borderRadius: 999 }} onClick={() => {
                        const base = new Date();
                        base.setHours(base.getHours() + p.addH);
                        base.setMinutes(0, 0, 0);
                        setStartsAt(toLocalInputValue(base));
                      }}>{p.t}</button>
                    ))}
                  </div>
                  <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
                    {['09:00','10:00','11:00','12:00','14:00','15:00','16:00','18:00'].map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setStartTime(t)}
                        className="button secondary"
                        style={{ padding: '8px 0', fontSize: 12, borderRadius: 10, background: startTime === t ? 'rgba(79,70,229,0.2)' : undefined, border: startTime === t ? '1px solid rgba(79,70,229,0.45)' : undefined }}
                      >
                        <Clock3 size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ minWidth: 0 }}>
                  <label className="small" style={{ opacity: .8, display: 'block' }}>Повестка / комментарии</label>
                  <textarea placeholder="Что важно обсудить, ожидаемый результат, материалы или ссылки" value={description} onChange={e => setDescription(e.target.value)} style={{ width: '100%', padding: '12px 12px', borderRadius: 12, marginTop: 6, minHeight: 110, resize: 'vertical' }} />
                </div>

                <div style={{ borderRadius: 12, padding: '10px 12px', background: isLight ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.14)', border: isLight ? '1px solid rgba(99,102,241,0.22)' : '1px solid rgba(99,102,241,0.28)' }}>
                  <div className="small" style={{ color: isLight ? '#4338ca' : '#c7d2fe' }}>
                    Проверьте данные перед отправкой: <b>{typeLabel(type)}</b> · <b>{startTime || '--:--'} - {(endsAt ? splitLocalInputValue(endsAt).time : '--:--')}</b>
                  </div>
                </div>

                <div style={{ position: 'sticky', bottom: 0, background: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(22,24,33,0.95)', backdropFilter: 'blur(6px)', paddingTop: 8, display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: isLight ? '1px solid rgba(15,23,42,0.1)' : '1px solid rgba(255,255,255,0.1)' }}>
                  <button type="button" className="button secondary" onClick={() => { setShowModal(false); setSelectedClientId(''); }} style={{ padding: '9px 14px', fontSize: 13 }}>Отмена</button>
                  <button className="button" type="submit" disabled={!title || !startsAt || submitting || (type === 'session' && !selectedClientId)} style={{ padding: '10px 16px', fontSize: 13, borderRadius: 12, background: 'linear-gradient(135deg, var(--primary), var(--accent))', opacity: (!title || !startsAt || submitting || (type === 'session' && !selectedClientId)) ? .7 : 1 }}>
                    {submitting ? 'Создание…' : 'Создать встречу'}
                  </button>
                </div>
              </form>
            </div>
          </div>
      )}
      </main>
    </div>
  );
}
