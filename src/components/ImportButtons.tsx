import { useShell } from '../shellContext';
import { FolderIcon, PlusIcon } from './Icons';

export function ImportButtons({ compact = false }: { compact?: boolean }) {
  const { pickFolder, pickFiles, lib } = useShell();
  const busy = lib.progress != null;
  return (
    <div className={`import-actions${compact ? ' compact' : ''}`}>
      <button type="button" className="btn primary" onClick={pickFolder} disabled={busy}>
        <FolderIcon /> ফোল্ডার ইমপোর্ট
      </button>
      <button type="button" className="btn" onClick={pickFiles} disabled={busy}>
        <PlusIcon /> ফাইল যোগ
      </button>
    </div>
  );
}

export function ImportProgressBar() {
  const { lib } = useShell();
  const p = lib.progress;
  if (!p) return null;
  return (
    <div className="progress" role="status" aria-live="polite">
      <div className="progress-text">
        <span>
          ইমপোর্ট হচ্ছে {Math.min(p.done + 1, p.total)}/{p.total}
        </span>
        <span className="progress-file">{p.current}</span>
      </div>
      <div className="bar">
        <i style={{ width: `${(p.done / Math.max(1, p.total)) * 100}%` }} />
      </div>
    </div>
  );
}
