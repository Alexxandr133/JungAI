import { useState } from 'react';
import { ThemeSettingsModal } from './ThemeSettingsModal';

type Props = {
  /** Компактная кнопка в навбаре */
  compact?: boolean;
};

export function ThemeMenuButton({ compact = true }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="button secondary"
        onClick={() => setOpen(true)}
        title="Тема оформления"
        style={
          compact
            ? { padding: '8px 12px', fontSize: 13, fontWeight: 600 }
            : { padding: '10px 18px', fontSize: 14, fontWeight: 600 }
        }
      >
        🎨 {compact ? 'Тема' : 'Оформление'}
      </button>
      <ThemeSettingsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
