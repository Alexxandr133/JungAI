import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppearance } from '../context/AppearanceContext';
import {
  isTextScaleExcludedPath,
  isThemeForcedDarkPath,
  isWallpaperExcludedPath
} from '../lib/appearancePaths';
import { wallpaperUrl } from '../lib/wallpapers';
import { useIsNarrowViewport } from '../hooks/useIsNarrowViewport';

/**
 * Синхронизирует тему, фон и масштаб текста с documentElement в зависимости от маршрута.
 */
export function GlobalAppearance() {
  const { pathname } = useLocation();
  const { appearance } = useAppearance();
  const narrow = useIsNarrowViewport();

  useLayoutEffect(() => {
    const html = document.documentElement;
    const { colorMode, lightCardVariant, wallpaper, textScale } = appearance;

    const forcedDarkUi = isThemeForcedDarkPath(pathname);
    const effectiveTheme = forcedDarkUi ? 'dark' : colorMode;

    html.dataset.theme = effectiveTheme;

    if (effectiveTheme === 'light') {
      html.dataset.lightCard = lightCardVariant;
    } else {
      delete html.dataset.lightCard;
    }

    html.style.colorScheme = effectiveTheme === 'light' ? 'light' : 'dark';

    const noWallpaper = isWallpaperExcludedPath(pathname) || !wallpaper;
    if (noWallpaper) {
      html.style.background = '';
      html.removeAttribute('data-wallpaper-on');
    } else {
      const url = wallpaperUrl(wallpaper);
      // Светлая тема: не засветлять фото белым слоем — лёгкий тёмный scrim как у тёмной, чуть слабее
      const overlay =
        colorMode === 'light' && !forcedDarkUi
          ? 'linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.12) 42%, rgba(0,0,0,0.28) 100%)'
          : 'linear-gradient(180deg, rgba(0,0,0,0.48) 0%, rgba(0,0,0,0.28) 40%, rgba(0,0,0,0.55) 100%)';
      html.style.background = `${overlay}, url("${url}") center / cover no-repeat fixed`;
      html.setAttribute('data-wallpaper-on', '1');
    }

    const textOff = narrow || isTextScaleExcludedPath(pathname);
    const mul = textOff ? 1 : textScale;
    html.style.setProperty('--appearance-text-mul', String(mul));
  }, [appearance, pathname, narrow]);

  return null;
}
