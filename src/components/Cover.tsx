import { NoteIcon } from './Icons';

export function Cover({ url, className }: { url?: string; className: string }) {
  return (
    <span className={`cover ${className}`}>
      {url ? <img src={url} alt="" loading="lazy" decoding="async" /> : <NoteIcon className="cover-fallback" />}
    </span>
  );
}
