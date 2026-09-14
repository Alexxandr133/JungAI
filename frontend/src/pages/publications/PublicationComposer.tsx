import { useEffect, useRef, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, List, ListOrdered, Redo2, Undo2 } from 'lucide-react';

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid var(--line, rgba(255,255,255,0.14))',
  background: 'var(--surface-2)',
  color: 'var(--text)',
  boxSizing: 'border-box'
};

function sanitizePastedRichHtml(html: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    doc.body.querySelectorAll('*').forEach((el) => {
      const node = el as HTMLElement;
      node.style.removeProperty('background');
      node.style.removeProperty('background-color');
      node.style.removeProperty('color');
      const style = node.getAttribute('style') || '';
      const cleaned = style
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((rule) => {
          const key = rule.split(':')[0]?.trim().toLowerCase();
          return key !== 'background' && key !== 'background-color' && key !== 'color';
        })
        .join('; ');
      if (cleaned) node.setAttribute('style', cleaned);
      else node.removeAttribute('style');
    });
    return doc.body.innerHTML;
  } catch {
    return html;
  }
}

type Props = {
  html: string;
  onChange: (html: string) => void;
};

function isComposerEmpty(html: string) {
  return !String(html || '')
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, '')
    .trim();
}

export function PublicationComposer({ html, onChange }: Props) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const seededRef = useRef(false);
  const [fontSizePx, setFontSizePx] = useState(16);
  const [textColor, setTextColor] = useState('#1f2937');
  const empty = isComposerEmpty(html);

  useEffect(() => {
    if (seededRef.current || !editorRef.current) return;
    if (html) editorRef.current.innerHTML = html;
    seededRef.current = true;
  }, [html]);

  function saveSelectionRange() {
    const root = editorRef.current;
    const selection = window.getSelection();
    if (!root || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return;
    savedRangeRef.current = range.cloneRange();
  }

  function restoreSelectionRange() {
    const selection = window.getSelection();
    if (!selection || !savedRangeRef.current) return;
    selection.removeAllRanges();
    selection.addRange(savedRangeRef.current);
  }

  function placeCaretAfter(node: Node) {
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    savedRangeRef.current = range.cloneRange();
  }

  function applyEditorCommand(command: string, value?: string) {
    if (command !== 'undo' && command !== 'redo') {
      editorRef.current?.focus();
      restoreSelectionRange();
    }
    document.execCommand(command, false, value);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
      saveSelectionRange();
    }
  }

  function applyFontSize(nextPx: number) {
    setFontSizePx(nextPx);
    const root = editorRef.current;
    if (!root) return;
    root.focus();
    restoreSelectionRange();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return;
    if (range.collapsed) {
      document.execCommand('styleWithCSS', false, 'true');
      document.execCommand('fontSize', false, '7');
      root.querySelectorAll('font[size="7"]').forEach((node) => {
        const span = document.createElement('span');
        span.style.fontSize = `${nextPx}px`;
        span.innerHTML = node.innerHTML || '&#8203;';
        node.replaceWith(span);
      });
      saveSelectionRange();
      onChange(root.innerHTML);
      return;
    }
    const selected = range.extractContents();
    const span = document.createElement('span');
    span.style.fontSize = `${nextPx}px`;
    span.appendChild(selected);
    span.querySelectorAll<HTMLElement>('[style*="font-size"]').forEach((el) => {
      el.style.removeProperty('font-size');
      if (!el.getAttribute('style')?.trim()) el.removeAttribute('style');
    });
    range.insertNode(span);
    placeCaretAfter(span);
    onChange(root.innerHTML);
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div
        style={{
          border: '1px solid var(--line, rgba(148,163,184,0.28))',
          borderRadius: 10,
          background: 'var(--card, var(--surface-2))',
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 6
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          <select
            value={fontSizePx}
            onChange={(e) => applyFontSize(Number(e.target.value))}
            style={{ ...fieldStyle, width: 100, padding: '8px 10px', borderRadius: 8, fontSize: 12 }}
          >
            {[12, 14, 16, 18, 20, 24, 28, 32].map((size) => (
              <option key={size} value={size}>
                {size}px
              </option>
            ))}
          </select>
          <input
            type="color"
            value={textColor}
            onChange={(e) => {
              setTextColor(e.target.value);
              applyEditorCommand('foreColor', e.target.value);
            }}
            style={{ width: 34, height: 32, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
          />
          <button className="button secondary" type="button" onClick={() => applyEditorCommand('formatBlock', 'p')} style={{ padding: '4px 8px', fontSize: 11, minHeight: 28, borderRadius: 8 }}>
            P
          </button>
          <button className="button secondary" type="button" onClick={() => applyEditorCommand('formatBlock', 'h2')} style={{ padding: '4px 8px', fontSize: 11, minHeight: 28, borderRadius: 8 }}>
            H2
          </button>
          <button className="button secondary" type="button" onClick={() => applyEditorCommand('formatBlock', 'h3')} style={{ padding: '4px 8px', fontSize: 11, minHeight: 28, borderRadius: 8 }}>
            H3
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              const url = window.prompt('Вставьте ссылку (https://...)');
              if (!url) return;
              const normalized = /^(https?:)?\/\//i.test(url) ? url : `https://${url}`;
              applyEditorCommand('createLink', normalized);
            }}
            style={{ padding: '4px 8px', fontSize: 11, minHeight: 28, borderRadius: 8 }}
          >
            URL
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          <button className="button secondary" type="button" onClick={() => applyEditorCommand('bold')} style={{ padding: '4px 8px', minHeight: 28, borderRadius: 8 }}>
            <b>B</b>
          </button>
          <button className="button secondary" type="button" onClick={() => applyEditorCommand('italic')} style={{ padding: '4px 8px', minHeight: 28, borderRadius: 8 }}>
            <i>I</i>
          </button>
          <button className="button secondary" type="button" onClick={() => applyEditorCommand('underline')} style={{ padding: '4px 8px', minHeight: 28, borderRadius: 8 }}>
            <u>U</u>
          </button>
          <button className="button secondary" type="button" onClick={() => applyEditorCommand('insertUnorderedList')} style={{ padding: '4px 8px', minHeight: 28, borderRadius: 8 }}>
            <List size={15} strokeWidth={2} />
          </button>
          <button className="button secondary" type="button" onClick={() => applyEditorCommand('insertOrderedList')} style={{ padding: '4px 8px', minHeight: 28, borderRadius: 8 }}>
            <ListOrdered size={15} strokeWidth={2} />
          </button>
          <button className="button secondary" type="button" onClick={() => applyEditorCommand('justifyLeft')} style={{ padding: '4px 8px', minHeight: 28, borderRadius: 8 }}>
            <AlignLeft size={15} strokeWidth={2} />
          </button>
          <button className="button secondary" type="button" onClick={() => applyEditorCommand('justifyCenter')} style={{ padding: '4px 8px', minHeight: 28, borderRadius: 8 }}>
            <AlignCenter size={15} strokeWidth={2} />
          </button>
          <button className="button secondary" type="button" onClick={() => applyEditorCommand('justifyRight')} style={{ padding: '4px 8px', minHeight: 28, borderRadius: 8 }}>
            <AlignRight size={15} strokeWidth={2} />
          </button>
          <button className="button secondary" type="button" onClick={() => applyEditorCommand('undo')} style={{ padding: '4px 8px', minHeight: 28, borderRadius: 8 }}>
            <Undo2 size={15} strokeWidth={2} />
          </button>
          <button className="button secondary" type="button" onClick={() => applyEditorCommand('redo')} style={{ padding: '4px 8px', minHeight: 28, borderRadius: 8 }}>
            <Redo2 size={15} strokeWidth={2} />
          </button>
        </div>
      </div>
      <div className={`forum__composer-shell${empty ? ' is-empty' : ''}`}>
        {empty ? (
          <div className="forum__composer-placeholder" aria-hidden>
            Напишите текст поста здесь…
          </div>
        ) : null}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="forum__composer-editor"
          data-placeholder="Напишите текст поста здесь…"
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData('text/html');
            const text = e.clipboardData.getData('text/plain');
            if (pasted) document.execCommand('insertHTML', false, sanitizePastedRichHtml(pasted));
            else document.execCommand('insertText', false, text || '');
            if (editorRef.current) onChange(editorRef.current.innerHTML);
          }}
          onMouseUp={saveSelectionRange}
          onKeyUp={saveSelectionRange}
          onFocus={() => editorRef.current?.closest('.forum__composer-shell')?.classList.add('is-focused')}
          onBlur={() => editorRef.current?.closest('.forum__composer-shell')?.classList.remove('is-focused')}
          onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
          style={{ ...fieldStyle, minHeight: 260, lineHeight: 1.7, position: 'relative', zIndex: 1 }}
        />
      </div>
      <div className="small" style={{ color: 'var(--text-muted)', marginTop: -2 }}>
        Заголовок поста — поле выше. Здесь — основной текст; списки и ссылки через панель.
      </div>
    </div>
  );
}
