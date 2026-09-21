import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    ym?: (...args: unknown[]) => void;
  }
}

const DEFAULT_METRIKA_ID = '112753708';

function resolveMetrikaId(): string | null {
  const fromEnv = String(import.meta.env.VITE_YANDEX_METRIKA_ID || '').trim();
  const id = fromEnv || DEFAULT_METRIKA_ID;
  if (!id || id === '0' || id === 'false') return null;
  return id;
}

/**
 * Яндекс.Метрика на всех страницах SPA.
 * ID по умолчанию 112753708; переопределение: VITE_YANDEX_METRIKA_ID.
 */
export function YandexMetrika() {
  const location = useLocation();

  useEffect(() => {
    const id = resolveMetrikaId();
    if (!id || typeof window === 'undefined') return;

    const numericId = Number(id);
    if (!Number.isFinite(numericId)) return;

    const w = window as Window & { ym?: (...args: unknown[]) => void };
    w.ym =
      w.ym ||
      function (...args: unknown[]) {
        (w.ym as any).a = (w.ym as any).a || [];
        (w.ym as any).a.push(args);
      };
    (w.ym as any).l = Date.now();

    const src = `https://mc.yandex.ru/metrika/tag.js?id=${numericId}`;
    const already = Array.from(document.scripts).some((s) => s.src === src);
    if (!already) {
      const script = document.createElement('script');
      script.async = true;
      script.src = src;
      document.head.appendChild(script);
    }

    w.ym(numericId, 'init', {
      ssr: true,
      webvisor: true,
      clickmap: true,
      ecommerce: 'dataLayer',
      accurateTrackBounce: true,
      trackLinks: true,
      referrer: document.referrer,
      url: location.href,
    });

    const noscriptId = 'yandex-metrika-noscript';
    if (!document.getElementById(noscriptId)) {
      const ns = document.createElement('noscript');
      ns.id = noscriptId;
      ns.innerHTML = `<div><img src="https://mc.yandex.ru/watch/${numericId}" style="position:absolute; left:-9999px;" alt="" /></div>`;
      document.body.appendChild(ns);
    }
  }, []);

  useEffect(() => {
    const id = resolveMetrikaId();
    if (!id || typeof window === 'undefined' || typeof window.ym !== 'function') return;
    const numericId = Number(id);
    const url = `${location.pathname}${location.search}${location.hash}`;
    window.ym(numericId, 'hit', url, { title: document.title, referer: document.referrer });
  }, [location.pathname, location.search, location.hash]);

  return null;
}
