import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';
import { VerificationRequired } from '../../components/VerificationRequired';
import { checkVerification } from '../../utils/verification';
import type { VerificationStatus } from '../../utils/verification';
import { useAppearance } from '../../context/AppearanceContext';
import { CalendarClock, CalendarDays, CalendarPlus, Check, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Clock3, Link2, Settings2, Share2, Trash2, Video, X } from 'lucide-react';
import { usePsychologistPlatformTour } from '../../hooks/usePsychologistPlatformTour';
import { PSYCHOLOGIST_SESSIONS_TOUR_STEPS } from '../../lib/psychologistPlatformTourSteps';
import { PsychologistTourHelpButton } from '../../components/PsychologistTourHelpButton';
import {
  CALENDAR_PREFS_KEY,
  type CalendarPrefs,
  calendarCells,
  clampInt,
  computeDaySummary,
  dayKeyFromDate,
  loadCalendarPrefs,
  pad2,
  SLOT_INTERVAL_MINUTES_OPTIONS,
  type DayCalSummary
} from '../../lib/eventsCalendarUtils';

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
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [calendarSelectedDay, setCalendarSelectedDay] = useState<string | null>(null);
  const [calendarModalTab, setCalendarModalTab] = useState<'calendar' | 'settings'>('calendar');
  const [calendarPrefs, setCalendarPrefs] = useState<CalendarPrefs>(() => loadCalendarPrefs());
  const [dayOffPicker, setDayOffPicker] = useState('');
  const [toast, setToast] = useState<{ variant: 'success' | 'error'; text: string } | null>(null);
  const [calendarBookingRequests, setCalendarBookingRequests] = useState<any[]>([]);
  const [declineBookingId, setDeclineBookingId] = useState<string | null>(null);
  const [declineReasonDraft, setDeclineReasonDraft] = useState('');
  const [psychSessionDeclineId, setPsychSessionDeclineId] = useState<string | null>(null);
  const [psychSessionDeclineDraft, setPsychSessionDeclineDraft] = useState('');
  const [narrowLayout, setNarrowLayout] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 720 : false
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(CALENDAR_PREFS_KEY, JSON.stringify(calendarPrefs));
    } catch {
      // ignore
    }
  }, [calendarPrefs]);

  useEffect(() => {
    function onResize() {
      setNarrowLayout(window.innerWidth <= 720);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

  function showToast(variant: 'success' | 'error', text: string) {
    setToast({ variant, text });
    window.setTimeout(() => setToast(null), 3400);
  }

  async function loadCalendarBookingRequests() {
    if (!token || (user?.role !== 'psychologist' && user?.role !== 'researcher' && user?.role !== 'admin')) {
      setCalendarBookingRequests([]);
      return;
    }
    try {
      const res = await api<{ items: any[] }>('/api/events/calendar-booking-requests', { token });
      setCalendarBookingRequests(res.items || []);
    } catch {
      setCalendarBookingRequests([]);
    }
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
      void load();
      void loadCalendarBookingRequests();
    }
  }, [token, isVerified, user?.role]);
  useEffect(() => { loadClients(); }, [token, user]);
  useEffect(() => { loadRequiresAttention(); }, [token, user]);

  usePsychologistPlatformTour({
    tourId: 'sessions',
    userId: user?.id,
    role: user?.role,
    enabled: Boolean(token && user?.role === 'psychologist' && isVerified === true),
    steps: PSYCHOLOGIST_SESSIONS_TOUR_STEPS
  });

  async function createEvent(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try {
      setSubmitting(true);
      await api('/api/events', { method: 'POST', token: token ?? undefined, body: { title, type, description, startsAt, endsAt: endsAt || null, clientId: type === 'session' ? selectedClientId : null } });
      setTitle(''); setDescription(''); setStartsAt(''); setEndsAt(''); setSelectedClientId(''); setStartDate(''); setStartTime(''); setDurationMin(60);
      setShowModal(false);
      await load();
      await loadRequiresAttention();
      await loadCalendarBookingRequests();
    } catch (e: any) {
      setError(e.message || 'Не удалось создать событие');
    } finally {
      setSubmitting(false);
    }
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
  async function copyGuestInviteLink(ev: any) {
    const roomUrl = ev?.voiceRoom?.roomUrl;
    if (!roomUrl) return;
    const invite = `${roomUrl}${roomUrl.includes('?') ? '&' : '?'}guest=1`;
    const timeLabel = `${new Date(ev.startsAt).toLocaleString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}${
      ev.endsAt ? ` – ${new Date(ev.endsAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : ''
    }`;
    const title = String(ev.title || 'Видеовстреча').trim() || 'Видеовстреча';
    const body =
      `JungAI — приглашение на видеозвонок\n` +
      `Встреча: ${title}\n` +
      `Время: ${timeLabel}\n\n` +
      `Ссылка для гостевого входа в комнату (скопируйте в браузер):\n${invite}\n\n` +
      `Откройте ссылку в указанное время. Гостевой режим не требует входа в аккаунт.`;
    try {
      await navigator.clipboard.writeText(body);
      showToast('success', 'Текст с приглашением и ссылкой скопирован в буфер обмена');
    } catch {
      showToast('error', 'Не удалось скопировать');
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

  useEffect(() => {
    if (!showCalendarModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowCalendarModal(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showCalendarModal]);


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

  const eventsByDay = useMemo(() => {
    const list =
      typeFilters.length > 0
        ? (items || []).filter((ev) => typeFilters.includes(String(ev.type)))
        : items || [];
    const map: Record<string, any[]> = {};
    for (const ev of list) {
      const k = dayKeyFromDate(new Date(ev.startsAt));
      if (!map[k]) map[k] = [];
      map[k].push(ev);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }
    return map;
  }, [items, typeFilters]);

  function guestInviteHref(roomUrl: string): string {
    return `${roomUrl}${roomUrl.includes('?') ? '&' : '?'}guest=1`;
  }

  function openCalendarModal() {
    const t = new Date();
    t.setDate(1);
    t.setHours(0, 0, 0, 0);
    setCalendarMonth(t);
    setCalendarSelectedDay(dayKeyFromDate(new Date()));
    setCalendarModalTab('calendar');
    setShowCalendarModal(true);
  }

  async function copyCalendarShareLink() {
    if (!token) return;
    try {
      const { url } = await api<{ url: string }>('/api/events/calendar-share', {
        method: 'POST',
        token,
        body: { prefs: calendarPrefs }
      });
      await navigator.clipboard.writeText(url);
      showToast('success', 'Ссылка на календарь скопирована в буфер обмена');
    } catch (e: any) {
      showToast('error', e.message || 'Не удалось создать ссылку');
    }
  }

  async function acceptCalendarBooking(id: string) {
    if (!token) return;
    try {
      await api(`/api/events/calendar-booking-requests/${id}/accept`, { method: 'POST', token });
      showToast('success', 'Встреча создана. Уведомление отправлено на почту заявителя.');
      await load();
      await loadCalendarBookingRequests();
    } catch (e: any) {
      showToast('error', e.message || 'Не удалось принять заявку');
    }
  }

  async function submitDeclineBooking() {
    if (!token || !declineBookingId) return;
    const r = declineReasonDraft.trim();
    if (r.length < 3) {
      showToast('error', 'Введите причину отклонения (не менее 3 символов).');
      return;
    }
    try {
      await api(`/api/events/calendar-booking-requests/${declineBookingId}/decline`, {
        method: 'POST',
        token,
        body: { reason: r }
      });
      showToast('success', 'Заявка отклонена. Уведомление отправлено на почту заявителя.');
      setDeclineBookingId(null);
      setDeclineReasonDraft('');
      await loadCalendarBookingRequests();
    } catch (e: any) {
      showToast('error', e.message || 'Не удалось отклонить заявку');
    }
  }

  async function acceptPsychSessionRequest(eventId: string) {
    if (!token) return;
    try {
      await api(`/api/events/${eventId}/session-status`, { method: 'PUT', token, body: { status: 'accepted' } });
      showToast('success', 'Сессия подтверждена');
      await load();
    } catch (e: any) {
      showToast('error', e.message || 'Не удалось подтвердить');
    }
  }

  async function submitPsychSessionDecline() {
    if (!token || !psychSessionDeclineId) return;
    try {
      await api(`/api/events/${psychSessionDeclineId}/session-status`, {
        method: 'PUT',
        token,
        body: { status: 'declined', comment: psychSessionDeclineDraft.trim() || undefined }
      });
      showToast('success', 'Запись отклонена');
      setPsychSessionDeclineId(null);
      setPsychSessionDeclineDraft('');
      await load();
    } catch (e: any) {
      showToast('error', e.message || 'Не удалось отклонить');
    }
  }

  const calendarView = useMemo(() => {
    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth();
    return {
      year: y,
      month: m,
      cells: calendarCells(y, m),
      title: new Date(y, m, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
    };
  }, [calendarMonth]);

  const selectedCalendarEvents = calendarSelectedDay ? eventsByDay[calendarSelectedDay] || [] : [];

  const calendarDaySummaries = useMemo(() => {
    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth();
    const cells = calendarCells(y, m);
    const map: Record<string, DayCalSummary> = {};
    for (const { d } of cells) {
      const key = dayKeyFromDate(d);
      map[key] = computeDaySummary(key, calendarPrefs, eventsByDay[key] || []);
    }
    return map;
  }, [calendarMonth, eventsByDay, calendarPrefs]);

  const selectedDaySummary = calendarSelectedDay
    ? computeDaySummary(calendarSelectedDay, calendarPrefs, selectedCalendarEvents)
    : null;

  function renderUpcomingEventCard(ev: any) {
    const actualStartTime = ev.actualStartTime ? new Date(ev.actualStartTime) : null;
    const timeLabel = `${new Date(ev.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${ev.endsAt ? `–${new Date(ev.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`;
    const guestUrl = ev.voiceRoom?.roomUrl && (String(ev.type) === 'video' || String(ev.type) === 'call')
      ? guestInviteHref(String(ev.voiceRoom.roomUrl))
      : null;
    const clientBookPending =
      String(ev.type) === 'session' && ev.sessionStatus === 'pending' && Boolean(ev.clientRequestedSession);
    const statusBits = (
      <>
        {String(ev.type) === 'session' && ev.sessionStatus === 'pending' && clientBookPending && (
          <span className="small" style={{ background: 'rgba(255, 193, 7, 0.2)', color: '#ffc107', borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>Запись клиента</span>
        )}
        {String(ev.type) === 'session' && ev.sessionStatus === 'pending' && !clientBookPending && (
          <span className="small" style={{ background: 'rgba(255, 193, 7, 0.2)', color: '#ffc107', borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>Ожидает клиента</span>
        )}
        {ev.sessionStatus === 'accepted' && (
          <span className="small" style={{ background: 'rgba(76, 175, 80, 0.2)', color: '#4caf50', borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>Принята</span>
        )}
        {ev.sessionStatus === 'declined' && (
          <span className="small" style={{ background: 'rgba(244, 67, 54, 0.2)', color: '#f44336', borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>Отклонена</span>
        )}
        {actualStartTime && (
          <span className="small" style={{ background: 'rgba(76, 175, 80, 0.2)', color: '#4caf50', borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>Начата</span>
        )}
      </>
    );
    const cardBorder = isLight ? '1px solid rgba(15,23,42,0.12)' : '1px solid rgba(255,255,255,0.1)';
    const cardBg = isLight ? 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)' : 'linear-gradient(145deg, rgba(30,33,45,0.95) 0%, rgba(22,24,33,0.92) 100%)';
    const canDelete = user?.role === 'psychologist' || user?.role === 'researcher' || user?.role === 'admin';

    return (
      <div
        key={ev.id}
        className="card"
        style={{
          width: '100%',
          marginLeft: 0,
          marginRight: 0,
          padding: narrowLayout ? 10 : 12,
          borderRadius: 14,
          border: cardBorder,
          background: cardBg,
          boxShadow: isLight ? '0 8px 22px rgba(15,23,42,0.07)' : '0 10px 26px rgba(0,0,0,0.32)',
          marginBottom: narrowLayout ? 8 : 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              <span className="small" style={{ color: 'var(--text)', fontWeight: 800, fontSize: 12 }}>{timeLabel}</span>
              <span
                className="small"
                style={{
                  background: isLight ? 'rgba(79,70,229,0.12)' : 'rgba(129,140,248,0.18)',
                  border: isLight ? '1px solid rgba(79,70,229,0.28)' : '1px solid rgba(165,180,252,0.25)',
                  borderRadius: 999,
                  padding: '3px 9px',
                  fontSize: 11,
                  fontWeight: 700,
                  color: isLight ? '#4338ca' : '#c7d2fe'
                }}
              >
                {typeLabel(String(ev.type))}
              </span>
            </div>
            <div style={{ fontWeight: 800, fontSize: narrowLayout ? 15 : 16, lineHeight: 1.3, marginTop: 6, wordBreak: 'break-word' }}>{ev.title}</div>
            {(ev.sessionStatus || actualStartTime) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>{statusBits}</div>
            )}
            {(ev.voiceRoom || guestUrl) && !clientBookPending && (
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                {ev.voiceRoom && (
                  <a
                    href={ev.voiceRoom.roomUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button"
                    style={{
                      padding: narrowLayout ? '6px 9px' : '6px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 9,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                      boxShadow: isLight ? '0 6px 16px rgba(79,70,229,0.2)' : '0 8px 18px rgba(79,70,229,0.32)'
                    }}
                  >
                    <Video size={13} />
                    Комната
                  </a>
                )}
                {guestUrl && (
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => copyGuestInviteLink(ev)}
                    style={{
                      padding: narrowLayout ? '6px 9px' : '6px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 9,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      border: isLight ? '1px solid rgba(15,23,42,0.14)' : '1px solid rgba(255,255,255,0.12)'
                    }}
                  >
                    <Link2 size={13} />
                    Ссылка приглашения
                  </button>
                )}
              </div>
            )}
            {clientBookPending && (user?.role === 'psychologist' || user?.role === 'researcher' || user?.role === 'admin') && (
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  className="button"
                  onClick={() => void acceptPsychSessionRequest(ev.id)}
                  style={{
                    padding: narrowLayout ? '7px 12px' : '8px 14px',
                    fontSize: 12,
                    fontWeight: 800,
                    borderRadius: 10,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <Check size={15} />
                  Подтвердить запись
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    setPsychSessionDeclineId(ev.id);
                    setPsychSessionDeclineDraft('');
                  }}
                  style={{
                    padding: narrowLayout ? '7px 12px' : '8px 14px',
                    fontSize: 12,
                    fontWeight: 800,
                    borderRadius: 10,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    border: isLight ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(248,113,113,0.4)',
                    color: isLight ? '#b91c1c' : '#fecaca'
                  }}
                >
                  <X size={15} />
                  Отклонить
                </button>
              </div>
            )}
          </div>
          {canDelete && (
            <button
              type="button"
              className="button danger"
              onClick={() => deleteEvent(ev.id)}
              title="Удалить встречу"
              aria-label="Удалить встречу"
              style={{
                flexShrink: 0,
                padding: narrowLayout ? '6px 8px' : '6px 8px',
                borderRadius: 9,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontWeight: 700,
                fontSize: 11
              }}
            >
              <Trash2 size={14} />
              {!narrowLayout && 'Удалить'}
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderHistoryEventCard(ev: any) {
    return (
      <div
        key={ev.id}
        className="card"
        style={{
          padding: 14,
          borderRadius: 14,
          opacity: 0.88,
          marginBottom: 10,
          background: isLight ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.15)',
          border: isLight ? '1px solid rgba(148,163,184,0.25)' : '1px solid rgba(148,163,184,0.22)'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <span className="small" style={{ color: 'var(--text-muted)', fontWeight: 700 }}>
              {new Date(ev.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="small" style={{ background: 'rgba(148,163,184,0.25)', borderRadius: 999, padding: '4px 10px', fontWeight: 700 }}>
              {typeLabel(String(ev.type))}
            </span>
          </div>
          <span className="small" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Прошла</span>
        </div>
        <div style={{ fontWeight: 700, marginTop: 8, lineHeight: 1.35, wordBreak: 'break-word' }}>{ev.title}</div>
      </div>
    );
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
      <main
        style={{
          flex: 1,
          padding: '24px clamp(16px, 5vw, 48px)',
          maxWidth: '100%',
          overflowX: 'hidden'
        }}
      >
        {/* Header */}
        <div
          data-tour="events-header"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 32,
            flexWrap: 'wrap'
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Сессии и встречи</h1>
            <span className="small" style={{ color: 'var(--text-muted)' }}>Часовой пояс: {Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
          </div>
          <PsychologistTourHelpButton tourId="sessions" steps={PSYCHOLOGIST_SESSIONS_TOUR_STEPS} userId={user?.id} role={user?.role} />
        </div>

        {toast && (
          <div
            role="status"
            style={{
              position: 'fixed',
              top: 88,
              right: 20,
              zIndex: 3000,
              maxWidth: 380,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '14px 16px',
              borderRadius: 14,
              boxShadow: isLight ? '0 16px 40px rgba(15,23,42,0.15)' : '0 18px 48px rgba(0,0,0,0.45)',
              border:
                toast.variant === 'success'
                  ? isLight
                    ? '1px solid rgba(34,197,94,0.45)'
                    : '1px solid rgba(74,222,128,0.4)'
                  : isLight
                    ? '1px solid rgba(239,68,68,0.45)'
                    : '1px solid rgba(248,113,113,0.45)',
              background:
                toast.variant === 'success'
                  ? isLight
                    ? 'linear-gradient(135deg, #ecfdf5, #f0fdf4)'
                    : 'linear-gradient(135deg, rgba(6,78,59,0.95), rgba(20,83,45,0.92))'
                  : isLight
                    ? 'linear-gradient(135deg, #fef2f2, #fff7ed)'
                    : 'linear-gradient(135deg, rgba(127,29,29,0.95), rgba(69,10,10,0.92))',
              color: toast.variant === 'success' ? (isLight ? '#14532d' : '#dcfce7') : isLight ? '#991b1b' : '#fecaca'
            }}
          >
            {toast.variant === 'success' ? (
              <CheckCircle2 size={22} style={{ flexShrink: 0, marginTop: 1 }} color={isLight ? '#16a34a' : '#86efac'} />
            ) : (
              <X size={22} style={{ flexShrink: 0, marginTop: 1 }} color={isLight ? '#dc2626' : '#fca5a5'} />
            )}
            <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.45 }}>{toast.text}</div>
          </div>
        )}
        {error && (
          <div
            style={{
              marginTop: 10,
              padding: '12px 14px',
              borderRadius: 12,
              fontWeight: 600,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.35)',
              color: '#b91c1c'
            }}
          >
            {error}
          </div>
        )}

        {/* Type filters + actions: на узких экранах кнопки «История» / «Запланировать» — отдельный ряд на всю ширину (50/50) */}
        <div
          data-tour="events-toolbar"
          style={{
            marginTop: 8,
            display: 'flex',
            flexDirection: narrowLayout ? 'column' : 'row',
            gap: narrowLayout ? 10 : 8,
            flexWrap: narrowLayout ? 'nowrap' : 'wrap',
            alignItems: narrowLayout ? 'stretch' : 'center'
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', flex: narrowLayout ? undefined : 1, minWidth: 0 }}>
            {['video','supervision','webinar','session'].map(t => {
              const active = typeFilters.includes(t);
              return (
                <button key={t} className={active ? 'button' : 'button secondary'} style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => setTypeFilters(prev => active ? prev.filter(x => x !== t) : [...prev, t])}>
                  {typeLabel(t)}
                </button>
              );
            })}
            {typeFilters.length > 0 && <button className="button danger" onClick={() => setTypeFilters([])} style={{ padding: '4px 8px', fontSize: 12 }}>Сбросить</button>}
          </div>
          {canCreate && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: narrowLayout ? '1fr 1fr 1fr' : 'auto auto auto',
                gap: 8,
                width: narrowLayout ? '100%' : 'auto',
                flexShrink: 0,
                marginLeft: narrowLayout ? undefined : 'auto'
              }}
            >
              <button
                type="button"
                className="button secondary"
                onClick={openCalendarModal}
                title="Календарь занятости"
                style={{
                  padding: '10px 14px',
                  fontSize: 13,
                  borderRadius: 12,
                  width: narrowLayout ? '100%' : 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontWeight: 700
                }}
              >
                <CalendarDays size={18} />
                {!narrowLayout && 'Календарь'}
              </button>
              <button
                className={showHistory ? 'button' : 'button secondary'}
                onClick={() => setShowHistory(prev => !prev)}
                style={{ padding: '10px 14px', fontSize: 13, borderRadius: 12, width: narrowLayout ? '100%' : 'auto', justifySelf: 'stretch' }}
              >
                {showHistory ? 'Актуальные' : 'История'}
              </button>
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
                  justifyContent: 'center',
                  gap: 8,
                  width: narrowLayout ? '100%' : 'auto',
                  background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                  boxShadow: isLight ? '0 8px 20px rgba(79,70,229,0.2)' : '0 10px 24px rgba(79,70,229,0.3)'
                }}
              >
                <CalendarPlus size={16} />
                Запланировать
              </button>
            </div>
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

        {!showHistory &&
          token &&
          (user?.role === 'psychologist' || user?.role === 'researcher' || user?.role === 'admin') &&
          isVerified === true &&
          calendarBookingRequests.length > 0 && (
            <div
              className="card"
              style={{
                marginTop: 14,
                padding: narrowLayout ? 12 : 16,
                border: isLight ? '1px solid rgba(79,70,229,0.22)' : '1px solid rgba(165,180,252,0.28)',
                background: isLight ? 'rgba(79,70,229,0.06)' : 'rgba(79,70,229,0.12)'
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 12 }}>Заявки на слот (публичный календарь)</div>
              <div style={{ display: 'grid', gap: 12 }}>
                {calendarBookingRequests.map((br: any) => (
                  <div
                    key={br.id}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      border: isLight ? '1px solid rgba(15,23,42,0.1)' : '1px solid rgba(255,255,255,0.1)',
                      background: isLight ? '#ffffff' : 'rgba(15,23,42,0.35)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 12,
                      alignItems: 'flex-start',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{br.contactName}</div>
                      <div className="small" style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                        {br.contactEmail}
                        {br.contactPhone ? ` · ${br.contactPhone}` : ''}
                      </div>
                      <div className="small" style={{ marginTop: 6, fontWeight: 700 }}>
                        {new Date(br.slotStart).toLocaleString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {br.message && (
                        <div className="small" style={{ marginTop: 6, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                          {br.message}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, flexShrink: 0 }}>
                      <button
                        type="button"
                        className="button"
                        onClick={() => void acceptCalendarBooking(br.id)}
                        style={{ padding: '8px 14px', fontSize: 12, fontWeight: 800, borderRadius: 10 }}
                      >
                        Принять
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => {
                          setDeclineBookingId(br.id);
                          setDeclineReasonDraft('');
                        }}
                        style={{ padding: '8px 14px', fontSize: 12, fontWeight: 800, borderRadius: 10 }}
                      >
                        Отклонить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Требуют внимания */}
        {!showHistory && requiresAttention && requiresAttention.clientsWithoutSessions.length > 0 && (
          <div
            className="card"
            style={{
              marginTop: 16,
              padding: narrowLayout ? 12 : 20,
              background: 'rgba(255, 193, 7, 0.1)',
              border: '1px solid rgba(255, 193, 7, 0.3)'
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: narrowLayout ? 10 : 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: narrowLayout ? 16 : undefined }}>
              <CircleAlert size={narrowLayout ? 16 : 18} />
              Требуют внимания
            </h3>
            <div style={{ marginBottom: narrowLayout ? 0 : 12 }}>
              <div style={{ fontWeight: 600, marginBottom: narrowLayout ? 6 : 8, fontSize: narrowLayout ? 13 : undefined }}>Клиенты без сессий {'>'}2 недель:</div>
              <div style={{ display: 'flex', gap: narrowLayout ? 6 : 8, flexWrap: 'wrap' }}>
                {requiresAttention.clientsWithoutSessions.map(client => (
                  <button
                    key={client.id}
                    onClick={() => openCreateSessionForClient(client.id, client.name)}
                    className="button"
                    style={{
                      padding: narrowLayout ? '5px 10px' : '8px 14px',
                      fontSize: narrowLayout ? 12 : 13,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: narrowLayout ? 6 : 8
                    }}
                  >
                    <CalendarPlus size={narrowLayout ? 12 : 14} />
                    Сессия: {client.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Compact agenda view */}
        <div data-tour="events-list" style={{ marginTop: 12 }}>
          {!showHistory && grouped.length === 0 && (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Нет запланированных событий</div>
              <div className="small">Нажмите «Запланировать», чтобы создать звонок или встречу.</div>
            </div>
          )}
          {!showHistory && grouped.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {narrowLayout ? (
                <div>
                  {grouped.map(([day, events]) => (
                    <div key={day} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <div
                        style={{
                          padding: '8px 12px',
                          background: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)',
                          color: 'var(--text-muted)',
                          fontWeight: 700,
                          fontSize: 13
                        }}
                      >
                        {new Date(day).toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'long' })}
                      </div>
                      <div style={{ padding: narrowLayout ? '10px 12px 14px' : '12px 16px 18px' }}>
                        {events
                          .sort((a: any, b: any) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
                          .map((ev: any) => renderUpcomingEventCard(ev))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 0 }}>
                  {grouped.map(([day, events]) => (
                    <React.Fragment key={day}>
                      <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>
                        {new Date(day).toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })}
                      </div>
                      <div style={{ padding: narrowLayout ? '10px 12px 14px' : '12px 16px 18px' }}>
                        {events
                          .sort((a: any, b: any) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
                          .map((ev: any) => renderUpcomingEventCard(ev))}
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              )}
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
              {narrowLayout ? (
                <div>
                  {historyGrouped.map(([day, events]) => (
                    <div key={day} style={{ borderBottom: '1px solid rgba(148,163,184,0.18)' }}>
                      <div
                        style={{
                          padding: '8px 12px',
                          background: isLight ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.18)',
                          color: 'var(--text-muted)',
                          fontWeight: 700,
                          fontSize: 13
                        }}
                      >
                        {new Date(day).toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'long' })}
                      </div>
                      <div style={{ padding: narrowLayout ? '10px 12px 14px' : '12px 16px 18px' }}>
                        {events
                          .sort((a: any, b: any) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
                          .map((ev: any) => renderHistoryEventCard(ev))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 0 }}>
                  {historyGrouped.map(([day, events]) => (
                    <React.Fragment key={day}>
                      <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(148,163,184,0.18)', color: 'var(--text-muted)' }}>
                        {new Date(day).toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })}
                      </div>
                      <div style={{ padding: narrowLayout ? '10px 12px 14px' : '12px 16px 18px' }}>
                        {events
                          .sort((a: any, b: any) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
                          .map((ev: any) => renderHistoryEventCard(ev))}
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {declineBookingId && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: isLight ? 'rgba(15,23,42,0.28)' : 'rgba(5,8,16,0.72)',
              backdropFilter: 'blur(8px)',
              display: 'grid',
              placeItems: 'center',
              zIndex: 1100,
              padding: 16
            }}
            onClick={() => setDeclineBookingId(null)}
            role="presentation"
          >
            <div
              className="card"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 'min(440px, 94vw)',
                padding: 20,
                borderRadius: 16,
                border: isLight ? '1px solid rgba(15,23,42,0.12)' : '1px solid rgba(255,255,255,0.12)'
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 17, marginBottom: 8 }}>Причина отклонения</div>
              <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                Комментарий будет отправлен заявителю на email.
              </div>
              <textarea
                value={declineReasonDraft}
                onChange={(e) => setDeclineReasonDraft(e.target.value)}
                rows={4}
                placeholder="Обязательно укажите причину…"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: 12,
                  borderRadius: 12,
                  marginBottom: 14,
                  resize: 'vertical',
                  border: isLight ? '1px solid rgba(15,23,42,0.14)' : '1px solid rgba(255,255,255,0.14)',
                  background: isLight ? '#fff' : 'var(--surface-2)',
                  color: 'var(--text)'
                }}
              />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button type="button" className="button secondary" onClick={() => setDeclineBookingId(null)} style={{ padding: '9px 14px', borderRadius: 12 }}>
                  Отмена
                </button>
                <button type="button" className="button danger" onClick={() => void submitDeclineBooking()} style={{ padding: '9px 14px', borderRadius: 12, fontWeight: 800 }}>
                  Отклонить заявку
                </button>
              </div>
            </div>
          </div>
        )}

        {psychSessionDeclineId && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: isLight ? 'rgba(15,23,42,0.28)' : 'rgba(5,8,16,0.72)',
              backdropFilter: 'blur(8px)',
              display: 'grid',
              placeItems: 'center',
              zIndex: 1100,
              padding: 16
            }}
            onClick={() => setPsychSessionDeclineId(null)}
            role="presentation"
          >
            <div
              className="card"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 'min(440px, 94vw)',
                padding: 20,
                borderRadius: 16,
                border: isLight ? '1px solid rgba(15,23,42,0.12)' : '1px solid rgba(255,255,255,0.12)'
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 17, marginBottom: 8 }}>Отклонить запись клиента</div>
              <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                По желанию укажите комментарий для клиента (увидит в карточке сессии).
              </div>
              <textarea
                value={psychSessionDeclineDraft}
                onChange={(e) => setPsychSessionDeclineDraft(e.target.value)}
                rows={4}
                placeholder="Комментарий (необязательно)"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: 12,
                  borderRadius: 12,
                  marginBottom: 14,
                  resize: 'vertical',
                  border: isLight ? '1px solid rgba(15,23,42,0.14)' : '1px solid rgba(255,255,255,0.14)',
                  background: isLight ? '#fff' : 'var(--surface-2)',
                  color: 'var(--text)'
                }}
              />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button type="button" className="button secondary" onClick={() => setPsychSessionDeclineId(null)} style={{ padding: '9px 14px', borderRadius: 12 }}>
                  Отмена
                </button>
                <button type="button" className="button danger" onClick={() => void submitPsychSessionDecline()} style={{ padding: '9px 14px', borderRadius: 12, fontWeight: 800 }}>
                  Отклонить запись
                </button>
              </div>
            </div>
          </div>
        )}

        {showCalendarModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: isLight ? 'rgba(15,23,42,0.28)' : 'rgba(5,8,16,0.72)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: narrowLayout ? 'stretch' : 'center',
              justifyContent: narrowLayout ? 'stretch' : 'center',
              zIndex: 1000,
              padding: narrowLayout ? 0 : 16
            }}
            role="presentation"
          >
            <div
              className="card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="events-calendar-title"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: narrowLayout ? '100%' : 'min(780px, 96vw)',
                maxWidth: narrowLayout ? '100%' : undefined,
                height: narrowLayout ? '100%' : undefined,
                maxHeight: narrowLayout ? '100dvh' : 'min(90vh, 880px)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                padding: 0,
                borderRadius: narrowLayout ? 0 : 18,
                border: isLight ? '1px solid rgba(15,23,42,0.15)' : '1px solid rgba(255,255,255,0.12)',
                boxShadow: narrowLayout ? 'none' : isLight ? '0 24px 60px rgba(15,23,42,0.18)' : '0 26px 80px rgba(0,0,0,0.6)',
                background: isLight ? '#ffffff' : 'linear-gradient(180deg, rgba(30,33,45,0.98), rgba(22,24,33,0.98))'
              }}
            >
              <div
                style={{
                  padding: narrowLayout ? '14px 14px 12px' : '18px 20px',
                  borderBottom: isLight ? '1px solid rgba(15,23,42,0.1)' : '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: narrowLayout ? 'wrap' : 'nowrap'
                }}
              >
                <div style={{ minWidth: 0, flex: narrowLayout ? '1 1 100%' : '1 1 auto' }}>
                  <div id="events-calendar-title" style={{ fontWeight: 900, fontSize: narrowLayout ? 17 : 18, letterSpacing: 0.2 }}>
                    {calendarModalTab === 'calendar' ? 'Календарь занятости' : 'Настройки доступности'}
                  </div>
                  <div className="small" style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                    {calendarModalTab === 'calendar'
                      ? 'Свободные промежутки считаются по рабочему дню, обеду, перерывам после встреч и активным фильтрам типов событий.'
                      : 'Параметры сохраняются в этом браузере и влияют только на расчёт свободных окон в календаре.'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: narrowLayout ? 'auto' : undefined }}>
                  <button
                    type="button"
                    className="button secondary"
                    aria-label={calendarModalTab === 'calendar' ? 'Настройки календаря' : 'Вернуться к календарю'}
                    aria-pressed={calendarModalTab === 'settings'}
                    onClick={() => setCalendarModalTab((t) => (t === 'calendar' ? 'settings' : 'calendar'))}
                    style={{ padding: '8px 10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Settings2 size={18} />
                  </button>
                  <button type="button" className="button secondary" onClick={() => setShowCalendarModal(false)} style={{ padding: '8px 12px', fontSize: 13 }}>
                    Закрыть
                  </button>
                </div>
              </div>

              {calendarModalTab === 'calendar' && (
                <div
                  style={{
                    padding: narrowLayout ? '10px 12px 8px' : '14px 20px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                    rowGap: 10
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      className="button secondary"
                      aria-label="Предыдущий месяц"
                      onClick={() =>
                        setCalendarMonth((prev) => {
                          const d = new Date(prev);
                          d.setMonth(d.getMonth() - 1);
                          return d;
                        })
                      }
                      style={{ padding: '10px 12px', borderRadius: 12 }}
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <div style={{ fontWeight: 800, fontSize: narrowLayout ? 14 : 16, textTransform: 'capitalize', minWidth: narrowLayout ? 120 : 160, textAlign: 'center', flex: '1 1 auto' }}>
                      {calendarView.title}
                    </div>
                    <button
                      type="button"
                      className="button secondary"
                      aria-label="Следующий месяц"
                      onClick={() =>
                        setCalendarMonth((prev) => {
                          const d = new Date(prev);
                          d.setMonth(d.getMonth() + 1);
                          return d;
                        })
                      }
                      style={{ padding: '10px 12px', borderRadius: 12 }}
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: narrowLayout ? 8 : 12, alignItems: 'center', width: narrowLayout ? '100%' : undefined, justifyContent: narrowLayout ? 'flex-start' : undefined }}>
                    <span className="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: '#22c55e' }} />
                      Есть окна (от–до)
                    </span>
                    <span className="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: '#eab308' }} />
                      Частично
                    </span>
                    <span className="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--primary)' }} />
                      Занято
                    </span>
                    {(user?.role === 'psychologist' || user?.role === 'researcher' || user?.role === 'admin') && (
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => void copyCalendarShareLink()}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 12, fontWeight: 700, fontSize: 13 }}
                      >
                        <Share2 size={16} />
                        Поделиться календарём
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div style={{ padding: calendarModalTab === 'calendar' ? (narrowLayout ? '0 12px 12px' : '0 20px 16px') : narrowLayout ? '12px 14px 16px' : '16px 20px 20px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                {calendarModalTab === 'settings' ? (
                  <div style={{ display: 'grid', gap: 18 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, alignItems: 'end' }}>
                      <label style={{ display: 'grid', gap: 6 }}>
                        <span className="small" style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Начало рабочего дня</span>
                        <select
                          value={calendarPrefs.workStartHour}
                          onChange={(e) =>
                            setCalendarPrefs((p) => ({ ...p, workStartHour: clampInt(e.target.value, 0, 23, p.workStartHour) }))
                          }
                          style={{ padding: '10px 12px', borderRadius: 12 }}
                        >
                          {Array.from({ length: 18 }, (_, i) => i + 6).map((h) => (
                            <option key={h} value={h}>
                              {pad2(h)}:00
                            </option>
                          ))}
                        </select>
                      </label>
                      <label style={{ display: 'grid', gap: 6 }}>
                        <span className="small" style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Конец рабочего дня</span>
                        <select
                          value={calendarPrefs.workEndHour}
                          onChange={(e) =>
                            setCalendarPrefs((p) => ({ ...p, workEndHour: clampInt(e.target.value, 1, 24, p.workEndHour) }))
                          }
                          style={{ padding: '10px 12px', borderRadius: 12 }}
                        >
                          {Array.from({ length: 18 }, (_, i) => i + 7).map((h) => (
                            <option key={h} value={h}>
                              {h === 24 ? '24:00' : `${pad2(h)}:00`}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label style={{ display: 'grid', gap: 6 }}>
                        <span className="small" style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Шаг слотов (показ)</span>
                        <select
                          value={calendarPrefs.slotIntervalMinutes}
                          onChange={(e) => {
                            const slotIntervalMinutes = Number(e.target.value) as CalendarPrefs['slotIntervalMinutes'];
                            setCalendarPrefs((p) => ({
                              ...p,
                              slotIntervalMinutes,
                              minFreeSegmentMinutes: slotIntervalMinutes
                            }));
                          }}
                          style={{ padding: '10px 12px', borderRadius: 12 }}
                        >
                          {SLOT_INTERVAL_MINUTES_OPTIONS.map((m) => (
                            <option key={m} value={m}>
                              {m < 60 ? `${m} мин` : m === 60 ? '1 час' : m === 90 ? '1 ч 30 мин' : '2 часа'}
                            </option>
                          ))}
                        </select>
                  
                      </label>
                      <label style={{ display: 'grid', gap: 6 }}>
                        <span className="small" style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Перерыв после встречи</span>
                        <input
                          type="number"
                          min={0}
                          max={180}
                          step={5}
                          value={calendarPrefs.breakAfterEventMinutes}
                          onChange={(e) =>
                            setCalendarPrefs((p) => ({
                              ...p,
                              breakAfterEventMinutes: clampInt(e.target.value, 0, 180, p.breakAfterEventMinutes)
                            }))
                          }
                          style={{ padding: '10px 12px', borderRadius: 12 }}
                        />
                      </label>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={calendarPrefs.weekendsOff}
                        onChange={(e) => setCalendarPrefs((p) => ({ ...p, weekendsOff: e.target.checked }))}
                      />
                      <span style={{ fontWeight: 700 }}>Считать субботу и воскресенье выходными</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={calendarPrefs.useCustomDaysOff}
                        onChange={(e) => setCalendarPrefs((p) => ({ ...p, useCustomDaysOff: e.target.checked }))}
                      />
                      <span style={{ fontWeight: 700 }}>Произвольные выходные</span>
                    </label>
                    {calendarPrefs.useCustomDaysOff && (
                      <div style={{ display: 'grid', gap: 10 }}>
                        <div className="small" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                          Добавьте даты, когда приёма нет (праздники, отпуск и т.д.).
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                          <input
                            type="date"
                            value={dayOffPicker}
                            onChange={(e) => setDayOffPicker(e.target.value)}
                            style={{ padding: '10px 12px', borderRadius: 12 }}
                          />
                          <button
                            type="button"
                            className="button secondary"
                            onClick={() => {
                              if (!dayOffPicker) return;
                              setCalendarPrefs((p) => ({
                                ...p,
                                customDaysOff: [...new Set([...p.customDaysOff, dayOffPicker])].sort()
                              }));
                              setDayOffPicker('');
                            }}
                            style={{ padding: '10px 14px', borderRadius: 12, fontWeight: 700 }}
                          >
                            Добавить дату
                          </button>
                        </div>
                        {calendarPrefs.customDaysOff.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {calendarPrefs.customDaysOff.map((dk) => (
                              <span
                                key={dk}
                                className="small"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '6px 10px',
                                  borderRadius: 10,
                                  fontWeight: 700,
                                  border: isLight ? '1px solid rgba(15,23,42,0.12)' : '1px solid rgba(255,255,255,0.14)',
                                  background: isLight ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.2)'
                                }}
                              >
                                {new Date(`${dk}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                                <button
                                  type="button"
                                  aria-label="Удалить дату"
                                  onClick={() =>
                                    setCalendarPrefs((p) => ({
                                      ...p,
                                      customDaysOff: p.customDaysOff.filter((x) => x !== dk)
                                    }))
                                  }
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    padding: 0,
                                    lineHeight: 1,
                                    fontWeight: 900,
                                    color: 'var(--text-muted)'
                                  }}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={calendarPrefs.lunchEnabled}
                        onChange={(e) => setCalendarPrefs((p) => ({ ...p, lunchEnabled: e.target.checked }))}
                      />
                      <span style={{ fontWeight: 700 }}>Вычитать обед из свободного времени</span>
                    </label>
                    {calendarPrefs.lunchEnabled && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'end' }}>
                        <label style={{ display: 'grid', gap: 6 }}>
                          <span className="small" style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Обед с</span>
                          <input
                            type="time"
                            value={calendarPrefs.lunchStart}
                            onChange={(e) => setCalendarPrefs((p) => ({ ...p, lunchStart: e.target.value }))}
                            style={{ padding: '10px 12px', borderRadius: 12 }}
                          />
                        </label>
                        <label style={{ display: 'grid', gap: 6 }}>
                          <span className="small" style={{ fontWeight: 700, color: 'var(--text-muted)' }}>до</span>
                          <input
                            type="time"
                            value={calendarPrefs.lunchEnd}
                            onChange={(e) => setCalendarPrefs((p) => ({ ...p, lunchEnd: e.target.value }))}
                            style={{ padding: '10px 12px', borderRadius: 12 }}
                          />
                        </label>
                      </div>
                    )}

                    <div
                      className="small"
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        border: isLight ? '1px solid rgba(15,23,42,0.1)' : '1px solid rgba(255,255,255,0.1)',
                        color: 'var(--text-muted)',
                        lineHeight: 1.5
                      }}
                    >
                      В ячейках календаря показаны свободные промежутки не короче выбранного шага слота (например <b>09:00–12:30</b>) и сами
                      слоты по этому шагу. Внизу при выборе дня — только <b>свободные слоты</b> и список встреч (для прошедших дней — только
                      встречи). Ссылка «Поделиться календарём» открывает запись гостю без входа в аккаунт. Занятость встреч расширяется на время
                      «перерыва после встречи».
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        overflowX: 'auto',
                        WebkitOverflowScrolling: 'touch',
                        marginBottom: 4,
                        marginLeft: narrowLayout ? -4 : 0,
                        marginRight: narrowLayout ? -4 : 0
                      }}
                    >
                      <div style={{ minWidth: narrowLayout ? 300 : undefined }}>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                            gap: narrowLayout ? 4 : 6,
                            marginBottom: 8
                          }}
                        >
                      {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((w) => (
                        <div key={w} className="small" style={{ fontWeight: 800, textAlign: 'center', color: 'var(--text-muted)', padding: '6px 0' }}>
                          {w}
                        </div>
                      ))}
                    </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: narrowLayout ? 4 : 6 }}>
                      {calendarView.cells.map(({ d, inMonth }) => {
                        const key = dayKeyFromDate(d);
                        const sum = calendarDaySummaries[key];
                        const nEv = (eventsByDay[key] || []).length;
                        const isToday = key === dayKeyFromDate(new Date());
                        const isSelected = calendarSelectedDay === key;
                        const isPast = sum.isPast;
                        const cellBusyFull = !isPast && sum.hasEvents && sum.freeSegments.length === 0 && !sum.weekendBlocked;
                        const cellPartial = !isPast && sum.hasEvents && sum.freeSegments.length > 0 && !sum.weekendBlocked;
                        const cellBg = !inMonth
                          ? isLight
                            ? 'rgba(148,163,184,0.06)'
                            : 'rgba(148,163,184,0.06)'
                          : isPast
                            ? isLight
                              ? 'rgba(148,163,184,0.1)'
                              : 'rgba(100,116,139,0.16)'
                            : sum.weekendBlocked
                              ? isLight
                                ? 'rgba(148,163,184,0.14)'
                                : 'rgba(100,116,139,0.2)'
                              : cellBusyFull
                                ? isLight
                                  ? 'rgba(79,70,229,0.1)'
                                  : 'rgba(79,70,229,0.16)'
                                : cellPartial
                                  ? isLight
                                    ? 'rgba(234,179,8,0.12)'
                                    : 'rgba(234,179,8,0.14)'
                                  : isLight
                                    ? 'rgba(34,197,94,0.08)'
                                    : 'rgba(34,197,94,0.12)';
                        const subColor = isPast
                          ? nEv > 0
                            ? 'var(--primary)'
                            : 'var(--text-muted)'
                          : sum.weekendBlocked
                            ? 'var(--text-muted)'
                            : cellBusyFull
                              ? 'var(--primary)'
                              : cellPartial
                                ? isLight
                                  ? '#a16207'
                                  : '#facc15'
                                : '#16a34a';
                        return (
                          <button
                            key={`${key}-${inMonth}`}
                            type="button"
                            onClick={() => setCalendarSelectedDay(key)}
                            style={{
                              minHeight: narrowLayout ? 56 : 76,
                              borderRadius: narrowLayout ? 10 : 12,
                              padding: narrowLayout ? 5 : 8,
                              textAlign: 'left',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              gap: 4,
                              cursor: 'pointer',
                              border: isSelected
                                ? '2px solid var(--primary)'
                                : isToday
                                  ? isLight
                                    ? '1px solid rgba(79,70,229,0.45)'
                                    : '1px solid rgba(165,180,252,0.45)'
                                  : isLight
                                    ? '1px solid rgba(15,23,42,0.1)'
                                    : '1px solid rgba(255,255,255,0.1)',
                              background: cellBg,
                              opacity: inMonth ? 1 : 0.45,
                              color: 'var(--text)'
                            }}
                          >
                            <div style={{ fontWeight: 800, fontSize: narrowLayout ? 12 : 14 }}>{d.getDate()}</div>
                            {inMonth && (
                              <div
                                className="small"
                                style={{
                                  fontWeight: 700,
                                  fontSize: narrowLayout ? 9 : 10,
                                  lineHeight: 1.25,
                                  color: subColor,
                                  overflow: 'hidden',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 3,
                                  WebkitBoxOrient: 'vertical',
                                  wordBreak: 'break-word'
                                }}
                              >
                                {isPast ? (
                                  sum.weekendBlocked ? (
                                    sum.freeLabel
                                  ) : nEv > 0 ? (
                                    `${nEv} встр.`
                                  ) : (
                                    '—'
                                  )
                                ) : sum.weekendBlocked ? (
                                  sum.freeLabel
                                ) : (
                                  <>
                                    {nEv > 0 && (
                                      <span style={{ color: 'var(--primary)', fontWeight: 800 }}>{nEv} встр. · </span>
                                    )}
                                    {sum.freeLabel}
                                  </>
                                )}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                      </div>
                    </div>

                    {calendarSelectedDay && selectedDaySummary && (
                      <div
                        style={{
                          marginTop: 16,
                          padding: 14,
                          borderRadius: 14,
                          border: isLight ? '1px solid rgba(15,23,42,0.1)' : '1px solid rgba(255,255,255,0.1)',
                          background: isLight ? 'rgba(248,250,252,0.95)' : 'rgba(15,23,42,0.45)'
                        }}
                      >
                        <div style={{ fontWeight: 800, marginBottom: 10 }}>
                          {(() => {
                            const [yy, mm, dd] = calendarSelectedDay.split('-').map(Number);
                            const dayDate = new Date(yy, mm - 1, dd);
                            return dayDate.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                          })()}
                        </div>
                        {selectedDaySummary.isPast && (
                          <div className="small" style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: 12 }}>
                            Прошедший день — показаны только встречи.
                          </div>
                        )}
                        {!selectedDaySummary.isPast && selectedDaySummary.weekendBlocked && (
                          <div className="small" style={{ color: 'var(--text-muted)', fontWeight: 700, marginBottom: 12 }}>
                            Выходной — свободные слоты не считаются.
                          </div>
                        )}
                        {!selectedDaySummary.isPast && !selectedDaySummary.weekendBlocked && selectedDaySummary.slotStarts.length > 0 && (
                          <div style={{ marginBottom: 14 }}>
                            <div className="small" style={{ color: 'var(--text-muted)', fontWeight: 700, marginBottom: 6 }}>
                              Свободные слоты
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {selectedDaySummary.slotStarts.slice(0, 32).map((t) => (
                                <span
                                  key={t}
                                  className="small"
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: 8,
                                    fontWeight: 700,
                                    background: isLight ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.18)',
                                    color: isLight ? '#166534' : '#bbf7d0'
                                  }}
                                >
                                  {t}
                                </span>
                              ))}
                              {selectedDaySummary.slotStarts.length > 32 && (
                                <span className="small" style={{ fontWeight: 700, color: 'var(--text-muted)', alignSelf: 'center' }}>
                                  +ещё {selectedDaySummary.slotStarts.length - 32}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {!selectedDaySummary.isPast &&
                          !selectedDaySummary.weekendBlocked &&
                          selectedDaySummary.slotStarts.length === 0 &&
                          selectedCalendarEvents.length === 0 && (
                            <div className="small" style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: 12 }}>
                              Нет свободных слотов и встреч на этот день.
                            </div>
                          )}
                        {selectedCalendarEvents.length > 0 && (
                          <div style={{ display: 'grid', gap: 8 }}>
                            <div className="small" style={{ color: 'var(--text-muted)', fontWeight: 700, marginBottom: 2 }}>
                              Встречи
                            </div>
                            {selectedCalendarEvents.map((ev: any) => (
                              <div
                                key={ev.id}
                                style={{
                                  padding: '10px 12px',
                                  borderRadius: 12,
                                  border: isLight ? '1px solid rgba(79,70,229,0.2)' : '1px solid rgba(165,180,252,0.22)',
                                  background: isLight ? 'rgba(79,70,229,0.06)' : 'rgba(79,70,229,0.12)'
                                }}
                              >
                                <div style={{ fontWeight: 800, fontSize: 13 }}>
                                  {new Date(ev.startsAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                  {ev.endsAt ? `–${new Date(ev.endsAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : ''}
                                  <span className="small" style={{ marginLeft: 8, color: 'var(--text-muted)', fontWeight: 700 }}>
                                    {typeLabel(String(ev.type))}
                                  </span>
                                </div>
                                <div style={{ fontWeight: 700, marginTop: 4 }}>{ev.title}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {selectedDaySummary.isPast && selectedCalendarEvents.length === 0 && (
                          <div className="small" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                            В этот день не было запланированных встреч.
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

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
