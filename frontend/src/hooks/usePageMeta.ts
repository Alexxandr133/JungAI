import { useEffect } from 'react';

export type PageMetaOptions = {
  title: string;
  description?: string;
  /** Absolute or site-relative path, e.g. /publications/post/abc */
  path?: string;
  image?: string | null;
  type?: 'website' | 'article' | 'profile';
  noIndex?: boolean;
};

const SITE = 'https://jung-ai.ru';
const DEFAULT_IMAGE = `${SITE}/jungai-logo.png`;

function absUrl(pathOrUrl?: string | null) {
  if (!pathOrUrl) return SITE;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${SITE}${path}`;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  const selector = attr === 'name' ? `meta[name="${key}"]` : `meta[property="${key}"]`;
  let el = document.querySelector(selector) as HTMLMetaElement | null;
  let created = false;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
    created = true;
  }
  const prev = el.content;
  el.content = content;
  return { el, created, prev };
}

function upsertLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  let created = false;
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
    created = true;
  }
  const prev = el.href;
  el.href = href;
  return { el, created, prev };
}

/** Title / description / Open Graph / Twitter / canonical for public & community pages. */
export function usePageMeta(titleOrOpts: string | PageMetaOptions, descriptionMaybe?: string) {
  const opts: PageMetaOptions =
    typeof titleOrOpts === 'string'
      ? { title: titleOrOpts, description: descriptionMaybe }
      : titleOrOpts;

  useEffect(() => {
    const fullTitle = opts.title.includes('JungAI') ? opts.title : `${opts.title} — JungAI`;
    const description =
      opts.description?.trim() ||
      'Профессиональное сообщество JungAI: посты психологов, клиентов и исследователей.';
    const url = absUrl(opts.path || (typeof window !== 'undefined' ? window.location.pathname : '/'));
    const image = absUrl(opts.image || DEFAULT_IMAGE);
    const type = opts.type || 'website';

    const prevTitle = document.title;
    document.title = fullTitle;

    const restores: Array<() => void> = [];

    const track = (entry: { el: HTMLElement; created: boolean; prev?: string }) => {
      restores.push(() => {
        if (entry.created) entry.el.remove();
        else if (entry.prev != null && 'content' in entry.el) {
          (entry.el as HTMLMetaElement).content = entry.prev;
        } else if (entry.prev != null && entry.el instanceof HTMLLinkElement) {
          entry.el.href = entry.prev;
        }
      });
    };

    track(upsertMeta('name', 'description', description));
    track(upsertMeta('name', 'robots', opts.noIndex ? 'noindex,nofollow' : 'index,follow'));
    track(upsertMeta('property', 'og:site_name', 'JungAI'));
    track(upsertMeta('property', 'og:locale', 'ru_RU'));
    track(upsertMeta('property', 'og:type', type));
    track(upsertMeta('property', 'og:title', fullTitle));
    track(upsertMeta('property', 'og:description', description));
    track(upsertMeta('property', 'og:url', url));
    track(upsertMeta('property', 'og:image', image));
    track(upsertMeta('name', 'twitter:card', 'summary_large_image'));
    track(upsertMeta('name', 'twitter:title', fullTitle));
    track(upsertMeta('name', 'twitter:description', description));
    track(upsertMeta('name', 'twitter:image', image));
    track(upsertLink('canonical', url));

    return () => {
      document.title = prevTitle;
      restores.forEach((fn) => fn());
    };
  }, [opts.title, opts.description, opts.path, opts.image, opts.type, opts.noIndex]);
}
