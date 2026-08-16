import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';
import { ResearcherNavbar } from '../../components/ResearcherNavbar';
import { VerificationRequired } from '../../components/VerificationRequired';
import { checkVerification } from '../../utils/verification';
import type { VerificationStatus } from '../../utils/verification';
import {
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Info,
  Link2,
  MoreHorizontal,
  Settings2,
  Video,
  X
} from 'lucide-react';
import { usePsychologistPlatformTour } from '../../hooks/usePsychologistPlatformTour';
import { PSYCHOLOGIST_SESSIONS_TOUR_STEPS } from '../../lib/psychologistPlatformTourSteps';
import { PsychologistTourHelpButton } from '../../components/PsychologistTourHelpButton';
import {
  DEFAULT_CALENDAR_PREFS,
  type CalendarPrefs,
  calendarCells,
  clampInt,
  computeDaySummary,
  dayKeyFromDate,
  mergeCalendarPrefsFromServer,
  pad2,
  SLOT_INTERVAL_MINUTES_OPTIONS,
  type DayCalSummary
} from '../../lib/eventsCalendarUtils';
import {
  EventsIncomingRequests,
  type IncomingRequestItem
} from './EventsIncomingRequests';
import './Events.css';

type EventsPageProps = { mode?: 'psychologist' | 'researcher' };

function eventTypeMatchesFilters(evType: string, filters: string[]): boolean {
  if (!filters.length) return true;
  const t = String(evType);
  if (filters.includes(t)) return true;
  if (t === 'call' && filters.includes('video')) return true;
  return false;
}

function canJoinRoom(ev: { startsAt: string; endsAt?: string | null }, nowMs: number): boolean {
  const start = new Date(ev.startsAt).getTime();
  const end = new Date(ev.endsAt || ev.startsAt).getTime();
  const openFrom = start - 15 * 60 * 1000;
  return nowMs >= openFrom && nowMs <= end;
}

function formatCountdown(startsAt: string, nowMs: number): string {
  const diff = new Date(startsAt).getTime() - nowMs;
  if (diff <= 0) return 'сейчас';
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `через ${mins} мин`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `через ${hours} ч`;
  const days = Math.round(hours / 24);
  return `через ${days} дн`;
}

function appOrigin(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin.replace(/\/$/, '');
}

/** Room id from voiceRoom; prefer id over absolute roomUrl (origin may differ). */
function eventRoomId(ev: any): string | null {
  const id = ev?.voiceRoom?.roomId;
  if (typeof id === 'string' && id.trim()) return id.trim();
  const url = String(ev?.voiceRoom?.roomUrl || '');
  const m = url.match(/\/room\/([^/?#]+)/);
  return m?.[1] || null;
}

function roomHrefFromId(roomId: string): string {
  return `${appOrigin()}/room/${roomId}`;
}

function guestInviteHrefFromId(roomId: string): string {
  return `${roomHrefFromId(roomId)}?guest=1`;
}

function calendarBookHrefFromToken(shareToken: string): string {
  return `${appOrigin()}/book/calendar?t=${encodeURIComponent(shareToken)}`;
}

function clientNameFromEvent(
  ev: any,
  clients: Array<{ id: string; name: string }>
): string | null {
  if (ev?.client?.name) return String(ev.client.name);
  if (ev?.clientName) return String(ev.clientName);
  if (ev?.clientId) {
    const c = clients.find((x) => x.id === ev.clientId);
    if (c) return c.name;
  }
  if (ev?.guestName) return String(ev.guestName);
  return null;
}

function isGuestParticipant(ev: any): boolean {
  return Boolean(ev?.isFirstMeeting || (ev?.guestEmail && !ev?.clientId));
}

export default function EventsPage({ mode = 'psychologist' }: EventsPageProps) {
  const isResearcherMode = mode === 'researcher';
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('video');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [durationMin, setDurationMin] = useState<number>(60);
  const [submitting, setSubmitting] = useState(false);
  const [startingCall, setStartingCall] = useState(false);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
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
  const [calendarPrefs, setCalendarPrefs] = useState<CalendarPrefs>(() => ({ ...DEFAULT_CALENDAR_PREFS }));
  const skipPrefsSaveRef = useRef(true);
  const [dayOffPicker, setDayOffPicker] = useState('');
  const [toast, setToast] = useState<{ variant: 'success' | 'error'; text: string } | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequestItem[]>([]);
  const [psychSessionDeclineId, setPsychSessionDeclineId] = useState<string | null>(null);
  const [psychSessionDeclineDraft, setPsychSessionDeclineDraft] = useState('');
  const [addClientEvent, setAddClientEvent] = useState<any | null>(null);
  const [addClientName, setAddClientName] = useState('');
  const [addClientEmail, setAddClientEmail] = useState('');
  const [addClientPhone, setAddClientPhone] = useState('');
  const [addClientSaving, setAddClientSaving] = useState(false);
  const [narrowLayout, setNarrowLayout] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 720 : false
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [calendarShareUrl, setCalendarShareUrl] = useState('');
  const [menuEventId, setMenuEventId] = useState<string | null>(null);
  const [settingsHelpOpen, setSettingsHelpOpen] = useState(false);
  const timeZone = useMemo(
    () => (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'),
    []
  );

  useEffect(() => {
    function onResize() {
      setNarrowLayout(window.innerWidth <= 720);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!menuEventId) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('[data-event-menu]')) return;
      setMenuEventId(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuEventId]);

  const TYPE_OPTIONS = useMemo(() => {
    const all = [
      { value: 'session', label: 'Сессия' },
      { value: 'video', label: 'Видеовстреча' },
      { value: 'supervision', label: 'Супервизия' },
      { value: 'webinar', label: 'Вебинар' }
    ];
    if (isResearcherMode) return all.filter((o) => o.value !== 'session');
    return all;
  }, [isResearcherMode]);

  const FILTER_CHIPS = TYPE_OPTIONS;

  const typeLabel = (v: string) => {
    if (v === 'call') return 'Видеовстреча';
    return TYPE_OPTIONS.find((o) => o.value === v)?.label || v;
  };

  async function load() {
    try {
      const res = await api<{ items: any[] }>('/api/events', { token: token ?? undefined });
      setItems(res.items || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    }
  }

  function showToast(variant: 'success' | 'error', text: string) {
    setToast({ variant, text });
    window.setTimeout(() => setToast(null), 3400);
  }

  async function loadIncomingRequests() {
    if (
      isResearcherMode ||
      !token ||
      (user?.role !== 'psychologist' && user?.role !== 'researcher' && user?.role !== 'admin')
    ) {
      setIncomingRequests([]);
      return;
    }
    try {
      const res = await api<{ items: IncomingRequestItem[] }>('/api/events/incoming-requests', { token });
      setIncomingRequests(res.items || []);
    } catch {
      try {
        const res = await api<{ items: any[] }>('/api/events/calendar-booking-requests', { token });
        setIncomingRequests(
          (res.items || []).map((br: any) => ({
            id: `booking:${br.id}`,
            bookingId: br.id,
            supportRequestId: null,
            kind: br.source === 'match' || br.questionnaire ? 'match' : 'slot',
            contactName: br.contactName,
            contactEmail: br.contactEmail,
            contactPhone: br.contactPhone,
            slotStart: br.slotStart,
            slotEnd: br.slotEnd,
            message: br.message,
            questionnaire: br.questionnaire || null,
            createdAt: br.createdAt,
            canWrite: false,
            clientId: null
          }))
        );
      } catch {
        setIncomingRequests([]);
      }
    }
  }

  async function loadClients() {
    if (!token || (user?.role !== 'psychologist' && user?.role !== 'admin')) return;
    try {
      const res = await api<{ items: Array<{ id: string; name: string; email?: string }> }>('/api/clients', {
        token
      });
      setClients(res.items || []);
    } catch (e: any) {
      console.error('Failed to load clients:', e);
    }
  }

  async function loadRequiresAttention() {
    if (!token || (user?.role !== 'psychologist' && user?.role !== 'admin')) return;
    try {
      const res = await api<{
        requiresAttention: { clientsWithoutSessions: Array<{ id: string; name: string }> };
      }>('/api/analytics/dashboard', { token });
      setRequiresAttention(res.requiresAttention);
    } catch (e: any) {
      console.error('Failed to load requires attention:', e);
    }
  }

  async function ensureCalendarShareUrl(force = false): Promise<string | null> {
    if (!token) return null;
    if (calendarShareUrl && !force) return calendarShareUrl;
    try {
      const res = await api<{ token?: string; url?: string }>('/api/events/calendar-share', {
        method: 'POST',
        token
      });
      const shareToken = res.token || (res.url ? new URL(res.url, appOrigin()).searchParams.get('t') : null);
      if (!shareToken) {
        showToast('error', 'Не удалось создать ссылку');
        return null;
      }
      const url = calendarBookHrefFromToken(shareToken);
      setCalendarShareUrl(url);
      return url;
    } catch (e: any) {
      showToast('error', e.message || 'Не удалось создать ссылку');
      return null;
    }
  }

  useEffect(() => {
    if (!token) {
      setIsVerified(null);
      return;
    }
    checkVerification(token).then((result) => {
      setIsVerified(result.isVerified);
      setVerificationStatus(result.status);
    });
  }, [token]);

  useEffect(() => {
    if (isVerified !== false) {
      void load();
      void loadIncomingRequests();
    }
  }, [token, isVerified, user?.role]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash !== '#requests') return;
    const t = window.setTimeout(() => {
      document.getElementById('requests')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => window.clearTimeout(t);
  }, [incomingRequests.length, isVerified]);

  useEffect(() => {
    loadClients();
  }, [token, user]);

  useEffect(() => {
    loadRequiresAttention();
  }, [token, user]);

  useEffect(() => {
    if (!token) return;
    if (user?.role !== 'psychologist' && user?.role !== 'researcher' && user?.role !== 'admin') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api<{ prefs: unknown }>('/api/events/calendar-prefs', { token });
        if (cancelled) return;
        skipPrefsSaveRef.current = true;
        setCalendarPrefs({
          ...DEFAULT_CALENDAR_PREFS,
          ...mergeCalendarPrefsFromServer(res.prefs)
        });
      } catch {
        // keep defaults
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user?.role]);

  useEffect(() => {
    if (!token) return;
    if (user?.role !== 'psychologist' && user?.role !== 'researcher' && user?.role !== 'admin') return;
    if (skipPrefsSaveRef.current) {
      skipPrefsSaveRef.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      void api('/api/events/calendar-prefs', {
        method: 'PUT',
        token,
        body: { prefs: calendarPrefs }
      }).catch(() => {
        // ignore transient save errors
      });
    }, 700);
    return () => window.clearTimeout(t);
  }, [calendarPrefs, token, user?.role]);

  useEffect(() => {
    if (!token || isResearcherMode) return;
    if (user?.role !== 'psychologist' && user?.role !== 'researcher' && user?.role !== 'admin') return;
    void ensureCalendarShareUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isResearcherMode, user?.role]);
  usePsychologistPlatformTour({
    tourId: 'sessions',
    userId: user?.id,
    role: user?.role,
    enabled: Boolean(token && user?.role === 'psychologist' && isVerified === true),
    steps: PSYCHOLOGIST_SESSIONS_TOUR_STEPS
  });

  async function startInstantCall() {
    if (!token || startingCall) return;
    setError(null);
    setStartingCall(true);
    try {
      const ev = await api<any>('/api/events/instant-call', {
        method: 'POST',
        token,
        body: { title: 'Быстрый звонок' }
      });
      const roomId = eventRoomId(ev) || ev?.voiceRoom?.roomId;
      if (roomId) {
        navigate(`/room/${roomId}`);
        return;
      }
      await load();
    } catch (e: any) {
      setError(e.message || 'Не удалось начать звонок');
    } finally {
      setStartingCall(false);
    }
  }

  function resetPlanForm() {
    setTitle('');
    setDescription('');
    setStartsAt('');
    setEndsAt('');
    setSelectedClientId('');
    setStartDate('');
    setStartTime('');
    setDurationMin(60);
    setType('video');
    setEditingEventId(null);
  }

  function openPlanModal() {
    resetPlanForm();
    setShowModal(true);
  }

  function openReschedule(ev: any) {
    setEditingEventId(ev.id);
    setTitle(String(ev.title || ''));
    const rawType = String(ev.type || 'video');
    setType(rawType === 'call' ? 'video' : rawType);
    setDescription(String(ev.description || ''));
    setSelectedClientId(ev.clientId ? String(ev.clientId) : '');
    const start = new Date(ev.startsAt);
    const end = ev.endsAt ? new Date(ev.endsAt) : null;
    setStartsAt(toLocalInputValue(start));
    if (end && !Number.isNaN(end.getTime())) {
      const mins = Math.max(30, Math.round((end.getTime() - start.getTime()) / 60000));
      setDurationMin(Math.round(mins / 30) * 30 || 60);
    } else {
      setDurationMin(60);
    }
    setMenuEventId(null);
    setShowModal(true);
  }

  async function submitEvent(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !startsAt) return;
    try {
      setSubmitting(true);
      const body = {
        title: title.trim(),
        type,
        description,
        startsAt,
        endsAt: endsAt || null,
        clientId: selectedClientId || null
      };
      if (editingEventId) {
        await api(`/api/events/${editingEventId}`, {
          method: 'PUT',
          token: token ?? undefined,
          body
        });
      } else {
        await api('/api/events', {
          method: 'POST',
          token: token ?? undefined,
          body
        });
      }
      resetPlanForm();
      setShowModal(false);
      await load();
      await loadRequiresAttention();
      await loadIncomingRequests();
    } catch (err: any) {
      setError(err.message || (editingEventId ? 'Не удалось перенести событие' : 'Не удалось создать событие'));
    } finally {
      setSubmitting(false);
    }
  }

  function openCreateSessionForClient(clientId: string, clientName: string) {
    resetPlanForm();
    setSelectedClientId(clientId);
    setType('session');
    setTitle(`Сессия с ${clientName}`);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    setDurationMin(60);
    setStartsAt(toLocalInputValue(tomorrow));
    setShowModal(true);
  }

  async function deleteEvent(id: string) {
    if (!confirm('Удалить событие?')) return;
    setError(null);
    setMenuEventId(null);
    try {
      await api(`/api/events/${id}`, { method: 'DELETE', token: token ?? undefined });
      await load();
    } catch (e: any) {
      setError(e.message || 'Failed to delete');
    }
  }

  async function copyGuestInviteLink(ev: any) {
    const roomId = eventRoomId(ev);
    if (!roomId) return;
    const invite = guestInviteHrefFromId(roomId);
    const timeLabel = `${new Date(ev.startsAt).toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}${
      ev.endsAt
        ? ` – ${new Date(ev.endsAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
        : ''
    }`;
    const inviteTitle = String(ev.title || 'Видеовстреча').trim() || 'Видеовстреча';
    const body =
      `JungAI — приглашение на видеозвонок\n` +
      `Встреча: ${inviteTitle}\n` +
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

  async function copyPublicCalendarLink() {
    const url = await ensureCalendarShareUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      showToast('success', 'Ссылка на календарь скопирована в буфер обмена');
    } catch {
      showToast('error', 'Не удалось скопировать');
    }
  }

  const canCreate = user?.role === 'psychologist' || user?.role === 'researcher' || user?.role === 'admin';

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

  useEffect(() => {
    if (showModal) {
      const t = setTimeout(() => titleRef.current?.focus(), 50);
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setShowModal(false);
          setEditingEventId(null);
        }
      };
      window.addEventListener('keydown', onKey);
      return () => {
        clearTimeout(t);
        window.removeEventListener('keydown', onKey);
      };
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

  const visibleItems = useMemo(() => {
    const list = items || [];
    if (!isResearcherMode) return list;
    return list.filter((ev: any) => String(ev.type) !== 'session');
  }, [items, isResearcherMode]);

  const activeItems = useMemo(() => {
    return visibleItems.filter((ev: any) => {
      const endTs = new Date(ev.endsAt || ev.startsAt).getTime();
      return endTs >= nowMs;
    });
  }, [visibleItems, nowMs]);

  const historyItems = useMemo(() => {
    return visibleItems.filter((ev: any) => {
      const endTs = new Date(ev.endsAt || ev.startsAt).getTime();
      return endTs < nowMs;
    });
  }, [visibleItems, nowMs]);

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    let filtered = activeItems;
    if (typeFilters.length) {
      filtered = filtered.filter((ev) => eventTypeMatchesFilters(String(ev.type), typeFilters));
    }
    for (const ev of filtered) {
      const d = new Date(ev.startsAt);
      const key = d.toISOString().slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [activeItems, typeFilters]);

  const historyGrouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    let filtered = historyItems;
    if (typeFilters.length) {
      filtered = filtered.filter((ev) => eventTypeMatchesFilters(String(ev.type), typeFilters));
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
    return (activeItems || [])
      .filter((ev) => new Date(ev.endsAt || ev.startsAt).getTime() >= nowMs)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0] || null;
  }, [activeItems, nowMs]);

  const eventsByDay = useMemo(() => {
    const list =
      typeFilters.length > 0
        ? (items || []).filter((ev) => eventTypeMatchesFilters(String(ev.type), typeFilters))
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

  function openCalendarModal(tab: 'calendar' | 'settings' = 'calendar') {
    const t = new Date();
    t.setDate(1);
    t.setHours(0, 0, 0, 0);
    setCalendarMonth(t);
    setCalendarSelectedDay(dayKeyFromDate(new Date()));
    setCalendarModalTab(tab);
    setSettingsHelpOpen(false);
    setShowCalendarModal(true);
  }

  function openAddClientFromEvent(ev: any) {
    const q = (ev.guestQuestionnaire || {}) as Record<string, unknown>;
    setAddClientEvent(ev);
    setAddClientName(String(ev.guestName || q.contactName || ''));
    setAddClientEmail(String(ev.guestEmail || q.contactEmail || ''));
    setAddClientPhone(String(ev.guestPhone || q.contactPhone || ''));
  }

  async function submitAddClientFromEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !addClientEvent) return;
    setAddClientSaving(true);
    try {
      const created = await api<{ id: string }>('/api/clients', {
        method: 'POST',
        token,
        body: {
          name: addClientName.trim(),
          email: addClientEmail.trim(),
          phone: addClientPhone.trim() || undefined,
          tags: []
        }
      });
      await api(`/api/events/${addClientEvent.id}/attach-client`, {
        method: 'POST',
        token,
        body: { clientId: created.id }
      });
      showToast('success', 'Клиент добавлен и привязан к встрече');
      setAddClientEvent(null);
      await load();
      await loadClients();
    } catch (err: any) {
      showToast('error', err?.message || 'Не удалось добавить клиента');
    } finally {
      setAddClientSaving(false);
    }
  }

  async function acceptPsychSessionRequest(eventId: string) {
    if (!token) return;
    try {
      await api(`/api/events/${eventId}/session-status`, {
        method: 'PUT',
        token,
        body: { status: 'accepted' }
      });
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

  function statusBadge(ev: any) {
    const clientBookPending =
      String(ev.type) === 'session' && ev.sessionStatus === 'pending' && Boolean(ev.clientRequestedSession);
    if (ev.sessionStatus === 'accepted') {
      return <span className="events-page__badge events-page__badge--sage">подтверждена</span>;
    }
    if (ev.sessionStatus === 'declined') {
      return <span className="events-page__badge events-page__badge--danger">отклонена</span>;
    }
    if (String(ev.type) === 'session' && ev.sessionStatus === 'pending' && clientBookPending) {
      return <span className="events-page__badge events-page__badge--warning">заявка клиента</span>;
    }
    if (String(ev.type) === 'session' && ev.sessionStatus === 'pending') {
      return <span className="events-page__badge events-page__badge--warning">ожидает</span>;
    }
    if (ev.sessionStatus === 'pending') {
      return <span className="events-page__badge events-page__badge--warning">ожидает</span>;
    }
    return null;
  }

  function roomJoinTitle(ev: any): string {
    if (canJoinRoom(ev, nowMs)) return 'Открыть комнату';
    return 'Комната доступна за 15 минут до начала';
  }

  function renderRoomButton(ev: any, primary = false) {
    const roomId = eventRoomId(ev);
    if (!roomId) return null;
    const href = roomHrefFromId(roomId);
    const enabled = canJoinRoom(ev, nowMs);
    const cls = primary
      ? 'events-page__btn events-page__btn--sm'
      : 'events-page__btn events-page__btn--secondary events-page__btn--sm';
    if (!enabled) {
      return (
        <button type="button" className={cls} disabled title={roomJoinTitle(ev)}>
          <Video size={14} strokeWidth={2} aria-hidden />
          <span>Комната</span>
        </button>
      );
    }
    return (
      <a href={href} className={cls} title={roomJoinTitle(ev)}>
        <Video size={14} strokeWidth={2} aria-hidden />
        <span>Комната</span>
      </a>
    );
  }

  function renderUpcomingEventCard(ev: any) {
    const timeLabel = `${new Date(ev.startsAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })}${
      ev.endsAt
        ? `–${new Date(ev.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : ''
    }`;
    const clientBookPending =
      String(ev.type) === 'session' && ev.sessionStatus === 'pending' && Boolean(ev.clientRequestedSession);
    const cName = clientNameFromEvent(ev, clients);
    const canManage = user?.role === 'psychologist' || user?.role === 'researcher' || user?.role === 'admin';
    const badge = statusBadge(ev);

    return (
      <div key={ev.id} className="events-page__event">
        <div className="events-page__event-top">
          <span className="events-page__event-time">{timeLabel}</span>
          <span className="events-page__badge events-page__badge--type">{typeLabel(String(ev.type))}</span>
          {Boolean(ev.isFirstMeeting) && (
            <span className="events-page__badge events-page__badge--peach">Первая встреча</span>
          )}
          {badge}
        </div>
        <div className="events-page__event-title">{ev.title}</div>
        {cName && (
          <div className="events-page__event-client">
            {cName}
            {isGuestParticipant(ev) && !ev.clientId ? (
              <span className="events-page__badge events-page__badge--muted" style={{ marginLeft: 8 }}>
                гость
              </span>
            ) : null}
          </div>
        )}

        {clientBookPending && canManage ? (
          <div className="events-page__event-actions">
            <button
              type="button"
              className="events-page__btn events-page__btn--sm"
              onClick={() => void acceptPsychSessionRequest(ev.id)}
            >
              <Check size={15} />
              Подтвердить запись
            </button>
            <button
              type="button"
              className="events-page__btn events-page__btn--secondary events-page__btn--sm"
              onClick={() => {
                setPsychSessionDeclineId(ev.id);
                setPsychSessionDeclineDraft('');
              }}
            >
              <X size={15} />
              Отклонить
            </button>
          </div>
        ) : (
          <div className="events-page__event-actions">
            {renderRoomButton(ev)}
            {eventRoomId(ev) && (
              <button
                type="button"
                className="events-page__btn events-page__btn--secondary events-page__btn--sm"
                onClick={() => copyGuestInviteLink(ev)}
              >
                <Link2 size={14} strokeWidth={2} aria-hidden />
                <span>Ссылка</span>
              </button>
            )}
            {canManage && isGuestParticipant(ev) && !ev.clientId && (
              <button
                type="button"
                className="events-page__btn events-page__btn--secondary events-page__btn--sm"
                onClick={() => openAddClientFromEvent(ev)}
              >
                В клиенты
              </button>
            )}
            {canManage && (
              <div className="events-page__menu-wrap" data-event-menu>
                <button
                  type="button"
                  className="events-page__menu-btn"
                  aria-label="Меню события"
                  onClick={() => setMenuEventId((id) => (id === ev.id ? null : ev.id))}
                >
                  <MoreHorizontal size={18} strokeWidth={2.25} aria-hidden />
                </button>
                {menuEventId === ev.id && (
                  <div className="events-page__menu" role="menu">
                    <button
                      type="button"
                      className="events-page__menu-item"
                      role="menuitem"
                      onClick={() => openReschedule(ev)}
                    >
                      Перенести
                    </button>
                    <button
                      type="button"
                      className="events-page__menu-item events-page__menu-item--danger"
                      role="menuitem"
                      onClick={() => void deleteEvent(ev.id)}
                    >
                      Удалить
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderHistoryEventCard(ev: any) {
    const cName = clientNameFromEvent(ev, clients);
    const showConvertBanner =
      Boolean(ev.isFirstMeeting) &&
      !ev.clientId &&
      Boolean(ev.guestEmail || ev.guestName) &&
      new Date(ev.endsAt || ev.startsAt).getTime() < nowMs;
    return (
      <div key={ev.id} className="events-page__event events-page__event--history">
        <div className="events-page__event-top">
          <span className="events-page__event-time">
            {new Date(ev.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {ev.endsAt
              ? `–${new Date(ev.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : ''}
          </span>
          <span className="events-page__badge events-page__badge--type">{typeLabel(String(ev.type))}</span>
          {Boolean(ev.isFirstMeeting) && (
            <span className="events-page__badge events-page__badge--peach">Первая встреча</span>
          )}
          <span className="events-page__badge events-page__badge--muted">Прошла</span>
        </div>
        <div className="events-page__event-title">{ev.title}</div>
        {cName && <div className="events-page__event-client">{cName}</div>}
        {showConvertBanner ? (
          <div className="events-page__first-meet-banner">
            <span>Первая встреча прошла — добавить в клиенты?</span>
            <button
              type="button"
              className="events-page__btn events-page__btn--secondary events-page__btn--sm"
              onClick={() => openAddClientFromEvent(ev)}
            >
              В клиенты
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  const planSummaryDate = startDate
    ? new Date(`${startDate}T12:00:00`).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long'
      })
    : 'дата не выбрана';
  const planSummary = `${typeLabel(type)} · ${startTime || '--:--'} · ${planSummaryDate}`;
  const planValid = Boolean(title.trim() && startsAt);

  if (token && isVerified === false) {
    return (
      <div className="events-page">
        {isResearcherMode ? <ResearcherNavbar /> : <PsychologistNavbar />}
        <VerificationRequired verificationStatus={verificationStatus} />
      </div>
    );
  }

  return (
    <div className="events-page">
      {isResearcherMode ? <ResearcherNavbar /> : <PsychologistNavbar />}
      <main className={`events-page__main${narrowLayout ? ' events-page__main--narrow' : ''}`}>
        <div className="events-page__header" data-tour="events-header">
          <div>
            <h1 className="events-page__h1">
              {isResearcherMode ? 'Звонки и встречи' : 'Сессии и встречи'}
            </h1>
            <div className="events-page__sub">Часовой пояс: {timeZone}</div>
          </div>
          <div className="events-page__header-actions">
            {!isResearcherMode && (
              <PsychologistTourHelpButton
                tourId="sessions"
                steps={PSYCHOLOGIST_SESSIONS_TOUR_STEPS}
                userId={user?.id}
                role={user?.role}
              />
            )}
            {canCreate && (
              <>
                <button
                  type="button"
                  className="events-page__btn events-page__btn--secondary"
                  onClick={() => openCalendarModal('calendar')}
                >
                  <CalendarDays size={18} />
                  Календарь
                </button>
                <button type="button" className="events-page__btn" onClick={openPlanModal}>
                  <CalendarPlus size={16} />
                  Запланировать встречу
                </button>
              </>
            )}
          </div>
        </div>

        {toast && (
          <div
            role="status"
            className={`events-page__toast events-page__toast--${toast.variant}`}
          >
            {toast.variant === 'success' ? (
              <CheckCircle2 size={22} style={{ flexShrink: 0 }} />
            ) : (
              <X size={22} style={{ flexShrink: 0 }} />
            )}
            <div>{toast.text}</div>
          </div>
        )}
        {error && <div className="events-page__error">{error}</div>}

        <div className="events-page__toolbar" data-tour="events-toolbar">
          <div className="events-page__tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={!showHistory}
              className={`events-page__tab${!showHistory ? ' is-active' : ''}`}
              onClick={() => setShowHistory(false)}
            >
              Предстоящие
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={showHistory}
              className={`events-page__tab${showHistory ? ' is-active' : ''}`}
              onClick={() => setShowHistory(true)}
            >
              История
            </button>
          </div>
          <div className="events-page__chips">
            {FILTER_CHIPS.map((chip) => {
              const active = typeFilters.includes(chip.value);
              return (
                <button
                  key={chip.value}
                  type="button"
                  className={`events-page__chip${active ? ' is-active' : ''}`}
                  onClick={() =>
                    setTypeFilters((prev) =>
                      active ? prev.filter((x) => x !== chip.value) : [...prev, chip.value]
                    )
                  }
                >
                  {chip.label}
                </button>
              );
            })}
            {typeFilters.length > 0 && (
              <button
                type="button"
                className="events-page__chip events-page__chip--reset"
                onClick={() => setTypeFilters([])}
              >
                Сбросить
              </button>
            )}
          </div>
        </div>

        <div className="events-page__grid">
          <div className="events-page__col-left">
            {!showHistory &&
              !isResearcherMode &&
              token &&
              (user?.role === 'psychologist' || user?.role === 'researcher' || user?.role === 'admin') &&
              isVerified === true && (
                <EventsIncomingRequests
                  token={token}
                  items={incomingRequests}
                  onChanged={() => {
                    void load();
                    void loadIncomingRequests();
                  }}
                  onToast={showToast}
                />
              )}

            {!showHistory && nearestUpcoming && (
              <div className="events-page__card">
                <h3 className="events-page__card-title">
                  <CalendarClock size={16} />
                  Ближайшая
                </h3>
                <div className="events-page__nearest-dt">
                  {new Date(nearestUpcoming.startsAt).toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                  {nearestUpcoming.endsAt
                    ? ` – ${new Date(nearestUpcoming.endsAt).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}`
                    : ''}
                </div>
                <div
                  className={`events-page__nearest-countdown${
                    formatCountdown(nearestUpcoming.startsAt, nowMs) === 'сейчас' ? ' is-now' : ''
                  }`}
                >
                  {formatCountdown(nearestUpcoming.startsAt, nowMs)}
                </div>
                <div className="events-page__event-title" style={{ marginTop: 8 }}>
                  {nearestUpcoming.title}
                </div>
                {clientNameFromEvent(nearestUpcoming, clients) && (
                  <div className="events-page__nearest-client">
                    {clientNameFromEvent(nearestUpcoming, clients)}
                  </div>
                )}
                <div className="events-page__nearest-meta">
                  <span className="events-page__badge events-page__badge--type">
                    {typeLabel(String(nearestUpcoming.type))}
                  </span>
                  {Boolean(nearestUpcoming.isFirstMeeting) && (
                    <span className="events-page__badge events-page__badge--peach">Первая встреча</span>
                  )}
                  {statusBadge(nearestUpcoming)}
                </div>
                <div className="events-page__nearest-actions">
                  {renderRoomButton(nearestUpcoming, true)}
                  {eventRoomId(nearestUpcoming) && (
                    <button
                      type="button"
                      className="events-page__btn events-page__btn--secondary events-page__btn--sm"
                      onClick={() => copyGuestInviteLink(nearestUpcoming)}
                    >
                      <Link2 size={14} strokeWidth={2} aria-hidden />
                      <span>Ссылка</span>
                    </button>
                  )}
                  {canCreate && isGuestParticipant(nearestUpcoming) && !nearestUpcoming.clientId && (
                    <button
                      type="button"
                      className="events-page__btn events-page__btn--secondary events-page__btn--sm"
                      onClick={() => openAddClientFromEvent(nearestUpcoming)}
                    >
                      В клиенты
                    </button>
                  )}
                  {canCreate && (
                    <button
                      type="button"
                      className="events-page__btn events-page__btn--ghost events-page__btn--sm"
                      onClick={() => openReschedule(nearestUpcoming)}
                    >
                      Перенести
                    </button>
                  )}
                </div>
              </div>
            )}

            <div data-tour="events-list">
              {!showHistory && grouped.length === 0 && (
                <div className="events-page__card events-page__empty">
                  <div className="events-page__empty-title">Нет запланированных событий</div>
                  <p className="events-page__empty-sub">
                    Нажмите «Запланировать встречу», чтобы создать звонок или встречу.
                  </p>
                </div>
              )}
              {!showHistory &&
                grouped.map(([day, events]) => (
                  <div key={day} className="events-page__day-block">
                    <div className="events-page__day-label">
                      {new Date(day).toLocaleDateString('ru-RU', {
                        weekday: 'long',
                        day: '2-digit',
                        month: 'long'
                      })}
                    </div>
                    {events
                      .sort(
                        (a: any, b: any) =>
                          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
                      )
                      .map((ev: any) => renderUpcomingEventCard(ev))}
                  </div>
                ))}
              {showHistory && historyGrouped.length === 0 && (
                <div className="events-page__card events-page__empty">
                  <div className="events-page__empty-title">История пока пуста</div>
                  <p className="events-page__empty-sub">Прошедшие встречи будут отображаться здесь.</p>
                </div>
              )}
              {showHistory &&
                historyGrouped.map(([day, events]) => (
                  <div key={day} className="events-page__day-block">
                    <div className="events-page__day-label">
                      {new Date(day).toLocaleDateString('ru-RU', {
                        weekday: 'long',
                        day: '2-digit',
                        month: 'long'
                      })}
                    </div>
                    {events
                      .sort(
                        (a: any, b: any) =>
                          new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
                      )
                      .map((ev: any) => renderHistoryEventCard(ev))}
                  </div>
                ))}
            </div>
          </div>

          <div className="events-page__col-right">
            {!isResearcherMode &&
              (user?.role === 'psychologist' || user?.role === 'researcher' || user?.role === 'admin') && (
                <div className="events-page__card">
                  <h3 className="events-page__card-title">Публичный календарь</h3>
                  <div
                    className="events-page__status-pill"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Check size={14} />
                      {calendarPrefs.bookingByLinkEnabled
                        ? 'Запись по ссылке включена'
                        : 'Запись по ссылке выключена'}
                    </span>
                    <button
                      type="button"
                      className="events-page__btn events-page__btn--secondary events-page__btn--sm"
                      onClick={() =>
                        setCalendarPrefs((prev) => ({
                          ...prev,
                          bookingByLinkEnabled: !prev.bookingByLinkEnabled,
                        }))
                      }
                      title={
                        calendarPrefs.bookingByLinkEnabled
                          ? 'Выключить запись по ссылке'
                          : 'Включить запись по ссылке'
                      }
                    >
                      {calendarPrefs.bookingByLinkEnabled ? 'Выкл' : 'Вкл'}
                    </button>
                  </div>
                  <div className="events-page__share-row">
                    <input
                      className="events-page__share-input"
                      readOnly
                      value={calendarShareUrl || 'Ссылка загружается…'}
                      onFocus={() => void ensureCalendarShareUrl()}
                    />
                    <button
                      type="button"
                      className="events-page__btn events-page__btn--secondary events-page__btn--sm"
                      onClick={() => void copyPublicCalendarLink()}
                      title="Копировать"
                    >
                      <Link2 size={14} />
                    </button>
                  </div>
                  <div className="events-page__stack-btns">
                    <a
                      className="events-page__btn events-page__btn--secondary events-page__btn--block"
                      href={calendarShareUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        if (!calendarShareUrl) {
                          e.preventDefault();
                          void ensureCalendarShareUrl().then((url) => {
                            if (url) window.open(url, '_blank', 'noopener,noreferrer');
                          });
                        }
                      }}
                    >
                      Открыть страницу записи
                    </a>
                    <button
                      type="button"
                      className="events-page__btn events-page__btn--secondary events-page__btn--block"
                      onClick={() => openCalendarModal('settings')}
                    >
                      <Settings2 size={16} />
                      Настройки доступности
                    </button>
                  </div>
                  <p className="events-page__card-micro">
                    Клиенты записываются сами — вы подтверждаете
                  </p>
                </div>
              )}

            {!isResearcherMode &&
              requiresAttention &&
              requiresAttention.clientsWithoutSessions.length > 0 && (
                <div className="events-page__card" data-tour="events-attention">
                  <h3 className="events-page__card-title">
                    <CircleAlert size={16} />
                    Требуют внимания
                  </h3>
                  <div className="events-page__card-micro" style={{ marginTop: 0, marginBottom: 10 }}>
                    Клиенты без сессий {'>'}2 недель
                  </div>
                  <div className="events-page__attention-list">
                    {requiresAttention.clientsWithoutSessions.map((client) => (
                      <div key={client.id} className="events-page__attention-row">
                        <span className="events-page__attention-name">{client.name}</span>
                        <button
                          type="button"
                          className="events-page__btn events-page__btn--sm"
                          onClick={() => openCreateSessionForClient(client.id, client.name)}
                        >
                          <CalendarPlus size={13} />
                          Предложить время
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {canCreate && (
              <div className="events-page__card">
                <h3 className="events-page__card-title">
                  <Video size={16} />
                  Быстрый звонок
                </h3>
                <button
                  type="button"
                  className="events-page__btn events-page__btn--block"
                  onClick={() => void startInstantCall()}
                  disabled={startingCall}
                >
                  {startingCall ? 'Подключение…' : 'Создать комнату сейчас и получить ссылку'}
                </button>
              </div>
            )}
          </div>
        </div>

        {addClientEvent && (
          <div
            className="events-page__modal-overlay"
            onClick={() => setAddClientEvent(null)}
            role="presentation"
          >
            <div
              className="events-page__modal events-page__modal--narrow-dlg"
              role="dialog"
              aria-modal="true"
              aria-label="Добавить в клиенты"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="events-page__dlg-head">
                <div className="events-page__modal-title">Добавить в клиенты</div>
                <div className="events-page__modal-sub">
                  Данные из анкеты подставлены — проверьте перед сохранением.
                </div>
              </div>
              <form onSubmit={(e) => void submitAddClientFromEvent(e)} className="events-page__dlg-form">
                <label className="events-page__dlg-label" htmlFor="events-add-client-name">
                  Имя
                </label>
                <input
                  id="events-add-client-name"
                  className="events-page__field"
                  required
                  placeholder="Имя *"
                  value={addClientName}
                  onChange={(e) => setAddClientName(e.target.value)}
                />
                <label className="events-page__dlg-label" htmlFor="events-add-client-email">
                  Email
                </label>
                <input
                  id="events-add-client-email"
                  className="events-page__field"
                  required
                  type="email"
                  placeholder="Email *"
                  value={addClientEmail}
                  onChange={(e) => setAddClientEmail(e.target.value)}
                />
                <label className="events-page__dlg-label" htmlFor="events-add-client-phone">
                  Телефон
                </label>
                <input
                  id="events-add-client-phone"
                  className="events-page__field"
                  placeholder="Телефон"
                  value={addClientPhone}
                  onChange={(e) => setAddClientPhone(e.target.value)}
                />
                <div className="events-page__dlg-actions">
                  <button
                    type="button"
                    className="events-page__btn events-page__btn--secondary"
                    onClick={() => setAddClientEvent(null)}
                  >
                    Отмена
                  </button>
                  <button type="submit" className="events-page__btn" disabled={addClientSaving}>
                    {addClientSaving ? 'Сохранение…' : 'Добавить'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {psychSessionDeclineId && (
          <div
            className="events-page__modal-overlay"
            onClick={() => setPsychSessionDeclineId(null)}
            role="presentation"
          >
            <div
              className="events-page__modal events-page__modal--narrow-dlg"
              role="dialog"
              aria-modal="true"
              aria-label="Отклонить запись клиента"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="events-page__dlg-head">
                <div className="events-page__modal-title">Отклонить запись клиента</div>
                <div className="events-page__modal-sub">
                  По желанию укажите комментарий — клиент увидит его в карточке сессии.
                </div>
              </div>
              <label className="events-page__dlg-label" htmlFor="events-psych-decline-comment">
                Комментарий
              </label>
              <textarea
                id="events-psych-decline-comment"
                className="events-page__field events-page__field--area"
                value={psychSessionDeclineDraft}
                onChange={(e) => setPsychSessionDeclineDraft(e.target.value)}
                rows={4}
                placeholder="Комментарий (необязательно)"
              />
              <div className="events-page__dlg-actions">
                <button
                  type="button"
                  className="events-page__btn events-page__btn--secondary"
                  onClick={() => setPsychSessionDeclineId(null)}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="events-page__btn events-page__btn--danger"
                  onClick={() => void submitPsychSessionDecline()}
                >
                  Отклонить запись
                </button>
              </div>
            </div>
          </div>
        )}

        {showCalendarModal && (
          <div
            className={`events-page__modal-overlay events-page__modal-overlay--stretch${
              narrowLayout ? ' events-page__modal-overlay--narrow' : ''
            }`}
            role="presentation"
          >
            <div
              className={`events-page__modal events-page__modal--calendar${
                narrowLayout ? ' is-narrow' : ''
              }`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="events-calendar-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="events-page__modal-head">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div id="events-calendar-title" className="events-page__modal-title">
                    {calendarModalTab === 'calendar' ? 'Календарь занятости' : 'Настройки доступности'}
                  </div>
                  <div className="events-page__modal-sub">
                    {calendarModalTab === 'calendar'
                      ? 'Свободные промежутки считаются по рабочему дню, обеду и перерывам.'
                      : 'Настройки влияют на ваш календарь и публичную страницу записи.'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {calendarModalTab === 'settings' && (
                    <div className="events-page__info-tip">
                      <button
                        type="button"
                        className="events-page__info-btn"
                        aria-label="Справка по настройкам"
                        aria-expanded={settingsHelpOpen}
                        onClick={() => setSettingsHelpOpen((v) => !v)}
                      >
                        <Info size={16} />
                      </button>
                      {settingsHelpOpen && (
                        <div className="events-page__info-popover" role="tooltip">
                          В ячейках календаря показаны свободные промежутки не короче выбранного шага
                          слота и сами слоты по этому шагу. Внизу при выборе дня — свободные слоты и
                          список встреч. Занятость расширяется на «перерыв после встречи». Эти же
                          правила используются на публичной странице записи.
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    className="events-page__btn events-page__btn--secondary events-page__btn--sm events-page__btn--icon"
                    aria-label={
                      calendarModalTab === 'calendar' ? 'Настройки календаря' : 'Вернуться к календарю'
                    }
                    aria-pressed={calendarModalTab === 'settings'}
                    onClick={() =>
                      setCalendarModalTab((t) => (t === 'calendar' ? 'settings' : 'calendar'))
                    }
                  >
                    <Settings2 size={18} strokeWidth={2} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="events-page__btn events-page__btn--secondary events-page__btn--sm"
                    onClick={() => setShowCalendarModal(false)}
                  >
                    Закрыть
                  </button>
                </div>
              </div>

              {calendarModalTab === 'calendar' && (
                <div className="events-page__cal-toolbar">
                  <div className="events-page__cal-nav">
                    <button
                      type="button"
                      className="events-page__btn events-page__btn--secondary events-page__btn--sm"
                      aria-label="Предыдущий месяц"
                      onClick={() =>
                        setCalendarMonth((prev) => {
                          const d = new Date(prev);
                          d.setMonth(d.getMonth() - 1);
                          return d;
                        })
                      }
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <div className="events-page__cal-month">{calendarView.title}</div>
                    <button
                      type="button"
                      className="events-page__btn events-page__btn--secondary events-page__btn--sm"
                      aria-label="Следующий месяц"
                      onClick={() =>
                        setCalendarMonth((prev) => {
                          const d = new Date(prev);
                          d.setMonth(d.getMonth() + 1);
                          return d;
                        })
                      }
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                  <div className="events-page__cal-legend">
                    <span className="events-page__cal-legend-item">
                      <span className="events-page__cal-dot events-page__cal-dot--sage" />
                      Есть окна
                    </span>
                    <span className="events-page__cal-legend-item">
                      <span className="events-page__cal-dot events-page__cal-dot--warning" />
                      Частично
                    </span>
                    <span className="events-page__cal-legend-item">
                      <span className="events-page__cal-dot events-page__cal-dot--brand" />
                      Занято
                    </span>
                  </div>
                </div>
              )}

              <div
                className="events-page__cal-scroll"
                style={{
                  padding: calendarModalTab === 'settings' ? (narrowLayout ? '12px 14px 16px' : '16px 20px 20px') : undefined
                }}
              >
                {calendarModalTab === 'settings' ? (
                  <div style={{ display: 'grid', gap: 18 }}>
                    <div className="events-page__settings-grid">
                      <label>
                        <span className="events-page__field-label">Начало рабочего дня</span>
                        <select
                          className="events-page__field"
                          value={calendarPrefs.workStartHour}
                          onChange={(e) =>
                            setCalendarPrefs((p) => ({
                              ...p,
                              workStartHour: clampInt(e.target.value, 0, 23, p.workStartHour)
                            }))
                          }
                        >
                          {Array.from({ length: 18 }, (_, i) => i + 6).map((h) => (
                            <option key={h} value={h}>
                              {pad2(h)}:00
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span className="events-page__field-label">Конец рабочего дня</span>
                        <select
                          className="events-page__field"
                          value={calendarPrefs.workEndHour}
                          onChange={(e) =>
                            setCalendarPrefs((p) => ({
                              ...p,
                              workEndHour: clampInt(e.target.value, 1, 24, p.workEndHour)
                            }))
                          }
                        >
                          {Array.from({ length: 18 }, (_, i) => i + 7).map((h) => (
                            <option key={h} value={h}>
                              {h === 24 ? '24:00' : `${pad2(h)}:00`}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span className="events-page__field-label">Шаг слотов (показ)</span>
                        <select
                          className="events-page__field"
                          value={calendarPrefs.slotIntervalMinutes}
                          onChange={(e) => {
                            const slotIntervalMinutes = Number(
                              e.target.value
                            ) as CalendarPrefs['slotIntervalMinutes'];
                            setCalendarPrefs((p) => ({
                              ...p,
                              slotIntervalMinutes,
                              minFreeSegmentMinutes: slotIntervalMinutes
                            }));
                          }
                          }
                        >
                          {SLOT_INTERVAL_MINUTES_OPTIONS.map((m) => (
                            <option key={m} value={m}>
                              {m < 60
                                ? `${m} мин`
                                : m === 60
                                  ? '1 час'
                                  : m === 90
                                    ? '1 ч 30 мин'
                                    : '2 часа'}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span className="events-page__field-label">Перерыв после встречи</span>
                        <input
                          className="events-page__field"
                          type="number"
                          min={0}
                          max={180}
                          step={5}
                          value={calendarPrefs.breakAfterEventMinutes}
                          onChange={(e) =>
                            setCalendarPrefs((p) => ({
                              ...p,
                              breakAfterEventMinutes: clampInt(
                                e.target.value,
                                0,
                                180,
                                p.breakAfterEventMinutes
                              )
                            }))
                          }
                        />
                      </label>
                    </div>

                    <label className="events-page__check">
                      <input
                        type="checkbox"
                        checked={calendarPrefs.weekendsOff}
                        onChange={(e) =>
                          setCalendarPrefs((p) => ({ ...p, weekendsOff: e.target.checked }))
                        }
                      />
                      Считать субботу и воскресенье выходными
                    </label>

                    <label className="events-page__check">
                      <input
                        type="checkbox"
                        checked={calendarPrefs.useCustomDaysOff}
                        onChange={(e) =>
                          setCalendarPrefs((p) => ({ ...p, useCustomDaysOff: e.target.checked }))
                        }
                      />
                      Произвольные выходные
                    </label>
                    {calendarPrefs.useCustomDaysOff && (
                      <div style={{ display: 'grid', gap: 10 }}>
                        <div style={{ fontSize: 13, color: 'var(--ink-muted)', fontWeight: 600 }}>
                          Добавьте даты, когда приёма нет (праздники, отпуск и т.д.).
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                          <input
                            className="events-page__field"
                            type="date"
                            value={dayOffPicker}
                            onChange={(e) => setDayOffPicker(e.target.value)}
                            style={{ width: 'auto' }}
                          />
                          <button
                            type="button"
                            className="events-page__btn events-page__btn--secondary events-page__btn--sm"
                            onClick={() => {
                              if (!dayOffPicker) return;
                              setCalendarPrefs((p) => ({
                                ...p,
                                customDaysOff: [...new Set([...p.customDaysOff, dayOffPicker])].sort()
                              }));
                              setDayOffPicker('');
                            }}
                          >
                            Добавить дату
                          </button>
                        </div>
                        {calendarPrefs.customDaysOff.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {calendarPrefs.customDaysOff.map((dk) => (
                              <span key={dk} className="events-page__dayoff-chip">
                                {new Date(`${dk}T12:00:00`).toLocaleDateString('ru-RU', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                                <button
                                  type="button"
                                  aria-label="Удалить дату"
                                  onClick={() =>
                                    setCalendarPrefs((p) => ({
                                      ...p,
                                      customDaysOff: p.customDaysOff.filter((x) => x !== dk)
                                    }))
                                  }
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <label className="events-page__check">
                      <input
                        type="checkbox"
                        checked={calendarPrefs.lunchEnabled}
                        onChange={(e) =>
                          setCalendarPrefs((p) => ({ ...p, lunchEnabled: e.target.checked }))
                        }
                      />
                      Вычитать обед из свободного времени
                    </label>
                    {calendarPrefs.lunchEnabled && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'end' }}>
                        <label>
                          <span className="events-page__field-label">Обед с</span>
                          <input
                            className="events-page__field"
                            type="time"
                            value={calendarPrefs.lunchStart}
                            onChange={(e) =>
                              setCalendarPrefs((p) => ({ ...p, lunchStart: e.target.value }))
                            }
                          />
                        </label>
                        <label>
                          <span className="events-page__field-label">до</span>
                          <input
                            className="events-page__field"
                            type="time"
                            value={calendarPrefs.lunchEnd}
                            onChange={(e) =>
                              setCalendarPrefs((p) => ({ ...p, lunchEnd: e.target.value }))
                            }
                          />
                        </label>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="events-page__cal-weekdays" style={{ marginBottom: 8 }}>
                      {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((w) => (
                        <div key={w} className="events-page__cal-weekday">
                          {w}
                        </div>
                      ))}
                    </div>
                    <div className="events-page__cal-grid">
                      {calendarView.cells.map(({ d, inMonth }) => {
                        const key = dayKeyFromDate(d);
                        const sum = calendarDaySummaries[key];
                        const nEv = (eventsByDay[key] || []).length;
                        const isToday = key === dayKeyFromDate(new Date());
                        const isSelected = calendarSelectedDay === key;
                        const isPast = sum.isPast;
                        const cellBusyFull =
                          !isPast && sum.hasEvents && sum.freeSegments.length === 0 && !sum.weekendBlocked;
                        const cellPartial =
                          !isPast && sum.hasEvents && sum.freeSegments.length > 0 && !sum.weekendBlocked;
                        const cellClass = [
                          'events-page__cal-cell',
                          !inMonth ? 'is-out' : '',
                          isPast ? 'is-past' : '',
                          sum.weekendBlocked ? 'is-weekend' : '',
                          cellBusyFull ? 'is-busy' : '',
                          cellPartial ? 'is-partial' : '',
                          isSelected ? 'is-selected' : '',
                          isToday ? 'is-today' : ''
                        ]
                          .filter(Boolean)
                          .join(' ');
                        return (
                          <button
                            key={`${key}-${inMonth}`}
                            type="button"
                            className={cellClass}
                            onClick={() => setCalendarSelectedDay(key)}
                          >
                            <div className="events-page__cal-cell-day">{d.getDate()}</div>
                            {inMonth && (
                              <div className="events-page__cal-cell-sub">
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
                                    {nEv > 0 && <span style={{ fontWeight: 800 }}>{nEv} встр. · </span>}
                                    {sum.freeLabel}
                                  </>
                                )}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {calendarSelectedDay && selectedDaySummary && (
                      <div className="events-page__cal-day-detail">
                        <div style={{ fontWeight: 800, marginBottom: 10 }}>
                          {(() => {
                            const [yy, mm, dd] = calendarSelectedDay.split('-').map(Number);
                            const dayDate = new Date(yy, mm - 1, dd);
                            return dayDate.toLocaleDateString('ru-RU', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            });
                          })()}
                        </div>
                        {selectedDaySummary.isPast && (
                          <div
                            style={{
                              fontSize: 13,
                              color: 'var(--ink-muted)',
                              fontWeight: 600,
                              marginBottom: 12
                            }}
                          >
                            Прошедший день — показаны только встречи.
                          </div>
                        )}
                        {!selectedDaySummary.isPast && selectedDaySummary.weekendBlocked && (
                          <div
                            style={{
                              fontSize: 13,
                              color: 'var(--ink-muted)',
                              fontWeight: 700,
                              marginBottom: 12
                            }}
                          >
                            Выходной — свободные слоты не считаются.
                          </div>
                        )}
                        {!selectedDaySummary.isPast &&
                          !selectedDaySummary.weekendBlocked &&
                          selectedDaySummary.slotStarts.length > 0 && (
                            <div style={{ marginBottom: 14 }}>
                              <div
                                style={{
                                  fontSize: 13,
                                  color: 'var(--ink-muted)',
                                  fontWeight: 700,
                                  marginBottom: 6
                                }}
                              >
                                Свободные слоты
                              </div>
                              <div className="events-page__cal-slots">
                                {selectedDaySummary.slotStarts.slice(0, 32).map((t) => (
                                  <span key={t} className="events-page__cal-slot">
                                    {t}
                                  </span>
                                ))}
                                {selectedDaySummary.slotStarts.length > 32 && (
                                  <span
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 700,
                                      color: 'var(--ink-muted)',
                                      alignSelf: 'center'
                                    }}
                                  >
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
                            <div
                              style={{
                                fontSize: 13,
                                color: 'var(--ink-muted)',
                                fontWeight: 600,
                                marginBottom: 12
                              }}
                            >
                              Нет свободных слотов и встреч на этот день.
                            </div>
                          )}
                        {selectedCalendarEvents.length > 0 && (
                          <div style={{ display: 'grid', gap: 8 }}>
                            <div
                              style={{
                                fontSize: 13,
                                color: 'var(--ink-muted)',
                                fontWeight: 700,
                                marginBottom: 2
                              }}
                            >
                              Встречи
                            </div>
                            {selectedCalendarEvents.map((ev: any) => (
                              <div key={ev.id} className="events-page__cal-ev">
                                <div style={{ fontWeight: 800, fontSize: 13 }}>
                                  {new Date(ev.startsAt).toLocaleTimeString('ru-RU', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                  {ev.endsAt
                                    ? `–${new Date(ev.endsAt).toLocaleTimeString('ru-RU', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}`
                                    : ''}
                                  <span
                                    style={{
                                      marginLeft: 8,
                                      color: 'var(--ink-muted)',
                                      fontWeight: 700,
                                      fontSize: 12
                                    }}
                                  >
                                    {typeLabel(String(ev.type))}
                                  </span>
                                </div>
                                <div style={{ fontWeight: 700, marginTop: 4 }}>{ev.title}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {selectedDaySummary.isPast && selectedCalendarEvents.length === 0 && (
                          <div style={{ fontSize: 13, color: 'var(--ink-muted)', fontWeight: 600 }}>
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

        {showModal && (
          <div className="events-page__modal-overlay">
            <div
              className="events-page__modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="schedule-title"
            >
              <div className="events-page__modal-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      display: 'grid',
                      placeItems: 'center',
                      background: 'var(--brand-soft)',
                      border: '1px solid var(--line)'
                    }}
                  >
                    <CalendarPlus size={18} color="var(--brand)" />
                  </div>
                  <div>
                    <div id="schedule-title" className="events-page__modal-title">
                      {editingEventId ? 'Перенос встречи' : 'Планирование встречи'}
                    </div>
                    <div className="events-page__modal-sub">
                      {editingEventId
                        ? 'Измените время или детали и сохраните'
                        : 'Заполните ключевые поля — клиент необязателен'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="events-page__btn events-page__btn--secondary events-page__btn--sm"
                  onClick={() => {
                    setShowModal(false);
                    setEditingEventId(null);
                  }}
                >
                  Закрыть
                </button>
              </div>

              <form onSubmit={submitEvent} className="events-page__modal-body">
                <div className="events-page__field-row">
                  <div>
                    <label className="events-page__field-label">Название встречи</label>
                    <input
                      ref={titleRef}
                      className="events-page__field"
                      placeholder="Например: Сессия с Иваном"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="events-page__field-label">Формат</label>
                    <select
                      className="events-page__field"
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                    >
                      {TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {canCreate && (
                  <div>
                    <label className="events-page__field-label">Клиент (необязательно)</label>
                    <select
                      className="events-page__field"
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                    >
                      <option value="">Без клиента</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name} {client.email ? `(${client.email})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="events-page__field-row">
                  <div>
                    <label className="events-page__field-label">Дата начала</label>
                    <input
                      className="events-page__field"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="events-page__field-label">Время начала</label>
                    <input
                      className="events-page__field"
                      type="time"
                      step={300}
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="events-page__field-label">Продолжительность</label>
                    <select
                      className="events-page__field"
                      value={String(durationMin)}
                      onChange={(e) => setDurationMin(Number(e.target.value))}
                    >
                      {Array.from({ length: 12 }, (_, i) => (i + 1) * 30).map((m) => (
                        <option key={m} value={m}>
                          {m / 60} ч
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="events-page__field-label">Быстрый выбор старта</label>
                  <div className="events-page__quick-times">
                    {[
                      { t: 'Сегодня', addH: 1 },
                      { t: 'Завтра', addH: 24 },
                      { t: 'Через 3 дня', addH: 72 }
                    ].map((p) => (
                      <button
                        type="button"
                        key={p.t}
                        className="events-page__btn events-page__btn--secondary events-page__btn--sm"
                        onClick={() => {
                          const base = new Date();
                          base.setHours(base.getHours() + p.addH);
                          base.setMinutes(0, 0, 0);
                          setStartsAt(toLocalInputValue(base));
                        }}
                      >
                        {p.t}
                      </button>
                    ))}
                  </div>
                  <div className="events-page__time-grid">
                    {['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '18:00'].map(
                      (t) => (
                        <button
                          key={t}
                          type="button"
                          className={`events-page__time-chip${startTime === t ? ' is-active' : ''}`}
                          onClick={() => setStartTime(t)}
                        >
                          <Clock3 size={12} />
                          {t}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div>
                  <label className="events-page__field-label">Повестка / комментарии</label>
                  <textarea
                    className="events-page__field"
                    placeholder="Что важно обсудить, ожидаемый результат, материалы или ссылки"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{ minHeight: 110, resize: 'vertical' }}
                  />
                </div>

                <div className="events-page__summary">{planSummary}</div>

                <div className="events-page__modal-foot">
                  <button
                    type="button"
                    className="events-page__btn events-page__btn--secondary"
                    onClick={() => {
                      setShowModal(false);
                      resetPlanForm();
                    }}
                  >
                    Отмена
                  </button>
                  <button
                    className="events-page__btn"
                    type="submit"
                    disabled={!planValid || submitting}
                  >
                    {submitting
                      ? editingEventId
                        ? 'Сохранение…'
                        : 'Создание…'
                      : editingEventId
                        ? 'Сохранить'
                        : 'Создать встречу'}
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
