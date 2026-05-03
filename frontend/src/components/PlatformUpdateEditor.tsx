import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

/**
 * Markdown-редактор с панелью: жирный, курсив, списки, заголовки и т.д.
 */
export function PlatformUpdateEditor({ value, onChange, disabled }: Props) {
  return (
    <div
      data-color-mode="dark"
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.12)'
      }}
    >
      <MDEditor
        value={value}
        onChange={(v) => onChange(v ?? '')}
        height={420}
        preview="live"
        visibleDragbar
        textareaProps={{
          disabled: Boolean(disabled),
          placeholder: 'Текст обновления… Используйте панель выше: **жирный**, списки, заголовки.'
        }}
      />
    </div>
  );
}
