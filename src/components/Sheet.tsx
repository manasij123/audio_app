import { useEffect, useId, useRef, type ReactNode } from 'react';
import { CloseIcon } from './Icons';

interface Props {
  title: ReactNode;
  onClose(): void;
  children: ReactNode;
  /** Extra class on the panel (e.g. for a taller sheet). */
  className?: string;
}

/** Bottom sheet dialog: closes on backdrop tap, Escape, or the close button. */
export function Sheet({ title, onClose, children, className = '' }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current;
    first?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close.current();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      previous?.focus?.({ preventScroll: true });
    };
  }, []);

  return (
    <div className="sheet-root">
      <div className="sheet-backdrop" onClick={onClose} />
      <div ref={panel} className={`sheet ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="sheet-grip" aria-hidden />
        <div className="sheet-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
