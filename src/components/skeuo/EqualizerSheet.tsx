import { EQ_BANDS, EQ_LABELS, EQ_MAX, EQ_MIN, EQ_PRESETS, FLAT, presetFor } from '../../lib/eq';
import { Sheet } from '../Sheet';

/** Hardware-style graphic equaliser: one fader per band plus preset keys. */
export function EqualizerSheet({ gains, onChange, onClose }: { gains: number[]; onChange(gains: number[]): void; onClose(): void }) {
  const preset = presetFor(gains);
  const setBand = (i: number, v: number) => onChange(gains.map((g, j) => (j === i ? v : g)));

  return (
    <Sheet title="ইকুয়ালাইজার · Equalizer" onClose={onClose} className="skeuo-sheet">
      <div className="eq-panel">
        <div className="eq-scale" aria-hidden>
          <span>+12</span>
          <span>0</span>
          <span>−12</span>
        </div>
        {EQ_BANDS.map((hz, i) => (
          <div key={hz} className="eq-band">
            <span className={`eq-db${gains[i] > 0 ? ' up' : gains[i] < 0 ? ' down' : ''}`}>
              {gains[i] > 0 ? '+' : ''}
              {gains[i]}
            </span>
            <div className="fader-slot">
              <input
                id={`eq-${hz}`}
                type="range"
                className="fader"
                min={EQ_MIN}
                max={EQ_MAX}
                step={1}
                value={gains[i]}
                onChange={(e) => setBand(i, Number(e.target.value))}
                onDoubleClick={() => setBand(i, 0)}
                aria-label={`${EQ_LABELS[i]} Hz`}
                aria-valuetext={`${gains[i]} dB`}
              />
            </div>
            <span className="eq-hz">{EQ_LABELS[i]}</span>
          </div>
        ))}
      </div>
      <div className="eq-presets" role="radiogroup" aria-label="Presets">
        {EQ_PRESETS.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={preset?.id === p.id} className={`hw-key sm${preset?.id === p.id ? ' on' : ''}`} onClick={() => onChange(p.gains)}>
            <span className="led" aria-hidden />
            {p.name}
          </button>
        ))}
      </div>
      <p className="eq-note">{preset ? `প্রিসেট: ${preset.name}` : 'নিজের সেটিং'} · ফেডারে ডাবল-ট্যাপ করলে ০ dB · সেটিং এই প্রোফাইলে সেভ থাকে</p>
      {!presetFor(gains) || preset?.id !== 'flat' ? (
        <button type="button" className="hw-key sm wide" onClick={() => onChange(FLAT)}>
          রিসেট · Flat
        </button>
      ) : null}
    </Sheet>
  );
}
