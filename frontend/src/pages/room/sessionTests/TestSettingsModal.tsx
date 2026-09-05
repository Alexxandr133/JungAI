import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ASSOCIATION_WORDS_100 } from './associationWords';

type Props = {
  open: boolean;
  words: string[];
  saving?: boolean;
  onClose: () => void;
  onSave: (words: string[]) => void;
};

export function TestSettingsModal({ open, words, saving, onClose, onSave }: Props) {
  const [draft, setDraft] = useState(words.join('\n'));

  useEffect(() => {
    if (open) setDraft(words.join('\n'));
  }, [open, words]);

  if (!open) return null;

  const parsed = draft
    .split(/\r?\n/)
    .map((w) => w.trim())
    .filter(Boolean);

  return createPortal(
    <div className="st-modal" role="dialog" aria-labelledby="st-settings-title">
      <button type="button" className="st-modal__backdrop" aria-label="Закрыть настройки" onClick={onClose} />
      <div className="st-modal__card">
        <div className="st-modal__head">
          <h2 id="st-settings-title">Настройки теста</h2>
          <button type="button" className="st-act st-act--quiet" onClick={onClose}>
            Закрыть
          </button>
        </div>
        <p className="st-modal__lead">
          Вы можете изменить банк слов. Каждое слово с новой строки. Если список пустой, то вернётся стандартный набор.
        </p>
        <label className="st-modal__label">
          Слова ассоциативного теста
          <span>{parsed.length} слов</span>
        </label>
        <textarea
          className="st-modal__bank"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
        />
        <div className="st-modal__actions">
          <button
            type="button"
            className="st-act st-act--quiet"
            onClick={() => setDraft([...ASSOCIATION_WORDS_100].join('\n'))}
          >
            Вернуть стандартный список
          </button>
          <button type="button" className="st-act" disabled={saving} onClick={() => onSave(parsed)}>
            Сохранить банк
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
