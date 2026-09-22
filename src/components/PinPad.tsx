import { useEffect, useState } from 'react';
import { CloseIcon } from './Icons';

interface Props {
  /** Resolve true when the PIN is accepted. */
  onSubmit(pin: string): Promise<boolean>;
  length?: number;
  /** Shown under the dots after a failed attempt. */
  errorText?: string;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
const LOCKOUT_AFTER = 5;
const LOCKOUT_MS = 30_000;

/** Numeric keypad for entering a profile PIN; also accepts the physical keyboard. */
export function PinPad({ onSubmit, length = 4, errorText = 'ভুল PIN · Wrong PIN' }: Props) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [fails, setFails] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  const locked = lockedUntil > now;
  useEffect(() => {
    if (!locked) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [locked]);

  const press = (k: string) => {
    if (busy || locked) return;
    setError(false);
    if (k === 'del') setPin((p) => p.slice(0, -1));
    else if (pin.length < length) {
      const next = pin + k;
      setPin(next);
      if (next.length === length) void submit(next);
    }
  };

  const submit = async (value: string) => {
    setBusy(true);
    const ok = await onSubmit(value);
    setBusy(false);
    if (ok) return;
    setPin('');
    setError(true);
    navigator.vibrate?.([40, 60, 40]);
    const f = fails + 1;
    setFails(f);
    if (f % LOCKOUT_AFTER === 0) {
      setLockedUntil(Date.now() + LOCKOUT_MS);
      setNow(Date.now());
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="pinpad">
      <div className={`pin-dots${error ? ' shake' : ''}`} role="status" aria-live="polite" aria-label={`${pin.length} of ${length} digits entered`}>
        {Array.from({ length }, (_, i) => (
          <span key={i} className={i < pin.length ? 'on' : ''} />
        ))}
      </div>
      <p className="pin-msg">{locked ? `অনেকবার ভুল হয়েছে · Too many tries. Wait ${Math.ceil((lockedUntil - now) / 1000)}s` : error ? errorText : ' '}</p>
      <div className="pin-keys">
        {KEYS.map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button key={i} type="button" className={`pin-key${k === 'del' ? ' del' : ''}`} onClick={() => press(k)} disabled={busy || locked} aria-label={k === 'del' ? 'Delete digit' : k}>
              {k === 'del' ? <CloseIcon /> : k}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
