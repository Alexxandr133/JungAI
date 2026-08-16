import type { Dispatch, SetStateAction } from 'react';
import { PlatformIcon } from '../../components/icons';
import { ThemeListbox } from '../../components/ThemeListbox';
import {
  MODALITY_OPTIONS,
  type PsychologistAiSettings,
  type ResponseStyle,
} from '../../lib/psychologistAiSettings';

type Props = {
  open: boolean;
  onClose: () => void;
  draft: PsychologistAiSettings;
  setDraft: Dispatch<SetStateAction<PsychologistAiSettings>>;
  onApply: () => void;
  onOpenMemory: () => void;
  isMobileView: boolean;
  quota?: {
    plan: 'standard' | 'medium' | 'large';
    limit: number;
    used: number;
    remaining: number;
    percentageUsed: number;
    resetAt: string;
  } | null;
};

const RESPONSE_STYLE_OPTIONS: Array<{ id: ResponseStyle; label: string }> = [
  { id: 'concise', label: 'Кратко, по пунктам' },
  { id: 'balanced', label: 'Сбалансированно' },
  { id: 'detailed', label: 'Развёрнуто, с примерами' },
];

function formatQuotaLine(quota: NonNullable<Props['quota']>): string {
  const used = quota.used.toLocaleString('ru-RU');
  const limit = quota.limit.toLocaleString('ru-RU');
  const reset = new Date(quota.resetAt).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
  });
  return `${used} / ${limit} · сброс ${reset}`;
}

export function PsychologistAiSettingsPanel({
  open,
  onClose,
  draft,
  setDraft,
  onApply,
  onOpenMemory,
  isMobileView,
  quota,
}: Props) {
  if (!open) return null;

  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 200,
          animation: 'fadeIn 0.2s ease',
        }}
      />
      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: isMobileView ? 'min(100%, 380px)' : 380,
          maxWidth: '100vw',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border, rgba(255,255,255,0.1))',
          zIndex: 201,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.35)',
          animation: 'slideInRight 0.25s ease',
        }}
      >
        <div
          style={{
            padding: '16px 18px',
            borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 16 }}>Настройки ИИ</div>
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
            style={{ padding: '6px 12px', fontSize: 13 }}
          >
            Закрыть
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {quota && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid var(--border, rgba(255,255,255,0.1))',
                background: 'var(--surface-2)',
              }}
            >
              <div className="small" style={{ fontWeight: 700, marginBottom: 4 }}>
                Квота токенов ({quota.plan})
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {formatQuotaLine(quota)}
              </div>
              <p className="small" style={{ marginTop: 8, marginBottom: 0, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                Осталось: <b>{quota.remaining.toLocaleString('ru-RU')}</b>
              </p>
            </div>
          )}

          <div>
            <label
              className="small"
              style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}
            >
              Модальность
            </label>
            <ThemeListbox
              ariaLabel="Модальность"
              value={draft.modality}
              options={MODALITY_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
              onChange={(modality) => setDraft((d) => ({ ...d, modality }))}
            />
            <p className="small" style={{ marginTop: 8, color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: 0 }}>
              От неё зависят системные инструкции ассистента. Данные клиентов не меняются.
            </p>
          </div>

          <div>
            <label
              className="small"
              style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}
            >
              Температура (креативность): {draft.temperature.toFixed(2)}
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={draft.temperature}
              onChange={(e) => setDraft((d) => ({ ...d, temperature: Number(e.target.value) }))}
              style={{ width: '100%', accentColor: 'var(--primary)' }}
            />
            <div
              className="small"
              style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginTop: 4 }}
            >
              <span>Точнее</span>
              <span>Свободнее</span>
            </div>
          </div>

          <div>
            <label
              className="small"
              style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}
            >
              Персонализация
            </label>
            <button
              type="button"
              className="button secondary"
              onClick={onOpenMemory}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: '12px 14px',
                fontSize: 14,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0 }}>
                <PlatformIcon name="file" size={18} strokeWidth={1.75} />
              </span>
              Память
            </button>
            <p className="small" style={{ marginTop: 8, color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: 0 }}>
              Кто вы, как удобнее получать ответы. Учитывается в каждом сообщении к ИИ.
            </p>
          </div>

          <div>
            <label
              className="small"
              style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}
            >
              Объём ответа
            </label>
            <ThemeListbox
              ariaLabel="Объём ответа"
              value={draft.responseStyle}
              options={RESPONSE_STYLE_OPTIONS}
              onChange={(responseStyle) => setDraft((d) => ({ ...d, responseStyle }))}
            />
          </div>
        </div>

        <div
          style={{
            padding: 16,
            borderTop: '1px solid var(--border, rgba(255,255,255,0.08))',
            display: 'flex',
            gap: 10,
            flexShrink: 0,
          }}
        >
          <button type="button" className="button secondary" style={{ flex: 1 }} onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="button" style={{ flex: 1 }} onClick={onApply}>
            Применить
          </button>
        </div>
      </aside>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}
