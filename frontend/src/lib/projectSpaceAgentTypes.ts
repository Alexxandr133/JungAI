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
  /** Для replace_text: что найти (точная строка из контекста) */
  search?: string;
  /** Для replace_text: на что заменить (пустая строка = удалить) */
  replace?: string;
  replaceAll?: boolean;
  /** Индекс таблицы во вкладке, с 0 */
  tableIndex?: number;
  title?: string;
  author?: string;
  year?: string;
  url?: string;
  notes?: string;
  status?: 'draft' | 'testing' | 'confirmed' | 'rejected';
};

export function actionLabel(action: ProjectAgentAction): string {
  switch (action.type) {
    case 'append_document':
      return `Добавить текст во вкладку «${action.tab || 'Заметки'}»`;
    case 'insert_table':
      return `Вставить новую таблицу во вкладку «${action.tab || 'Данные'}»`;
    case 'replace_text':
      return action.replace
        ? `Заменить «${truncate(action.search)}» → «${truncate(action.replace)}»`
        : `Удалить текст «${truncate(action.search)}»`;
    case 'update_table':
      return `Изменить таблицу ${(action.tableIndex ?? 0) + 1} во вкладке «${action.tab || 'Документ'}»`;
    case 'remove_table':
      return `Удалить таблицу ${(action.tableIndex ?? 0) + 1} во вкладке «${action.tab || 'Документ'}»`;
    case 'set_document':
      return action.html === '' || (action.html === undefined && !action.text)
        ? `Очистить вкладку «${action.tab || 'Документ'}»`
        : `Заменить всё содержимое вкладки «${action.tab || 'Документ'}»`;
    case 'add_hypothesis':
      return `Добавить гипотезу`;
    case 'add_task':
      return `Добавить задачу`;
    case 'add_source':
      return `Добавить источник «${action.title || 'без названия'}»`;
    case 'add_material':
      return `Добавить материал «${action.title || 'без названия'}»`;
    default:
      return 'Применить действие';
  }
}

function truncate(s?: string, max = 24): string {
  if (!s) return '…';
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildTableHtml(headers: string[], rows: string[][]): string {
  const th = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
    .join('');
  return `<div class="wa-table-wrap"><table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div><p><br></p>`;
}

export function markdownToSimpleHtml(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inList = false;

  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      continue;
    }
    if (t.startsWith('### ')) {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      out.push(`<h3>${escapeHtml(t.slice(4))}</h3>`);
    } else if (t.startsWith('## ')) {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      out.push(`<h2>${escapeHtml(t.slice(3))}</h2>`);
    } else if (t.startsWith('- ') || t.startsWith('* ')) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${escapeHtml(t.slice(2))}</li>`);
    } else {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      out.push(`<p>${escapeHtml(t)}</p>`);
    }
  }
  if (inList) out.push('</ul>');
  return out.join('');
}
