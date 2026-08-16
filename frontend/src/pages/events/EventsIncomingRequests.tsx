import { useMemo, useState } from 'react';
import { useMessengerUi } from '../../context/MessengerUiContext';
import { api } from '../../lib/api';

export type IncomingRequestItem = {
  id: string;
  bookingId?: string | null;
  supportRequestId?: string | null;
  kind: 'slot' | 'match';
  source?: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  slotStart?: string | Date | null;
  slotEnd?: string | Date | null;
  message?: string | null;
  questionnaire?: Record<string, unknown> | null;
  createdAt: string;
  canWrite: boolean;
  clientId?: string | null;
};

type Props = {
  token: string;
  items: IncomingRequestItem[];
  onChanged: () => void;
  onToast: (variant: 'success' | 'error', text: string) => void;
};

const WHO_FOR_LABEL: Record<string, string> = {
  self: 'Для себя',
  couple: 'Для пары',
  child: 'Для ребёнка',
  individual: 'Для себя',
};

function whoForLabel(v: unknown) {
  if (typeof v !== 'string') return '—';
  return WHO_FOR_LABEL[v] || v;
}

function formatSlot(start?: string | Date | null, end?: string | Date | null) {
  if (!start) return null;
  const s = new Date(start);
  if (Number.isNaN(s.getTime())) return null;
  const startLabel = s.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  if (!end) return startLabel;
  const e = new Date(end);
  if (Number.isNaN(e.getTime())) return startLabel;
  const endLabel = e.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${startLabel} – ${endLabel}`;
}

export function EventsIncomingRequests({ token, items, onChanged, onToast }: Props) {
  const { openMessenger } = useMessengerUi();
  const [declineId, setDeclineId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    [items]
  );

  async function accept(item: IncomingRequestItem) {
    setBusyId(item.id);
    try {
      if (item.bookingId) {
        await api(`/api/events/calendar-booking-requests/${item.bookingId}/accept`, {
          method: 'POST',
          token,
        });
      } else if (item.supportRequestId) {
        await api(`/api/psychologist/requests/${item.supportRequestId}/respond`, {
          method: 'POST',
          token,
          body: { action: 'accept' },
        });
      } else {
        throw new Error('Неизвестный тип заявки');
      }
      onToast('success', 'Создана первая встреча. Уведомление отправлено заявителю, если настроена почта.');
      onChanged();
    } catch (e: any) {
      onToast('error', e?.message || 'Не удалось принять заявку');
    } finally {
      setBusyId(null);
    }
  }

  async function write(item: IncomingRequestItem) {
    if (!item.canWrite || !item.supportRequestId) return;
    setBusyId(item.id);
    try {
      const res = await api<{ roomId: string }>(
        `/api/psychologist/requests/${item.supportRequestId}/start-chat`,
        { method: 'POST', token }
      );
      if (res.roomId) openMessenger({ roomId: res.roomId, clientName: item.contactName });
    } catch (e: any) {
      onToast('error', e?.message || 'Не удалось открыть чат');
    } finally {
      setBusyId(null);
    }
  }

  async function submitDecline() {
    if (!declineId) return;
    const item = sorted.find((x) => x.id === declineId);
    if (!item) return;
    const reason = declineReason.trim();
    if (reason.length < 3) {
      onToast('error', 'Укажите причину отклонения (не менее 3 символов)');
      return;
    }
    setBusyId(item.id);
    try {
      if (item.bookingId) {
        await api(`/api/events/calendar-booking-requests/${item.bookingId}/decline`, {
          method: 'POST',
          token,
          body: { reason },
        });
      } else if (item.supportRequestId) {
        await api(`/api/psychologist/requests/${item.supportRequestId}/respond`, {
          method: 'POST',
          token,
          body: { action: 'decline', declineReason: reason },
        });
      }
      onToast('success', 'Заявка отклонена');
      setDeclineId(null);
      setDeclineReason('');
      onChanged();
    } catch (e: any) {
      onToast('error', e?.message || 'Не удалось отклонить');
    } finally {
      setBusyId(null);
    }
  }

  if (!sorted.length) return null;

  return (
    <>
      <div id="requests" className="events-page__card events-page__requests" data-tour="events-requests">
        <h3 className="events-page__card-title">Заявки и запросы</h3>
        <p className="events-page__requests-lead">
          Публичный календарь и анкеты подбора клиентов
        </p>
        <div className="events-page__booking-list">
          {sorted.map((item) => {
            const q = item.questionnaire || null;
            const topics = Array.isArray(q?.topics) ? (q!.topics as string[]) : [];
            const customTopic = typeof q?.customTopic === 'string' ? q.customTopic : '';
            const budget =
              (typeof q?.priceBandLabel === 'string' && q.priceBandLabel) ||
              (typeof q?.budget === 'string' && q.budget) ||
              null;
            const whoFor = q?.whoFor ?? q?.format;
            const comment =
              (typeof q?.note === 'string' && q.note) ||
              (typeof q?.comment === 'string' && q.comment) ||
              null;
            const slotLabel =
              (typeof q?.slotLabel === 'string' && q.slotLabel) ||
              formatSlot(item.slotStart, item.slotEnd);
            const isMatch = item.kind === 'match';

            return (
              <div key={item.id} className="events-page__booking-item events-page__request-item">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="events-page__request-head">
                    <span
                      className={`events-page__badge ${
                        isMatch ? 'events-page__badge--type' : 'events-page__badge--sage'
                      }`}
                    >
                      {isMatch ? 'Заявка из подбора' : 'Заявка на слот'}
                    </span>
                    <span className="events-page__badge events-page__badge--warning">Новый</span>
                    <span className="events-page__request-date">
                      {new Date(item.createdAt).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="events-page__request-contact">
                    <div className="events-page__request-name">{item.contactName}</div>
                    <div className="events-page__request-meta">
                      {item.contactEmail}
                      {item.contactPhone ? ` · ${item.contactPhone}` : ''}
                    </div>
                  </div>

                  {isMatch || q ? (
                    <div className="events-page__request-grid">
                      <div>
                        <div className="events-page__request-label">Для кого</div>
                        <div className="events-page__request-value">{whoForLabel(whoFor)}</div>
                      </div>
                      <div>
                        <div className="events-page__request-label">Темы</div>
                        <div className="events-page__request-chips">
                          {topics.length === 0 && !customTopic ? (
                            <span className="events-page__request-muted">—</span>
                          ) : (
                            <>
                              {topics.map((t) => (
                                <span key={t} className="events-page__chip">
                                  {t}
                                </span>
                              ))}
                              {customTopic ? (
                                <span className="events-page__chip">{customTopic}</span>
                              ) : null}
                            </>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="events-page__request-label">Бюджет</div>
                        <div className="events-page__request-value">{budget || '—'}</div>
                      </div>
                      <div>
                        <div className="events-page__request-label">Желаемый слот</div>
                        <div className="events-page__request-value events-page__request-value--bold">
                          {slotLabel || '—'}
                        </div>
                      </div>
                      {comment ? (
                        <div className="events-page__request-comment">
                          <div className="events-page__request-label">Комментарий</div>
                          <div className="events-page__request-value">{comment}</div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      {slotLabel ? (
                        <div className="events-page__request-value events-page__request-value--bold" style={{ marginTop: 8 }}>
                          {slotLabel}
                        </div>
                      ) : null}
                      {item.message ? (
                        <div className="events-page__request-muted" style={{ marginTop: 6, lineHeight: 1.45 }}>
                          {item.message}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>

                <div className="events-page__request-actions">
                  <button
                    type="button"
                    className="events-page__btn events-page__btn--sm"
                    disabled={busyId === item.id}
                    onClick={() => void accept(item)}
                  >
                    Принять
                  </button>
                  <button
                    type="button"
                    className="events-page__btn events-page__btn--secondary events-page__btn--sm"
                    disabled={!item.canWrite || busyId === item.id}
                    title={
                      item.canWrite
                        ? 'Написать в чат'
                        : 'Нет аккаунта на платформе — напишите на email заявителя'
                    }
                    onClick={() => void write(item)}
                  >
                    Написать
                  </button>
                  <button
                    type="button"
                    className="events-page__btn events-page__btn--ghost events-page__btn--sm"
                    disabled={busyId === item.id}
                    onClick={() => {
                      setDeclineId(item.id);
                      setDeclineReason('');
                    }}
                  >
                    Отклонить
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {declineId ? (
        <div
          className="events-page__modal-overlay"
          role="presentation"
          onClick={() => setDeclineId(null)}
        >
          <div
            className="events-page__modal events-page__modal--narrow-dlg"
            role="dialog"
            aria-modal="true"
            aria-label="Отклонить заявку"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="events-page__dlg-head">
              <h3 className="events-page__modal-title">Отклонить заявку</h3>
              <p className="events-page__modal-sub">
                Причина уйдёт заявителю на email или в чат.
              </p>
            </div>
            <label className="events-page__dlg-label" htmlFor="events-decline-reason">
              Причина
            </label>
            <textarea
              id="events-decline-reason"
              className="events-page__field events-page__field--area"
              rows={4}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Кратко опишите причину…"
              autoFocus
            />
            <div className="events-page__dlg-actions">
              <button
                type="button"
                className="events-page__btn events-page__btn--secondary"
                onClick={() => setDeclineId(null)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="events-page__btn events-page__btn--danger"
                onClick={() => void submitDecline()}
              >
                Отклонить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
