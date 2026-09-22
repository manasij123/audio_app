import type { CSSProperties } from 'react';
import { initialOf } from '../lib/art';
import type { Profile } from '../lib/types';

export function Avatar({ profile, size = 40 }: { profile: Pick<Profile, 'name' | 'hue' | 'google'>; size?: number }) {
  const photo = profile.google?.photoURL;
  return (
    <span className="avatar" style={{ '--h': profile.hue, width: size, height: size, fontSize: size * 0.42 } as CSSProperties} aria-hidden>
      {photo ? <img src={photo} alt="" referrerPolicy="no-referrer" /> : initialOf(profile.name)}
    </span>
  );
}
