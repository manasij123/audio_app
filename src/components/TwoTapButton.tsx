import { useEffect, useRef, useState, type ReactNode } from 'react';

const WINDOW_MS = 4000;

/** A button that needs a second tap within a few seconds — in-page confirmation, no dialogs. */
export function TwoTapButton({ onConfirm, children, confirmLabel, className = 'btn danger', disabled }: { onConfirm(): void; children: ReactNode; confirmLabel: ReactNode; className?: string; disabled?: boolean }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      className={`${className}${armed ? ' confirm' : ''}`}
      disabled={disabled}
      onClick={() => {
        clearTimeout(timer.current);
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
          timer.current = window.setTimeout(() => setArmed(false), WINDOW_MS);
        }
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
