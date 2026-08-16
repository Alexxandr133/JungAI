import { useEffect } from 'react';

/** Минимальные per-route title/description для публичных лендингов */
export function usePageMeta(title: string, description?: string) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    let created = false;
    const prevDescription = meta?.content;
    if (description) {
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
        created = true;
      }
      meta.content = description;
    }

    return () => {
      document.title = prevTitle;
      if (meta && description) {
        if (created) meta.remove();
        else if (prevDescription != null) meta.content = prevDescription;
      }
    };
  }, [title, description]);
}
