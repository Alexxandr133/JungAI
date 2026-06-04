const STT_JOBS_KEY = 'jingai_stt_active_jobs';

export function getActiveSttJobIds(): string[] {
  try {
    const raw = localStorage.getItem(STT_JOBS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function addActiveSttJob(id: string): void {
  const ids = getActiveSttJobIds();
  if (!ids.includes(id)) {
    localStorage.setItem(STT_JOBS_KEY, JSON.stringify([id, ...ids]));
  }
}

export function removeActiveSttJob(id: string): void {
  const ids = getActiveSttJobIds().filter((x) => x !== id);
  if (ids.length) localStorage.setItem(STT_JOBS_KEY, JSON.stringify(ids));
  else localStorage.removeItem(STT_JOBS_KEY);
}
