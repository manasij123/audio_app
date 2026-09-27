import { useEffect, useState } from 'react';
import { subscribeCatalog, type CatalogTrack } from '../lib/catalog';
import { describeAuthError } from '../lib/firebase';

/** Live story catalogue from the server (cached by Firestore for offline browsing). */
export function useCatalog(isAdmin: boolean) {
  const [tracks, setTracks] = useState<CatalogTrack[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setTracks(null);
    return subscribeCatalog(
      isAdmin,
      (t) => {
        setTracks(t);
        setError(null);
      },
      (e) => {
        console.warn('[shruti] catalogue', e);
        setError(describeAuthError(e));
        setTracks((cur) => cur ?? []);
      },
    );
  }, [isAdmin]);
  return { tracks, error };
}
