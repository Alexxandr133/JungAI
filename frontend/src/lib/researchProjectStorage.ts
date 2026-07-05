import type { ProjectAgentAction } from './projectSpaceAgentTypes';
import { formatTabHtmlForAgent } from './projectSpaceDocumentEdit';
import { buildChangeHistoryContextForAi } from './projectSpaceChangeHistory';
import { AI_CONTEXT_MAX_CHARS } from './aiContextTypes';

export type ResearchProject = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectTabContent = Record<string, string>;

export const PROJECTS_KEY = 'researcher_projects';
export const DEFAULT_PROJECT_TABS = ['Гипотеза', 'Метод', 'Заметки', 'Данные', 'Выводы'];

function tabsKey(projectId: string) {
  return `researcher_project_space.${projectId}.tabs`;
}

function tabContentKey(projectId: string, tab: string) {
  return `researcher_project_space.${projectId}.tab.${tab}`;
}

function aiChatKey(projectId: string) {
  return `researcher_project_space.${projectId}.ai_chat`;
}

function materialsKey(projectId: string) {
  return `researcher_project_space.${projectId}.materials`;
}

export function loadProjects(): ResearchProject[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveProjects(list: ResearchProject[]) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
}

export function getProjectById(id: string): ResearchProject | null {
  return loadProjects().find((p) => p.id === id) ?? null;
}

export function loadProjectTabs(projectId: string): string[] {
  try {
    const raw = localStorage.getItem(tabsKey(projectId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed.filter((t) => typeof t === 'string');
    }
  } catch {
    /* ignore */
  }
  return [...DEFAULT_PROJECT_TABS];
}

export function saveProjectTabs(projectId: string, tabs: string[]) {
  localStorage.setItem(tabsKey(projectId), JSON.stringify(tabs));
}

export function loadTabContent(projectId: string, tab: string): string {
  try {
    return localStorage.getItem(tabContentKey(projectId, tab)) || '';
  } catch {
    return '';
  }
}

export function saveTabContent(projectId: string, tab: string, html: string) {
  localStorage.setItem(tabContentKey(projectId, tab), html);
}

export function loadAllTabContents(projectId: string, tabs: string[]): ProjectTabContent {
  const out: ProjectTabContent = {};
  for (const tab of tabs) {
    out[tab] = loadTabContent(projectId, tab);
  }
  return out;
}

export type ProjectAiMessage = {
  role: 'user' | 'assistant';
  content: string;
  actions?: ProjectAgentAction[];
  appliedActionIndexes?: number[];
  rejectedActionIndexes?: number[];
};

export function loadProjectAiChat(projectId: string): ProjectAiMessage[] {
  try {
    const raw = localStorage.getItem(aiChatKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveProjectAiChat(projectId: string, messages: ProjectAiMessage[]) {
  localStorage.setItem(aiChatKey(projectId), JSON.stringify(messages));
}

export function htmlToPlainText(html: string): string {
  if (!html) return '';
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
}

export type SpaceHypothesis = {
  id: string;
  text: string;
  status: 'draft' | 'testing' | 'confirmed' | 'rejected';
  createdAt: string;
};

export type SpaceSource = {
  id: string;
  title: string;
  author: string;
  year: string;
  url: string;
  notes: string;
  urlAnalysis?: string;
  urlAnalyzedAt?: string;
  pageTitle?: string;
};

export type SpaceTask = {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
};

export type SpaceMaterial = {
  id: string;
  title: string;
  content: string;
  source: string;
  createdAt: string;
  fileName?: string;
  mimeType?: string;
};

export type SpaceActiveTool = 'document' | 'hypotheses' | 'sources' | 'tasks' | 'materials';

function toolDataKey(projectId: string, tool: 'hypotheses' | 'sources' | 'tasks') {
  return `researcher_project_space.${projectId}.tool.${tool}`;
}

function loadToolJson<T>(projectId: string, tool: 'hypotheses' | 'sources' | 'tasks'): T[] {
  try {
    const raw = localStorage.getItem(toolDataKey(projectId, tool));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToolJson(projectId: string, tool: 'hypotheses' | 'sources' | 'tasks', data: unknown[]) {
  localStorage.setItem(toolDataKey(projectId, tool), JSON.stringify(data));
  touchProjectUpdated(projectId);
}

export function loadSpaceHypotheses(projectId: string): SpaceHypothesis[] {
  return loadToolJson<SpaceHypothesis>(projectId, 'hypotheses');
}

export function saveSpaceHypotheses(projectId: string, items: SpaceHypothesis[]) {
  saveToolJson(projectId, 'hypotheses', items);
}

export function loadSpaceSources(projectId: string): SpaceSource[] {
  return loadToolJson<SpaceSource>(projectId, 'sources');
}

export function saveSpaceSources(projectId: string, items: SpaceSource[]) {
  saveToolJson(projectId, 'sources', items);
}

export function loadSpaceTasks(projectId: string): SpaceTask[] {
  return loadToolJson<SpaceTask>(projectId, 'tasks');
}

export function saveSpaceTasks(projectId: string, items: SpaceTask[]) {
  saveToolJson(projectId, 'tasks', items);
}

export function loadSpaceMaterials(projectId: string): SpaceMaterial[] {
  try {
    const raw = localStorage.getItem(materialsKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSpaceMaterials(projectId: string, items: SpaceMaterial[]) {
  localStorage.setItem(materialsKey(projectId), JSON.stringify(items));
  touchProjectUpdated(projectId);
}

export function addSpaceMaterial(
  projectId: string,
  payload: { title: string; content: string; source?: string; fileName?: string; mimeType?: string }
): SpaceMaterial {
  const items = loadSpaceMaterials(projectId);
  const item: SpaceMaterial = {
    id: `mat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: payload.title.trim().slice(0, 200) || 'Материал',
    content: payload.content.trim(),
    source: payload.source?.trim() || 'Основной AI-чат',
    createdAt: new Date().toISOString(),
    ...(payload.fileName ? { fileName: payload.fileName.slice(0, 260) } : {}),
    ...(payload.mimeType ? { mimeType: payload.mimeType.slice(0, 120) } : {}),
  };
  saveSpaceMaterials(projectId, [item, ...items]);
  return item;
}

export function buildFullSpaceContextForAi(
  projectId: string,
  projectTitle: string,
  tabs: string[],
  contents: ProjectTabContent
): string {
  const parts: string[] = [`# Проект: ${projectTitle}`];

  parts.push('\n## Документ (вкладки)');
  let hasDoc = false;
  for (const tab of tabs) {
    const html = contents[tab] || '';
    if (html.trim()) {
      hasDoc = true;
      parts.push(`\n### ${tab}\n${formatTabHtmlForAgent(html)}`);
    }
  }
  if (!hasDoc) parts.push('(пусто)');

  const hypotheses = loadSpaceHypotheses(projectId);
  parts.push('\n## Гипотезы');
  if (hypotheses.length) {
    for (const h of hypotheses) parts.push(`- [${h.status}] ${h.text}`);
  } else parts.push('(нет)');

  const sources = loadSpaceSources(projectId);
  parts.push('\n## Источники');
  if (sources.length) {
    for (const s of sources) {
      let line = `- ${s.title}`;
      if (s.author || s.year) line += ` (${[s.author, s.year].filter(Boolean).join(', ')})`;
      if (s.url) line += `\n  URL: ${s.url}`;
      if (s.notes) line += `\n  Заметки: ${s.notes}`;
      if (s.urlAnalysis) line += `\n  Анализ страницы: ${s.urlAnalysis.slice(0, 4000)}`;
      parts.push(line);
    }
  } else parts.push('(нет)');

  const tasks = loadSpaceTasks(projectId);
  parts.push('\n## Задачи');
  if (tasks.length) {
    for (const t of tasks) parts.push(`- ${t.done ? '[x]' : '[ ]'} ${t.text}`);
  } else parts.push('(нет)');

  const materials = loadSpaceMaterials(projectId);
  parts.push('\n## Материалы проекта');
  if (materials.length) {
    for (const m of materials) {
      const fileTag = m.fileName ? `, файл: ${m.fileName}` : '';
      parts.push(`\n### ${m.title} (${m.source}${fileTag})\n${m.content.slice(0, 20000)}`);
    }
  } else parts.push('(нет)');

  parts.push(buildChangeHistoryContextForAi(projectId));

  return parts.join('\n').slice(0, AI_CONTEXT_MAX_CHARS);
}

/** @deprecated use buildFullSpaceContextForAi */
export function buildSpaceContextForAi(projectTitle: string, tabs: string[], contents: ProjectTabContent): string {
  const parts: string[] = [`Проект: ${projectTitle}`];
  for (const tab of tabs) {
    const plain = htmlToPlainText(contents[tab] || '');
    if (plain) parts.push(`\n## ${tab}\n${plain.slice(0, 8000)}`);
  }
  if (parts.length === 1) parts.push('\n(Материалы проекта пока пусты.)');
  return parts.join('\n');
}

export function touchProjectUpdated(projectId: string) {
  const list = loadProjects();
  const idx = list.findIndex((p) => p.id === projectId);
  if (idx === -1) return;
  list[idx] = { ...list[idx], updatedAt: new Date().toISOString() };
  saveProjects(list);
}

export function ensureDocumentTab(projectId: string, tabs: string[], tabName: string): string[] {
  const name = tabName.trim();
  if (!name || tabs.includes(name)) return tabs;
  const next = [...tabs, name];
  saveProjectTabs(projectId, next);
  return next;
}

export function appendToDocumentTab(projectId: string, tab: string, html: string, tabs: string[]): string[] {
  const nextTabs = ensureDocumentTab(projectId, tabs, tab);
  const existing = loadTabContent(projectId, tab);
  saveTabContent(projectId, tab, existing ? `${existing}${html}` : html);
  touchProjectUpdated(projectId);
  return nextTabs;
}
