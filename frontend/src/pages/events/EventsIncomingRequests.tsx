import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMessengerUi } from '../../context/MessengerUiContext';
import { api } from '../../lib/api';
import { formatDateTimeInAppTz, formatTimeInAppTz, toWallInputValue } from '../../lib/eventsCalendarUtils';
import { SessionDurationField, capSessionDurationMin } from './SessionDurationField';

export type IncomingRequestItem = {
  id: string;
  bookingId?: string | null;
  supportRequestId?: string | null;
  kind: 'slot' | 'match' | 'inquiry';
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
  const startLabel = formatDateTimeInAppTz(s);
  if (!end) return startLabel;
  const e = new Date(end);
  if (Number.isNaN(e.getTime())) return startLabel;
  return `${startLabel} – ${formatTimeInAppTz(e)}`;
}

function defaultIntroLocalValue(): string {
  const d = new Date();
  d.setTime(d.getTime() + 24 * 60 * 60 * 1000);
  const wall = toWallInputValue(d);
  const [date, time] = wall.split('T');
  const hh = Number((time || '10:00').slice(0, 2));
  const hm = hh < 10 ? '10:00' : hh > 20 ? '18:00' : `${String(hh).padStart(2, '0')}:00`;
  return `${date}T${hm}`;
}

function localInputToIso(local: string): string | null {
  if (!local || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(local)) return null;
  return local.slice(0, 16);
}

export function EventsIncomingRequests({ token, items, onChanged, onToast }: Props) {
  const { openMessenger } = useMessengerUi();
  const [declineId, setDeclineId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [acceptInquiryItem, setAcceptInquiryItem] = useState<IncomingRequestItem | null>(null);
  const [introLocal, setIntroLocal] = useState(defaultIntroLocalValue);
  const [introDurationMin, setIntroDurationMin] = useState(60);

  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    [items]
  );

  function isInquiryItem(item: IncomingRequestItem) {
    return item.kind === 'inquiry' || (!item.slotStart && item.source === 'inquiry');
  }

  function openAccept(item: IncomingRequestItem) {
    if (item.bookingId && isInquiryItem(item)) {
      setAcceptInquiryItem(item);
      setIntroLocal(defaultIntroLocalValue());
      setIntroDurationMin(60);
      return;
    }
    void accept(item);
  }

  async function accept(item: IncomingRequestItem, body?: { startsAt: string; durationMin: number }) {
    setBusyId(item.id);
    try {
      if (item.bookingId) {
        await api(`/api/events/calendar-booking-requests/${item.bookingId}/accept`, {
          method: 'POST',
          token,
          body: body || {},
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
      onToast(
        'success',
        isInquiryItem(item)
          ? 'Клиент добавлен, вводная назначена. На почту ушли ссылка регистрации и детали встречи.'
          : 'Создана первая встреча. Уведомление отправлено заявителю, если настроена почта.'
      );
      setAcceptInquiryItem(null);
      onChanged();
    } catch (e: any) {
      onToast('error', e?.message || 'Не удалось принять заявку');
    } finally {
      setBusyId(null);
    }
  }

  async function submitInquiryAccept() {
    if (!acceptInquiryItem) return;
    const startsAt = localInputToIso(introLocal);
    if (!startsAt) {
      onToast('error', 'Укажите дату и время вводной встречи');
      return;
    }
    if (new Date(startsAt).getTime() < Date.now() - 60_000) {
      onToast('error', 'Нельзя назначить встречу в прошлом');
      return;
    }
    await accept(acceptInquiryItem, {
      startsAt,
      durationMin: capSessionDurationMin(introDurationMin) || 60,
    });
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
          Публичная страница, слоты и анкеты подбора клиентов
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
            const isInquiry = isInquiryItem(item);

            return (
              <div key={item.id} className="events-page__booking-item events-page__request-item">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="events-page__request-head">
                    <span
                      className={`events-page__badge ${
                        isInquiry
                          ? 'events-page__badge--type'
                          : isMatch
                            ? 'events-page__badge--type'
                            : 'events-page__badge--sage'
                      }`}
                    >
                      {isInquiry ? 'Запрос на ведение' : isMatch ? 'Заявка из подбора' : 'Заявка на слот'}
                    </span>
                    <span className="events-page__badge events-page__badge--warning">Новый</span>
                    <span className="events-page__request-date">
                      {formatDateTimeInAppTz(new Date(item.createdAt))}
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
                      {!isInquiry ? (
                        <div>
                          <div className="events-page__request-label">Желаемый слот</div>
                          <div className="events-page__request-value events-page__request-value--bold">
                            {slotLabel || '—'}
                          </div>
                        </div>
                      ) : null}
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
                    onClick={() => openAccept(item)}
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

      {acceptInquiryItem
        ? createPortal(
        <div
          className="events-page__modal-overlay"
          role="presentation"
          onClick={() => setAcceptInquiryItem(null)}
        >
          <div
            className="events-page__modal events-page__modal--narrow-dlg"
            role="dialog"
            aria-modal="true"
            aria-label="Принять запрос и назначить вводную"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="events-page__dlg-head">
              <h3 className="events-page__modal-title">Принять запрос</h3>
              <p className="events-page__modal-sub">
                {acceptInquiryItem.contactName} будет добавлен(а) в ваши клиенты. На почту уйдёт ссылка
                регистрации и приглашение на вводную встречу — время обязательно.
              </p>
            </div>
            <label className="events-page__dlg-label" htmlFor="events-intro-starts">
              Дата и время вводной
            </label>
            <input
              id="events-intro-starts"
              className="events-page__field"
              type="datetime-local"
              value={introLocal}
              onChange={(e) => setIntroLocal(e.target.value)}
              required
            />
            <div style={{ marginTop: 12 }}>
              <SessionDurationField
                key={acceptInquiryItem.id}
                id="events-intro-duration"
                label="Длительность"
                labelClassName="events-page__dlg-label"
                value={introDurationMin}
                onChange={setIntroDurationMin}
              />
            </div>
            <div className="events-page__dlg-actions">
              <button
                type="button"
                className="events-page__btn events-page__btn--secondary"
                onClick={() => setAcceptInquiryItem(null)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="events-page__btn"
                disabled={busyId === acceptInquiryItem.id}
                onClick={() => void submitInquiryAccept()}
              >
                {busyId === acceptInquiryItem.id ? 'Сохраняем…' : 'Принять и назначить'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      {declineId
        ? createPortal(
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
        </div>,
        document.body
      ) : null}
    </>
  );
}
