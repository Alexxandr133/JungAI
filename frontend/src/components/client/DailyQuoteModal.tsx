import { useEffect, useState } from 'react';
import { hasSeenTodaysQuote, markTodaysQuoteSeen, quoteForToday, type DailyQuote } from '../../lib/dailyQuotes';
import './DailyQuoteModal.css';

type Props = {
  /** If false, never auto-open (caller controls) */
  enabled?: boolean;
  quote?: DailyQuote;
};

export function DailyQuoteModal({ enabled = true, quote }: Props) {
  const q = quote ?? quoteForToday();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (hasSeenTodaysQuote()) return;
    setOpen(true);
  }, [enabled]);

  function dismiss() {
    markTodaysQuoteSeen();
    setOpen(false);
  }

  if (!open) return null;

  const initials = q.author
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');

  return (
    <div className="daily-quote-modal" role="dialog" aria-modal="true" aria-labelledby="daily-quote-title">
      <button type="button" className="daily-quote-modal__backdrop" aria-label="Закрыть" onClick={dismiss} />
      <div className="daily-quote-modal__card">
        <div className="daily-quote-modal__ornament" aria-hidden>
          ⌘
        </div>
        <div className="daily-quote-modal__avatar" aria-hidden>
          {initials || '·'}
        </div>
        <p id="daily-quote-title" className="daily-quote-modal__author">
          {q.author}
        </p>
        {q.source && <p className="daily-quote-modal__source">{q.source}</p>}
        <blockquote className="daily-quote-modal__text">«{q.text}»</blockquote>
        <button type="button" className="button daily-quote-modal__btn" onClick={dismiss}>
          Продолжить
        </button>
      </div>
    </div>
  );
}
