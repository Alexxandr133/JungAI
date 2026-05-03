import { useState } from 'react';
import { ThemeSettingsModal } from './ThemeSettingsModal';
import { PlatformIcon } from './icons';

type Props = {
  /** Компактная кнопка в навбаре */
  compact?: boolean;
  iconOnly?: boolean;
};

export function ThemeMenuButton({ compact = true, iconOnly = false }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="button secondary"
        onClick={() => setOpen(true)}
        title="Тема оформления"
        style={
          iconOnly
            ? {
                width: 36,
                height: 36,
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10
              }
            : compact
            ? { padding: '8px 12px', fontSize: 13, fontWeight: 600 }
            : { padding: '10px 18px', fontSize: 14, fontWeight: 600 }
        }
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: iconOnly ? 0 : 8 }}>
          <PlatformIcon name="moon" size={16} />
          {!iconOnly && (compact ? 'Тема' : 'Оформление')}
        </span>
      </button>
      <ThemeSettingsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
