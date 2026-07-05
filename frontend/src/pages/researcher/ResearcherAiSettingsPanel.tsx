import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { PlatformIcon } from '../../components/icons';
import {
  DREAM_SAMPLE_SIZE_OPTIONS,
  DREAM_SAMPLING_OPTIONS,
  MODALITY_OPTIONS,
  RESEARCH_PROMPT_OPTIONS,
  type ResearcherAiSettings,
} from '../../lib/researcherAiSettings';

type ParticipantOption = { clientId: string; label: string; count: number };

type Props = {
  open: boolean;
  onClose: () => void;
  draft: ResearcherAiSettings;
  setDraft: Dispatch<SetStateAction<ResearcherAiSettings>>;
  onApply: () => void;
  onOpenMemory: () => void;
  isMobileView: boolean;
  participants: ParticipantOption[];
  quota?: {
    plan: string;
    limit: number;
    used: number;
    remaining: number;
    percentageUsed: number;
    resetAt: string;
  } | null;
};

export function ResearcherAiSettingsPanel({
  open,
  onClose,
  draft,
  setDraft,
  onApply,
  onOpenMemory,
  isMobileView,
  participants,
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
        }}
      />
      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: isMobileView ? 'min(100%, 420px)' : 420,
          maxWidth: '100vw',
          background: 'var(--surface)',
          borderLeft: '1px solid rgba(255,255,255,0.1)',
          zIndex: 201,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.35)',
        }}
      >
        <div
          style={{
            padding: '16px 18px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 16 }}>Настройки исследователя</div>
          <button type="button" className="button secondary" onClick={onClose} style={{ padding: '6px 12px', fontSize: 13 }}>
            Закрыть
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {quota && (
            <div style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'var(--surface-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="small" style={{ fontWeight: 700 }}>Токены AI ({quota.plan})</span>
                <span className="small" style={{ color: 'var(--text-muted)' }}>
                  {quota.used.toLocaleString('ru-RU')} / {quota.limit.toLocaleString('ru-RU')}
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.09)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, quota.percentageUsed)}%`,
                    background: 'linear-gradient(90deg, #22c55e, #16a34a)',
                  }}
                />
              </div>
            </div>
          )}

          <Section title="Модальность">
            <select
              value={draft.modality}
              onChange={(e) => setDraft((d) => ({ ...d, modality: e.target.value as ResearcherAiSettings['modality'] }))}
              style={selectStyle}
            >
              {MODALITY_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </Section>

          <Section title={`Креативность: ${draft.temperature.toFixed(2)}`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={draft.temperature}
              onChange={(e) => setDraft((d) => ({ ...d, temperature: Number(e.target.value) }))}
              style={{ width: '100%', accentColor: 'var(--primary)' }}
            />
          </Section>

          <Section title="Объём ответа">
            <select
              value={draft.responseStyle}
              onChange={(e) =>
                setDraft((d) => ({ ...d, responseStyle: e.target.value as ResearcherAiSettings['responseStyle'] }))
              }
              style={selectStyle}
            >
              <option value="concise">Кратко</option>
              <option value="balanced">Сбалансированно</option>
              <option value="detailed">Развёрнуто</option>
            </select>
          </Section>

          <Section title="Персонализация">
            <button type="button" className="button secondary" onClick={onOpenMemory} style={{ width: '100%', padding: '12px 14px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <PlatformIcon name="file" size={18} strokeWidth={1.75} />
                Память / профиль исследователя
              </span>
            </button>
          </Section>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 4 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Выборка снов</div>

            <label style={labelStyle}>
              <input
                type="checkbox"
                checked={draft.includeDreamsInContext}
                onChange={(e) => setDraft((d) => ({ ...d, includeDreamsInContext: e.target.checked }))}
                style={{ marginRight: 8 }}
              />
              Включать сны в контекст
            </label>

            <div style={{ marginTop: 12 }}>
              <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)', fontWeight: 600 }}>Период</div>
              <select
                value={draft.dreamsContextRange}
                disabled={!draft.includeDreamsInContext}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, dreamsContextRange: e.target.value as ResearcherAiSettings['dreamsContextRange'] }))
                }
                style={selectStyle}
              >
                <option value="30d">30 дней</option>
                <option value="90d">90 дней</option>
                <option value="365d">1 год</option>
                <option value="all">Всё время</option>
              </select>
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)', fontWeight: 600 }}>Режим выборки</div>
              <select
                value={draft.dreamSamplingMode}
                disabled={!draft.includeDreamsInContext}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, dreamSamplingMode: e.target.value as ResearcherAiSettings['dreamSamplingMode'] }))
                }
                style={selectStyle}
              >
                {DREAM_SAMPLING_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)', fontWeight: 600 }}>Размер выборки (снов в запросе)</div>
              <select
                value={draft.dreamSampleSize}
                disabled={!draft.includeDreamsInContext}
                onChange={(e) => setDraft((d) => ({ ...d, dreamSampleSize: Number(e.target.value) }))}
                style={selectStyle}
              >
                {DREAM_SAMPLE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n} снов</option>
                ))}
              </select>
            </div>

            {draft.dreamSamplingMode === 'by_participant' && (
              <div style={{ marginTop: 12 }}>
                <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)', fontWeight: 600 }}>Участник</div>
                <select
                  value={draft.participantClientId}
                  disabled={!draft.includeDreamsInContext}
                  onChange={(e) => setDraft((d) => ({ ...d, participantClientId: e.target.value }))}
                  style={selectStyle}
                >
                  <option value="">— выберите —</option>
                  {participants.map((p) => (
                    <option key={p.clientId} value={p.clientId}>{p.label} ({p.count})</option>
                  ))}
                </select>
              </div>
            )}

            {draft.dreamSamplingMode === 'by_symbol' && (
              <div style={{ marginTop: 12 }}>
                <div className="small" style={{ marginBottom: 6, color: 'var(--text-muted)', fontWeight: 600 }}>Символ (фильтр)</div>
                <input
                  type="text"
                  value={draft.symbolFilter}
                  disabled={!draft.includeDreamsInContext}
                  onChange={(e) => setDraft((d) => ({ ...d, symbolFilter: e.target.value }))}
                  placeholder="например: вода, змея, дом"
                  style={{ ...selectStyle, fontSize: 14 }}
                />
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 4 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Исследовательский промпт</div>
            <select
              value={draft.researchPromptId}
              onChange={(e) =>
                setDraft((d) => ({ ...d, researchPromptId: e.target.value as ResearcherAiSettings['researchPromptId'] }))
              }
              style={selectStyle}
            >
              {RESEARCH_PROMPT_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <p className="small" style={{ marginTop: 8, color: 'var(--text-muted)', lineHeight: 1.45 }}>
              {RESEARCH_PROMPT_OPTIONS.find((p) => p.id === draft.researchPromptId)?.description}
            </p>
            {draft.researchPromptId === 'custom' && (
              <textarea
                value={draft.customResearchPrompt}
                onChange={(e) => setDraft((d) => ({ ...d, customResearchPrompt: e.target.value }))}
                rows={5}
                placeholder="Опишите теорию, гипотезу или метод анализа…"
                style={{
                  width: '100%',
                  marginTop: 10,
                  padding: 12,
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  fontSize: 13,
                  lineHeight: 1.5,
                  resize: 'vertical',
                }}
              />
            )}
          </div>
        </div>

        <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button type="button" className="button secondary" style={{ flex: 1 }} onClick={onClose}>Отмена</button>
          <button type="button" className="button" style={{ flex: 1 }} onClick={onApply}>Применить</button>
        </div>
      </aside>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <label className="small" style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontWeight: 600 }}>
        {title}
      </label>
      {children}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'var(--surface-2)',
  color: 'var(--text)',
  fontSize: 14,
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  fontSize: 14,
  cursor: 'pointer',
};
