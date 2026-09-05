import { useEffect, useRef, useState } from 'react';
import { ASSOCIATION_FLAGS } from './associationWords';
import { associationReport, associationWords } from './sessionTestLogic';
import type { AssociationState } from './types';

type Props = {
  state: AssociationState;
  isTherapist: boolean;
  finished?: boolean;
  onAdvance: () => void;
  onStartRun2: () => void;
  onFinish: () => void;
  onFlag: (wordIndex: number, runNumber: 1 | 2, flag: string) => void;
  onSubmit: (text: string, reactionMs: number) => void;
  onSaveResult?: () => void;
  onCloseTest?: () => void;
  onOpenSettings?: () => void;
  saving?: boolean;
  saveError?: string | null;
  saved?: boolean;
};

export function AssociationPanel({
  state,
  isTherapist,
  finished,
  onAdvance,
  onStartRun2,
  onFinish,
  onFlag,
  onSubmit,
  onSaveResult,
  onCloseTest,
  onOpenSettings,
  saving,
  saveError,
  saved
}: Props) {
  if (isTherapist) {
    return (
      <TherapistAssociation
        state={state}
        finished={Boolean(finished || state.status === 'done')}
        onAdvance={onAdvance}
        onStartRun2={onStartRun2}
        onFinish={onFinish}
        onFlag={onFlag}
        onSaveResult={onSaveResult}
        onCloseTest={onCloseTest}
        onOpenSettings={onOpenSettings}
        saving={saving}
        saveError={saveError}
        saved={saved}
      />
    );
  }
  return <ClientAssociation state={state} onSubmit={onSubmit} />;
}

function ClientAssociation({
  state,
  onSubmit
}: {
  state: AssociationState;
  onSubmit: (text: string, reactionMs: number) => void;
}) {
  const [text, setText] = useState('');
  const reactionStart = useRef<number | null>(null);
  const reactionMs = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const awaiting = state.status === 'awaiting' && Boolean(state.word);
  const total = associationWords(state).length;

  useEffect(() => {
    setText('');
    reactionMs.current = null;
    if (awaiting) {
      reactionStart.current = performance.now();
      inputRef.current?.focus();
    } else {
      reactionStart.current = null;
    }
  }, [state.word, state.idx, state.runNumber, awaiting]);

  function markStart() {
    if (state.runNumber === 1 && reactionStart.current != null && reactionMs.current == null) {
      reactionMs.current = performance.now() - reactionStart.current;
    }
  }

  function submit() {
    const value = text.trim();
    if (!value || !awaiting) return;
    const ms =
      state.runNumber === 1
        ? reactionMs.current ?? (reactionStart.current ? performance.now() - reactionStart.current : 0)
        : 0;
    onSubmit(value, ms);
  }

  const progress = `${state.idx >= 0 ? Math.min(state.idx + 1, total) : 0} / ${total}`;

  let kicker = 'ожидание';
  if (state.runNumber === 2 && awaiting) kicker = 'проверка';
  else if (awaiting) kicker = 'стимул';
  else if (state.status === 'ready') kicker = 'ответ принят';
  else if (state.status === 'done') kicker = 'завершено';

  let hint = 'Психолог начнёт тест. Оставайтесь на этой странице.';
  if (state.status === 'awaiting') {
    hint =
      state.runNumber === 2
        ? 'Вспомните свой ответ на это слово в первом прогоне'
        : 'Запишите первое, что приходит в голову';
  } else if (state.status === 'ready') {
    hint = 'Ждите следующее слово';
  } else if (state.status === 'run1done') {
    hint = 'Первый круг завершён';
  } else if (state.status === 'done') {
    hint = 'Спасибо. Можно обсудить результат с психологом';
  }

  return (
    <section className="session-test-gaze" aria-label="Ассоциативный тест">
      <div className="session-test-gaze__inner">
        <p className="session-test-gaze__progress">{progress}</p>
        <p className="session-test-gaze__kicker">{kicker}</p>
        <div className={`session-test-gaze__word${awaiting ? ' is-live' : ''}`} key={`${state.idx}-${state.word || 'idle'}`}>
          {state.word || 'ожидание'}
        </div>
        <p className="session-test-gaze__hint">{hint}</p>
        <div className="session-test-gaze__composer">
          <input
            ref={inputRef}
            type="text"
            autoComplete="off"
            disabled={!awaiting}
            placeholder={awaiting ? 'Ваше слово' : 'Ожидание'}
            value={text}
            onChange={(e) => {
              markStart();
              setText(e.target.value);
            }}
            onKeyDown={(e) => {
              markStart();
              if (e.key === 'Enter') submit();
            }}
          />
          <button type="button" disabled={!awaiting || !text.trim()} onClick={submit}>
            Ответить
          </button>
        </div>
      </div>
    </section>
  );
}

function TherapistAssociation({
  state,
  finished,
  onAdvance,
  onStartRun2,
  onFinish,
  onFlag,
  onSaveResult,
  onCloseTest,
  onOpenSettings,
  saving,
  saveError,
  saved
}: {
  state: AssociationState;
  finished: boolean;
  onAdvance: () => void;
  onStartRun2: () => void;
  onFinish: () => void;
  onFlag: (wordIndex: number, runNumber: 1 | 2, flag: string) => void;
  onSaveResult?: () => void;
  onCloseTest?: () => void;
  onOpenSettings?: () => void;
  saving?: boolean;
  saveError?: string | null;
  saved?: boolean;
}) {
  const visible = state.responses.filter((r) => r.run_number === state.runNumber);
  const report = associationReport(state);
  const total = associationWords(state).length;
  const canAdvance = state.status === 'idle' || state.status === 'ready';
  const lastRow = useRef<HTMLTableRowElement | null>(null);
  const noteTarget = visible[visible.length - 1];
  const [noteDraft, setNoteDraft] = useState(noteTarget?.therapist_flag || '');

  useEffect(() => {
    setNoteDraft(noteTarget?.therapist_flag || '');
  }, [noteTarget?.word_index, noteTarget?.run_number, noteTarget?.therapist_flag]);

  useEffect(() => {
    lastRow.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [visible.length]);

  const advanceLabel =
    state.status === 'idle'
      ? 'Начать тест'
      : state.status === 'awaiting'
        ? 'Ожидание ответа…'
        : state.idx + 1 >= total
          ? state.runNumber === 1
            ? 'Завершить круг 1'
            : 'Показать итог'
          : 'Следующее слово';

  const statusText =
    state.status === 'awaiting' ? 'ждём ответ' : finished ? 'завершено' : 'можно продолжать';

  function commitNote(value: string, wordIndex = noteTarget?.word_index, runNumber = noteTarget?.run_number) {
    if (wordIndex == null || runNumber == null) return;
    onFlag(wordIndex, runNumber, value.trim());
  }

  return (
    <section className="st-desk" aria-label="Панель психолога">
      <header className="st-desk__top">
        <div>
          <h2>Ассоциации</h2>
          <p>
            Круг {state.runNumber}
            {state.runNumber === 2 ? ', проверка' : ''} · {statusText}
          </p>
        </div>
        <p className="st-desk__count">
          {state.idx >= 0 ? Math.min(state.idx + 1, total) : 0}
          <span> / {total}</span>
        </p>
      </header>

      <p className="st-desk__now">
        <span>Сейчас</span>
        <strong>{state.word || (finished ? 'тест завершён' : 'слово ещё не показано')}</strong>
      </p>

      <div className="st-desk__tools">
        {finished ? (
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
          </>
        ) : state.status === 'run1done' ? (
          <button type="button" className="st-act" onClick={onStartRun2}>
            Второй круг
          </button>
        ) : (
          <button type="button" className="st-act" disabled={!canAdvance} onClick={onAdvance}>
            {advanceLabel}
          </button>
        )}
        {!finished && (
          <button type="button" className="st-act st-act--quiet" onClick={onFinish}>
            Закончить
          </button>
        )}
      </div>
      {saveError ? <p className="st-desk__sum">{saveError}</p> : null}

      {!finished && (
        <div className="st-desk__note">
          <label>
            Пометка к последнему ответу
            <input
              type="text"
              value={noteDraft}
              disabled={!noteTarget}
              placeholder={noteTarget ? 'Своими словами' : 'Сначала дождитесь ответа'}
              onChange={(e) => setNoteDraft(e.target.value)}
              onBlur={() => commitNote(noteDraft)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitNote(noteDraft);
              }}
            />
          </label>
          <p className="st-desk__marks">
            {ASSOCIATION_FLAGS.map((f) => (
              <button
                key={f}
                type="button"
                disabled={!noteTarget}
                onClick={() => {
                  setNoteDraft(f);
                  commitNote(f);
                }}
              >
                {f}
              </button>
            ))}
          </p>
        </div>
      )}

      <div className="st-desk__log">
        {visible.length === 0 ? (
          <p className="st-desk__empty">Ответы появятся здесь, по одному слову.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>№</th>
                <th>Слово</th>
                <th>Ответ</th>
                <th>Время</th>
                <th>Пометка</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r, i) => (
                <tr
                  key={`${r.run_number}-${r.word_index}`}
                  ref={i === visible.length - 1 ? lastRow : undefined}
                  className={`${r.is_outlier ? 'is-outlier ' : ''}${r.is_reproduction_match === false ? 'is-mismatch ' : ''}${i === visible.length - 1 ? 'is-latest' : ''}`}
                >
                  <td>{r.word_index + 1}</td>
                  <td>{r.word}</td>
                  <td>{r.response_text}</td>
                  <td>
                    {r.run_number === 1
                      ? `${(r.reaction_time_ms / 1000).toFixed(2)} с`
                      : r.is_reproduction_match
                        ? 'совпало'
                        : 'другое'}
                  </td>
                  <td>
                    <input
                      className="st-desk__row-note"
                      value={r.therapist_flag || ''}
                      onChange={(e) => onFlag(r.word_index, r.run_number, e.target.value)}
                      placeholder="пометка"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {report.run1 > 0 && (state.status === 'run1done' || finished) && (
        <p className="st-desk__sum">
          {report.run1} ответов, среднее {(report.avg / 1000).toFixed(2)} с, задержек {report.outliers}
          {report.run2 > 0 ? ` · во втором прогоне совпало ${report.matches} из ${report.run2}` : ''}
        </p>
      )}
    </section>
  );
}
