export const SESSION_TEST_TOPIC = 'jungai.session-test';

export type SessionTestKind = 'association' | 'pyramid';

export type AssociationResponse = {
  word_index: number;
  word: string;
  response_text: string;
  reaction_time_ms: number;
  is_outlier: boolean;
  run_number: 1 | 2;
  is_reproduction_match: boolean | null;
  therapist_flag: string | null;
};

export type AssociationStatus = 'idle' | 'awaiting' | 'ready' | 'run1done' | 'done';

export type AssociationState = {
  kind: 'association';
  sessionId: string;
  therapistIdentity: string;
  status: AssociationStatus;
  runNumber: 1 | 2;
  idx: number;
  word: string | null;
  showProgress: boolean;
  words: string[];
  responses: AssociationResponse[];
};

export type PyramidLevels = {
  1: string[];
  2: string[];
  3: string[];
  4: string[];
  5: string[];
};

export type PyramidStep = 'query' | 'level' | 'pause' | 'result' | 'done';

export type PyramidState = {
  kind: 'pyramid';
  sessionId: string;
  therapistIdentity: string;
  query: string;
  step: PyramidStep;
  currentLevel: 1 | 2 | 3 | 4 | 5;
  levels: PyramidLevels;
  pauseEndsAt: number | null;
};

export type SessionTestState = AssociationState | PyramidState | null;

export type SessionTestMessage =
  | { type: 'hello' }
  | { type: 'close' }
  | { type: 'state'; state: SessionTestState }
  | { type: 'association_submit'; wordIndex: number; runNumber: 1 | 2; text: string; reactionMs: number }
  | { type: 'association_flag'; wordIndex: number; runNumber: 1 | 2; flag: string }
  | {
      type: 'pyramid_patch';
      query?: string;
      step?: PyramidStep;
      currentLevel?: 1 | 2 | 3 | 4 | 5;
      levels?: PyramidLevels;
      pauseEndsAt?: number | null;
    };

export const PYRAMID_LEVEL_SIZES = [16, 8, 4, 2, 1] as const;
export const PYRAMID_PAUSE_MS = 900_000;

export const PYRAMID_INTERPRET = [
  { level: 1, count: 16, text: 'Уровень реальности — поверхностные убеждения, стереотипы, часто навязанные извне' },
  { level: 2, count: 8, text: 'Уровень разума — личные мысли, убеждения, осознаваемые страхи и мотивации' },
  { level: 3, count: 4, text: 'Уровень чувств — истинные эмоции, желания, неосознаваемые переживания' },
  { level: 4, count: 2, text: 'Корень проблемы — неосознаваемые блоки, страхи, внутренние противоречия' },
  { level: 5, count: 1, text: 'Ключевое слово — глубинная ассоциация, ключ к пониманию истинных причин запроса' }
] as const;

export function emptyPyramidLevels(): PyramidLevels {
  return {
    1: Array(16).fill(''),
    2: Array(8).fill(''),
    3: Array(4).fill(''),
    4: Array(2).fill(''),
    5: Array(1).fill('')
  };
}

export function freshAssociation(sessionId: string, therapistIdentity: string, words: string[]): AssociationState {
  return {
    kind: 'association',
    sessionId,
    therapistIdentity,
    status: 'idle',
    runNumber: 1,
    idx: -1,
    word: null,
    showProgress: true,
    words,
    responses: []
  };
}

export function freshPyramid(sessionId: string, therapistIdentity: string): PyramidState {
  return {
    kind: 'pyramid',
    sessionId,
    therapistIdentity,
    query: '',
    step: 'query',
    currentLevel: 1,
    levels: emptyPyramidLevels(),
    pauseEndsAt: null
  };
}

export function newSessionId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : String(Date.now());
}
