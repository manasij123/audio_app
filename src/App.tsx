import { useEffect, useState } from 'react';
import { AuthGate, type Account } from './components/AuthGate';
import { hashHue } from './lib/art';
import { openLibraryStore, type LibraryStore } from './lib/db';
import type { Profile } from './lib/types';
import { Shell } from './Shell';

/** The listener's account seen as a local "profile" (keys their settings, queue and cached progress). */
function profileFor(a: Account): Profile {
  return {
    id: a.user.uid,
    name: a.user.name,
    hue: hashHue(a.user.uid),
    pinHash: null,
    pinSalt: null,
    createdAt: 0,
    google: { uid: a.user.uid, email: a.user.email, name: a.user.name, photoURL: a.user.photoURL },
  };
}

export default function App() {
  const [opened, setOpened] = useState<{ store: LibraryStore; error: unknown } | null>(null);

  useEffect(() => {
    let cancelled = false;
    openLibraryStore().then((r) => !cancelled && setOpened(r));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {/* Slow-drifting glows behind everything; the frosted-glass surfaces blur them. */}
      <div className="ambient" aria-hidden>
        <i />
        <i />
        <i />
      </div>
      {!opened ? (
        <div className="gate" aria-busy="true" />
      ) : (
        <AuthGate>
          {(account) => <Shell key={account.user.uid} store={opened.store} profile={profileFor(account)} account={account} storageError={opened.error} />}
        </AuthGate>
      )}
    </>
  );
}
