import { ASSOCIATION_WORDS_100 } from './associationWords';
import type { AssociationResponse, AssociationState } from './types';

function mean(arr: number[]) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function stddev(arr: number[]) {
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((v) => (v - m) ** 2)));
}

export function associationWords(state: AssociationState) {
  return state.words?.length ? state.words : [...ASSOCIATION_WORDS_100];
}

export function isAssociationOutlier(value: number, prior: number[]) {
  if (prior.length < 5) return false;
  return value > mean(prior) + 1.5 * stddev(prior);
}

export function presentAssociationWord(state: AssociationState): AssociationState {
  const words = associationWords(state);
  const nextIdx = state.idx + 1;
  if (nextIdx >= words.length) {
    return {
      ...state,
      idx: words.length,
      word: null,
      status: state.runNumber === 1 ? 'run1done' : 'done'
    };
  }
  return {
    ...state,
    idx: nextIdx,
    word: words[nextIdx],
    status: 'awaiting'
  };
}

export function applyAssociationSubmit(
  state: AssociationState,
  wordIndex: number,
  runNumber: 1 | 2,
  text: string,
  reactionMs: number
): AssociationState {
  if (state.idx !== wordIndex || state.runNumber !== runNumber || state.status !== 'awaiting') {
    return state;
  }
  const trimmed = text.trim();
  if (!trimmed) return state;
  const words = associationWords(state);
  const prior = state.responses.filter((r) => r.run_number === 1).map((r) => r.reaction_time_ms);
  const prev = state.responses.find((r) => r.run_number === 1 && r.word_index === wordIndex);
  const outlier = runNumber === 1 ? isAssociationOutlier(reactionMs, prior) : false;
  const existing = state.responses.find((r) => r.word_index === wordIndex && r.run_number === runNumber);
  const row: AssociationResponse = {
    word_index: wordIndex,
    word: words[wordIndex] || existing?.word || '',
    response_text: trimmed,
    reaction_time_ms: Math.round(reactionMs),
    is_outlier: outlier,
    run_number: runNumber,
    is_reproduction_match:
      runNumber === 2 && prev ? prev.response_text.toLowerCase() === trimmed.toLowerCase() : null,
    therapist_flag: existing?.therapist_flag || (outlier && runNumber === 1 ? 'задержка' : null)
  };
  return {
    ...state,
    status: 'ready',
    responses: [...state.responses.filter((r) => !(r.word_index === wordIndex && r.run_number === runNumber)), row]
  };
}

export function applyAssociationFlag(
  state: AssociationState,
  wordIndex: number,
  runNumber: 1 | 2,
  flag: string
): AssociationState {
  return {
    ...state,
    responses: state.responses.map((r) =>
      r.word_index === wordIndex && r.run_number === runNumber ? { ...r, therapist_flag: flag || null } : r
    )
  };
}

export function associationReport(state: AssociationState) {
  const run1 = state.responses.filter((r) => r.run_number === 1);
  const times = run1.map((r) => r.reaction_time_ms);
  const avg = mean(times);
  const outliers = run1.filter((r) => r.is_outlier).length;
  const run2 = state.responses.filter((r) => r.run_number === 2);
  const matches = run2.filter((r) => r.is_reproduction_match).length;
  return { run1: run1.length, avg, outliers, run2: run2.length, matches };
}
