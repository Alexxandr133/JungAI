import type { ProjectAgentAction } from './projectSpaceAgentTypes';
import {
  loadAllTabContents,
  loadSpaceHypotheses,
  loadSpaceMaterials,
  loadSpaceSources,
  loadSpaceTasks,
  saveProjectTabs,
  saveSpaceHypotheses,
  saveSpaceMaterials,
  saveSpaceSources,
  saveSpaceTasks,
  saveTabContent,
  touchProjectUpdated,
  type SpaceHypothesis,
  type SpaceMaterial,
  type SpaceSource,
  type SpaceTask,
} from './researchProjectStorage';

export type ProjectSpaceSnapshot = {
  tabs: string[];
  tabContents: Record<string, string>;
  hypotheses: SpaceHypothesis[];
  sources: SpaceSource[];
  tasks: SpaceTask[];
  materials: SpaceMaterial[];
};

export type SpaceChangeRecord = {
  id: string;
  at: string;
  label: string;
  action: ProjectAgentAction;
  snapshot: ProjectSpaceSnapshot;
  revertedAt?: string;
};

const MAX_CHANGE_RECORDS = 40;

function historyKey(projectId: string) {
  return `researcher_project_space.${projectId}.change_history`;
}

export function captureProjectSpaceSnapshot(projectId: string, tabs: string[]): ProjectSpaceSnapshot {
  return {
    tabs: [...tabs],
    tabContents: loadAllTabContents(projectId, tabs),
    hypotheses: loadSpaceHypotheses(projectId),
    sources: loadSpaceSources(projectId),
    tasks: loadSpaceTasks(projectId),
    materials: loadSpaceMaterials(projectId),
  };
}

export function restoreProjectSpaceSnapshot(projectId: string, snapshot: ProjectSpaceSnapshot): string[] {
  saveProjectTabs(projectId, snapshot.tabs);
  for (const tab of snapshot.tabs) {
    saveTabContent(projectId, tab, snapshot.tabContents[tab] || '');
  }
  saveSpaceHypotheses(projectId, snapshot.hypotheses);
  saveSpaceSources(projectId, snapshot.sources);
  saveSpaceTasks(projectId, snapshot.tasks);
  saveSpaceMaterials(projectId, snapshot.materials);
  touchProjectUpdated(projectId);
  return [...snapshot.tabs];
}

export function loadSpaceChangeHistory(projectId: string): SpaceChangeRecord[] {
  try {
    const raw = localStorage.getItem(historyKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSpaceChangeHistory(projectId: string, records: SpaceChangeRecord[]) {
  localStorage.setItem(historyKey(projectId), JSON.stringify(records.slice(0, MAX_CHANGE_RECORDS)));
}

export function pushSpaceChange(
  projectId: string,
  record: Omit<SpaceChangeRecord, 'revertedAt'>
): SpaceChangeRecord[] {
  const prev = loadSpaceChangeHistory(projectId);
  const next = [record as SpaceChangeRecord, ...prev].slice(0, MAX_CHANGE_RECORDS);
  saveSpaceChangeHistory(projectId, next);
  return next;
}

export function markSpaceChangeReverted(projectId: string, changeId: string): SpaceChangeRecord[] {
  const next = loadSpaceChangeHistory(projectId).map((r) =>
    r.id === changeId ? { ...r, revertedAt: new Date().toISOString() } : r
  );
  saveSpaceChangeHistory(projectId, next);
  return next;
}

export function buildChangeHistoryContextForAi(projectId: string): string {
  const records = loadSpaceChangeHistory(projectId).filter((r) => !r.revertedAt).slice(0, 15);
  if (!records.length) return '';

  const lines = records.map((r, i) => {
    const dt = new Date(r.at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
    return `${i + 1}. [${dt}] ${r.label} (id: ${r.id})`;
  });

  return (
    '\n## История изменений агента (откат — кнопка «Отменить» в панели агента)\n' +
    lines.join('\n') +
    '\nКаждая запись хранит снимок проекта до применения действия.'
  );
}
