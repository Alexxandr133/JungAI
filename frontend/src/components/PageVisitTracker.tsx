import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

function newVisitId() {
  return `pv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Трекинг времени на маршрутах для админ-аналитики.
 * Шлёт heartbeat каждые ~20с и при смене страницы / уходе с вкладки.
 */
export function PageVisitTracker() {
  const { token, user } = useAuth();
  const location = useLocation();
  const pathRef = useRef(location.pathname);
  const visitIdRef = useRef(newVisitId());
  const startedAtRef = useRef(Date.now());
  const lastSentDurRef = useRef(0);

  useEffect(() => {
    pathRef.current = location.pathname;
    visitIdRef.current = newVisitId();
    startedAtRef.current = Date.now();
    lastSentDurRef.current = 0;
  }, [location.pathname]);

  useEffect(() => {
    if (!token || !user) return;

    const flush = (force = false) => {
      const durationMs = Date.now() - startedAtRef.current;
      if (!force && durationMs - lastSentDurRef.current < 8000) return;
      if (durationMs < 1500 && !force) return;
      lastSentDurRef.current = durationMs;
      const payload = {
        path: pathRef.current,
        durationMs,
        visitId: visitIdRef.current,
      };
      void api('/api/analytics/page-visit', {
        method: 'POST',
        token,
        body: payload,
        suppressSessionExpired: true,
      }).catch(() => undefined);
    };

    const interval = window.setInterval(() => flush(false), 20000);
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush(true);
    };
    const onUnload = () => flush(true);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onUnload);

    // первый тик через 3с — зафиксировать заход
    const first = window.setTimeout(() => flush(false), 3000);

    return () => {
      flush(true);
      window.clearInterval(interval);
      window.clearTimeout(first);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onUnload);
    };
  }, [token, user, location.pathname]);

  return null;
}
