import { useEffect, useState } from 'react';

const QUERY = '(max-width: 768px)';

/** Мобильная вёрстка: шаг «размер текста» в мастере темы скрыт. */
export function useIsNarrowViewport(): boolean {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(QUERY).matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  return narrow;
}
