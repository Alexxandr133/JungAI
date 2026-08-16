import { useEffect, useId, useRef, useState } from 'react';

export type ThemeListboxOption<T extends string = string> = {
  id: T;
  label: string;
  description?: string;
};

type Props<T extends string> = {
  value: T;
  options: Array<ThemeListboxOption<T>>;
  onChange: (id: T) => void;
  ariaLabel: string;
  disabled?: boolean;
};

/** Кастомный listbox в теме приложения (вместо native &lt;select&gt;). */
export function ThemeListbox<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled,
}: Props<T>) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (t && rootRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid var(--border, rgba(255,255,255,0.12))',
          background: 'var(--surface-2)',
          color: 'var(--text)',
          fontSize: 14,
          fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.55 : 1,
          textAlign: 'left',
        }}
      >
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected?.label ?? '—'}
        </span>
        <span aria-hidden style={{ opacity: 0.7, flexShrink: 0 }}>
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: 'absolute',
            zIndex: 40,
            left: 0,
            right: 0,
            top: 'calc(100% + 6px)',
            margin: 0,
            padding: 6,
            listStyle: 'none',
            maxHeight: 280,
            overflowY: 'auto',
            borderRadius: 12,
            border: '1px solid var(--border, rgba(255,255,255,0.12))',
            background: 'var(--surface)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.28)',
          }}
        >
          {options.map((o) => {
            const active = o.id === value;
            return (
              <li key={o.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                  style={{
                    width: '100%',
                    display: 'block',
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: active ? 'var(--brand-soft, rgba(108,91,212,0.16))' : 'transparent',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: active ? 700 : 500,
                  }}
                >
                  <div>{o.label}</div>
                  {o.description ? (
                    <div className="small" style={{ marginTop: 2, color: 'var(--text-muted)', fontWeight: 500 }}>
                      {o.description}
                    </div>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
