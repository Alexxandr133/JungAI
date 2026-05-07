import { useEffect, useMemo, useState } from 'react';
import { useAppearance } from '../context/AppearanceContext';

const STORAGE_KEY = 'jungai-install-prompt-dismissed-v1';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

/** Показываем только на телефонах (без планшетов и ноутбуков). */
function isPhoneDevice(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const maxSide = Math.max(window.screen.width, window.screen.height);
  const isTabletUa = /iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
  const isPhoneUa = /iPhone|iPod|Android.+Mobile/i.test(ua);
  return isPhoneUa && !isTabletUa && maxSide <= 950;
}

function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || Boolean(nav.standalone);
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

export function MobileInstallPrompt() {
  const { appearance } = useAppearance();
  const isLight = appearance.colorMode === 'light';
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const ios = useMemo(() => isIOS(), []);

  useEffect(() => {
    if (!isPhoneDevice() || isStandaloneMode()) return;
    if (localStorage.getItem(STORAGE_KEY) === '1') return;

    if (ios) {
      setVisible(true);
      return;
    }

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener);
  }, [ios]);

  useEffect(() => {
    const onAppInstalled = () => {
      localStorage.setItem(STORAGE_KEY, '1');
      setVisible(false);
    };
    window.addEventListener('appinstalled', onAppInstalled);
    return () => window.removeEventListener('appinstalled', onAppInstalled);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  async function install() {
    if (!deferredPrompt) return;
    setIsInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        localStorage.setItem(STORAGE_KEY, '1');
        setVisible(false);
      }
    } finally {
      setIsInstalling(false);
    }
  }

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 9999,
        borderRadius: 16,
        border: isLight ? '1px solid rgba(59,130,246,0.28)' : '1px solid rgba(91,124,250,0.35)',
        background: isLight
          ? 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.98))'
          : 'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(11,15,26,0.98))',
        color: isLight ? '#0f172a' : '#e2e8f0',
        boxShadow: isLight ? '0 14px 34px rgba(15,23,42,0.16)' : '0 16px 40px rgba(0,0,0,0.45)',
        padding: 14
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: isLight ? 'rgba(37,99,235,0.12)' : 'rgba(37,99,235,0.24)',
            display: 'grid',
            placeItems: 'center',
            fontSize: 18
          }}
        >
          📱
        </div>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Установить JungAI как приложение</div>
      </div>
      {ios ? (
        <div style={{ color: isLight ? '#334155' : 'rgba(226,232,240,.92)', lineHeight: 1.5, fontSize: 13 }}>
          Нажмите <b>Поделиться</b> в Safari и выберите <b>«На экран Домой»</b>. Ярлык сохранится как отдельное приложение.
        </div>
      ) : (
        <div style={{ color: isLight ? '#334155' : 'rgba(226,232,240,.92)', lineHeight: 1.5, fontSize: 13 }}>
          Добавьте JungAI на домашний экран, чтобы открывать платформу отдельным приложением без лишних вкладок браузера.
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
        <button
          type="button"
          className="button secondary"
          style={{
            padding: '8px 12px',
            background: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(148,163,184,0.14)',
            border: isLight ? '1px solid rgba(15,23,42,0.12)' : '1px solid rgba(148,163,184,0.25)'
          }}
          onClick={dismiss}
        >
          Не сейчас
        </button>
        {!ios && deferredPrompt && (
          <button
            type="button"
            className="button"
            style={{ padding: '8px 12px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
            onClick={install}
            disabled={isInstalling}
          >
            {isInstalling ? 'Подготовка…' : 'Установить'}
          </button>
        )}
      </div>
    </div>
  );
}

