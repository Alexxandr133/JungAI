import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { api, resolvePublicFileUrl } from '../../lib/api';
import {
  DEFAULT_CALENDAR_PREFS,
  type CalendarPrefs,
  calendarCells,
  computeDaySummary,
  dayKeyFromDate,
  mergeCalendarPrefsFromServer,
  pad2
} from '../../lib/eventsCalendarUtils';
import { BrandLogo } from '../../components/BrandLogo';
import { OPERATOR_INFO } from '../../content/operatorInfo';
import '../../styles/landing-tokens.css';
import './PublicCalendarBook.css';

const QUIZ_KEY = 'client_quiz_result';
const STEP_LABELS = ['День', 'Слот', 'Данные'] as const;

type WizardStep = 1 | 2 | 3 | 4;

type PublicHost = {
  name: string;
  avatarUrl: string | null;
  therapyMethod: string | null;
  isVerified: boolean;
};

function localSlotRangeIso(dayKey: string, startHm: string, durationMin: number) {
  const [H, M] = startHm.split(':').map(Number);
  const [y, mo, da] = dayKey.split('-').map(Number);
  const start = new Date(y, mo - 1, da, H, M, 0, 0);
  const end = new Date(start.getTime() + durationMin * 60000);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return { slotStart: iso(start), slotEnd: iso(end) };
}

function hostIdFromToken(token: string): string | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(b64)
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('')
    );
    const payload = JSON.parse(json) as { pid?: unknown };
    return typeof payload.pid === 'string' && payload.pid ? payload.pid : null;
  } catch {
    return null;
  }
}

function loadQuizCommentPrefill(): string {
  try {
    const raw = localStorage.getItem(QUIZ_KEY);
    if (!raw) return '';
    const data = JSON.parse(raw) as {
      notePrefill?: string;
      notes?: string;
      freeText?: string;
      customTopic?: string | null;
      topics?: string[];
      whoLabel?: string;
    };
    if (data.notePrefill) return String(data.notePrefill);
    if (data.notes) return String(data.notes);
    if (data.freeText) return String(data.freeText);
    const parts = [
      Array.isArray(data.topics) && data.topics.length ? data.topics.join(', ') : null,
      data.whoLabel || null,
      data.customTopic || null
    ].filter(Boolean);
    return parts.length ? `Запрос из анкеты: ${parts.join(' · ')}` : '';
  } catch {
    return '';
  }
}

function SlimBookFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="pub-book__footer">
      <div className="pub-book__footer-inner">
        <nav className="pub-book__footer-docs" aria-label="Документы">
          <Link to="/terms">Пользовательское соглашение</Link>
          <Link to="/privacy">Политика конфиденциальности</Link>
          <Link to="/personal-data-consent">Согласие на обработку ПДн</Link>
          <Link to="/contacts">Контакты</Link>
        </nav>
        <div className="pub-book__footer-meta">
          © {year} JungAI · Оператор ПДн: реестр РКН № {OPERATOR_INFO.rknRegistryNumber}
        </div>
      </div>
    </footer>
  );
}

export default function PublicCalendarBookPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t') || searchParams.get('token') || '';
  const profileId = useMemo(() => (token ? hostIdFromToken(token) : null), [token]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [prefs, setPrefs] = useState<CalendarPrefs>(DEFAULT_CALENDAR_PREFS);
  const [host, setHost] = useState<PublicHost | null>(null);
  const [avatarBroken, setAvatarBroken] = useState(false);

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
  const [message, setMessage] = useState(() => loadQuizCommentPrefill());
  const [consentPd, setConsentPd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (profileId) return;
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
        const data = await api<{
          items: any[];
          prefs: unknown;
          host?: PublicHost;
        }>(`/api/events/public-calendar?t=${encodeURIComponent(token)}`);
        if (cancelled) return;
        setItems(data.items || []);
        setPrefs({ ...DEFAULT_CALENDAR_PREFS, ...mergeCalendarPrefsFromServer(data.prefs) });
        setHost(
          data.host
            ? {
                name: data.host.name || 'Специалист',
                avatarUrl: data.host.avatarUrl || null,
                therapyMethod: data.host.therapyMethod || null,
                isVerified: Boolean(data.host.isVerified)
              }
            : null
        );
        setAvatarBroken(false);
        setCalendarSelectedDay(null);
        setWizardStep(1);
        setSelectedSlot(null);
      } catch (e: any) {
        if (!cancelled) {
          const msg = String(e?.message || '');
          setLoadError(
            msg.includes('отключена') || msg.includes('403')
              ? 'Запись по ссылке временно отключена специалистом.'
              : msg || 'Не удалось загрузить календарь'
          );
        }
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
  const canSubmit = consentPd && !submitting;

  const hostName = host?.name || 'Специалист';
  const avatarSrc = resolvePublicFileUrl(host?.avatarUrl) || host?.avatarUrl || null;
  const initial = (hostName.trim()[0] || 'П').toUpperCase();

  function goStep(target: 1 | 2 | 3) {
    if (target < wizardStep) setWizardStep(target);
  }

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!consentPd) {
      setFormError('Нужно согласие на обработку персональных данных.');
      return;
    }
    if (!token || !calendarSelectedDay || !selectedSlot) {
      setFormError('Выберите день и слот.');
      return;
    }
    const sum = computeDaySummary(calendarSelectedDay, prefs, selectedCalendarEvents);
    if (sum.isPast || sum.weekendBlocked) {
      setFormError('Этот день недоступен для записи.');
      return;
    }
    const { slotStart, slotEnd } = localSlotRangeIso(
      calendarSelectedDay,
      selectedSlot,
      prefs.slotIntervalMinutes
    );
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
      setWizardStep(4);
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      setMessage('');
      setConsentPd(false);
    } catch (err: any) {
      setFormError(err.message || 'Не удалось отправить заявку');
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="landing pub-book">
        <header className="pub-book__top">
          <BrandLogo to="/" height={40} showText={false} />
          <p className="pub-book__top-title">Запись недоступна</p>
        </header>
        <main className="pub-book__main">
          <h1 className="pub-book__h1">Календарь недоступен</h1>
          <p className="pub-book__lead">Нужна корректная ссылка от специалиста.</p>
        </main>
        <SlimBookFooter />
      </div>
    );
  }

  if (profileId) {
    return <Navigate to={`/psychologists/${profileId}`} replace />;
  }

  return (
    <div className="landing pub-book">
      <header className="pub-book__top">
        <BrandLogo to="/" height={40} showText={false} />
        <p className="pub-book__top-title">Запись к {hostName}</p>
      </header>

      <main className="pub-book__main">
        <h1 className="pub-book__h1">Запись на встречу</h1>
        <p className="pub-book__lead">Выберите день и время — специалист подтвердит заявку.</p>

        {!loading && !loadError && host && (
          <section className="pub-book__host" aria-label="Специалист">
            {avatarSrc && !avatarBroken ? (
              <img
                className="pub-book__avatar"
                src={avatarSrc}
                alt=""
                onError={() => setAvatarBroken(true)}
              />
            ) : (
              <div className="pub-book__avatar-fallback" aria-hidden>
                {initial}
              </div>
            )}
            <div className="pub-book__host-meta">
              <div className="pub-book__host-name-row">
                <h2 className="pub-book__host-name">{hostName}</h2>
                {host.isVerified ? <span className="pub-book__badge">Верифицирован</span> : null}
              </div>
              {host.therapyMethod ? (
                <p className="pub-book__host-method">{host.therapyMethod}</p>
              ) : null}
            </div>
          </section>
        )}

        {loading && (
          <div className="pub-book__card pub-book__card-pad">Загрузка календаря…</div>
        )}
        {loadError && <div className="pub-book__error">{loadError}</div>}

        {!loading && !loadError && wizardStep < 4 && (
          <div className="pub-book__steps" role="list">
            {STEP_LABELS.map((label, i) => {
              const n = (i + 1) as 1 | 2 | 3;
              const active = wizardStep === n;
              const done = wizardStep > n;
              return (
                <button
                  key={label}
                  type="button"
                  role="listitem"
                  className={`pub-book__step${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}
                  onClick={() => goStep(n)}
                  disabled={!done}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {!loading && !loadError && wizardStep === 4 && (
          <div className="pub-book__card pub-book__success">
            <div className="pub-book__success-icon">
              <CheckCircle2 size={32} />
            </div>
            <h2>Заявка отправлена</h2>
            <p>
              {hostName} подтвердит встречу — детали придут на почту.
            </p>
            {profileId ? (
              <Link to={`/psychologists/${profileId}`} className="landing-btn landing-btn--primary">
                Вернуться к профилю
              </Link>
            ) : (
              <Link to="/" className="landing-btn landing-btn--primary">
                На главную
              </Link>
            )}
          </div>
        )}

        {!loading && !loadError && wizardStep < 4 && (
          <div className="pub-book__card">
            {wizardStep === 1 && (
              <>
                <div className="pub-book__month-bar">
                  <div className="pub-book__month-nav">
                    <button
                      type="button"
                      className="pub-book__icon-btn"
                      aria-label="Предыдущий месяц"
                      onClick={() =>
                        setCalendarMonth((prev) => {
                          const d = new Date(prev);
                          d.setMonth(d.getMonth() - 1);
                          return d;
                        })
                      }
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <div className="pub-book__month-title">{calendarView.title}</div>
                    <button
                      type="button"
                      className="pub-book__icon-btn"
                      aria-label="Следующий месяц"
                      onClick={() =>
                        setCalendarMonth((prev) => {
                          const d = new Date(prev);
                          d.setMonth(d.getMonth() + 1);
                          return d;
                        })
                      }
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                  <div className="pub-book__legend">
                    <span className="pub-book__legend-item">
                      <span className="pub-book__dot pub-book__dot--sage" />
                      Есть окна
                    </span>
                    <span className="pub-book__legend-item">
                      <span className="pub-book__dot pub-book__dot--warning" />
                      Частично
                    </span>
                    <span className="pub-book__legend-item">
                      <span className="pub-book__dot pub-book__dot--brand" />
                      Занято
                    </span>
                  </div>
                </div>

                <div className="pub-book__card-pad">
                  <div className="pub-book__step-label">Шаг 1: выберите день</div>
                  <div className="pub-book__weekdays">
                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((w) => (
                      <div key={w} className="pub-book__weekday">
                        {w}
                      </div>
                    ))}
                  </div>
                  <div className="pub-book__grid">
                    {calendarView.cells.map(({ d, inMonth }) => {
                      const key = dayKeyFromDate(d);
                      const sum = calendarDaySummaries[key];
                      const nEv = (eventsByDay[key] || []).length;
                      const isSelected = calendarSelectedDay === key;
                      const isPast = sum.isPast;
                      const cellBusyFull =
                        !isPast && sum.hasEvents && sum.freeSegments.length === 0 && !sum.weekendBlocked;
                      const cellPartial =
                        !isPast && sum.hasEvents && sum.freeSegments.length > 0 && !sum.weekendBlocked;
                      const className = [
                        'pub-book__cell',
                        !inMonth ? 'is-out' : '',
                        isPast ? 'is-past' : '',
                        sum.weekendBlocked ? 'is-weekend' : '',
                        cellBusyFull ? 'is-busy' : '',
                        cellPartial ? 'is-partial' : '',
                        isSelected ? 'is-selected' : ''
                      ]
                        .filter(Boolean)
                        .join(' ');

                      return (
                        <button
                          key={`${key}-${inMonth}`}
                          type="button"
                          className={className}
                          onClick={() => setCalendarSelectedDay(key)}
                        >
                          <div className="pub-book__cell-day">{d.getDate()}</div>
                          {inMonth && (
                            <div className="pub-book__cell-sub">
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
                                  {nEv > 0 ? `${nEv} встр. · ` : null}
                                  {sum.freeLabel}
                                </>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="pub-book__actions pub-book__actions--end">
                    <button
                      type="button"
                      className="landing-btn landing-btn--primary"
                      disabled={!canProceedStep1}
                      onClick={() => {
                        setSelectedSlot(null);
                        setWizardStep(2);
                      }}
                    >
                      Далее
                    </button>
                  </div>
                </div>
              </>
            )}

            {wizardStep === 2 && calendarSelectedDay && selectedDaySummary && (
              <div className="pub-book__card-pad">
                <div className="pub-book__step-label">Шаг 2: выберите время</div>
                <p className="pub-book__day-title">
                  {new Date(`${calendarSelectedDay}T12:00:00`).toLocaleDateString('ru-RU', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
                <div className="pub-book__slots">
                  {selectedDaySummary.slotStarts.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`pub-book__slot${selectedSlot === t ? ' is-selected' : ''}`}
                      onClick={() => setSelectedSlot(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="pub-book__actions">
                  <button
                    type="button"
                    className="landing-btn landing-btn--ghost"
                    onClick={() => setWizardStep(1)}
                  >
                    Назад
                  </button>
                  <button
                    type="button"
                    className="landing-btn landing-btn--primary"
                    disabled={!canProceedStep2}
                    onClick={() => setWizardStep(3)}
                  >
                    Далее
                  </button>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <form className="pub-book__card-pad pub-book__form" onSubmit={submitBooking}>
                <div className="pub-book__step-label">
                  Шаг 3: контакты
                  {calendarSelectedDay && selectedSlot ? (
                    <span style={{ color: 'var(--ink)' }}>
                      {' '}
                      ·{' '}
                      {new Date(`${calendarSelectedDay}T12:00:00`).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'short'
                      })}
                      , {selectedSlot}
                    </span>
                  ) : null}
                </div>

                <label className="pub-book__field">
                  <span className="pub-book__label">Ваше имя</span>
                  <input
                    className="pub-book__input"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    required
                    minLength={2}
                    placeholder="Ваше имя"
                    autoComplete="name"
                  />
                </label>
                <label className="pub-book__field">
                  <span className="pub-book__label">Ваш email</span>
                  <input
                    className="pub-book__input"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    required
                    placeholder="Ваш email"
                    autoComplete="email"
                  />
                </label>
                <label className="pub-book__field">
                  <span className="pub-book__label">Телефон (необязательно)</span>
                  <input
                    className="pub-book__input"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="Телефон (необязательно)"
                    autoComplete="tel"
                  />
                </label>
                <label className="pub-book__field">
                  <span className="pub-book__label">Пара слов о запросе (необязательно)</span>
                  <textarea
                    className="pub-book__textarea"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    placeholder="Пара слов о запросе (необязательно)"
                  />
                </label>

                <label className="pub-book__consent">
                  <input
                    type="checkbox"
                    checked={consentPd}
                    onChange={(e) => setConsentPd(e.target.checked)}
                    required
                  />
                  <span>
                    Согласен(на) на обработку персональных данных в соответствии с{' '}
                    <Link to="/privacy" target="_blank" rel="noreferrer">
                      политикой конфиденциальности
                    </Link>
                  </span>
                </label>

                <p className="pub-book__hint">Подтверждение и детали встречи придут на почту.</p>

                {formError ? <div className="pub-book__error">{formError}</div> : null}

                <div className="pub-book__actions">
                  <button
                    type="button"
                    className="landing-btn landing-btn--ghost"
                    onClick={() => setWizardStep(2)}
                  >
                    Назад
                  </button>
                  <button type="submit" className="landing-btn landing-btn--primary" disabled={!canSubmit}>
                    {submitting ? 'Отправка…' : 'Отправить заявку'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </main>

      <SlimBookFooter />
    </div>
  );
}
