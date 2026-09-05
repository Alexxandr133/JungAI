import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';

const MIN_W = 196;
const DEFAULT_W = 360;

type Props = {
  children: ReactNode | ((width: number) => ReactNode);
};

export function DraggablePip({ children }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ x: 16, y: 16 });
  const [width, setWidth] = useState(DEFAULT_W);
  const placed = useRef(false);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const resize = useRef<{ startX: number; startW: number } | null>(null);

  function parentBox(el: HTMLElement) {
    const parent = (el.offsetParent as HTMLElement | null) ?? document.body;
    return parent.getBoundingClientRect();
  }

  function parkBottomRight(el: HTMLElement) {
    const box = parentBox(el);
    const w = el.offsetWidth || width;
    const h = el.offsetHeight || 170;
    setPos({
      x: Math.max(12, box.width - w - 16),
      y: Math.max(12, box.height - h - 16)
    });
  }

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || placed.current) return;
    placed.current = true;
    parkBottomRight(el);
  }, []);

  function clampWidth(next: number, el: HTMLElement) {
    const box = parentBox(el);
    return Math.max(MIN_W, Math.min(box.width - pos.x - 8, next));
  }

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest('button, a, input, textarea, .session-test-pip__resize')) return;
    const el = ref.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    const box = parentBox(el);
    drag.current = { dx: e.clientX - box.left - pos.x, dy: e.clientY - box.top - pos.y };
  }

  function onResizeDown(e: React.PointerEvent) {
    e.stopPropagation();
    const el = ref.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    resize.current = { startX: e.clientX, startW: width };
  }

  function onPointerMove(e: React.PointerEvent) {
    const el = ref.current;
    if (!el) return;
    if (resize.current) {
      const next = clampWidth(resize.current.startW + (e.clientX - resize.current.startX), el);
      setWidth(next);
      return;
    }
    if (!drag.current) return;
    const box = parentBox(el);
    const w = el.offsetWidth || width;
    const h = el.offsetHeight || 160;
    const x = Math.max(8, Math.min(box.width - w - 8, e.clientX - box.left - drag.current.dx));
    const y = Math.max(8, Math.min(box.height - h - 8, e.clientY - box.top - drag.current.dy));
    setPos({ x, y });
  }

  function onPointerUp() {
    drag.current = null;
    resize.current = null;
  }

  return (
    <div
      ref={ref}
      className="session-test-pip"
      style={{ left: pos.x, top: pos.y, width }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {typeof children === 'function' ? children(width) : children}
      <button
        type="button"
        className="session-test-pip__resize"
        aria-label="Изменить ширину островка"
        title="Потяните, чтобы изменить ширину"
        onPointerDown={onResizeDown}
      />
    </div>
  );
}
