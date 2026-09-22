import type { CSSProperties } from 'react';
import { hashHue, initialOf } from '../lib/art';

interface Props {
  url?: string;
  title: string;
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

/** Embedded cover art, or a generated tile (colour from the title, first letter large). */
export function Cover({ url, title, size, className = '' }: Props) {
  if (url) {
    return (
      <span className={`cover cover-${size} ${className}`}>
        <img src={url} alt="" loading="lazy" decoding="async" />
      </span>
    );
  }
  const hue = hashHue(title);
  return (
    <span className={`cover cover-${size} cover-gen ${className}`} style={{ '--h': hue } as CSSProperties} aria-hidden>
      <span className="cover-letter">{initialOf(title)}</span>
    </span>
  );
}
