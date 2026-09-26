import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';

const MIN = 0;
const MAX = 300;
const SWEEP = 270; // degrees from 0% to 300%

/**
 * A rotary volume knob, 0–300%. Drag up/down (or around), use the mouse wheel,
 * or arrow keys; double-click resets to 100%. The pointer sweeps 270°.
 */
export function VolumeKnob({ value, onChange }: { value: number; onChange(percent: number): void }) {
  const drag = useRef<{ y: number; start: number } | null>(null);
  const clamp = (v: number) => Math.round(Math.max(MIN, Math.min(MAX, v)) / 5) * 5;
  const angle = -SWEEP / 2 + (value / MAX) * SWEEP;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, start: value };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    // 1px of vertical drag = 1.5%.
    onChange(clamp(drag.current.start + (drag.current.y - e.clientY) * 1.5));
  };
  const end = () => (drag.current = null);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 25 : 5;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') onChange(clamp(value + step));
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') onChange(clamp(value - step));
    else if (e.key === 'Home') onChange(MIN);
    else if (e.key === 'End') onChange(MAX);
    else return;
    e.preventDefault();
  };

  return (
    <div className="knob-wrap">
      <div className="knob-dial" aria-hidden>
        {Array.from({ length: 13 }, (_, i) => (
          <i key={i} className={i * 25 <= value ? 'lit' : ''} style={{ '--a': `${-SWEEP / 2 + (i / 12) * SWEEP}deg` } as CSSProperties} />
        ))}
      </div>
      <div
        className="knob"
        role="slider"
        tabIndex={0}
        aria-label="Volume"
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={value}
        aria-valuetext={`${value}%`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        onWheel={(e) => onChange(clamp(value + (e.deltaY < 0 ? 5 : -5)))}
        onKeyDown={onKeyDown}
        onDoubleClick={() => onChange(100)}
      >
        <div className="knob-cap" style={{ transform: `rotate(${angle}deg)` }}>
          <span className="knob-mark" />
        </div>
      </div>
      <div className={`knob-led${value > 100 ? ' hot' : ''}`}>{value}%</div>
      <div className="knob-label">ভলিউম</div>
    </div>
  );
}
