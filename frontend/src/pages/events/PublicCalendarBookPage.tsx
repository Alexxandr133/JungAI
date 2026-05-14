import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAppearance } from '../../context/AppearanceContext';
import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  DEFAULT_CALENDAR_PREFS,
  type CalendarPrefs,
  calendarCells,
  computeDaySummary,
  dayKeyFromDate,
  mergeCalendarPrefsFromServer,
  pad2
} from '../../lib/eventsCalendarUtils';

function localSlotRangeIso(dayKey: string, startHm: string, durationMin: number) {
  const [H, M] = startHm.split(':').map(Number);
  const [y, mo, da] = dayKey.split('-').map(Number);
  const start = new Date(y, mo - 1, da, H, M, 0, 0);
  const end = new Date(start.getTime() + durationMin * 60000);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return { slotStart: iso(start), slotEnd: iso(end) };
}

type WizardStep = 1 | 2 | 3 | 4;

export default function PublicCalendarBookPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t') || searchParams.get('token') || '';
  const { appearance } = useAppearance();
  const isLight = appearance.colorMode === 'light';

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [prefs, setPrefs] = useState<CalendarPrefs>(DEFAULT_CALENDAR_PREFS);

  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [calendarSelectedDay, setCalendarSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: isLight ? '1px solid rgba(15,23,42,0.14)' : '1px solid rgba(255,255,255,0.14)',
    background: isLight ? '#ffffff' : 'rgba(15,23,42,0.55)',
    color: 'var(--text)',
    fontSize: 15,
    outline: 'none',
    boxSizing: 'border-box'
  };

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setLoadError('В ссылке нет токена доступа.');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await api<{ items: any[]; prefs: unknown }>(`/api/events/public-calendar?t=${encodeURIComponent(token)}`);
        if (cancelled) return;
        setItems(data.items || []);
        setPrefs({ ...DEFAULT_CALENDAR_PREFS, ...mergeCalendarPrefsFromServer(data.prefs) });
        setCalendarSelectedDay(null);
        setWizardStep(1);
        setSelectedSlot(null);
      } catch (e: any) {
        if (!cancelled) setLoadError(e.message || 'Не удалось загрузить календарь');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const ev of items || []) {
      const k = dayKeyFromDate(new Date(ev.startsAt));
      if (!map[k]) map[k] = [];
      map[k].push(ev);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }
    return map;
  }, [items]);

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

  const calendarDaySummaries = useMemo(() => {
    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth();
    const cells = calendarCells(y, m);
    const map: Record<string, ReturnType<typeof computeDaySummary>> = {};
    for (const { d } of cells) {
      const key = dayKeyFromDate(d);
      map[key] = computeDaySummary(key, prefs, eventsByDay[key] || []);
    }
    return map;
  }, [calendarMonth, eventsByDay, prefs]);

  const selectedCalendarEvents = calendarSelectedDay ? eventsByDay[calendarSelectedDay] || [] : [];
  const selectedDaySummary = calendarSelectedDay
    ? computeDaySummary(calendarSelectedDay, prefs, selectedCalendarEvents)
    : null;

  const canProceedStep1 =
    calendarSelectedDay &&
    selectedDaySummary &&
    !selectedDaySummary.isPast &&
    !selectedDaySummary.weekendBlocked &&
    selectedDaySummary.slotStarts.length > 0;

  const canProceedStep2 = Boolean(selectedSlot);

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!token || !calendarSelectedDay || !selectedSlot) {
      setFormError('Выберите день и слот.');
      return;
    }
    const sum = computeDaySummary(calendarSelectedDay, prefs, selectedCalendarEvents);
    if (sum.isPast || sum.weekendBlocked) {
      setFormError('Этот день недоступен для записи.');
      return;
    }
    const { slotStart, slotEnd } = localSlotRangeIso(calendarSelectedDay, selectedSlot, prefs.slotIntervalMinutes);
    setSubmitting(true);
    try {
      await api('/api/events/public-calendar/book', {
        method: 'POST',
        body: {
          token,
          slotStart,
          slotEnd,
          contactName,
          contactEmail,
          contactPhone: contactPhone.trim() || undefined,
          message: message.trim() || undefined
        }
      });
      setSubmittedEmail(contactEmail.trim());
      setWizardStep(4);
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      setMessage('');
    } catch (err: any) {
      setFormError(err.message || 'Не удалось отправить заявку');
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div style={{ minHeight: '100vh', padding: 24, maxWidth: 520, margin: '0 auto' }}>
        <h1 style={{ fontSize: 20 }}>Календарь недоступен</h1>
        <p className="small">Нужна корректная ссылка от специалиста.</p>
      </div>
    );
  }

  const cardShell: React.CSSProperties = {
    borderRadius: 18,
    overflow: 'hidden',
    border: isLight ? '1px solid rgba(15,23,42,0.12)' : '1px solid rgba(255,255,255,0.12)',
    boxShadow: isLight ? '0 18px 48px rgba(15,23,42,0.1)' : '0 20px 56px rgba(0,0,0,0.45)',
    background: isLight ? '#ffffff' : 'linear-gradient(180deg, rgba(30,33,45,0.98), rgba(22,24,33,0.98))',
    maxWidth: 520,
    margin: '0 auto'
  };

  const stepBadge = (n: number, label: string, active: boolean, done: boolean) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        opacity: active ? 1 : done ? 0.85 : 0.45,
        fontWeight: active ? 800 : 600,
        fontSize: 13
      }}
    >
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: 999,
          display: 'grid',
          placeItems: 'center',
          fontSize: 12,
          fontWeight: 900,
          background: done ? '#22c55e' : active ? 'var(--primary)' : isLight ? '#e2e8f0' : '#334155',
          color: done || active ? '#fff' : 'var(--text-muted)'
        }}
      >
        {done ? '✓' : n}
      </span>
      {label}
    </div>
  );

  function renderCalendarGrid(onPickDay: (key: string) => void) {
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, marginBottom: 8 }}>
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((w) => (
            <div key={w} className="small" style={{ fontWeight: 800, textAlign: 'center', color: 'var(--text-muted)', padding: '6px 0' }}>
              {w}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
          {calendarView.cells.map(({ d, inMonth }) => {
            const key = dayKeyFromDate(d);
            const sum = calendarDaySummaries[key];
            const nEv = (eventsByDay[key] || []).length;
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
                onClick={() => onPickDay(key)}
                style={{
                  minHeight: 68,
                  borderRadius: 12,
                  padding: 6,
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 2,
                  cursor: 'pointer',
                  border: isSelected ? '2px solid var(--primary)' : isLight ? '1px solid rgba(15,23,42,0.1)' : '1px solid rgba(255,255,255,0.1)',
                  background: cellBg,
                  opacity: inMonth ? 1 : 0.45,
                  color: 'var(--text)'
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 13 }}>{d.getDate()}</div>
                {inMonth && (
                  <div
                    className="small"
                    style={{
                      fontWeight: 700,
                      fontSize: 9,
                      lineHeight: 1.2,
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
                        {nEv > 0 && <span style={{ color: 'var(--primary)', fontWeight: 800 }}>{nEv} встр. · </span>}
                        {sum.freeLabel}
                      </>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: 'clamp(16px, 4vw, 28px)',
        background: isLight ? '#f1f5f9' : '#0b1120',
        color: 'var(--text)'
      }}
    >
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <h1 style={{ fontSize: 21, fontWeight: 900, marginBottom: 6 }}>Запись на встречу</h1>
        <p className="small" style={{ color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.55 }}>
          Пройдите шаги: день → слот → контакты. Ответ придёт на указанную почту.
        </p>

        {loading && (
          <div style={{ ...cardShell, padding: 16 }}>
            Загрузка календаря…
          </div>
        )}
        {loadError && (
          <div className="card" style={{ padding: 16, borderColor: 'rgba(239,68,68,0.45)', ...cardShell }}>
            {loadError}
          </div>
        )}

        {!loading && !loadError && wizardStep < 4 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 16, justifyContent: 'center' }}>
            {stepBadge(1, 'День', wizardStep === 1, wizardStep > 1)}
            {stepBadge(2, 'Слот', wizardStep === 2, wizardStep > 2)}
            {stepBadge(3, 'Данные', wizardStep === 3, false)}
          </div>
        )}

        {!loading && !loadError && wizardStep === 4 && (
          <div style={{ ...cardShell, padding: 28, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, margin: '0 auto 16px', borderRadius: 999, background: 'rgba(34,197,94,0.15)', display: 'grid', placeItems: 'center' }}>
              <CheckCircle2 size={32} color="#16a34a" />
            </div>
            <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 900 }}>Запрос отправлен</h2>
            <p className="small" style={{ color: 'var(--text-muted)', lineHeight: 1.65, margin: 0 }}>
              Вы отправили заявку на запись. Ожидайте ответ специалиста на почту
              {submittedEmail ? (
                <>
                  {' '}
                  <b style={{ color: 'var(--text)' }}>{submittedEmail}</b>
                </>
              ) : null}
              .
            </p>
          </div>
        )}

        {!loading && !loadError && wizardStep < 4 && (
          <div style={{ ...cardShell, padding: 0 }}>
            <div
              style={{
                padding: '12px 14px',
                borderBottom: isLight ? '1px solid rgba(15,23,42,0.08)' : '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
                  style={{ padding: '8px 10px', borderRadius: 10 }}
                >
                  <ChevronLeft size={18} />
                </button>
                <div style={{ fontWeight: 800, fontSize: 14, textTransform: 'capitalize', minWidth: 120, textAlign: 'center' }}>
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
                  style={{ padding: '8px 10px', borderRadius: 10 }}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            <div style={{ padding: 14 }}>
              {wizardStep === 1 && (
                <>
                  <div className="small" style={{ fontWeight: 800, marginBottom: 10, color: 'var(--text-muted)' }}>
                    Шаг 1: выберите день с доступными слотами
                  </div>
                  {renderCalendarGrid((key) => setCalendarSelectedDay(key))}
                  <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="button"
                      disabled={!canProceedStep1}
                      onClick={() => {
                        setSelectedSlot(null);
                        setWizardStep(2);
                      }}
                      style={{ padding: '10px 20px', borderRadius: 12, fontWeight: 800, opacity: canProceedStep1 ? 1 : 0.5 }}
                    >
                      Далее
                    </button>
                  </div>
                </>
              )}

              {wizardStep === 2 && calendarSelectedDay && selectedDaySummary && (
                <>
                  <div className="small" style={{ fontWeight: 800, marginBottom: 10, color: 'var(--text-muted)' }}>
                    Шаг 2: выберите время
                  </div>
                  <div style={{ fontWeight: 800, marginBottom: 12 }}>
                    {new Date(`${calendarSelectedDay}T12:00:00`).toLocaleDateString('ru-RU', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {selectedDaySummary.slotStarts.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSelectedSlot(t)}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 10,
                          fontWeight: 800,
                          fontSize: 14,
                          cursor: 'pointer',
                          border:
                            selectedSlot === t
                              ? '2px solid var(--primary)'
                              : isLight
                                ? '1px solid rgba(34,197,94,0.35)'
                                : '1px solid rgba(74,222,128,0.35)',
                          background:
                            selectedSlot === t
                              ? isLight
                                ? 'rgba(79,70,229,0.12)'
                                : 'rgba(129,140,248,0.22)'
                              : isLight
                                ? 'rgba(34,197,94,0.1)'
                                : 'rgba(34,197,94,0.15)',
                          color: isLight ? '#166534' : '#bbf7d0'
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <div style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <button type="button" className="button secondary" onClick={() => setWizardStep(1)} style={{ padding: '10px 16px', borderRadius: 12, fontWeight: 700 }}>
                      Назад
                    </button>
                    <button
                      type="button"
                      className="button"
                      disabled={!canProceedStep2}
                      onClick={() => setWizardStep(3)}
                      style={{ padding: '10px 20px', borderRadius: 12, fontWeight: 800, opacity: canProceedStep2 ? 1 : 0.5 }}
                    >
                      Далее
                    </button>
                  </div>
                </>
              )}

              {wizardStep === 3 && (
                <form onSubmit={submitBooking} style={{ display: 'grid', gap: 16 }}>
                  <div className="small" style={{ fontWeight: 800, color: 'var(--text-muted)' }}>
                    Шаг 3: контакты
                    {calendarSelectedDay && selectedSlot ? (
                      <span style={{ color: 'var(--text)' }}>
                        {' '}
                        · {new Date(`${calendarSelectedDay}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}, {selectedSlot}
                      </span>
                    ) : null}
                  </div>

                  <div
                    style={{
                      padding: 16,
                      borderRadius: 14,
                      border: isLight ? '1px solid rgba(79,70,229,0.18)' : '1px solid rgba(165,180,252,0.2)',
                      background: isLight ? 'rgba(79,70,229,0.04)' : 'rgba(79,70,229,0.08)',
                      display: 'grid',
                      gap: 14
                    }}
                  >
                    <label style={{ display: 'grid', gap: 6 }}>
                      <span className="small" style={{ fontWeight: 700, color: 'var(--text-muted)' }}>
                        Имя *
                      </span>
                      <input
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        required
                        minLength={2}
                        placeholder="Как к вам обращаться"
                        style={fieldStyle}
                      />
                    </label>
                    <label style={{ display: 'grid', gap: 6 }}>
                      <span className="small" style={{ fontWeight: 700, color: 'var(--text-muted)' }}>
                        Email *
                      </span>
                      <input
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        required
                        placeholder="name@example.com"
                        style={fieldStyle}
                      />
                    </label>
                    <label style={{ display: 'grid', gap: 6 }}>
                      <span className="small" style={{ fontWeight: 700, color: 'var(--text-muted)' }}>
                        Телефон
                      </span>
                      <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+7 …" style={fieldStyle} />
                    </label>
                    <label style={{ display: 'grid', gap: 6 }}>
                      <span className="small" style={{ fontWeight: 700, color: 'var(--text-muted)' }}>
                        Комментарий
                      </span>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={3}
                        placeholder="Кратко опишите запрос или удобный способ связи"
                        style={{ ...fieldStyle, resize: 'vertical', minHeight: 88, lineHeight: 1.45 }}
                      />
                    </label>
                  </div>

                  {formError && (
                    <div
                      className="small"
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        fontWeight: 600,
                        background: 'rgba(239,68,68,0.12)',
                        border: '1px solid rgba(239,68,68,0.35)',
                        color: '#b91c1c'
                      }}
                    >
                      {formError}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setWizardStep(2)}
                      style={{ padding: '10px 16px', borderRadius: 12, fontWeight: 700 }}
                    >
                      Назад
                    </button>
                    <button type="submit" className="button" disabled={submitting} style={{ padding: '10px 22px', borderRadius: 12, fontWeight: 800 }}>
                      {submitting ? 'Отправка…' : 'Отправить заявку'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
