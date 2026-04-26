import type { Dispatch, SetStateAction } from 'react';
import { PlatformIcon } from '../../components/icons';
import { MODALITY_OPTIONS, type DreamsContextRange, type PsychologistAiSettings } from '../../lib/psychologistAiSettings';

type Props = {
  open: boolean;
  onClose: () => void;
  draft: PsychologistAiSettings;
  setDraft: Dispatch<SetStateAction<PsychologistAiSettings>>;
  onApply: () => void;
  onOpenMemory: () => void;
  isMobileView: boolean;
};

export function PsychologistAiSettingsPanel({
  open,
  onClose,
  draft,
  setDraft,
  onApply,
  onOpenMemory,
  isMobileView
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
          animation: 'fadeIn 0.2s ease'
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
          borderLeft: '1px solid rgba(255,255,255,0.1)',
          zIndex: 201,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.35)',
          animation: 'slideInRight 0.25s ease'
        }}
      >
        <div
          style={{
            padding: '16px 18px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexShrink: 0
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

        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label className="small" style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}>
              Модальность
            </label>
            <select
              value={draft.modality}
              onChange={e =>
                setDraft(d => ({ ...d, modality: e.target.value as PsychologistAiSettings['modality'] }))
              }
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                fontSize: 14
              }}
            >
              {MODALITY_OPTIONS.map(o => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="small" style={{ marginTop: 8, color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: 0 }}>
              От неё зависят системные инструкции ассистента (акценты теории). Данные клиентов не меняются.
            </p>
          </div>

          <div>
            <label className="small" style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}>
              Температура (креативность): {draft.temperature.toFixed(2)}
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={draft.temperature}
              onChange={e => setDraft(d => ({ ...d, temperature: Number(e.target.value) }))}
              style={{ width: '100%', accentColor: 'var(--primary)' }}
            />
            <div className="small" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginTop: 4 }}>
              <span>Точнее</span>
              <span>Свободнее</span>
            </div>
          </div>

          <div>
            <label className="small" style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}>
              Сны в контексте ИИ
            </label>
            <select
              value={draft.dreamsContextRange}
              onChange={e =>
                setDraft(d => ({
                  ...d,
                  dreamsContextRange: e.target.value as DreamsContextRange
                }))
              }
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                fontSize: 14
              }}
            >
              <option value="30d">Последний месяц (по умолчанию)</option>
              <option value="90d">Последние 3 месяца</option>
              <option value="365d">Последний год</option>
              <option value="all">Все сны за всё время</option>
            </select>
            {draft.dreamsContextRange !== '30d' && (
              <div
                style={{
                  marginTop: 10,
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'rgba(255, 152, 0, 0.12)',
                  border: '1px solid rgba(255, 152, 0, 0.35)',
                  color: 'var(--text)'
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    border: '2px solid #ff9800',
                    color: '#ff9800',
                    fontWeight: 800,
                    fontSize: 14,
                    display: 'grid',
                    placeItems: 'center',
                    lineHeight: 1
                  }}
                  aria-hidden
                >
                  !
                </span>
                <span className="small" style={{ lineHeight: 1.45, margin: 0 }}>
                  Длинный период — в запрос попадет больше текста снов. Расход токенов на один запрос вырастет, ответы могут стать дороже и медленнее.
                </span>
              </div>
            )}
            <p className="small" style={{ marginTop: 8, color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: 0 }}>
              В режиме клиента в контекст подставляются сны за выбранный период (полный текст), по дате записи.
            </p>
          </div>

          <div>
            <label className="small" style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}>
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
                fontSize: 14
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
            <label className="small" style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}>
              Объём ответа
            </label>
            <select
              value={draft.responseStyle}
              onChange={e =>
                setDraft(d => ({
                  ...d,
                  responseStyle: e.target.value as PsychologistAiSettings['responseStyle']
                }))
              }
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                fontSize: 14
              }}
            >
              <option value="concise">Кратко, по пунктам</option>
              <option value="balanced">Сбалансированно</option>
              <option value="detailed">Развёрнуто, с примерами</option>
            </select>
          </div>
        </div>

        <div
          style={{
            padding: 16,
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            gap: 10,
            flexShrink: 0
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
