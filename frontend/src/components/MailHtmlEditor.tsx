import { useEffect, useRef } from 'react';
import './MailHtmlEditor.css';

type Props = {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
};

function exec(cmd: string, value?: string) {
  document.execCommand(cmd, false, value);
}

export function MailHtmlEditor({ value, onChange, minHeight = 200 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const skipping = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (skipping.current) {
      skipping.current = false;
      return;
    }
    if (el.innerHTML !== value) {
      el.innerHTML = value || '<p><br/></p>';
    }
  }, [value]);

  function emit() {
    const el = ref.current;
    if (!el) return;
    skipping.current = true;
    onChange(el.innerHTML);
  }

  function onToolbar(cmd: string, arg?: string) {
    ref.current?.focus();
    if (cmd === 'createLink') {
      const url = window.prompt('URL ссылки', 'https://');
      if (!url) return;
      exec('createLink', url);
    } else if (cmd === 'insertUnsubscribe') {
      exec(
        'insertHTML',
        `<p style="margin-top:16px;font-size:12px;color:#6b7280;"><a href="{{unsubscribeUrl}}">Отписаться от рассылки</a></p>`
      );
    } else if (cmd === 'insertGreeting') {
      exec('insertHTML', `<p>Здравствуйте{{#name}}, {{name}}{{/name}}!</p>`);
    } else {
      exec(cmd, arg);
    }
    emit();
  }

  return (
    <div className="mail-html-editor">
      <div className="mail-html-editor__toolbar" role="toolbar" aria-label="Форматирование письма">
        <button type="button" title="Жирный" onMouseDown={(e) => e.preventDefault()} onClick={() => onToolbar('bold')}>
          <b>B</b>
        </button>
        <button type="button" title="Курсив" onMouseDown={(e) => e.preventDefault()} onClick={() => onToolbar('italic')}>
          <i>I</i>
        </button>
        <button type="button" title="Подчёркнутый" onMouseDown={(e) => e.preventDefault()} onClick={() => onToolbar('underline')}>
          <u>U</u>
        </button>
        <span className="mail-html-editor__sep" />
        <button type="button" title="Заголовок" onMouseDown={(e) => e.preventDefault()} onClick={() => onToolbar('formatBlock', 'h2')}>
          H2
        </button>
        <button type="button" title="Абзац" onMouseDown={(e) => e.preventDefault()} onClick={() => onToolbar('formatBlock', 'p')}>
          ¶
        </button>
        <button type="button" title="Список" onMouseDown={(e) => e.preventDefault()} onClick={() => onToolbar('insertUnorderedList')}>
          ••
        </button>
        <button type="button" title="Ссылка" onMouseDown={(e) => e.preventDefault()} onClick={() => onToolbar('createLink')}>
          🔗
        </button>
        <span className="mail-html-editor__sep" />
        <button type="button" title="Приветствие" onMouseDown={(e) => e.preventDefault()} onClick={() => onToolbar('insertGreeting')}>
          Приветствие
        </button>
        <button type="button" title="Отписка" onMouseDown={(e) => e.preventDefault()} onClick={() => onToolbar('insertUnsubscribe')}>
          Отписка
        </button>
      </div>
      <div
        ref={ref}
        className="mail-html-editor__surface"
        contentEditable
        suppressContentEditableWarning
        style={{ minHeight }}
        onInput={emit}
        onBlur={emit}
      />
      <div className="mail-html-editor__hint">
        Переменные: {'{{name}}'}, {'{{email}}'}, {'{{unsubscribeUrl}}'} · шапка и подпись JungAI добавятся автоматически
      </div>
    </div>
  );
}
