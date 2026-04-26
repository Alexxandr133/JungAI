import { useEffect, useState } from 'react';
import { PERSONALITY_EXAMPLE } from '../../lib/psychologistAiPersonality';

type Props = {
  open: boolean;
  variant: 'onboarding' | 'memory';
  initialText: string;
  onClose: () => void;
  onSave: (text: string) => void;
  /** Только для onboarding: пропустить без сохранения */
  onSkip?: () => void;
};

export function PsychologistAiPersonalityModal({ open, variant, initialText, onClose, onSave, onSkip }: Props) {
  const [text, setText] = useState(initialText);

  useEffect(() => {
    if (open) setText(initialText);
  }, [open, initialText]);

  if (!open) return null;

  const title = variant === 'onboarding' ? 'Давайте познакомимся' : 'Память / персонализация';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-personality-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        display: 'grid',
        placeItems: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.55)'
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: 'min(560px, 100%)',
          maxHeight: 'min(90vh, 720px)',
          display: 'flex',
          flexDirection: 'column',
          padding: 24,
          borderRadius: 16,
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 id="ai-personality-title" style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800 }}>
          {title}
        </h2>

        {variant === 'onboarding' && (
          <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.55 }}>
            Пожалуйста, кратко расскажите о себе и о том, <strong>как вам удобнее получать ответы</strong> от ассистента.
            Это не публичный профиль — текст используется только как инструкция для ИИ в ваших чатах.
          </p>
        )}

        {variant === 'memory' && (
          <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.5 }}>
            Здесь можно изменить персонализацию: кто вы, стиль общения, границы тем.
          </p>
        )}

        <div className="small" style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-muted)' }}>
          Пример оформления (можно скопировать и отредактировать)
        </div>
        <pre
          style={{
            margin: '0 0 16px',
            padding: 12,
            borderRadius: 10,
            background: 'var(--surface-2)',
            border: '1px solid rgba(255,255,255,0.08)',
            fontSize: 12,
            lineHeight: 1.45,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: 'var(--text-muted)',
            maxHeight: 140,
            overflow: 'auto'
          }}
        >
          {PERSONALITY_EXAMPLE}
        </pre>

        <label className="small" style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: 'var(--text)' }}>
          Ваш текст
        </label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Начните с пару строк о себе и о желаемом стиле ответов…"
          rows={12}
          style={{
            width: '100%',
            flex: 1,
            minHeight: 200,
            padding: 14,
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'var(--surface-2)',
            color: 'var(--text)',
            fontSize: 14,
            lineHeight: 1.5,
            resize: 'vertical',
            fontFamily: 'inherit',
            marginBottom: 16
          }}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' }}>
          {variant === 'onboarding' && onSkip && (
            <button type="button" className="button secondary" onClick={onSkip}>
              Позже
            </button>
          )}
          <button type="button" className="button secondary" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="button" onClick={() => onSave(text)}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
