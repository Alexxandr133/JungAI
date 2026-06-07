import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'jingai_cookie_consent_v1';

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const accepted = localStorage.getItem(STORAGE_KEY);
      if (!accepted) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function accept() {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 4500,
        maxWidth: 720,
        margin: '0 auto',
        padding: '16px 18px',
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'var(--surface)',
        boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
        display: 'grid',
        gap: 12,
      }}
    >
      <div className="small" style={{ color: 'var(--text)', lineHeight: 1.55 }}>
        Мы используем файлы cookie и локальное хранилище браузера для входа в аккаунт, настроек интерфейса и
        безопасности. Подробнее — в{' '}
        <Link to="/privacy" style={{ color: 'var(--primary)' }}>
          Политике конфиденциальности
        </Link>
        .
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="button" onClick={accept} style={{ padding: '8px 16px', fontSize: 14 }}>
          Понятно
        </button>
      </div>
    </div>
  );
}
