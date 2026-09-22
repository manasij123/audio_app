import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { describeCloudError, getCloudConfig, signInWithGoogle } from '../lib/cloud';
import type { LibraryStore } from '../lib/db';
import { hashPin, pinSupported, verifyPin } from '../lib/pin';
import type { GoogleLink, Profile } from '../lib/types';
import { Avatar } from './Avatar';
import { GoogleIcon, LockIcon, PlusIcon } from './Icons';
import { LogoWithVerse } from './Verse';
import { PinPad } from './PinPad';

const SESSION_KEY = 'shruti.session';
export const PIN_LENGTH = 4;

export interface ProfileApi {
  profiles: Profile[];
  save(p: Profile): Promise<void>;
  remove(id: string): Promise<void>;
  /** Back to the "who's listening" screen. */
  switchProfile(): void;
  /** Same as switch, but says "locked". */
  lock(): void;
}

function sessionGet(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}
function sessionSet(id: string | null) {
  try {
    if (id) sessionStorage.setItem(SESSION_KEY, id);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** Avatar hues that sit well with the red/black brand (reds, crimsons, purples, blues). */
const AVATAR_HUES = [352, 8, 18, 330, 300, 270, 235, 210];
const randomHue = () => AVATAR_HUES[Math.floor(Math.random() * AVATAR_HUES.length)];
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

type View = { kind: 'pick' } | { kind: 'pin'; profile: Profile } | { kind: 'create'; google?: GoogleLink };

/**
 * Profiles ("who's listening?") with optional 4-digit PIN locks, plus
 * optional Google sign-in. Renders `children` for the unlocked profile.
 */
export function ProfileGate({ store, children }: { store: LibraryStore; children: (profile: Profile, api: ProfileApi) => ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: 'pick' });
  const [notice, setNotice] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);

  const refresh = useCallback(async () => {
    const list = (await store.listProfiles()).sort((a, b) => a.createdAt - b.createdAt);
    setProfiles(list);
    return list;
  }, [store]);

  // First load: restore this tab's session, or skip the picker when there is a single unlocked profile.
  useEffect(() => {
    refresh().then((list) => {
      const remembered = list.find((p) => p.id === sessionGet());
      if (remembered) setActiveId(remembered.id);
      else if (list.length === 1 && !list[0].pinHash) enter(list[0]);
      else if (list.length === 0) setView({ kind: 'create' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  const enter = (p: Profile) => {
    sessionSet(p.id);
    setActiveId(p.id);
    setView({ kind: 'pick' });
    setNotice(null);
  };

  const choose = (p: Profile) => (p.pinHash ? setView({ kind: 'pin', profile: p }) : enter(p));

  const api: ProfileApi = {
    profiles: profiles ?? [],
    save: async (p) => {
      await store.putProfile(p);
      await refresh();
    },
    remove: async (id) => {
      await store.deleteProfile(id);
      const list = await refresh();
      if (id === activeId) {
        sessionSet(null);
        setActiveId(null);
        setView(list.length ? { kind: 'pick' } : { kind: 'create' });
      }
    },
    switchProfile: () => {
      sessionSet(null);
      setActiveId(null);
      setView({ kind: 'pick' });
    },
    lock: () => {
      sessionSet(null);
      setActiveId(null);
      setView({ kind: 'pick' });
      setNotice('লক করা হয়েছে · Locked');
    },
  };

  const googleSignIn = async () => {
    setGoogleBusy(true);
    setNotice(null);
    try {
      const link = await signInWithGoogle();
      const existing = (profiles ?? []).find((p) => p.google?.uid === link.uid);
      if (existing) {
        const updated = { ...existing, google: link };
        await store.putProfile(updated);
        await refresh();
        choose(updated);
      } else setView({ kind: 'create', google: link });
    } catch (e) {
      setNotice(describeCloudError(e));
    } finally {
      setGoogleBusy(false);
    }
  };

  if (!profiles) return <div className="gate" aria-busy="true" />;

  const active = profiles.find((p) => p.id === activeId);
  if (active) return <>{children(active, api)}</>;

  const cloud = getCloudConfig() != null;

  return (
    <div className="gate">
      <div className="gate-brand">
        <LogoWithVerse />
      </div>

      {view.kind === 'pick' && (
        <section className="gate-card">
          <h1>কে শুনছেন?</h1>
          <p className="gate-sub">Who’s listening? Each profile keeps its own progress, favourites and bookmarks.</p>
          <div className="profile-grid">
            {profiles.map((p) => (
              <button key={p.id} type="button" className="profile-tile" onClick={() => choose(p)}>
                <Avatar profile={p} size={72} />
                <span className="profile-name">{p.name}</span>
                {p.pinHash && (
                  <span className="profile-lock" aria-label="PIN protected">
                    <LockIcon />
                  </span>
                )}
              </button>
            ))}
            <button type="button" className="profile-tile add" onClick={() => setView({ kind: 'create' })}>
              <span className="avatar add-avatar" style={{ width: 72, height: 72 }}>
                <PlusIcon />
              </span>
              <span className="profile-name">নতুন প্রোফাইল</span>
            </button>
          </div>
          {cloud && (
            <button type="button" className="btn google" onClick={googleSignIn} disabled={googleBusy}>
              <GoogleIcon /> {googleBusy ? 'Signing in…' : 'Google দিয়ে সাইন ইন'}
            </button>
          )}
          {notice && <p className="gate-notice">{notice}</p>}
        </section>
      )}

      {view.kind === 'pin' && (
        <section className="gate-card">
          <Avatar profile={view.profile} size={72} />
          <h1>{view.profile.name}</h1>
          <p className="gate-sub">PIN দিন · Enter your PIN</p>
          <PinPad
            length={PIN_LENGTH}
            onSubmit={async (pin) => {
              const ok = await verifyPin(pin, view.profile.pinHash!, view.profile.pinSalt!);
              if (ok) enter(view.profile);
              return ok;
            }}
          />
          <div className="gate-actions">
            <button type="button" className="btn ghost" onClick={() => setView({ kind: 'pick' })}>
              অন্য প্রোফাইল · Other profile
            </button>
            {cloud && view.profile.google && (
              <ForgotPinWithGoogle
                profile={view.profile}
                onReset={async (p) => {
                  await store.putProfile(p);
                  await refresh();
                  enter(p);
                }}
                onError={setNotice}
              />
            )}
          </div>
          {notice && <p className="gate-notice">{notice}</p>}
        </section>
      )}

      {view.kind === 'create' && (
        <CreateProfile
          google={view.google}
          first={profiles.length === 0}
          onCancel={profiles.length ? () => setView({ kind: 'pick' }) : undefined}
          onCreate={async (p) => {
            await store.putProfile(p);
            await refresh();
            enter(p);
          }}
          onGoogle={cloud && !view.google ? googleSignIn : undefined}
        />
      )}

    </div>
  );
}

function ForgotPinWithGoogle({ profile, onReset, onError }: { profile: Profile; onReset(p: Profile): void; onError(msg: string): void }) {
  return (
    <button
      type="button"
      className="btn ghost"
      onClick={async () => {
        try {
          const link = await signInWithGoogle();
          if (link.uid !== profile.google?.uid) {
            onError('অন্য Google অ্যাকাউন্ট · That is a different Google account than the one linked to this profile.');
            return;
          }
          onReset({ ...profile, google: link, pinHash: null, pinSalt: null });
        } catch (e) {
          onError(describeCloudError(e));
        }
      }}
    >
      PIN ভুলে গেছেন? · Forgot PIN (Google)
    </button>
  );
}

function CreateProfile({
  google,
  first,
  onCancel,
  onCreate,
  onGoogle,
}: {
  google?: GoogleLink;
  first: boolean;
  onCancel?(): void;
  onCreate(p: Profile): Promise<void>;
  onGoogle?(): void;
}) {
  const [name, setName] = useState(google?.name ?? '');
  const [hue] = useState(randomHue);
  const [usePin, setUsePin] = useState(false);
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return setError('একটা নাম দিন · Enter a name');
    let pinHash: string | null = null;
    let pinSalt: string | null = null;
    if (usePin) {
      if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)) return setError(`PIN হবে ${PIN_LENGTH} সংখ্যার · PIN must be ${PIN_LENGTH} digits`);
      if (pin !== pin2) return setError('দুটো PIN মিলছে না · The PINs don’t match');
      ({ hash: pinHash, salt: pinSalt } = await hashPin(pin));
    }
    setBusy(true);
    await onCreate({ id: newId(), name: clean, hue, pinHash, pinSalt, createdAt: Date.now(), google: google ?? null });
    setBusy(false);
  };

  return (
    <form className="gate-card" onSubmit={submit}>
      <Avatar profile={{ name: name || '?', hue, google: google ?? null }} size={72} />
      <h1>{first ? 'স্বাগতম!' : 'নতুন প্রোফাইল'}</h1>
      <p className="gate-sub">{first ? 'Welcome to Shruti. Create a profile to start your library.' : 'Add someone else who listens on this device.'}</p>
      <label className="field">
        <span>নাম · Name</span>
        <input id="profile-name" data-autofocus value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="nickname" />
      </label>
      {pinSupported() && (
        <label className="switch-row">
          <input id="profile-use-pin" type="checkbox" checked={usePin} onChange={(e) => setUsePin(e.target.checked)} />
          <span>
            PIN দিয়ে লক করুন
            <small>Lock this profile with a {PIN_LENGTH}-digit PIN</small>
          </span>
        </label>
      )}
      {usePin && (
        <div className="pin-fields">
          <label className="field">
            <span>PIN</span>
            <input id="profile-pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={PIN_LENGTH} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
          </label>
          <label className="field">
            <span>আবার PIN · Confirm</span>
            <input id="profile-pin2" type="password" inputMode="numeric" autoComplete="new-password" maxLength={PIN_LENGTH} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} />
          </label>
        </div>
      )}
      {google && <p className="gate-sub small">Linked to Google: {google.email}</p>}
      {error && <p className="gate-notice">{error}</p>}
      <button type="submit" className="btn primary wide" disabled={busy}>
        শুরু করুন · Continue
      </button>
      {onGoogle && (
        <button type="button" className="btn google wide" onClick={onGoogle}>
          <GoogleIcon /> Google দিয়ে সাইন ইন
        </button>
      )}
      {onCancel && (
        <button type="button" className="btn ghost" onClick={onCancel}>
          বাতিল · Cancel
        </button>
      )}
    </form>
  );
}
