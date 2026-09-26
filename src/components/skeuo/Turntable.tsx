import { Cover } from '../Cover';

/**
 * A record on a platter with the cover art as its label. The record spins while
 * playing and the tonearm swings onto it; both come to rest on pause.
 */
export function Turntable({ coverUrl, title, playing }: { coverUrl?: string; title: string; playing: boolean }) {
  return (
    <div className={`turntable${playing ? ' playing' : ''}`}>
      <div className="platter">
        <div className="record">
          <div className="record-label">
            <Cover url={coverUrl} title={title} size="lg" />
          </div>
          <span className="spindle" />
        </div>
        <span className="record-sheen" aria-hidden />
      </div>
      <div className="tonearm" aria-hidden>
        <span className="arm-base" />
        <span className="arm-rod" />
        <span className="arm-head" />
      </div>
    </div>
  );
}
