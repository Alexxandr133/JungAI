/** ИИ-агент space проекта: промпт и разбор действий */

export type ProjectAgentActionType =
  | 'append_document'
  | 'insert_table'
  | 'replace_text'
  | 'update_table'
  | 'remove_table'
  | 'set_document'
  | 'add_hypothesis'
  | 'add_task'
  | 'add_source'
  | 'add_material';

export type ProjectAgentAction = {
  type: ProjectAgentActionType;
  tab?: string;
  html?: string;
  headers?: string[];
  rows?: string[][];
  text?: string;
  search?: string;
  replace?: string;
  replaceAll?: boolean;
  tableIndex?: number;
  title?: string;
  author?: string;
  year?: string;
  url?: string;
  notes?: string;
  status?: 'draft' | 'testing' | 'confirmed' | 'rejected';
};

const ACTION_MARKER = 'AGENT_ACTIONS_JSON=';

/** Запрос явно требует изменений в проекте */
export function messageExpectsAgentActions(text: string): boolean {
  return /(?:создай|создать|добав|встав|запиш|измен|удал|очист|помен|сделай|выпис|заполни|перенес|обнов|сформир|таблиц|оформи)/iu.test(
    text
  );
}

/** Модель пообещала действие, но могла не вывести JSON */
export function assistantClaimsAction(text: string): boolean {
  return /(?:создаю|добавл|вставлю|запишу|изменю|удалю|оформлю|выписыва|готовлю|сформир|сейчас создам|сделаю)/iu.test(
    text
  );
}

export function buildActionRepairUserPrompt(
  userMessage: string,
  assistantMessage: string,
  tabs: string[]
): string {
  return `Запрос исследователя: ${userMessage}

Ответ ассистента (текст без JSON): ${assistantMessage.slice(0, 4000)}

Вкладки проекта: ${tabs.join(', ')}

Сформируй ТОЛЬКО одну строку:
AGENT_ACTIONS_JSON={"actions":[...]}

Действия должны выполнить запрос. Для таблицы используй insert_table с headers и rows. Для текста — append_document или insert_table. Без markdown, без пояснений.`;
}

function tryParseActionsJson(jsonPart: string): ProjectAgentAction[] {
  let cleaned = jsonPart
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const markerIdx = cleaned.lastIndexOf(ACTION_MARKER);
  if (markerIdx >= 0) {
    cleaned = cleaned.slice(markerIdx + ACTION_MARKER.length).trim();
  }

  const attempts = [cleaned];
  if (cleaned.includes('"actions"')) {
    const extracted = extractBalancedJsonObject(cleaned);
    if (extracted && extracted !== cleaned) attempts.unshift(extracted);
    if (extracted && !extracted.endsWith('}')) {
      attempts.push(`${extracted.replace(/,\s*$/, '')}]}`);
      attempts.push(`${extracted}]}`);
    }
  }

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt) as { actions?: unknown };
      const actions = sanitizeActions(parsed.actions ?? parsed);
      if (actions.length) return actions;
    } catch {
      /* next attempt */
    }
  }
  return [];
}

function extractBalancedJsonObject(raw: string): string | null {
  const keyIdx = raw.lastIndexOf('"actions"');
  if (keyIdx === -1) return null;
  const start = raw.lastIndexOf('{', keyIdx);
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return raw.slice(start);
}

export function buildProjectAgentSystemPrompt(
  projectTitle: string,
  documentTabs: string[],
  opts?: {
    includeDreams?: boolean;
    selectedParticipant?: { label: string; code: string; dreamCount: number };
  }
): string {
  const tabsList = documentTabs.length ? documentTabs.join(', ') : 'Гипотеза, Метод, Заметки';
  const dreamsBlock = opts?.includeDreams
    ? `

В контекст включены обезличенные сны (маркеры [имя], [место] — обезличивание).
Можешь анализировать символы, строить таблицы insert_table по снам из контекста, добавлять гипотезы и материалы.
Не запрашивай персональные данные.${
        opts.selectedParticipant
          ? `

ВЫБРАННЫЙ УЧАСТНИК В КОНТЕКСТЕ: ${opts.selectedParticipant.label} (код ${opts.selectedParticipant.code}), снов передано: ${opts.selectedParticipant.dreamCount}.
Слова «участник», «его/её сны», «этого человека», «у участника» — ВСЕГДА про этого участника, даже без @-кода.
Таблицу снов участника делай через insert_table: headers=["Сон","Дата","Символы","Содержание"], rows — из блока «Сны» ниже.`
          : ''
      }`
    : '';

  return `Ты — ИИ-агент исследовательского проекта «${projectTitle}» на платформе JungAI.

Ты видишь полный контекст: документы по вкладкам (текст и таблицы с tableIndex), гипотезы, источники, задачи, материалы, историю изменений агента.${dreamsBlock}

КРИТИЧЕСКИ ВАЖНО — выбор действия:
- Пользователь просит ИЗМЕНИТЬ или УДАЛИТЬ текст → replace_text (search = точная строка из контекста, replace = новый текст или "")
- Пользователь просит ИЗМЕНИТЬ таблицу → update_table (tableIndex из контекста, новые headers и rows). НЕ insert_table!
- Пользователь просит УДАЛИТЬ таблицу → remove_table
- insert_table и append_document — ТОЛЬКО для НОВОГО контента, когда явно просят добавить
- set_document — полностью переписать вкладку; для очистки: {"type":"set_document","tab":"Заметки","html":""}

Примеры:
- «удали ыфвафыва и напиши привет мир» → replace_text: search="ыфвафыва", replace="привет мир"
- «поменяй значения в таблице» → update_table: tableIndex=0, headers=[...], rows=[новые значения]
- «добавь ещё одну таблицу» → insert_table

Доступные вкладки: ${tabsList}

КРИТИЧЕСКИ ВАЖНО — формат ответа:
1. Кратко опиши план в тексте (1–3 предложения).
2. В САМОМ КОНЦЕ ответа ОБЯЗАТЕЛЬНО одна строка без markdown:
AGENT_ACTIONS_JSON={"actions":[...]}

Без строки AGENT_ACTIONS_JSON изменения НЕ ПРИМЕНЯТСЯ — пользователь нажимает «Применить» только после JSON.
НИКОГДА не пиши «создаю», «сделаю», «добавлю» без этой строки в том же ответе.
Если пользователь просит создать таблицу, записать текст, добавить гипотезу — actions ОБЯЗАТЕЛЬНЫ.

Типы:
- replace_text: {"type":"replace_text","tab":"Заметки","search":"старый","replace":"новый","replaceAll":true}
- update_table: {"type":"update_table","tab":"Данные","tableIndex":0,"headers":["A","B"],"rows":[["1","2"]]}
- remove_table: {"type":"remove_table","tab":"Данные","tableIndex":0}
- set_document: {"type":"set_document","tab":"Заметки","html":"<p>...</p>"} или {"html":""} для очистки
- append_document: {"type":"append_document","tab":"Заметки","html":"<p>дополнение</p>"}
- insert_table: {"type":"insert_table","tab":"Данные","headers":[],"rows":[]}
- add_hypothesis, add_task, add_source, add_material — как раньше

Пример ответа на «создай таблицу во вкладке Данные»:
Сформирую таблицу с данными во вкладке «Данные».
AGENT_ACTIONS_JSON={"actions":[{"type":"insert_table","tab":"Данные","headers":["Поле","Значение"],"rows":[["Пример","1"]]}]}

Если изменения не нужны (только вопрос/обсуждение) — не добавляй AGENT_ACTIONS_JSON.
Отвечай на русском.`;
}

export function parseAgentResponse(raw: string): { message: string; actions: ProjectAgentAction[] } {
  if (!raw?.trim()) return { message: '', actions: [] };

  const markerIdx = raw.lastIndexOf(ACTION_MARKER);
  if (markerIdx !== -1) {
    const message = raw.slice(0, markerIdx).trim();
    const actions = tryParseActionsJson(raw.slice(markerIdx + ACTION_MARKER.length));
    if (actions.length) return { message, actions };
    if (message) return { message, actions: [] };
  }

  const altIdx = raw.lastIndexOf('AGENT_ACTIONS_JSON');
  if (altIdx !== -1) {
    const slice = raw.slice(altIdx);
    const eqIdx = slice.indexOf('=');
    const jsonStart = eqIdx >= 0 ? altIdx + eqIdx + 1 : altIdx + 'AGENT_ACTIONS_JSON'.length;
    const message = raw.slice(0, altIdx).trim();
    const actions = tryParseActionsJson(raw.slice(jsonStart));
    if (actions.length) return { message, actions };
  }

  const blockRe = /```(?:json)?\s*(\{[\s\S]*?"actions"\s*:\s*\[[\s\S]*)/gi;
  let blockMatch: RegExpExecArray | null = null;
  let lastBlock: RegExpExecArray | null = null;
  while ((blockMatch = blockRe.exec(raw)) !== null) lastBlock = blockMatch;
  if (lastBlock) {
    const actions = tryParseActionsJson(lastBlock[1]);
    if (actions.length) {
      return { message: raw.slice(0, lastBlock.index).trim(), actions };
    }
  }

  const extracted = extractBalancedJsonObject(raw);
  if (extracted) {
    const actions = tryParseActionsJson(extracted);
    if (actions.length) {
      const objIdx = raw.lastIndexOf(extracted);
      return { message: raw.slice(0, objIdx).trim(), actions };
    }
  }

  return { message: raw.trim(), actions: [] };
}

function sanitizeActions(raw: unknown): ProjectAgentAction[] {
  if (!Array.isArray(raw)) return [];
  const out: ProjectAgentAction[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const a = item as Record<string, unknown>;
    const type = String(a.type || '') as ProjectAgentActionType;
    const allowed: ProjectAgentActionType[] = [
      'append_document',
      'insert_table',
      'replace_text',
      'update_table',
      'remove_table',
      'set_document',
      'add_hypothesis',
      'add_task',
      'add_source',
      'add_material',
    ];
    if (!allowed.includes(type)) continue;

    const action: ProjectAgentAction = { type };
    if (typeof a.tab === 'string') action.tab = a.tab.slice(0, 80);
    if (typeof a.html === 'string') action.html = a.html.slice(0, 12000);
    if (typeof a.text === 'string') action.text = a.text.slice(0, 4000);
    if (typeof a.search === 'string') action.search = a.search.slice(0, 2000);
    if (typeof a.replace === 'string') action.replace = a.replace.slice(0, 4000);
    if (typeof a.replaceAll === 'boolean') action.replaceAll = a.replaceAll;
    if (typeof a.tableIndex === 'number' && Number.isFinite(a.tableIndex)) {
      action.tableIndex = Math.max(0, Math.min(20, Math.floor(a.tableIndex)));
    }
    if (typeof a.title === 'string') action.title = a.title.slice(0, 300);
    if (typeof a.author === 'string') action.author = a.author.slice(0, 200);
    if (typeof a.year === 'string') action.year = a.year.slice(0, 20);
    if (typeof a.url === 'string') action.url = a.url.slice(0, 500);
    if (typeof a.notes === 'string') action.notes = a.notes.slice(0, 2000);
    if (['draft', 'testing', 'confirmed', 'rejected'].includes(String(a.status))) {
      action.status = a.status as ProjectAgentAction['status'];
    }
    if (Array.isArray(a.headers)) {
      action.headers = a.headers.map((h) => String(h).slice(0, 120)).slice(0, 12);
    }
    if (Array.isArray(a.rows)) {
      action.rows = a.rows
        .slice(0, 50)
        .map((row) =>
          Array.isArray(row) ? row.map((c) => String(c).slice(0, 500)).slice(0, 12) : []
        );
    }
    out.push(action);
  }
  return out.slice(0, 8);
}

function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildProjectSpaceContextBlock(opts: {
  projectTitle: string;
  documentTabs: string[];
  tabContents: Record<string, string>;
  hypotheses: Array<{ text: string; status: string }>;
  sources: Array<{ title: string; author?: string; year?: string; url?: string; notes?: string; urlAnalysis?: string }>;
  tasks: Array<{ text: string; done: boolean }>;
  materials: Array<{ title: string; content: string; source?: string; createdAt: string }>;
}): string {
  const parts: string[] = [`# Проект: ${opts.projectTitle}`];
  parts.push('\n## Документ (вкладки)');
  let hasDoc = false;
  for (const tab of opts.documentTabs) {
    const plain = stripHtml(opts.tabContents[tab] || '');
    if (plain) {
      hasDoc = true;
      parts.push(`\n### ${tab}\n${plain.slice(0, 6000)}`);
    }
  }
  if (!hasDoc) parts.push('(пусто)');
  return parts.join('\n').slice(0, 380_000);
}
