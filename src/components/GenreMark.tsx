import type { CSSProperties } from 'react';
import type { GenreId } from '../lib/genres';
import { AtomIcon, CompassIcon, GhostIcon, KnifeIcon, MagnifierIcon } from './Icons';

const ICONS = { mystery: MagnifierIcon, thriller: KnifeIcon, horror: GhostIcon, adventure: CompassIcon, scifi: AtomIcon };
/** Each genre's tint hue, kept dark and muted so they sit inside the red/black brand. */
export const GENRE_HUE: Record<GenreId, number> = { mystery: 225, thriller: 350, horror: 5, adventure: 32, scifi: 185 };

export function GenreIcon({ id, className }: { id: GenreId; className?: string }) {
  const Icon = ICONS[id];
  return <Icon className={className} />;
}

export const genreStyle = (id: GenreId) => ({ '--gh': GENRE_HUE[id] }) as CSSProperties;
