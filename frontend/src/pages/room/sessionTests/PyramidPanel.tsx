import { useEffect, useMemo, useState } from 'react';
import {
  PYRAMID_INTERPRET,
  PYRAMID_LEVEL_SIZES,
  type PyramidLevels,
  type PyramidState
} from './types';

type Props = {
  state: PyramidState;
  isTherapist: boolean;
  notes: string;
  onNotes: (v: string) => void;
  onComplete: () => void;
  onPatch: (patch: Partial<Pick<PyramidState, 'query' | 'step' | 'currentLevel' | 'levels' | 'pauseEndsAt'>>) => void;
  onSaveResult?: () => void;
  onCloseTest?: () => void;
  onOpenSettings?: () => void;
  saving?: boolean;
  saved?: boolean;
  saveError?: string | null;
};

function wordLabel(n: number) {
  if (n === 1) return 'слово';
  if (n >= 2 && n <= 4) return 'слова';
  return 'слов';
}

function levelFilled(levels: PyramidLevels, level: 1 | 2 | 3 | 4 | 5) {
  return levels[level].every((t) => String(t).trim());
}

function GazeSteps({ level }: { level: number }) {
  return (
    <div className="session-test-gaze__steps" aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n === level ? 'is-on' : n < level ? 'is-done' : ''} />
      ))}
    </div>
  );
}

export function PyramidPanel({
  state,
  isTherapist,
  notes,
  onNotes,
  onComplete,
  onPatch,
  onSaveResult,
  onCloseTest,
  onOpenSettings,
  saving,
  saved,
  saveError
}: Props) {
  return isTherapist ? (
    <TherapistPyramid
      state={state}
      notes={notes}
      onNotes={onNotes}
      onComplete={onComplete}
      onSaveResult={onSaveResult}
      onCloseTest={onCloseTest}
      onOpenSettings={onOpenSettings}
      saving={saving}
      saved={saved}
      saveError={saveError}
    />
  ) : (
    <ClientPyramid state={state} onPatch={onPatch} />
  );
}

function ClientPyramid({
  state,
  onPatch
}: {
  state: PyramidState;
  onPatch: Props['onPatch'];
}) {
  const [query, setQuery] = useState(state.query);
  const [draft, setDraft] = useState(state.levels[state.currentLevel]);
  const [, tick] = useState(0);

  useEffect(() => {
    setQuery(state.query);
  }, [state.query]);

  useEffect(() => {
    setDraft(state.levels[state.currentLevel]);
  }, [state.currentLevel, state.sessionId, state.step]);

  useEffect(() => {
    if (state.step !== 'pause' || !state.pauseEndsAt) return;
    const id = window.setInterval(() => {
      if (Date.now() >= (state.pauseEndsAt || 0)) {
        onPatch({ step: 'result', pauseEndsAt: null });
      } else {
        tick((n) => n + 1);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [state.step, state.pauseEndsAt, onPatch]);

  if (state.step === 'query') {
    return (
      <section className="session-test-gaze">
        <div className="session-test-gaze__inner session-test-gaze__inner--narrow">
          <p className="session-test-gaze__kicker">тест пирамида</p>
          <h2 className="session-test-gaze__title">CФормлируйте ваш запрос</h2>
          <p className="session-test-gaze__hint">пишите свободно</p>
          <input
            className="session-test-gaze__solo-field"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Например: отношения с родителями"
          />
          <button
            type="button"
            className="session-test-gaze__cta"
            disabled={!query.trim()}
            onClick={() => onPatch({ query: query.trim(), step: 'level', currentLevel: 1 })}
          >
            Начать
          </button>
        </div>
      </section>
    );
  }

  if (state.step === 'pause') {
    const left = Math.max(0, Math.ceil(((state.pauseEndsAt || Date.now()) - Date.now()) / 1000));
    const mm = String(Math.floor(left / 60)).padStart(2, '0');
    const ss = String(left % 60).padStart(2, '0');
    return (
      <section className="session-test-gaze">
        <div className="session-test-gaze__inner session-test-gaze__inner--narrow">
          <p className="session-test-gaze__kicker">пауза</p>
          <h2 className="session-test-gaze__title">Перед ключевым словом</h2>
          <p className="session-test-gaze__hint">Можно подождать 10–15 минут или открыть результат сейчас.</p>
          <div className="session-test-gaze__timer">{mm}:{ss}</div>
          <button type="button" className="session-test-gaze__cta" onClick={() => onPatch({ step: 'result', pauseEndsAt: null })}>
            Посмотреть результат
          </button>
        </div>
      </section>
    );
  }

  if (state.step === 'result' || state.step === 'done') {
    return (
      <section className="session-test-gaze">
        <div className="session-test-gaze__inner session-test-gaze__inner--narrow">
          <p className="session-test-gaze__kicker">результат</p>
          <h2 className="session-test-gaze__title">Ключевое слово</h2>
          <div className="session-test-gaze__word is-live is-key">{state.levels[5][0] || '—'}</div>
          <p className="session-test-gaze__hint">Обсудите его с психологом. Запрос: «{state.query}»</p>
        </div>
      </section>
    );
  }

  const level = state.currentLevel;
  const size = PYRAMID_LEVEL_SIZES[level - 1];
  const filled = draft.every((t) => t.trim());

  function setCell(i: number, value: string) {
    const next = draft.slice();
    next[i] = value;
    setDraft(next);
    onPatch({ levels: { ...state.levels, [level]: next } });
  }

  function goNext() {
    if (!levelFilled({ ...state.levels, [level]: draft }, level)) return;
    if (level < 5) {
      onPatch({ currentLevel: (level + 1) as 1 | 2 | 3 | 4 | 5, levels: { ...state.levels, [level]: draft } });
      return;
    }
    onPatch({
      step: 'pause',
      levels: { ...state.levels, [level]: draft },
      pauseEndsAt: Date.now() + 900_000
    });
  }

  return (
    <section className="session-test-gaze session-test-gaze--fill">
      <div className="session-test-gaze__inner session-test-gaze__inner--wide session-test-gaze__inner--fill">
        <GazeSteps level={level} />
        <p className="session-test-gaze__kicker">
          уровень {level} · {size} {wordLabel(size)}
        </p>
        <h2 className="session-test-gaze__title">{level === 1 ? 'Свободные ассоциации' : 'Объедините пары'}</h2>
        <p className="session-test-gaze__hint">
          {level === 1 ? 'Заполните шестнадцать первых слов' : 'Для каждой пары напишите одно общее слово.'}
        </p>

        {level === 1 ? (
          <div className="session-test-gaze__grid">
            {draft.map((v, i) => (
              <label key={i} className="session-test-gaze__cell">
                <span>{i + 1}</span>
                <input value={v} onChange={(e) => setCell(i, e.target.value)} />
              </label>
            ))}
          </div>
        ) : (
          <div className={`session-test-gaze__pairs session-test-gaze__pairs--${size}`}>
            {draft.map((v, i) => {
              const a = state.levels[(level - 1) as 1 | 2 | 3 | 4][i * 2];
              const b = state.levels[(level - 1) as 1 | 2 | 3 | 4][i * 2 + 1];
              return (
                <label key={i} className="session-test-gaze__pair">
                  <span className="session-test-gaze__pair-words">
                    <em>{a || '…'}</em>
                    <i>+</i>
                    <em>{b || '…'}</em>
                  </span>
                  <input value={v} placeholder="Общая ассоциация" onChange={(e) => setCell(i, e.target.value)} />
                </label>
              );
            })}
          </div>
        )}

        <button type="button" className="session-test-gaze__cta" disabled={!filled} onClick={goNext}>
          Далее
        </button>
      </div>
    </section>
  );
}

function TherapistPyramid({
  state,
  notes,
  onNotes,
  onComplete,
  onSaveResult,
  onCloseTest,
  onOpenSettings,
  saving,
  saved,
  saveError
}: {
  state: PyramidState;
  notes: string;
  onNotes: (v: string) => void;
  onComplete: () => void;
  onSaveResult?: () => void;
  onCloseTest?: () => void;
  onOpenSettings?: () => void;
  saving?: boolean;
  saved?: boolean;
  saveError?: string | null;
}) {
  const rows = useMemo(() => [1, 2, 3, 4, 5] as const, []);
  return (
    <section className="st-desk st-desk--split">
      <header className="st-desk__top">
        <div>
          <h2>Пирамида</h2>
          <p>{state.query ? state.query : 'Клиент ещё не написал запрос'}</p>
        </div>
      </header>

      <div className="st-desk__split">
        <div className="st-levels">
          {rows.map((level) => {
            const words = state.levels[level].map((t) => t.trim()).filter(Boolean);
            return (
              <div key={level} className={`st-level${level === 5 && words.length ? ' is-key' : ''}`}>
                <b>{level}</b>
                {words.length ? (
                  <div className="st-level-words">
                    {words.map((word, i) => (
                      <span key={`${level}-${i}`} className="st-chip">{word}</span>
                    ))}
                  </div>
                ) : (
                  <p>ещё пусто · {PYRAMID_LEVEL_SIZES[level - 1]} слов</p>
                )}
              </div>
            );
          })}
        </div>

        <aside className="st-desk__side">
          <label>
            Заметки
            <textarea value={notes} onChange={(e) => onNotes(e.target.value)} placeholder="То, что замечаете по ходу" />
          </label>
          {state.step === 'done' ? (
            <>
              <button type="button" className="st-act" disabled={saving || saved} onClick={onSaveResult}>
                {saved ? 'Сохранено' : saving ? 'Сохраняем…' : 'Сохранить результат в рабочую область'}
              </button>
              <button type="button" className="st-act st-act--quiet" onClick={onOpenSettings}>
                Настройки теста
              </button>
              <button type="button" className="st-act st-act--quiet" onClick={onCloseTest}>
                Закрыть тест
              </button>
              {saveError ? <p className="st-desk__sum">{saveError}</p> : null}
            </>
          ) : (
            <button
              type="button"
              className="st-act st-act--quiet"
              disabled={state.step !== 'result'}
              onClick={onComplete}
            >
              Закончить
            </button>
          )}
          {(state.step === 'result' || state.step === 'done') && (
            <ul className="st-read">
              {PYRAMID_INTERPRET.map((r) => (
                <li key={r.level}>
                  <strong>Уровень {r.level}</strong>
                  <span>{r.text}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </section>
  );
}
