import { useState } from 'react';
import {
  COGNITIVE_QUESTIONS,
  INDIVIDUATION_QUESTIONS,
  INDIVIDUATION_STAGES,
  type CognitiveHexResult,
  type IndividuationHexResult,
  scoreCognitiveHex,
  scoreIndividuationHex,
} from '../../data/individuationModel';
import { HexProgressRing, IndividuationHexagram } from './IndividuationHexagram';
import './IndividuationTestRunner.css';

type TestKind = 'individuation-hex' | 'cognitive-hex';

type Props = {
  kind: TestKind;
  onComplete: (result: IndividuationHexResult | CognitiveHexResult) => void;
  onCancel?: () => void;
};

export function IndividuationTestRunner({ kind, onComplete, onCancel }: Props) {
  const [onboard, setOnboard] = useState(true);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | number>>({});

  const questions = kind === 'individuation-hex' ? INDIVIDUATION_QUESTIONS : COGNITIVE_QUESTIONS;
  const q = questions[index];
  const total = questions.length;

  function finish() {
    if (kind === 'individuation-hex') {
      const strAnswers: Record<number, string> = {};
      for (const [k, v] of Object.entries(answers)) strAnswers[Number(k)] = String(v);
      onComplete(scoreIndividuationHex(strAnswers));
    } else {
      const numAnswers: Record<number, number> = {};
      for (const [k, v] of Object.entries(answers)) numAnswers[Number(k)] = Number(v);
      onComplete(scoreCognitiveHex(numAnswers));
    }
  }

  function next() {
    if (index < total - 1) setIndex((i) => i + 1);
    else finish();
  }

  if (onboard) {
    return (
      <div className="ind-test onboard">
        <div className="ind-test__astrolabe" aria-hidden>
          <IndividuationHexagram animated size={200} />
        </div>
        <h2>{kind === 'individuation-hex' ? 'Гексаграмма индивидуации' : 'Когнитивная гексаграмма'}</h2>
        <p>
          {kind === 'individuation-hex'
            ? 'Узнайте архетипическую архитектуру за ~15 минут. 36 ситуационных дилемм по шести стадиям.'
            : 'Спектр когнитивных функций: 12 вопросов о предпочтениях мышления и восприятия.'}
        </p>
        <div className="ind-test__actions">
          {onCancel && (
            <button type="button" className="button secondary" onClick={onCancel}>
              Назад
            </button>
          )}
          <button type="button" className="button" onClick={() => setOnboard(false)}>
            Начать диагностику
          </button>
        </div>
      </div>
    );
  }

  const progressStage =
    kind === 'individuation-hex' && 'stage' in q
      ? INDIVIDUATION_STAGES.findIndex((s) => s.id === (q as { stage: string }).stage)
      : Math.floor((index / total) * 6);

  const answered = answers[q.id] !== undefined;

  return (
    <div className="ind-test">
      <div className="ind-test__progress-head">
        <HexProgressRing current={index + 1} total={total} />
        <div>
          <div className="ind-test__progress-title">
            {kind === 'individuation-hex' ? 'Гексаграмма индивидуации' : 'Когнитивная гексаграмма'}
          </div>
          <div className="ind-test__progress-meta">
            Вопрос {index + 1} из {total}
          </div>
        </div>
      </div>

      <div className="ind-test__question card">{q.text}</div>

      <div className="ind-test__options">
        {kind === 'individuation-hex' && 'options' in q && (q as { options: { key: string; text: string }[] }).options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={answers[q.id] === opt.key ? 'ind-test__option selected' : 'ind-test__option'}
            onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.key }))}
          >
            <span className="ind-test__option-key">{opt.key}</span>
            {opt.text}
          </button>
        ))}
        {kind === 'cognitive-hex' && 'options' in q && (q as { options: { text: string }[] }).options.map((opt, i) => (
          <button
            key={i}
            type="button"
            className={answers[q.id] === i ? 'ind-test__option selected' : 'ind-test__option'}
            onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: i }))}
          >
            {opt.text}
          </button>
        ))}
      </div>

      <div className="ind-test__nav">
        <button type="button" className="button secondary" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
          ← Назад
        </button>
        <button type="button" className="button" disabled={!answered} onClick={next}>
          {index === total - 1 ? 'Завершить' : 'Далее →'}
        </button>
      </div>

      <div className="ind-test__mini-hex" aria-hidden>
        <IndividuationHexagram progressStageIndex={progressStage} size={120} />
      </div>
    </div>
  );
}
