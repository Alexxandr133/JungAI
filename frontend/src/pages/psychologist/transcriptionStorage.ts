const STT_JOBS_KEY = 'jingai_stt_active_jobs';
export const RESEARCHER_STT_JOBS_KEY = 'jingai_researcher_stt_active_jobs';

export function getActiveSttJobIds(storageKey = STT_JOBS_KEY): string[] {
  try {
    const raw = localStorage.getItem(storageKey);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function addActiveSttJob(id: string, storageKey = STT_JOBS_KEY): void {
  const ids = getActiveSttJobIds(storageKey);
  if (!ids.includes(id)) {
    localStorage.setItem(storageKey, JSON.stringify([id, ...ids]));
  }
}

export function removeActiveSttJob(id: string, storageKey = STT_JOBS_KEY): void {
  const ids = getActiveSttJobIds(storageKey).filter((x) => x !== id);
  if (ids.length) localStorage.setItem(storageKey, JSON.stringify(ids));
  else localStorage.removeItem(storageKey);
}
