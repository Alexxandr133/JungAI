import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useAppearance } from '../../context/AppearanceContext';
import { CheckCircle2, ChevronLeft, ChevronRight, X } from 'lucide-react';
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

type Step = 1 | 2 | 3;

type Props = {
  open: boolean;
  token: string | null;
  onClose: () => void;
  onBooked?: () => void;
};

export function ClientSessionBookingModal({ open, token, onClose, onBooked }: Props) {
  const { appearance } = useAppearance();
  const isLight = appearance.colorMode === 'light';

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [psychologistName, setPsychologistName] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [prefs, setPrefs] = useState<CalendarPrefs>(DEFAULT_CALENDAR_PREFS);

  const [step, setStep] = useState<Step>(1);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [calendarSelectedDay, setCalendarSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    setStep(1);
    setCalendarSelectedDay(null);
    setSelectedSlot(null);
    setLoadError(null);
    setBookError(null);
    setLoading(true);
    (async () => {
      try {
        const data = await api<{ items: any[]; prefs: unknown; psychologistName?: string }>(
          '/api/events/psychologist-calendar-for-client',
          { token }
        );
        if (cancelled) return;
        setItems(data.items || []);
        setPrefs({ ...DEFAULT_CALENDAR_PREFS, ...mergeCalendarPrefsFromServer(data.prefs) });
        setPsychologistName(data.psychologistName || '');
      } catch (e: any) {
        if (!cancelled) setLoadError(e.message || 'Не удалось загрузить календарь');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, token]);

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

  async function confirmBook() {
    if (!token || !calendarSelectedDay || !selectedSlot) return;
    setBookError(null);
    const sum = computeDaySummary(calendarSelectedDay, prefs, selectedCalendarEvents);
    if (sum.isPast || sum.weekendBlocked) {
      setBookError('Этот день недоступен для записи.');
      return;
    }
    const { slotStart, slotEnd } = localSlotRangeIso(calendarSelectedDay, selectedSlot, prefs.slotIntervalMinutes);
    setSubmitting(true);
    try {
      await api('/api/events/client-book-session-slot', {
        method: 'POST',
        token,
        body: { slotStart, slotEnd }
      });
      setStep(3);
      onBooked?.();
    } catch (e: any) {
      setBookError(e.message || 'Не удалось записаться');
    } finally {
      setSubmitting(false);
    }
  }

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
                  minHeight: 64,
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

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: isLight ? 'rgba(15,23,42,0.35)' : 'rgba(5,8,16,0.78)',
        backdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        padding: 16
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="card"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(520px, 100%)',
          maxHeight: 'min(92vh, 720px)',
          overflow: 'auto',
          borderRadius: 18,
          padding: 0,
          border: isLight ? '1px solid rgba(15,23,42,0.12)' : '1px solid rgba(255,255,255,0.12)',
          boxShadow: isLight ? '0 24px 60px rgba(15,23,42,0.18)' : '0 24px 70px rgba(0,0,0,0.55)'
        }}
      >
        <div
          style={{
            padding: '14px 16px',
            borderBottom: isLight ? '1px solid rgba(15,23,42,0.08)' : '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10
          }}
        >
          <div>
            <div style={{ fontWeight: 900, fontSize: 17 }}>Запланировать сессию</div>
            {psychologistName ? (
              <div className="small" style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                Календарь: {psychologistName}
              </div>
            ) : null}
          </div>
          <button type="button" className="button secondary" aria-label="Закрыть" onClick={onClose} style={{ padding: 8, borderRadius: 10 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 16 }}>
          {loading && <div className="small">Загрузка…</div>}
          {loadError && (
            <div className="small" style={{ color: '#b91c1c', fontWeight: 600 }}>
              {loadError}
            </div>
          )}

          {!loading && !loadError && step < 3 && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>
              <span style={{ color: step === 1 ? 'var(--primary)' : 'var(--text)' }}>1. День</span>
              <span>→</span>
              <span style={{ color: step === 2 ? 'var(--primary)' : 'var(--text)' }}>2. Время</span>
            </div>
          )}

          {!loading && !loadError && step === 3 && (
            <div style={{ textAlign: 'center', padding: '8px 4px 12px' }}>
              <div style={{ width: 52, height: 52, margin: '0 auto 12px', borderRadius: 999, background: 'rgba(34,197,94,0.15)', display: 'grid', placeItems: 'center' }}>
                <CheckCircle2 size={30} color="#16a34a" />
              </div>
              <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>Запрос отправлен</div>
              <p className="small" style={{ color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                Время выбрано. Психолог увидит запись и подтвердит её в разделе сессий. После подтверждения сессия отобразится как принята; комната станет доступна, когда специалист согласится.
              </p>
              <button type="button" className="button" style={{ marginTop: 18, padding: '10px 22px', borderRadius: 12, fontWeight: 800 }} onClick={onClose}>
                Готово
              </button>
            </div>
          )}

          {!loading && !loadError && step < 3 && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  marginBottom: 12
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
                    style={{ padding: '6px 8px', borderRadius: 10 }}
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
                    style={{ padding: '6px 8px', borderRadius: 10 }}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              {step === 1 && (
                <>
                  <div className="small" style={{ fontWeight: 800, marginBottom: 10, color: 'var(--text-muted)' }}>
                    Выберите день со свободными слотами
                  </div>
                  {renderCalendarGrid((key) => setCalendarSelectedDay(key))}
                  <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="button"
                      disabled={!canProceedStep1}
                      onClick={() => {
                        setSelectedSlot(null);
                        setStep(2);
                      }}
                      style={{ padding: '9px 18px', borderRadius: 12, fontWeight: 800, opacity: canProceedStep1 ? 1 : 0.45 }}
                    >
                      Далее
                    </button>
                  </div>
                </>
              )}

              {step === 2 && calendarSelectedDay && selectedDaySummary && (
                <>
                  <div className="small" style={{ fontWeight: 800, marginBottom: 10, color: 'var(--text-muted)' }}>
                    Выберите время
                  </div>
                  <div style={{ fontWeight: 800, marginBottom: 10 }}>
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
                          padding: '9px 12px',
                          borderRadius: 10,
                          fontWeight: 800,
                          fontSize: 13,
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
                  {bookError && (
                    <div
                      className="small"
                      style={{
                        marginTop: 12,
                        padding: '8px 10px',
                        borderRadius: 10,
                        background: 'rgba(239,68,68,0.12)',
                        border: '1px solid rgba(239,68,68,0.35)',
                        color: '#b91c1c',
                        fontWeight: 600
                      }}
                    >
                      {bookError}
                    </div>
                  )}
                  <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <button type="button" className="button secondary" onClick={() => setStep(1)} style={{ padding: '9px 14px', borderRadius: 12, fontWeight: 700 }}>
                      Назад
                    </button>
                    <button
                      type="button"
                      className="button"
                      disabled={!canProceedStep2 || submitting}
                      onClick={() => void confirmBook()}
                      style={{ padding: '9px 18px', borderRadius: 12, fontWeight: 800, opacity: canProceedStep2 && !submitting ? 1 : 0.45 }}
                    >
                      {submitting ? 'Сохранение…' : 'Подтвердить запись'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
