/**
 * Журнал снов и чаты с ИИ: светлая тема не применяется — как в тёмной теме.
 */
export function isThemeForcedDarkPath(pathname: string): boolean {
  if (pathname.startsWith('/dreams')) return true;
  if (pathname.startsWith('/paranormal')) return true;
  if (pathname.startsWith('/guest/dreams')) return true;
  if (pathname.startsWith('/ai/recommendations')) return true;
  if (pathname.startsWith('/client/ai')) return true;
  if (pathname.startsWith('/psychologist/ai')) return true;
  if (pathname.startsWith('/researcher/ai')) return true;
  return false;
}

/** Фон не накладывается на эти маршруты */
export function isWallpaperExcludedPath(pathname: string): boolean {
  if (pathname.startsWith('/dreams')) return true;
  if (pathname.startsWith('/paranormal')) return true;
  if (pathname.startsWith('/guest/dreams')) return true;
  if (pathname.startsWith('/psychologist/work-area')) return true;
  if (pathname.startsWith('/ai/recommendations')) return true;
  if (pathname.startsWith('/client/ai')) return true;
  if (pathname.startsWith('/psychologist/ai')) return true;
  if (pathname.startsWith('/researcher/ai')) return true;
  return false;
}

/** Масштаб текста не применяется (остаётся 100%) */
export function isTextScaleExcludedPath(pathname: string): boolean {
  if (pathname.startsWith('/psychologist/work-area')) return true;
  if (pathname.startsWith('/ai/recommendations')) return true;
  if (pathname.startsWith('/client/ai')) return true;
  if (pathname.startsWith('/psychologist/ai')) return true;
  if (pathname.startsWith('/researcher/ai')) return true;
  return false;
}
