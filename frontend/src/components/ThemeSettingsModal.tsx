import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  useAppearance,
  TEXT_SCALE_MIN,
  TEXT_SCALE_MAX,
  type ColorMode,
  type LightCardVariant
} from '../context/AppearanceContext';
import { WALLPAPER_FILES, wallpaperUrl } from '../lib/wallpapers';
import { useIsNarrowViewport } from '../hooks/useIsNarrowViewport';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ThemeSettingsModal({ open, onClose }: Props) {
  const { appearance, setAppearance } = useAppearance();
  const narrow = useIsNarrowViewport();
  const totalSteps = narrow ? 2 : 3;
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const goNext = useCallback(() => {
    setStep((s) => Math.min(totalSteps - 1, s + 1));
  }, [totalSteps]);

  const goBack = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const title = useMemo(() => {
    if (step === 0) return 'Шаг 1: тема оформления';
    if (step === 1) return 'Шаг 2: фон';
    return 'Шаг 3: размер текста';
  }, [step]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="theme-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200000,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        className={`card theme-settings-modal-panel${narrow ? ' theme-settings-modal-panel--narrow' : ''}`}
        style={{
          width: narrow ? 'min(520px, 100%)' : 'min(900px, 94vw)',
          maxWidth: narrow ? undefined : 900,
          maxHeight: 'min(90vh, 820px)',
          overflow: 'auto',
          padding: narrow ? 20 : 32,
          borderRadius: 20
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="theme-modal-title"
          style={{ margin: '0 0 8px', fontSize: narrow ? 20 : 24, fontWeight: 800 }}
        >
          {title}
        </h2>
        <p className="small" style={{ margin: '0 0 20px', lineHeight: 1.5 }}>
          {step === 0 &&
            'Картинка на фоне доступна только в тёмной теме. Светлая тема сбрасывает фон. Для светлой — два стиля карточек.'}
          {step === 1 &&
            'Фон только для тёмной темы. Не показывается в журнале снов, ИИ и рабочей области психолога.'}
          {step === 2 && !narrow && 'Масштаб не действует в ИИ и рабочей области. Ограничен для читаемости.'}
        </p>

        {step === 0 && (
          <StepTheme
            narrow={narrow}
            colorMode={appearance.colorMode}
            lightCardVariant={appearance.lightCardVariant}
            onPickMode={(m) => setAppearance({ colorMode: m })}
            onPickCard={(v) => setAppearance({ lightCardVariant: v })}
          />
        )}

        {step === 1 && (
          <StepWallpaper
            narrow={narrow}
            current={appearance.wallpaper}
            onPick={(w) => setAppearance({ wallpaper: w })}
          />
        )}

        {step === 2 && !narrow && (
          <StepTextScale
            value={appearance.textScale}
            onChange={(v) => setAppearance({ textScale: v })}
          />
        )}

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            justifyContent: 'flex-end',
            marginTop: 24,
            paddingTop: 16,
            borderTop: '1px solid var(--navbar-edge)'
          }}
        >
          <button type="button" className="button secondary" onClick={onClose}>
            Закрыть
          </button>
          {step > 0 && (
            <button type="button" className="button secondary" onClick={goBack}>
              Назад
            </button>
          )}
          {step < totalSteps - 1 ? (
            <button type="button" className="button" onClick={goNext}>
              Далее
            </button>
          ) : (
            <button type="button" className="button" onClick={onClose}>
              Готово
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function StepTheme({
  colorMode,
  lightCardVariant,
  onPickMode,
  onPickCard,
  narrow
}: {
  colorMode: ColorMode;
  lightCardVariant: LightCardVariant;
  onPickMode: (m: ColorMode) => void;
  onPickCard: (v: LightCardVariant) => void;
  narrow: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: narrow ? 18 : 24 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: narrow ? '1fr' : 'repeat(2, minmax(0, 1fr))',
          gap: narrow ? 12 : 16
        }}
      >
        <button
          type="button"
          onClick={() => onPickMode('dark')}
          className="card"
          style={{
            padding: narrow ? 14 : 18,
            cursor: 'pointer',
            textAlign: 'left',
            border:
              colorMode === 'dark' ? '2px solid var(--primary)' : '1px solid var(--navbar-edge)',
            background: 'var(--surface-2)'
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: narrow ? 14 : 15 }}>
            🌙 Тёмная
          </div>
          {/* Превью всегда в стиле тёмной темы (не зависит от текущей темы интерфейса) */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 14,
              textAlign: 'left',
              background: 'linear-gradient(180deg, #363a48 0%, #2a2e3a 100%)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 12, color: '#f1f2f6', marginBottom: 4 }}>
              Заголовок
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.4, color: 'rgba(230,232,240,0.88)' }}>
              Пример карточки в тёмной теме
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onPickMode('light')}
          className="card"
          style={{
            padding: narrow ? 14 : 18,
            cursor: 'pointer',
            textAlign: 'left',
            border:
              colorMode === 'light' ? '2px solid var(--primary)' : '1px solid var(--navbar-edge)',
            background: 'var(--surface-2)'
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: narrow ? 14 : 15 }}>☀️ Светлая</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            Ниже — стиль карточек: мягкий или чёткий
          </div>
        </button>
      </div>

      {colorMode === 'light' && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: narrow ? 14 : 15 }}>
            Стиль карточек
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: narrow ? '1fr' : 'repeat(2, minmax(0, 1fr))',
              gap: narrow ? 12 : 16
            }}
          >
            <button
              type="button"
              onClick={() => onPickCard('soft')}
              style={{
                padding: narrow ? 14 : 18,
                borderRadius: 18,
                cursor: 'pointer',
                textAlign: 'left',
                border:
                  lightCardVariant === 'soft'
                    ? '3px solid #5b41e8'
                    : '1px solid rgba(91, 65, 232, 0.25)',
                background: 'linear-gradient(165deg, #ffffff 0%, #e8ecfc 50%, #f5f3ff 100%)',
                boxShadow:
                  '0 12px 40px rgba(91, 65, 232, 0.15), inset 0 1px 0 rgba(255,255,255,0.95)',
                color: '#0b1020'
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>Мягкий</div>
              <div style={{ fontSize: 12, lineHeight: 1.45, color: '#1e293b', fontWeight: 500 }}>
                Градиент, фиолетовая обводка, мягкая тень — как стекло
              </div>
            </button>
            <button
              type="button"
              onClick={() => onPickCard('crisp')}
              style={{
                padding: narrow ? 14 : 18,
                borderRadius: 12,
                cursor: 'pointer',
                textAlign: 'left',
                border:
                  lightCardVariant === 'crisp'
                    ? '3px solid #0f172a'
                    : '2px solid rgba(15, 23, 42, 0.2)',
                background: '#ffffff',
                boxShadow: '0 2px 6px rgba(15, 23, 42, 0.08)',
                color: '#0b1020'
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>Чёткий</div>
              <div style={{ fontSize: 12, lineHeight: 1.45, color: '#1e293b', fontWeight: 500 }}>
                Ровный белый фон, тёмная рамка, минимум теней
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StepWallpaper({
  current,
  onPick,
  narrow
}: {
  current: string;
  onPick: (filename: string) => void;
  narrow: boolean;
}) {
  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: narrow
            ? 'repeat(auto-fill, minmax(88px, 1fr))'
            : 'repeat(auto-fill, minmax(112px, 1fr))',
          gap: narrow ? 10 : 12
        }}
      >
        <button
          type="button"
          onClick={() => onPick('')}
          className="card"
          style={{
            aspectRatio: '1',
            padding: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 600,
            border: current === '' ? '2px solid var(--primary)' : undefined
          }}
        >
          Нет фона
        </button>
        {WALLPAPER_FILES.map((file) => (
          <button
            key={file}
            type="button"
            onClick={() => onPick(file)}
            style={{
              aspectRatio: '1',
              padding: 0,
              borderRadius: 12,
              overflow: 'hidden',
              cursor: 'pointer',
              border: current === file ? '3px solid var(--accent)' : '2px solid transparent',
              background: `center/cover no-repeat url(${wallpaperUrl(file)})`
            }}
            title={file}
          />
        ))}
      </div>
    </div>
  );
}

function StepTextScale({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
        <span>Масштаб текста</span>
        <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{pct}%</span>
      </div>
      <input
        type="range"
        min={TEXT_SCALE_MIN * 100}
        max={TEXT_SCALE_MAX * 100}
        step={1}
        value={pct}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        style={{ width: '100%' }}
      />
      <div
        style={{
          marginTop: 16,
          padding: 14,
          borderRadius: 12,
          border: '1px solid var(--navbar-edge)',
          fontSize: `${Math.round(14 * value)}px`,
          lineHeight: 1.5,
          color: 'var(--text)',
          background: 'var(--surface-2)'
        }}
      >
        Так будет выглядеть обычный абзац интерфейса. На узких экранах шаг отключён — используется 100%.
      </div>
    </div>
  );
}
