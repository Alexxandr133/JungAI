import {
  addSpaceMaterial,
  appendToDocumentTab,
  loadSpaceHypotheses,
  loadSpaceSources,
  loadSpaceTasks,
  loadTabContent,
  saveSpaceHypotheses,
  saveSpaceSources,
  saveSpaceTasks,
  saveTabContent,
  touchProjectUpdated,
  type SpaceHypothesis,
} from './researchProjectStorage';
import {
  removeTableFromDocumentHtml,
  replaceTableInDocumentHtml,
  replaceTextInDocumentHtml,
} from './projectSpaceDocumentEdit';
import { buildTableHtml, type ProjectAgentAction } from './projectSpaceAgentTypes';

function saveTabHtml(projectId: string, tab: string, html: string, tabs: string[]) {
  saveTabContent(projectId, tab, html);
  touchProjectUpdated(projectId);
  return tabs;
}

export function applyProjectAgentAction(
  projectId: string,
  action: ProjectAgentAction,
  tabs: string[]
): {
  tabs: string[];
  reloadTab?: string;
  switchTool?: 'document' | 'hypotheses' | 'sources' | 'tasks' | 'materials';
  ok: boolean;
  error?: string;
} {
  switch (action.type) {
    case 'replace_text': {
      const tab = action.tab?.trim() || tabs[0] || 'Заметки';
      const search = action.search?.trim();
      if (!search) return { tabs, ok: false, error: 'Не указан текст для поиска' };
      const html = loadTabContent(projectId, tab);
      const { html: next, replaced } = replaceTextInDocumentHtml(
        html,
        search,
        action.replace ?? '',
        action.replaceAll !== false
      );
      if (!replaced) {
        return {
          tabs,
          ok: false,
          error: `Текст «${search.slice(0, 40)}» не найден во вкладке «${tab}»`,
        };
      }
      saveTabHtml(projectId, tab, next, tabs);
      return { tabs, reloadTab: tab, switchTool: 'document', ok: true };
    }
    case 'update_table': {
      const tab = action.tab?.trim() || tabs[0] || 'Заметки';
      const tableIndex = typeof action.tableIndex === 'number' ? action.tableIndex : 0;
      const headers = action.headers?.length ? action.headers : ['Столбец 1', 'Столбец 2'];
      const rows = action.rows ?? [];
      const html = loadTabContent(projectId, tab);
      const { html: next, replaced } = replaceTableInDocumentHtml(html, tableIndex, headers, rows);
      if (!replaced) {
        return {
          tabs,
          ok: false,
          error: `Таблица ${tableIndex + 1} не найдена во вкладке «${tab}»`,
        };
      }
      saveTabHtml(projectId, tab, next, tabs);
      return { tabs, reloadTab: tab, switchTool: 'document', ok: true };
    }
    case 'remove_table': {
      const tab = action.tab?.trim() || tabs[0] || 'Заметки';
      const tableIndex = typeof action.tableIndex === 'number' ? action.tableIndex : 0;
      const html = loadTabContent(projectId, tab);
      const { html: next, removed } = removeTableFromDocumentHtml(html, tableIndex);
      if (!removed) {
        return {
          tabs,
          ok: false,
          error: `Таблица ${tableIndex + 1} не найдена во вкладке «${tab}»`,
        };
      }
      saveTabHtml(projectId, tab, next, tabs);
      return { tabs, reloadTab: tab, switchTool: 'document', ok: true };
    }
    case 'set_document': {
      const tab = action.tab?.trim() || tabs[0] || 'Заметки';
      const html =
        action.html !== undefined
          ? action.html
          : action.text !== undefined
            ? action.text
              ? `<p>${action.text}</p>`
              : ''
            : '';
      saveTabHtml(projectId, tab, html, tabs);
      return { tabs, reloadTab: tab, switchTool: 'document', ok: true };
    }
    case 'append_document': {
      const tab = action.tab?.trim() || 'Заметки';
      const html = action.html || `<p>${action.text || ''}</p>`;
      const nextTabs = appendToDocumentTab(projectId, tab, html, tabs);
      return { tabs: nextTabs, reloadTab: tab, switchTool: 'document', ok: true };
    }
    case 'insert_table': {
      const tab = action.tab?.trim() || 'Данные';
      const headers = action.headers?.length ? action.headers : ['Столбец 1', 'Столбец 2'];
      const rows = action.rows?.length ? action.rows : [];
      const html = buildTableHtml(headers, rows);
      const nextTabs = appendToDocumentTab(projectId, tab, html, tabs);
      return { tabs: nextTabs, reloadTab: tab, switchTool: 'document', ok: true };
    }
    case 'add_hypothesis': {
      if (!action.text?.trim()) return { tabs, ok: false, error: 'Пустая гипотеза' };
      const items = loadSpaceHypotheses(projectId);
      const status = (['draft', 'testing', 'confirmed', 'rejected'] as const).includes(
        action.status as SpaceHypothesis['status']
      )
        ? (action.status as SpaceHypothesis['status'])
        : 'draft';
      saveSpaceHypotheses(projectId, [
        { id: `hyp-${Date.now()}`, text: action.text.trim(), status, createdAt: new Date().toISOString() },
        ...items,
      ]);
      return { tabs, switchTool: 'hypotheses', ok: true };
    }
    case 'add_task': {
      if (!action.text?.trim()) return { tabs, ok: false, error: 'Пустая задача' };
      const items = loadSpaceTasks(projectId);
      saveSpaceTasks(projectId, [
        ...items,
        { id: `task-${Date.now()}`, text: action.text.trim(), done: false, createdAt: new Date().toISOString() },
      ]);
      return { tabs, switchTool: 'tasks', ok: true };
    }
    case 'add_source': {
      if (!action.title?.trim()) return { tabs, ok: false, error: 'Нет названия источника' };
      const items = loadSpaceSources(projectId);
      saveSpaceSources(projectId, [
        {
          id: `src-${Date.now()}`,
          title: action.title.trim(),
          author: action.author?.trim() || '',
          year: action.year?.trim() || '',
          url: action.url?.trim() || '',
          notes: action.notes?.trim() || '',
        },
        ...items,
      ]);
      return { tabs, switchTool: 'sources', ok: true };
    }
    case 'add_material': {
      const content = action.text?.trim() || action.notes?.trim() || '';
      if (!content && !action.title?.trim()) return { tabs, ok: false, error: 'Пустой материал' };
      addSpaceMaterial(projectId, {
        title: action.title?.trim() || 'Материал от агента',
        content,
        source: 'ИИ-агент проекта',
      });
      return { tabs, switchTool: 'materials', ok: true };
    }
    default:
      return { tabs, ok: false, error: 'Неизвестное действие' };
  }
}
