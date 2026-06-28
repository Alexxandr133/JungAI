/** Модель индивидуации: 6 стадий SD, оси компенсаций, когнитивная гексаграмма */

import { INDIVIDUATION_QUESTIONS_BANK } from './individuationQuestionsBank';

export type StageId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6';
export type StateKind = 'D' | 'F' | 'I';
export type ViewMode = 'overview' | 'axes' | 'shadow';

export type StageDef = {
  id: StageId;
  label: string;
  archetype: string;
  color: string;
  focus: string;
  /** Индекс вершины 0–5, порядок против часовой от S1 (низ) */
  ccwIndex: number;
};

export const INDIVIDUATION_STAGES: StageDef[] = [
  {
    id: 'S1',
    label: 'Мистическое соучастие',
    archetype: 'Ева / Уроборос',
    color: '#D4A574',
    focus: 'Базовое доверие, телесность, слияние vs автономия',
    ccwIndex: 0,
  },
  {
    id: 'S2',
    label: 'Проективная стадия',
    archetype: 'Елена',
    color: '#9B59B6',
    focus: 'Магическое мышление, зависимость от авторитета, безопасность',
    ccwIndex: 1,
  },
  {
    id: 'S3',
    label: 'Сила и импульсивность',
    archetype: 'Ипполита / Герой',
    color: '#E74C3C',
    focus: 'Воля, границы, агрессия, «Я хочу», витальность',
    ccwIndex: 2,
  },
  {
    id: 'S4',
    label: 'Абстрактные содержания',
    archetype: 'Мария',
    color: '#3498DB',
    focus: 'Порядок, мораль, долг, идеология, правила',
    ccwIndex: 3,
  },
  {
    id: 'S5',
    label: 'Снятие проекций',
    archetype: 'Саломея / Рацио',
    color: '#F39C12',
    focus: 'Автономия, рациональность, кризис смыслов',
    ccwIndex: 4,
  },
  {
    id: 'S6',
    label: 'Воссоединение',
    archetype: 'София / Самость',
    color: '#2ECC71',
    focus: 'Целостность, эмпатия, принятие, трансперсональность',
    ccwIndex: 5,
  },
];

export type CompensationAxis = {
  id: string;
  label: string;
  poleA: StageId;
  poleB: StageId;
  conflict: string;
  jungFunction: string;
  individuationGoal: string;
};

export const COMPENSATION_AXES: CompensationAxis[] = [
  {
    id: 'axis-survival-order',
    label: 'Выживание ↔ Порядок',
    poleA: 'S1',
    poleB: 'S4',
    conflict: 'Тело/Хаос (Бежевый) vs Дух/Порядок (Синий)',
    jungFunction: 'Ощущение (S)',
    individuationGoal: 'Гибкие структуры без потери связи с телом',
  },
  {
    id: 'axis-magic-ratio',
    label: 'Магия ↔ Рацио',
    poleA: 'S2',
    poleB: 'S5',
    conflict: 'Причастность/Мистика (Фиолетовый) vs Эффективность/Расчёт (Оранжевый)',
    jungFunction: 'Интуиция (N) vs Мышление (T)',
    individuationGoal: 'Интуиция и логика как взаимодополняющие инструменты',
  },
  {
    id: 'axis-power-empathy',
    label: 'Сила ↔ Эмпатия',
    poleA: 'S3',
    poleB: 'S6',
    conflict: 'Эгоцентричная сила (Красный) vs Альтруистичное равенство (Зелёный)',
    jungFunction: 'Чувство (F) и волевой аспект (J/P)',
    individuationGoal: 'Здоровая агрессия для защиты гуманистических ценностей',
  },
];

export type ScoreWeight = { stage: StageId; state: StateKind; weight?: number };

export type IndividuationOption = {
  key: 'A' | 'B' | 'C' | 'D';
  text: string;
  scores: ScoreWeight[];
};

export type IndividuationQuestion = {
  id: number;
  stage: StageId;
  axis?: string;
  text: string;
  options: IndividuationOption[];
};

export type StageProfile = {
  stage: StageId;
  D: number;
  F: number;
  I: number;
};

/** Длина луча = I (интеграция), 18%–100% радиуса */
export function integrationRayLength(prof: StageProfile): number {
  return 0.18 + (prof.I / 100) * 0.82;
}

export type IndividuationHexResult = {
  schemaVersion: 1;
  kind: 'individuation-hex';
  completedAt: string;
  stages: StageProfile[];
  dominantFixation?: StageId;
  dominantDeficit?: StageId;
  growthPoint?: StageId;
  axisTension: Record<string, number>;
  interpretation: string;
};

export type CognitiveFunctionId = 'S' | 'F' | 'J' | 'N' | 'T' | 'P';

export type CognitivePole = {
  id: string;
  functionId: CognitiveFunctionId;
  pole: 'E' | 'I';
  label: string;
  short: string;
};

export const COGNITIVE_POLES: CognitivePole[] = [
  { id: 'Se', functionId: 'S', pole: 'E', label: 'Se', short: 'Непосредственный сенсорный контакт' },
  { id: 'Si', functionId: 'S', pole: 'I', label: 'Si', short: 'Телесная память, внутренняя опора' },
  { id: 'Fe', functionId: 'F', pole: 'E', label: 'Fe', short: 'Дифференцированная эмпатия' },
  { id: 'Fi', functionId: 'F', pole: 'I', label: 'Fi', short: 'Аутентичный внутренний компас' },
  { id: 'Je', functionId: 'J', pole: 'E', label: 'Je', short: 'Решимость, экологичное структурирование' },
  { id: 'Ji', functionId: 'J', pole: 'I', label: 'Ji', short: 'Автономная внутренняя дисциплина' },
  { id: 'Ne', functionId: 'N', pole: 'E', label: 'Ne', short: 'Гибкое паттерн-распознавание' },
  { id: 'Ni', functionId: 'N', pole: 'I', label: 'Ni', short: 'Трансперсональное видение' },
  { id: 'Te', functionId: 'T', pole: 'E', label: 'Te', short: 'Инструментальная рациональность' },
  { id: 'Ti', functionId: 'T', pole: 'I', label: 'Ti', short: 'Рефлексия без интеллектуализации' },
  { id: 'Pe', functionId: 'P', pole: 'E', label: 'Pe', short: 'Адаптивность без тревоги' },
  { id: 'Pi', functionId: 'P', pole: 'I', label: 'Pi', short: 'Толерантность к амбивалентности' },
];

export type CognitiveQuestion = {
  id: number;
  functionId: CognitiveFunctionId;
  text: string;
  options: { text: string; pole: 'E' | 'I' }[];
};

export type CognitiveHexResult = {
  schemaVersion: 1;
  kind: 'cognitive-hex';
  completedAt: string;
  poles: Record<string, number>;
  dominantE?: string;
  dominantI?: string;
  interpretation: string;
};

/** Координаты вершин: против часовой от нижней (S1) */
export function stageVertex(stageId: StageId, cx: number, cy: number, radius: number) {
  const stage = INDIVIDUATION_STAGES.find((s) => s.id === stageId)!;
  const angle = -Math.PI / 2 + (Math.PI / 3) * stage.ccwIndex;
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle), angle };
}

export function allStageVertices(cx: number, cy: number, radius: number) {
  return INDIVIDUATION_STAGES.map((s) => ({
    ...stageVertex(s.id, cx, cy, radius),
    stage: s,
  }));
}

/** 36 вопросов: A=Дефицит, B=Фиксация, C=Интеграция, D=Тень */
export const INDIVIDUATION_QUESTIONS: IndividuationQuestion[] = INDIVIDUATION_QUESTIONS_BANK as IndividuationQuestion[];

export const COGNITIVE_QUESTIONS: CognitiveQuestion[] = [
  { id: 1, functionId: 'S', text: 'В новой обстановке вы первым делом…', options: [
    { text: 'Сканируете детали: свет, звуки, запахи', pole: 'E' },
    { text: 'Сверяете с телесной памятью «похоже/не похоже»', pole: 'I' },
    { text: 'Ищете знакомый якорь или предмет', pole: 'I' },
    { text: 'Действуете телом — идёте, трогаете, пробуете', pole: 'E' },
  ]},
  { id: 2, functionId: 'S', text: 'При принятии бытового решения (еда, маршрут)…', options: [
    { text: 'Что приятно телу прямо сейчас', pole: 'E' },
    { text: 'Что работало надёжно раньше', pole: 'I' },
    { text: 'Эксперимент ради ощущения новизны', pole: 'E' },
    { text: 'Проверенный ритуал/режим', pole: 'I' },
  ]},
  { id: 3, functionId: 'F', text: 'Друг расстроен, но не говорит прямо. Вы…', options: [
    { text: 'Подстраиваете тон и атмосферу, создаёте безопасность', pole: 'E' },
    { text: 'Сверяетесь с внутренним «мне ок помочь?»', pole: 'I' },
    { text: 'Читаете язык тела и отражаете', pole: 'E' },
    { text: 'Ждёте, пока сам откроется — уважая границу', pole: 'I' },
  ]},
  { id: 4, functionId: 'F', text: 'Моральный выбор без свидетелей…', options: [
    { text: '«Как это скажется на отношениях?»', pole: 'E' },
    { text: '«Совпадает ли с моими ценностями?»', pole: 'I' },
    { text: 'Ищу баланс интересов группы', pole: 'E' },
    { text: 'Только внутренний компас', pole: 'I' },
  ]},
  { id: 5, functionId: 'J', text: 'Дедлайн через неделю. Вы…', options: [
    { text: 'Делите задачи для команды и контролируете', pole: 'E' },
    { text: 'Строите личный план и следуете ему', pole: 'I' },
    { text: 'Договариваетесь о правилах совместной работы', pole: 'E' },
    { text: 'Работаете автономно до готовности', pole: 'I' },
  ]},
  { id: 6, functionId: 'J', text: 'Когда планы рушатся…', options: [
    { text: 'Быстро перестраиваю систему для всех', pole: 'E' },
    { text: 'Возвращаюсь к внутреннему приоритету', pole: 'I' },
    { text: 'Делегирую и закрываю риски', pole: 'E' },
    { text: 'Пересматриваю личные критерии «зачем»', pole: 'I' },
  ]},
  { id: 7, functionId: 'N', text: 'Видите паттерн в хаосе данных…', options: [
    { text: 'Генерируете несколько гипотез сразу', pole: 'E' },
    { text: 'Ждёте, пока сложится одно глубокое видение', pole: 'I' },
    { text: 'Связываете разрозненные факты в сеть', pole: 'E' },
    { text: 'Улавливаете скрытый смысл «между строк»', pole: 'I' },
  ]},
  { id: 8, functionId: 'N', text: 'Будущее проекта кажется…', options: [
    { text: 'Множество веток — интересно комбинировать', pole: 'E' },
    { text: 'Один сильный вектор, к которому идёте', pole: 'I' },
    { text: 'Поле возможностей для мозгового штурма', pole: 'E' },
    { text: 'Образ цели, который созревает внутри', pole: 'I' },
  ]},
  { id: 9, functionId: 'T', text: 'Спор о методе работы…', options: [
    { text: 'Что эффективнее по метрикам и срокам', pole: 'E' },
    { text: 'Что логически непротиворечиво', pole: 'I' },
    { text: 'Лучшая практика индустрии', pole: 'E' },
    { text: 'Собственная модель, выверенная до деталей', pole: 'I' },
  ]},
  { id: 10, functionId: 'T', text: 'Ошибка в рассуждении коллеги…', options: [
    { text: 'Указываю на следствие для результата', pole: 'E' },
    { text: 'Разбираю структуру аргумента', pole: 'I' },
    { text: 'Предлагаю рабочий протокол', pole: 'E' },
    { text: 'Ищу внутреннее противоречие в системе', pole: 'I' },
  ]},
  { id: 11, functionId: 'P', text: 'Незавершённость задачи…', options: [
    { text: 'Ок — адаптируюсь по ходу', pole: 'E' },
    { text: 'Терплю амбивалентность, пока не прояснится', pole: 'I' },
    { text: 'Ищу новые входы и опции', pole: 'E' },
    { text: 'Держу паузу без паники', pole: 'I' },
  ]},
  { id: 12, functionId: 'P', text: 'Новая информация меняет картину…', options: [
    { text: 'Быстро переключаю фокус', pole: 'E' },
    { text: 'Даю себе время переварить', pole: 'I' },
    { text: 'Пробую несколько траекторий параллельно', pole: 'E' },
    { text: 'Интегрирую в уже сложную внутреннюю модель', pole: 'I' },
  ]},
];

function emptyStageScores(): Record<StageId, Record<StateKind, number>> {
  return {
    S1: { D: 0, F: 0, I: 0 },
    S2: { D: 0, F: 0, I: 0 },
    S3: { D: 0, F: 0, I: 0 },
    S4: { D: 0, F: 0, I: 0 },
    S5: { D: 0, F: 0, I: 0 },
    S6: { D: 0, F: 0, I: 0 },
  };
}

function normalizeStage(raw: Record<StateKind, number>): StageProfile {
  const total = raw.D + raw.F + raw.I || 1;
  return {
    stage: 'S1',
    D: Math.round((raw.D / total) * 100),
    F: Math.round((raw.F / total) * 100),
    I: Math.round((raw.I / total) * 100),
  };
}

export function scoreIndividuationHex(answers: Record<number, string>): IndividuationHexResult {
  const acc = emptyStageScores();
  for (const question of INDIVIDUATION_QUESTIONS) {
    const key = answers[question.id];
    if (!key) continue;
    const opt = question.options.find((o) => o.key === key);
    if (!opt) continue;
    for (const s of opt.scores) {
      const w = s.weight ?? 1;
      acc[s.stage][s.state] += w;
    }
  }

  const stages: StageProfile[] = INDIVIDUATION_STAGES.map((st) => {
    const n = normalizeStage(acc[st.id]);
    return { ...n, stage: st.id };
  });

  const dominantFixation = [...stages].sort((a, b) => b.F - a.F)[0]?.stage;
  const dominantDeficit = [...stages].sort((a, b) => b.D - a.D)[0]?.stage;
  const growthPoint = [...stages].sort((a, b) => a.I - b.I)[0]?.stage;

  const axisTension: Record<string, number> = {};
  for (const axis of COMPENSATION_AXES) {
    const a = stages.find((s) => s.stage === axis.poleA)!;
    const b = stages.find((s) => s.stage === axis.poleB)!;
    axisTension[axis.id] = Math.abs(a.F - b.F) + Math.abs(a.D - b.D) + Math.abs(a.I - b.I) / 2;
  }

  const domStage = INDIVIDUATION_STAGES.find((s) => s.id === dominantFixation);
  const shadowStage = INDIVIDUATION_STAGES.find((s) => s.id === dominantDeficit);
  const growthStage = INDIVIDUATION_STAGES.find((s) => s.id === growthPoint);

  const interpretation = [
    domStage ? `Доминанта (фиксация): ${domStage.label} — возможная ригидность в теме «${domStage.focus}».` : '',
    shadowStage ? `Тень (дефицит): ${shadowStage.label} — зона вытеснения, стоит мягко возвращать опыт этой стадии.` : '',
    growthStage ? `Точка роста: ${growthStage.label} — развитие интеграции здесь даст наибольший эффект.` : '',
    'Профиль ориентировочный; для глубинной работы обсудите результаты со специалистом.',
  ].filter(Boolean).join(' ');

  return {
    schemaVersion: 1,
    kind: 'individuation-hex',
    completedAt: new Date().toISOString(),
    stages,
    dominantFixation,
    dominantDeficit,
    growthPoint,
    axisTension,
    interpretation,
  };
}

export function scoreCognitiveHex(answers: Record<number, number>): CognitiveHexResult {
  const poleScores: Record<string, number> = {};
  for (const p of COGNITIVE_POLES) poleScores[p.id] = 0;

  for (const question of COGNITIVE_QUESTIONS) {
    const idx = answers[question.id];
    if (idx === undefined) continue;
    const opt = question.options[idx];
    if (!opt) continue;
    const poleId = COGNITIVE_POLES.find((p) => p.functionId === question.functionId && p.pole === opt.pole)?.id;
    if (poleId) poleScores[poleId] += 1;
  }

  const ePoles = COGNITIVE_POLES.filter((p) => p.pole === 'E');
  const iPoles = COGNITIVE_POLES.filter((p) => p.pole === 'I');
  const dominantE = [...ePoles].sort((a, b) => (poleScores[b.id] ?? 0) - (poleScores[a.id] ?? 0))[0]?.id;
  const dominantI = [...iPoles].sort((a, b) => (poleScores[b.id] ?? 0) - (poleScores[a.id] ?? 0))[0]?.id;

  return {
    schemaVersion: 1,
    kind: 'cognitive-hex',
    completedAt: new Date().toISOString(),
    poles: poleScores,
    dominantE,
    dominantI,
    interpretation: `Выраженные полюса: ${dominantE ?? '—'} (экстравертный) и ${dominantI ?? '—'} (интровертный). Спектр функций — не жёсткая типизация.`,
  };
}

export const RESEARCHER_INDIVIDUATION_KEY = 'researcher_individuation_results';

export function saveResearcherIndividuationResult(testType: 'individuation-hex' | 'cognitive-hex', result: unknown) {
  try {
    const raw = localStorage.getItem(RESEARCHER_INDIVIDUATION_KEY);
    const data = raw ? JSON.parse(raw) : {};
    data[testType] = { result, savedAt: new Date().toISOString() };
    localStorage.setItem(RESEARCHER_INDIVIDUATION_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

export function loadResearcherIndividuationResult(testType: 'individuation-hex' | 'cognitive-hex') {
  try {
    const raw = localStorage.getItem(RESEARCHER_INDIVIDUATION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data[testType]?.result ?? null;
  } catch {
    return null;
  }
}

export function clearResearcherIndividuationResult(testType: 'individuation-hex' | 'cognitive-hex') {
  try {
    const raw = localStorage.getItem(RESEARCHER_INDIVIDUATION_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    delete data[testType];
    localStorage.setItem(RESEARCHER_INDIVIDUATION_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}
