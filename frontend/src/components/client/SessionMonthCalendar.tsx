import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SessionMonthCalendar.css';

type SessionDay = {
  /** YYYY-MM-DD */
  date: string;
  title?: string;
};

type Props = {
  sessions: SessionDay[];
  nearestLabel?: string | null;
  nearestWhen?: string | null;
  countdown?: string | null;
  joinUrl?: string | null;
  onWrite?: () => void;
  compact?: boolean;
};

function monthMatrix(year: number, month: number): (number | null)[][] {
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function SessionMonthCalendar({
  sessions,
  nearestLabel,
  nearestWhen,
  countdown,
  joinUrl,
  onWrite,
  compact = false,
}: Props) {
  const navigate = useNavigate();
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const rows = useMemo(() => monthMatrix(year, month), [year, month]);
  const sessionMap = useMemo(() => {
    const m = new Map<string, SessionDay[]>();
    for (const s of sessions) {
      const k = s.date.slice(0, 10);
      const list = m.get(k) || [];
      list.push(s);
      m.set(k, list);
    }
    return m;
  }, [sessions]);

  const monthTitle = cursor.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  const todayKey = ymd(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div className={`session-cal${compact ? ' session-cal--compact' : ''}`}>
      <div className="session-cal__head">
        <button
          type="button"
          className="session-cal__nav"
          aria-label="Предыдущий месяц"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
        >
          ‹
        </button>
        <div className="session-cal__title">{monthTitle}</div>
        <button
          type="button"
          className="session-cal__nav"
          aria-label="Следующий месяц"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
        >
          ›
        </button>
      </div>
      <div className="session-cal__dow" aria-hidden>
        {['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="session-cal__grid">
        {rows.flatMap((row, ri) =>
          row.map((day, ci) => {
            if (day == null) return <span key={`${ri}-${ci}`} className="session-cal__cell is-empty" />;
            const key = ymd(year, month, day);
            const has = sessionMap.has(key);
            const isToday = key === todayKey;
            return (
              <button
                key={key}
                type="button"
                className={`session-cal__cell${has ? ' has-session' : ''}${isToday ? ' is-today' : ''}`}
                title={has ? sessionMap.get(key)?.map((s) => s.title).filter(Boolean).join(', ') : undefined}
                onClick={() => navigate('/client/sessions')}
              >
                {day}
              </button>
            );
          })
        )}
      </div>

      {(nearestLabel || nearestWhen) && (
        <div className="session-cal__next">
          <div>
            <div className="session-cal__next-label">Ближайшая</div>
            <div className="session-cal__next-title">{nearestLabel}</div>
            {nearestWhen && <div className="session-cal__next-when">{nearestWhen}</div>}
            {countdown && <div className="session-cal__next-count">{countdown}</div>}
          </div>
          <div className="session-cal__next-actions">
            {joinUrl && (
              <a href={joinUrl} className="button" style={{ textDecoration: 'none', padding: '6px 12px', fontSize: 12 }}>
                Войти
              </a>
            )}
            {onWrite && (
              <button type="button" className="button secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={onWrite}>
                Написать
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
