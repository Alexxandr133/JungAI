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

export type ProjectAiMessage = { role: 'user' | 'assistant'; content: string };

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
