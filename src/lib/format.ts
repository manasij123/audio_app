export function formatTime(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return '--:--';
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** "1 ঘ 20 মি" style compact duration for stats and time-left labels. */
export function formatDuration(sec: number): string {
  const m = Math.round(sec / 60);
  if (m < 1) return sec >= 1 ? `${Math.round(sec)}s` : '0m';
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

export function formatBytes(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  if (gb >= 0.1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / 1024 ** 2;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

export function formatRate(r: number): string {
  return `${Number(r.toFixed(2))}×`;
}

const rtf = typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }) : null;

export function formatAgo(ts: number, now = Date.now()): string {
  const diff = (ts - now) / 1000;
  const abs = Math.abs(diff);
  if (!rtf) return new Date(ts).toLocaleDateString();
  if (abs < 60) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return new Date(ts).toLocaleDateString();
}
