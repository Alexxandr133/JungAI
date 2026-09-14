import { useEffect, useState } from 'react';
import './BreathingPracticeModal.css';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Total guided seconds (default ~60) */
  seconds?: number;
};

const STEPS = [
  { label: 'Вдох', seconds: 4, hint: 'Медленно через нос' },
  { label: 'Задержка', seconds: 4, hint: 'Мягко удерживайте' },
  { label: 'Выдох', seconds: 6, hint: 'Медленно через рот' },
  { label: 'Пауза', seconds: 2, hint: 'Отпустите плечи' },
];

export function BreathingPracticeModal({ open, onClose, seconds = 60 }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!open) {
      setElapsed(0);
      setRunning(false);
      return;
    }
    setElapsed(0);
    setRunning(true);
  }, [open]);

  useEffect(() => {
    if (!open || !running) return;
    const id = window.setInterval(() => {
      setElapsed((e) => {
        if (e + 1 >= seconds) {
          window.clearInterval(id);
          setRunning(false);
          return seconds;
        }
        return e + 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [open, running, seconds]);

  if (!open) return null;

  const cycle = STEPS.reduce((a, s) => a + s.seconds, 0);
  const pos = elapsed % cycle;
  let acc = 0;
  let stepIdx = 0;
  for (let i = 0; i < STEPS.length; i++) {
    if (pos < acc + STEPS[i].seconds) {
      stepIdx = i;
      break;
    }
    acc += STEPS[i].seconds;
  }
  const step = STEPS[stepIdx];
  const done = elapsed >= seconds;
  const progress = Math.min(1, elapsed / seconds);
  const cycleIndex = Math.floor(elapsed / cycle);
  // «Отпустите плечи» только в первом круге
  const hint = done
    ? 'Готово. Можно вернуться к делам.'
    : stepIdx === 3 && cycleIndex >= 1
      ? ''
      : step.hint;

  return (
    <div className="breath-modal" role="dialog" aria-modal="true" aria-labelledby="breath-title">
      <button type="button" className="breath-modal__backdrop" aria-label="Закрыть" onClick={onClose} />
      <div className="breath-modal__card">
        <h2 id="breath-title" className="breath-modal__title">
          Пауза · дыхание
        </h2>
        <p className="breath-modal__lead">Около минуты. Следуйте шагам — ничего записывать не нужно.</p>

        <div className={`breath-modal__orb${running && !done ? ` is-${stepIdx}` : ''}`} aria-hidden>
          <span>{done ? '✓' : step.label}</span>
        </div>

        <p className="breath-modal__hint">{hint || '\u00a0'}</p>

        <div className="breath-modal__bar" aria-hidden>
          <span style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="breath-modal__time">
          {elapsed} / {seconds} сек
        </p>

        <div className="breath-modal__actions">
          {!done && (
            <button type="button" className="button secondary" onClick={() => setRunning((r) => !r)}>
              {running ? 'Пауза' : 'Продолжить'}
            </button>
          )}
          <button type="button" className="button" onClick={onClose}>
            {done ? 'Закрыть' : 'Выйти'}
          </button>
        </div>
      </div>
    </div>
  );
}
