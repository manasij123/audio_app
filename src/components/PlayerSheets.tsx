import { useState } from 'react';
import { getEngine, useEngine } from '../lib/engine';
import { formatDuration, formatRate, formatTime } from '../lib/format';
import type { Settings } from '../lib/settings';
import type { Bookmark, Chapter, Track } from '../lib/types';
import { Cover } from './Cover';
import { ArrowDownIcon, ArrowUpIcon, CloseIcon, EditIcon, PlayIcon, TrashIcon } from './Icons';
import { Sheet } from './Sheet';

const SPEED_PRESETS = [0.75, 1, 1.25, 1.5, 1.75, 2];

export function SpeedSheet({ onClose, onChange }: { onClose(): void; onChange(rate: number): void }) {
  const rate = useEngine((s) => s.rate);
  const set = (r: number) => onChange(Math.round(Math.max(0.5, Math.min(3, r)) * 100) / 100);
  return (
    <Sheet title="গতি · Playback speed" onClose={onClose}>
      <div className="speed-readout">
        <button type="button" className="round-btn" onClick={() => set(rate - 0.05)} aria-label="Slower">
          −
        </button>
        <output htmlFor="speed-range" aria-live="polite">
          {formatRate(rate)}
        </output>
        <button type="button" className="round-btn" onClick={() => set(rate + 0.05)} aria-label="Faster">
          +
        </button>
      </div>
      <input id="speed-range" type="range" className="slider" min={0.5} max={3} step={0.05} value={rate} onChange={(e) => set(Number(e.target.value))} aria-label="Playback speed" />
      <div className="scale-labels" aria-hidden>
        <span>0.5×</span>
        <span>1×</span>
        <span>2×</span>
        <span>3×</span>
      </div>
      <div className="chip-row">
        {SPEED_PRESETS.map((r) => (
          <button key={r} type="button" className={`chip${rate === r ? ' on' : ''}`} onClick={() => set(r)} data-autofocus={rate === r || undefined}>
            {formatRate(r)}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

const SLEEP_MINUTES = [5, 10, 15, 30, 45, 60, 90];

export function SleepSheet({ settings, onClose, onSettings }: { settings: Settings; onClose(): void; onSettings(p: Partial<Settings>): void }) {
  const engine = getEngine();
  const sleep = useEngine((s) => s.sleep);
  const remaining = useEngine((s) => s.sleepRemaining);
  const start = (m: number | 'track') => {
    engine.setSleep(m === 'track' ? 'track' : { minutes: m });
    if (m !== 'track') onSettings({ lastSleepMinutes: m });
    onClose();
  };
  return (
    <Sheet title="ঘুমের টাইমার · Sleep timer" onClose={onClose}>
      {sleep && (
        <div className="sleep-active">
          <div>
            <strong>{sleep.kind === 'track' ? 'এই পর্ব শেষ হলে থামবে' : `${formatTime(remaining)} পরে থামবে`}</strong>
            <small>{sleep.kind === 'track' ? 'Stops at the end of this episode' : 'Counts down only while playing, fades out at the end'}</small>
          </div>
          <div className="row-actions">
            {sleep.kind === 'minutes' && (
              <button type="button" className="btn" onClick={() => engine.extendSleep(5)}>
                +5 মিনিট
              </button>
            )}
            <button type="button" className="btn ghost" onClick={() => engine.setSleep(null)}>
              বন্ধ করুন · Off
            </button>
          </div>
        </div>
      )}
      <div className="option-grid">
        {SLEEP_MINUTES.map((m) => (
          <button key={m} type="button" className={`option${settings.lastSleepMinutes === m ? ' suggested' : ''}`} onClick={() => start(m)}>
            <strong>{m}</strong>
            <span>মিনিট</span>
          </button>
        ))}
        <button type="button" className="option wide" onClick={() => start('track')}>
          <strong>পর্ব শেষে</strong>
          <span>End of episode</span>
        </button>
      </div>
      <label className="switch-row">
        <input id="shake-extend" type="checkbox" checked={settings.shakeToExtend} onChange={(e) => onSettings({ shakeToExtend: e.target.checked })} />
        <span>
          ঝাঁকালে +৫ মিনিট
          <small>Shake the phone to add 5 minutes while the timer runs</small>
        </span>
      </label>
    </Sheet>
  );
}

const BOOSTS = [
  { value: 1, label: 'বন্ধ' },
  { value: 1.5, label: '1.5×' },
  { value: 2, label: '2×' },
  { value: 3, label: '3×' },
];

export function EffectsControls({ settings, savedSeconds, onSettings }: { settings: Settings; savedSeconds: number; onSettings(p: Partial<Settings>): void }) {
  return (
    <>
      <div className="setting-block">
        <div className="setting-label">
          ভলিউম বুস্ট
          <small>Volume boost for quiet recordings (with a limiter to avoid distortion)</small>
        </div>
        <div className="segmented" role="radiogroup" aria-label="Volume boost">
          {BOOSTS.map((b) => (
            <button key={b.value} type="button" role="radio" aria-checked={settings.boost === b.value} className={settings.boost === b.value ? 'on' : ''} onClick={() => onSettings({ boost: b.value })}>
              {b.label}
            </button>
          ))}
        </div>
      </div>
      <label className="switch-row">
        <input id="skip-silence" type="checkbox" checked={settings.skipSilence} onChange={(e) => onSettings({ skipSilence: e.target.checked })} />
        <span>
          নীরবতা এড়িয়ে যান · Skip silence
          <small>Speeds through silent gaps. {savedSeconds > 60 ? `Saved you ${formatDuration(savedSeconds)} so far.` : ''}</small>
        </span>
      </label>
      <label className="switch-row">
        <input id="voice-clarity" type="checkbox" checked={settings.voiceClarity} onChange={(e) => onSettings({ voiceClarity: e.target.checked })} />
        <span>
          কণ্ঠ স্পষ্ট · Voice clarity
          <small>Cuts low rumble and lifts speech frequencies — good for old radio recordings</small>
        </span>
      </label>
    </>
  );
}

export function EffectsSheet(props: { settings: Settings; savedSeconds: number; onClose(): void; onSettings(p: Partial<Settings>): void }) {
  return (
    <Sheet title="সাউন্ড · Sound" onClose={props.onClose}>
      <EffectsControls {...props} />
    </Sheet>
  );
}

export function QueueSheet({
  queue,
  tracks,
  coverUrls,
  onClose,
  onPlay,
  onMove,
  onRemove,
  onClear,
}: {
  queue: string[];
  tracks: Map<string, Track>;
  coverUrls: ReadonlyMap<string, string>;
  onClose(): void;
  onPlay(id: string): void;
  onMove(index: number, delta: number): void;
  onRemove(id: string): void;
  onClear(): void;
}) {
  const items = queue.map((id) => tracks.get(id)).filter((t): t is Track => !!t);
  return (
    <Sheet title="পরের তালিকা · Up next" onClose={onClose}>
      {items.length === 0 ? (
        <p className="empty-note">তালিকা খালি। কোনো পর্বের ⋯ মেনু থেকে “এর পরে চালান” বা “তালিকায় যোগ করুন” বেছে নিন। খালি থাকলে লাইব্রেরির ক্রম অনুযায়ী পরের পর্ব চলবে।</p>
      ) : (
        <>
          <ol className="queue-list">
            {items.map((t, i) => (
              <li key={t.id}>
                <button type="button" className="queue-main" onClick={() => onPlay(t.id)}>
                  <Cover url={coverUrls.get(t.id)} title={t.title} size="xs" />
                  <span>{t.title}</span>
                </button>
                <button type="button" className="icon-btn" onClick={() => onMove(i, -1)} disabled={i === 0} aria-label={`Move ${t.title} up`}>
                  <ArrowUpIcon />
                </button>
                <button type="button" className="icon-btn" onClick={() => onMove(i, 1)} disabled={i === items.length - 1} aria-label={`Move ${t.title} down`}>
                  <ArrowDownIcon />
                </button>
                <button type="button" className="icon-btn" onClick={() => onRemove(t.id)} aria-label={`Remove ${t.title} from queue`}>
                  <CloseIcon />
                </button>
              </li>
            ))}
          </ol>
          <button type="button" className="btn ghost" onClick={onClear}>
            তালিকা খালি করুন · Clear queue
          </button>
        </>
      )}
    </Sheet>
  );
}

export function ChaptersSheet({ chapters, onClose }: { chapters: Chapter[]; onClose(): void }) {
  const engine = getEngine();
  const time = useEngine((s) => Math.floor(s.time));
  const current = chapters.findLastIndex((c) => c.start <= time + 0.5);
  return (
    <Sheet title="অধ্যায় · Chapters" onClose={onClose}>
      <ol className="chapter-list">
        {chapters.map((c, i) => (
          <li key={i}>
            <button type="button" className={i === current ? 'on' : ''} onClick={() => engine.seek(c.start)} data-autofocus={i === current || undefined}>
              <span className="ch-no">{i + 1}</span>
              <span className="ch-title">{c.title}</span>
              <span className="ch-time">{formatTime(c.start)}</span>
            </button>
          </li>
        ))}
      </ol>
    </Sheet>
  );
}

export function TrackBookmarksSheet({
  track,
  bookmarks,
  onClose,
  onAdd,
  onEdit,
  onDelete,
  onJump,
}: {
  track: Track;
  bookmarks: Bookmark[];
  onClose(): void;
  onAdd(time: number, note: string): void;
  onEdit(id: string, note: string): void;
  onDelete(id: string): void;
  onJump(b: Bookmark): void;
}) {
  const time = useEngine((s) => s.time);
  const current = useEngine((s) => s.trackId === track.id);
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const sorted = [...bookmarks].sort((a, b) => a.time - b.time);

  return (
    <Sheet title={`বুকমার্ক · ${track.title}`} onClose={onClose}>
      {current && (
        <form
          className="bm-add"
          onSubmit={(e) => {
            e.preventDefault();
            onAdd(time, note.trim());
            setNote('');
          }}
        >
          <label className="field grow">
            <span>{formatTime(time)}-এ নোট (ঐচ্ছিক) · Note</span>
            <input id="bookmark-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="যেমন: ফেলুদার প্রথম সূত্র" maxLength={200} />
          </label>
          <button type="submit" className="btn primary">
            যোগ করুন
          </button>
        </form>
      )}
      {sorted.length === 0 ? (
        <p className="empty-note">এই পর্বে কোনো বুকমার্ক নেই। No bookmarks in this episode yet.</p>
      ) : (
        <ul className="bm-list">
          {sorted.map((b) => (
            <li key={b.id}>
              {editing === b.id ? (
                <form
                  className="bm-edit"
                  onSubmit={(e) => {
                    e.preventDefault();
                    onEdit(b.id, editText.trim());
                    setEditing(null);
                  }}
                >
                  <input id={`bm-edit-${b.id}`} data-autofocus value={editText} onChange={(e) => setEditText(e.target.value)} maxLength={200} aria-label="Bookmark note" autoFocus />
                  <button type="submit" className="btn primary sm">
                    সেভ
                  </button>
                </form>
              ) : (
                <>
                  <button type="button" className="bm-main" onClick={() => onJump(b)}>
                    <span className="bm-time">
                      <PlayIcon /> {formatTime(b.time)}
                    </span>
                    <span className="bm-note">{b.note || <em>নোট নেই</em>}</span>
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => {
                      setEditing(b.id);
                      setEditText(b.note);
                    }}
                    aria-label="Edit note"
                  >
                    <EditIcon />
                  </button>
                  <button type="button" className="icon-btn" onClick={() => onDelete(b.id)} aria-label="Delete bookmark">
                    <TrashIcon />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
