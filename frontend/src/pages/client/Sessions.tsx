import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ClientNavbar } from '../../components/ClientNavbar';
import { ClientSessionBookingModal } from '../../components/client/ClientSessionBookingModal';
import { useMessengerUi } from '../../context/MessengerUiContext';
import { CalendarClock, Check, Phone, Video, X, CalendarPlus } from 'lucide-react';
import './Sessions.css';

type Session = {
  id: string;
  date: string;
  summary?: string;
  videoUrl?: string;
  eventId?: string;
  createdAt: string;
};

type Event = {
  id: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  sessionStatus?: 'pending' | 'accepted' | 'declined';
  sessionDeclineComment?: string;
  clientRequestedSession?: boolean;
  voiceRoom?: {
    id: string;
    roomId: string;
    roomUrl: string;
  };
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${date} в ${time}`;
}

function isUpcoming(date: string) {
  return new Date(date) > new Date();
}

export default function ClientSessions() {
  const { token } = useAuth();
  const { openMessenger } = useMessengerUi();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [declineComment, setDeclineComment] = useState<Record<string, string>>({});
  const [showDeclineModal, setShowDeclineModal] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const nowTs = Date.now();
  const activeEvents = events.filter((ev) => new Date(ev.endsAt || ev.startsAt).getTime() >= nowTs);
  const historyEvents = events.filter((ev) => new Date(ev.endsAt || ev.startsAt).getTime() < nowTs);
  const nearestUpcomingEvent =
    activeEvents
      .filter((ev) => new Date(ev.startsAt).getTime() > nowTs)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0] || null;
  const visibleSessions = sessions.filter((session) => {
    if (!session.eventId) return true;
    const linkedEvent = events.find((ev) => ev.id === session.eventId);
    if (!linkedEvent) return true;
    return linkedEvent.sessionStatus === 'accepted';
  });
  const activeSessions = visibleSessions.filter((s) => new Date(s.date).getTime() >= nowTs);
  const historySessions = visibleSessions.filter((s) => new Date(s.date).getTime() < nowTs);

  const [showBookModal, setShowBookModal] = useState(false);
  const [upcomingReminder, setUpcomingReminder] = useState<{ id: string; title: string; startsAt: string } | null>(null);
  const [reflectEventId, setReflectEventId] = useState<string | null>(null);
  const [reflectMood, setReflectMood] = useState(3);
  const [reflectText, setReflectText] = useState('');
  const [reflectSaving, setReflectSaving] = useState(false);

  const reloadData = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [sessionsRes, eventsRes, remindRes] = await Promise.all([
        api<{ items: Session[] }>('/api/my-sessions', { token }),
        api<{ items: Event[] }>('/api/my-events', { token }),
        api<{ upcoming: Array<{ id: string; title: string; startsAt: string }> }>(
          '/api/client/session-reminders/sync',
          { token, method: 'POST', body: {} }
        ).catch(() => ({ upcoming: [] as Array<{ id: string; title: string; startsAt: string }> })),
      ]);
      setSessions(sessionsRes.items || []);
      setEvents(eventsRes.items || []);
      const rem = remindRes.upcoming?.[0];
      setUpcomingReminder(rem ? { id: rem.id, title: rem.title, startsAt: rem.startsAt } : null);
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Не удалось загрузить сессии';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reloadData();
  }, [reloadData]);

  async function handleSessionStatus(eventId: string, status: 'accepted' | 'declined') {
    if (!token) return;
    setProcessing(eventId);
    try {
      await api(`/api/events/${eventId}/session-status`, {
        method: 'PUT',
        token,
        body: {
          status,
          comment: status === 'declined' ? declineComment[eventId] : undefined,
        },
      });
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === eventId
            ? {
                ...ev,
                sessionStatus: status,
                sessionDeclineComment: status === 'declined' ? declineComment[eventId] : undefined,
              }
            : ev
        )
      );
      setShowDeclineModal(null);
      setDeclineComment((prev) => ({ ...prev, [eventId]: '' }));
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Не удалось обновить статус';
      window.alert(msg);
    } finally {
      setProcessing(null);
    }
  }

  async function submitReflection() {
    if (!token || !reflectEventId) return;
    setReflectSaving(true);
    try {
      await api('/api/client/session-reflection', {
        token,
        method: 'POST',
        body: { eventId: reflectEventId, moodAfter: reflectMood, text: reflectText },
      });
      setReflectEventId(null);
      setReflectText('');
      setReflectMood(3);
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Не удалось сохранить';
      window.alert(msg);
    } finally {
      setReflectSaving(false);
    }
  }

  function renderEventCard(event: Event, opts?: { history?: boolean }) {
    const upcoming = isUpcoming(event.startsAt);
    const isPending = event.sessionStatus === 'pending' || !event.sessionStatus;
    const clientAskedPsych = Boolean(event.clientRequestedSession);
    const psychInvitedClient = isPending && !clientAskedPsych;
    const clientWaitingPsych = isPending && clientAskedPsych;
    const isAccepted = event.sessionStatus === 'accepted';
    const isDeclined = event.sessionStatus === 'declined';
    const highlightClientAction = psychInvitedClient && upcoming;
    const highlightWaitingPsych = clientWaitingPsych && upcoming;

    const cardMod = isDeclined
      ? 'client-sessions__card--declined'
      : highlightClientAction || highlightWaitingPsych
        ? 'client-sessions__card--pending'
        : isAccepted
          ? 'client-sessions__card--accepted'
          : '';

    return (
      <article key={event.id} className={`client-sessions__card ${cardMod}`.trim()}>
        <div className="client-sessions__card-row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="client-sessions__card-title">
              {highlightClientAction && <span className="client-sessions__badge client-sessions__badge--warning">Ожидает вашего ответа</span>}
              {highlightWaitingPsych && <span className="client-sessions__badge client-sessions__badge--warning">Ожидает психолога</span>}
              {isAccepted && <span className="client-sessions__badge client-sessions__badge--sage">Принята</span>}
              {isDeclined && <span className="client-sessions__badge client-sessions__badge--danger">Отклонена</span>}
              {opts?.history && <span className="client-sessions__badge client-sessions__badge--muted">Прошла</span>}
              <h3>{event.title}</h3>
            </div>
            <div className="client-sessions__when">
              <CalendarClock size={15} />
              {formatDateTime(event.startsAt)}
            </div>
            {event.description && (
              <div className="client-sessions__desc">
                <div className="client-sessions__desc-label">Описание</div>
                {event.description}
              </div>
            )}
            {event.sessionDeclineComment && (
              <div className="client-sessions__decline-note">
                <strong>{event.clientRequestedSession ? 'Комментарий специалиста' : 'Ваш комментарий'}</strong>
                {event.sessionDeclineComment}
              </div>
            )}
          </div>
          <div className="client-sessions__card-actions">
            {opts?.history ? (
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setReflectEventId(event.id);
                  setReflectMood(3);
                  setReflectText('');
                }}
              >
                Рефлексия
              </button>
            ) : (
              <>
                {event.voiceRoom && (isAccepted || psychInvitedClient) && (
                  <a href={event.voiceRoom.roomUrl} target="_blank" rel="noopener noreferrer" className="button">
                    <Video size={15} />В комнату
                  </a>
                )}
                {psychInvitedClient && upcoming && (
                  <>
                    <button
                      type="button"
                      className="button"
                      onClick={() => void handleSessionStatus(event.id, 'accepted')}
                      disabled={processing === event.id}
                    >
                      {processing === event.id ? '…' : (
                        <>
                          <Check size={14} /> Принять
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="button danger"
                      onClick={() => setShowDeclineModal(event.id)}
                      disabled={processing === event.id}
                    >
                      <X size={14} /> Отклонить
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="client-sessions">
      <ClientNavbar />
      <main className="client-sessions__main">
        <header className="client-sessions__head">
          <div>
            <p className="client-sessions__eyebrow">Календарь</p>
            <h1 className="client-sessions__h1">Сессии</h1>
          </div>
          <div className="client-sessions__actions">
            <button type="button" className="button" onClick={() => setShowBookModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <CalendarPlus size={16} />
              Запланировать
            </button>
            <div className="client-sessions__tabs" role="tablist">
              <button type="button" role="tab" className={`client-sessions__tab${!showHistory ? ' is-on' : ''}`} onClick={() => setShowHistory(false)}>
                Предстоящие
              </button>
              <button type="button" role="tab" className={`client-sessions__tab${showHistory ? ' is-on' : ''}`} onClick={() => setShowHistory(true)}>
                История
              </button>
            </div>
          </div>
        </header>

        {upcomingReminder && (
          <div className="client-sessions__banner">
            <div>
              <strong>Сессия в ближайшие 24 часа</strong>
              <span>
                «{upcomingReminder.title}» — {formatDateTime(upcomingReminder.startsAt)}
              </span>
            </div>
            {nearestUpcomingEvent?.voiceRoom?.roomUrl &&
              (nearestUpcomingEvent.sessionStatus === 'accepted' ||
                ((nearestUpcomingEvent.sessionStatus === 'pending' || !nearestUpcomingEvent.sessionStatus) &&
                  !nearestUpcomingEvent.clientRequestedSession)) && (
                <a href={nearestUpcomingEvent.voiceRoom.roomUrl} className="button" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Video size={14} />В комнату
                </a>
              )}
          </div>
        )}

        {loading && <p className="client-sessions__loading">Загрузка сессий…</p>}
        {error && <div className="client-sessions__error">{error}</div>}

        {!loading && !error && !showHistory && activeEvents.length > 0 && (
          <div className="client-sessions__list">{activeEvents.map((ev) => renderEventCard(ev))}</div>
        )}

        {!loading && !error && showHistory && historyEvents.length === 0 && historySessions.length === 0 && (
          <div className="client-sessions__empty">
            <h2>История пока пуста</h2>
            <p>Прошедшие встречи появятся здесь после сессий.</p>
          </div>
        )}

        {!loading && !error && showHistory && (historyEvents.length > 0 || historySessions.length > 0) && (
          <div className="client-sessions__list">
            {historyEvents.map((ev) => renderEventCard(ev, { history: true }))}
            {historySessions.map((session) => (
              <article key={`h-sess-${session.id}`} className="client-sessions__card">
                <div className="client-sessions__card-title">
                  <span className="client-sessions__badge client-sessions__badge--muted">Прошла</span>
                  <h3>Сессия с психологом</h3>
                </div>
                <div className="client-sessions__when">
                  <CalendarClock size={15} />
                  {formatDateTime(session.date)}
                </div>
              </article>
            ))}
          </div>
        )}

        {!loading && !error && !showHistory && activeSessions.length === 0 && activeEvents.length === 0 && (
          <div className="client-sessions__empty">
            <Phone size={36} color="var(--brand)" />
            <h2>Пока нет сессий</h2>
            <p>Запланируйте встречу или напишите психологу — приглашения появятся здесь.</p>
            <div className="client-sessions__empty-actions">
              <button type="button" className="button" onClick={() => setShowBookModal(true)}>
                Запланировать
              </button>
              <button type="button" className="button secondary" onClick={() => openMessenger()}>
                Написать психологу
              </button>
            </div>
          </div>
        )}

        {reflectEventId && (
          <div className="client-sessions__modal-backdrop" onClick={() => setReflectEventId(null)}>
            <div className="client-sessions__modal" onClick={(e) => e.stopPropagation()}>
              <h3>Как прошла сессия?</h3>
              <p>Короткая рефлексия попадёт в «Мой путь».</p>
              <div className="client-sessions__reflect-mood">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" className={reflectMood === n ? 'is-on' : undefined} onClick={() => setReflectMood(n)}>
                    {n}
                  </button>
                ))}
              </div>
              <textarea
                value={reflectText}
                onChange={(e) => setReflectText(e.target.value)}
                placeholder="Что осталось важным? (необязательно)"
                rows={4}
              />
              <div className="client-sessions__modal-actions">
                <button type="button" className="button secondary" onClick={() => setReflectEventId(null)}>
                  Закрыть
                </button>
                <button type="button" className="button" disabled={reflectSaving} onClick={() => void submitReflection()}>
                  {reflectSaving ? '…' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeclineModal && (
          <div className="client-sessions__modal-backdrop" onClick={() => setShowDeclineModal(null)}>
            <div className="client-sessions__modal" onClick={(e) => e.stopPropagation()}>
              <h3>Отклонить приглашение</h3>
              <p>Можно оставить комментарий (необязательно).</p>
              <textarea
                value={declineComment[showDeclineModal] || ''}
                onChange={(e) => setDeclineComment((prev) => ({ ...prev, [showDeclineModal]: e.target.value }))}
                placeholder="Комментарий"
                rows={4}
              />
              <div className="client-sessions__modal-actions">
                <button type="button" className="button secondary" onClick={() => setShowDeclineModal(null)}>
                  Отмена
                </button>
                <button
                  type="button"
                  className="button danger"
                  disabled={processing === showDeclineModal}
                  onClick={() => void handleSessionStatus(showDeclineModal, 'declined')}
                >
                  {processing === showDeclineModal ? '…' : 'Отклонить'}
                </button>
              </div>
            </div>
          </div>
        )}

        <ClientSessionBookingModal open={showBookModal} token={token} onClose={() => setShowBookModal(false)} onBooked={() => void reloadData()} />
      </main>
    </div>
  );
}
