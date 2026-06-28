import type { RefObject, ReactNode } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Strikethrough,
  Table2,
  Underline,
  Unlink,
} from 'lucide-react';

type Props = {
  editorRef: RefObject<HTMLDivElement | null>;
  onChange: () => void;
};

export function ProjectSpaceEditorToolbar({ editorRef, onChange }: Props) {
  function focusEditor() {
    editorRef.current?.focus();
  }

  function exec(cmd: string, value?: string) {
    focusEditor();
    document.execCommand(cmd, false, value);
    onChange();
  }

  function execBlock(tag: 'P' | 'H1' | 'H2' | 'H3' | 'BLOCKQUOTE' | 'PRE') {
    focusEditor();
    document.execCommand('formatBlock', false, tag);
    onChange();
  }

  function insertLink() {
    const url = window.prompt('Вставить ссылку (URL):');
    if (!url) return;
    exec('createLink', url);
  }

  function insertTable() {
    focusEditor();
    const rows = 4;
    const cols = 3;
    const theadCells = Array.from({ length: cols })
      .map((_, i) => `<th>Столбец ${i + 1}</th>`)
      .join('');
    const bodyRows = Array.from({ length: rows - 1 })
      .map(
        () =>
          `<tr>${Array.from({ length: cols })
            .map(() => '<td>&nbsp;</td>')
            .join('')}</tr>`
      )
      .join('');
    const html = `<div class="wa-table-wrap"><table><thead><tr>${theadCells}</tr></thead><tbody>${bodyRows}</tbody></table></div><p><br></p>`;
    document.execCommand('insertHTML', false, html);
    onChange();
  }

  return (
    <div className="project-space-toolbar" role="toolbar" aria-label="Форматирование текста">
      <div className="project-space-toolbar__group">
        <select
          className="project-space-toolbar__select"
          defaultValue="P"
          onChange={(e) => execBlock(e.target.value as 'P' | 'H1' | 'H2' | 'H3' | 'BLOCKQUOTE' | 'PRE')}
          title="Стиль абзаца"
        >
          <option value="P">Обычный</option>
          <option value="H1">Заголовок 1</option>
          <option value="H2">Заголовок 2</option>
          <option value="H3">Заголовок 3</option>
          <option value="BLOCKQUOTE">Цитата</option>
          <option value="PRE">Код</option>
        </select>
      </div>

      <div className="project-space-toolbar__group">
        <ToolbarBtn title="Жирный" onClick={() => exec('bold')}>
          <Bold size={16} strokeWidth={2.2} />
        </ToolbarBtn>
        <ToolbarBtn title="Курсив" onClick={() => exec('italic')}>
          <Italic size={16} strokeWidth={2.2} />
        </ToolbarBtn>
        <ToolbarBtn title="Подчёркнутый" onClick={() => exec('underline')}>
          <Underline size={16} strokeWidth={2.2} />
        </ToolbarBtn>
        <ToolbarBtn title="Зачёркнутый" onClick={() => exec('strikeThrough')}>
          <Strikethrough size={16} strokeWidth={2.2} />
        </ToolbarBtn>
      </div>

      <div className="project-space-toolbar__group">
        <ToolbarBtn title="Маркированный список" onClick={() => exec('insertUnorderedList')}>
          <List size={16} />
        </ToolbarBtn>
        <ToolbarBtn title="Нумерованный список" onClick={() => exec('insertOrderedList')}>
          <ListOrdered size={16} />
        </ToolbarBtn>
        <span className="project-space-toolbar__sep" />
        <ToolbarBtn title="По левому краю" onClick={() => exec('justifyLeft')}>
          <AlignLeft size={16} />
        </ToolbarBtn>
        <ToolbarBtn title="По центру" onClick={() => exec('justifyCenter')}>
          <AlignCenter size={16} />
        </ToolbarBtn>
        <ToolbarBtn title="По правому краю" onClick={() => exec('justifyRight')}>
          <AlignRight size={16} />
        </ToolbarBtn>
        <ToolbarBtn title="По ширине" onClick={() => exec('justifyFull')}>
          <AlignJustify size={16} />
        </ToolbarBtn>
      </div>

      <div className="project-space-toolbar__group">
        <ToolbarBtn title="Вставить ссылку" onClick={insertLink}>
          <Link2 size={16} />
        </ToolbarBtn>
        <ToolbarBtn title="Удалить ссылку" onClick={() => exec('unlink')}>
          <Unlink size={16} />
        </ToolbarBtn>
        <span className="project-space-toolbar__sep" />
        <ToolbarBtn title="Вставить таблицу" onClick={insertTable}>
          <Table2 size={16} />
        </ToolbarBtn>
        <label className="project-space-toolbar__color" title="Цвет текста">
          <span className="project-space-toolbar__color-label">A</span>
          <input
            type="color"
            defaultValue="#e2e8f0"
            onChange={(e) => exec('foreColor', e.target.value)}
          />
        </label>
        <label className="project-space-toolbar__color" title="Цвет фона">
          <span className="project-space-toolbar__color-label">▣</span>
          <input
            type="color"
            defaultValue="#334155"
            onChange={(e) => exec('hiliteColor', e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}

function ToolbarBtn({
  children,
  title,
  onClick,
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="project-space-toolbar__btn" title={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </button>
  );
}
