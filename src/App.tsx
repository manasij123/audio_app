import { useEffect, useState } from 'react';
import { ProfileGate } from './components/ProfileGate';
import { openLibraryStore, type LibraryStore } from './lib/db';
import { Shell } from './Shell';

export default function App() {
  const [opened, setOpened] = useState<{ store: LibraryStore; error: unknown } | null>(null);

  useEffect(() => {
    let cancelled = false;
    openLibraryStore().then((r) => !cancelled && setOpened(r));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!opened) return <div className="gate" aria-busy="true" />;

  return (
    <ProfileGate store={opened.store}>
      {(profile, api) => <Shell key={profile.id} store={opened.store} profile={profile} profiles={api} storageError={opened.error} />}
    </ProfileGate>
  );
}
