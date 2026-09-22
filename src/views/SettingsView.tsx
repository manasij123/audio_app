import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Avatar } from '../components/Avatar';
import { CloudIcon, DownloadIcon, EditIcon, GoogleIcon, LockIcon, UploadIcon } from '../components/Icons';
import { PinPad } from '../components/PinPad';
import { EffectsControls } from '../components/PlayerSheets';
import { PIN_LENGTH } from '../components/ProfileGate';
import { TwoTapButton } from '../components/TwoTapButton';
import { describeCloudError, getCloudConfig, isCloudConfigBuiltIn, setCloudConfig, signInWithGoogle, signOutGoogle } from '../lib/cloud';
import { isPersisted, requestPersistence, storageEstimate } from '../lib/db';
import { formatAgo, formatBytes, formatDuration } from '../lib/format';
import { hashPin, pinSupported, verifyPin } from '../lib/pin';
import type { ThemePref } from '../lib/settings';
import { mergeSync, type RemoteData } from '../lib/sync';
import { useShell } from '../shellContext';

const SKIP_BACK = [5, 10, 15, 30];
const SKIP_FORWARD = [10, 15, 30, 45, 60];
const THEMES: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'সিস্টেম' },
  { value: 'light', label: 'লাইট' },
  { value: 'dark', label: 'ডার্ক' },
];

function Section({ title, children, icon }: { title: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <section className="settings-section">
      <h2>
        {icon}
        {title}
      </h2>
      <div className="settings-card">{children}</div>
    </section>
  );
}

function Segmented<T extends string | number>({ label, value, options, onChange, format = String }: { label: string; value: T; options: T[]; onChange(v: T): void; format?: (v: T) => string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o)} type="button" role="radio" aria-checked={value === o} className={value === o ? 'on' : ''} onClick={() => onChange(o)}>
          {format(o)}
        </button>
      ))}
    </div>
  );
}

export function SettingsView() {
  const shell = useShell();
  const { profile, profiles, settings, updateSettings, lib, store, sync, toast } = shell;

  /* ---------------------------------------------------------- profile */
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(profile.name);
  const [pinMode, setPinMode] = useState<null | 'verify' | 'new' | 'confirm'>(null);
  const [pinAction, setPinAction] = useState<'set' | 'remove'>('set');
  const firstPin = useRef('');

  const startPin = (action: 'set' | 'remove') => {
    setPinAction(action);
    setPinMode(profile.pinHash ? 'verify' : 'new');
  };

  const onPin = async (pin: string): Promise<boolean> => {
    if (pinMode === 'verify') {
      const ok = await verifyPin(pin, profile.pinHash!, profile.pinSalt!);
      if (!ok) return false;
      if (pinAction === 'remove') {
        await profiles.save({ ...profile, pinHash: null, pinSalt: null });
        setPinMode(null);
        toast('PIN সরানো হয়েছে · PIN removed');
      } else setPinMode('new');
      return true;
    }
    if (pinMode === 'new') {
      firstPin.current = pin;
      setPinMode('confirm');
      return true;
    }
    if (pin !== firstPin.current) {
      setPinMode('new');
      toast('দুটো PIN মিলল না, আবার দিন · PINs didn’t match, try again');
      return false;
    }
    const { hash, salt } = await hashPin(pin);
    await profiles.save({ ...profile, pinHash: hash, pinSalt: salt });
    setPinMode(null);
    toast('PIN সেট হয়েছে · PIN set');
    return true;
  };

  /* ------------------------------------------------------------ cloud */
  const cloudReady = getCloudConfig() != null;
  const [configText, setConfigText] = useState('');
  const [configError, setConfigError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  const linkGoogle = async () => {
    setLinking(true);
    try {
      const link = await signInWithGoogle();
      const other = profiles.profiles.find((p) => p.id !== profile.id && p.google?.uid === link.uid);
      if (other) {
        toast(`এই Google অ্যাকাউন্ট “${other.name}” প্রোফাইলে যুক্ত · Already linked to another profile`);
        return;
      }
      await profiles.save({ ...profile, google: link });
      toast('Google যুক্ত হয়েছে, sync শুরু হচ্ছে · Linked, syncing…');
    } catch (e) {
      toast(describeCloudError(e));
    } finally {
      setLinking(false);
    }
  };

  const unlinkGoogle = async () => {
    await signOutGoogle().catch(() => {});
    await profiles.save({ ...profile, google: null });
    toast('Google আলাদা করা হয়েছে · Unlinked. Your data on this device stays.');
  };

  /* ---------------------------------------------------------- storage */
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => {
    storageEstimate().then(setEstimate);
    isPersisted().then(setPersisted);
  }, [lib.tracks.length]);
  const libraryBytes = useMemo(() => lib.tracks.reduce((s, t) => s + t.sizeBytes, 0), [lib.tracks]);
  const finished = useMemo(() => lib.tracks.filter((t) => t.finished), [lib.tracks]);
  const finishedBytes = finished.reduce((s, t) => s + t.sizeBytes, 0);
  const savedSeconds = useMemo(() => [...lib.stats.values()].reduce((s, d) => s + d.savedSeconds, 0), [lib.stats]);

  /* ----------------------------------------------------------- backup */
  const importInput = useRef<HTMLInputElement>(null);

  const exportBackup = async () => {
    const merged = mergeSync(profile.id, { progress: await store.getProgress(profile.id), bookmarks: await store.getBookmarks(profile.id) }, null);
    const payload = { app: 'shruti', kind: 'backup', version: 1, exportedAt: new Date().toISOString(), profile: profile.name, data: merged.remote };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `shruti-${profile.name.replace(/\W+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const importBackup = async (file: File | undefined) => {
    if (!file) return;
    try {
      const json = JSON.parse(await file.text()) as { app?: string; data?: RemoteData };
      if (json.app !== 'shruti' || !json.data?.progress) throw new Error('not a Shruti backup');
      const merged = mergeSync(profile.id, { progress: await store.getProgress(profile.id), bookmarks: await store.getBookmarks(profile.id) }, json.data);
      await store.saveProgressMany(merged.localProgress);
      await store.putBookmarks(merged.localBookmarks);
      await lib.reload();
      sync.markDirty();
      toast(`ব্যাকআপ থেকে ${merged.localProgress.length}টি পর্ব ও ${merged.localBookmarks.length}টি বুকমার্ক আপডেট হয়েছে`);
    } catch {
      toast('এটা শ্রুতির ব্যাকআপ ফাইল নয় · That file isn’t a Shruti backup');
    }
  };

  return (
    <div className="view settings">
      <header className="view-head">
        <h1>সেটিংস</h1>
      </header>

      <Section title="প্রোফাইল · Profile">
        <div className="profile-card">
          <Avatar profile={profile} size={56} />
          {editingName ? (
            <form
              className="inline-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (name.trim()) await profiles.save({ ...profile, name: name.trim() });
                setEditingName(false);
              }}
            >
              <input id="profile-rename" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus aria-label="Profile name" />
              <button type="submit" className="btn primary sm">
                সেভ
              </button>
            </form>
          ) : (
            <div className="profile-card-text">
              <strong>{profile.name}</strong>
              <small>{profile.pinHash ? 'PIN দিয়ে লক করা' : 'PIN নেই'}</small>
            </div>
          )}
          {!editingName && (
            <button type="button" className="icon-btn" onClick={() => setEditingName(true)} aria-label="Rename profile">
              <EditIcon />
            </button>
          )}
        </div>

        {pinMode ? (
          <div className="pin-inline">
            <p className="setting-label center">
              {pinMode === 'verify' ? 'বর্তমান PIN দিন · Current PIN' : pinMode === 'new' ? `নতুন ${PIN_LENGTH}-সংখ্যার PIN · New PIN` : 'আবার দিন · Confirm PIN'}
            </p>
            <PinPad key={pinMode} length={PIN_LENGTH} onSubmit={onPin} />
            <button type="button" className="btn ghost" onClick={() => setPinMode(null)}>
              বাতিল · Cancel
            </button>
          </div>
        ) : (
          <div className="button-row">
            {pinSupported() && (
              <button type="button" className="btn" onClick={() => startPin('set')}>
                <LockIcon /> {profile.pinHash ? 'PIN বদলান' : 'PIN সেট করুন'}
              </button>
            )}
            {profile.pinHash && (
              <button type="button" className="btn ghost" onClick={() => startPin('remove')}>
                PIN সরান
              </button>
            )}
            {profile.pinHash && (
              <button type="button" className="btn ghost" onClick={profiles.lock}>
                এখন লক করুন
              </button>
            )}
            <button type="button" className="btn ghost" onClick={profiles.switchProfile}>
              প্রোফাইল বদলান
            </button>
          </div>
        )}
        <p className="fine">PIN এই ফোনে অন্যদের থেকে আপনার প্রোফাইল আলাদা রাখে। It keeps others on a shared phone out of your profile; it does not encrypt the files.</p>
      </Section>

      <Section title="Google অ্যাকাউন্ট ও Sync" icon={<CloudIcon />}>
        {!cloudReady ? (
          <>
            <p className="setting-text">
              Google দিয়ে সাইন ইন করলে আপনার অগ্রগতি, প্রিয় আর বুকমার্ক অন্য ফোন/কম্পিউটারে sync হবে (অডিও ফাইল নয়)। এর জন্য একটা বিনামূল্যের Firebase প্রজেক্ট লাগে — README-তে ধাপগুলো দেওয়া আছে।
            </p>
            <details className="details">
              <summary>Firebase কনফিগ যোগ করুন · Add Firebase config</summary>
              <label className="field">
                <span>Firebase console → Project settings → Your apps → firebaseConfig</span>
                <textarea id="firebase-config" rows={6} value={configText} onChange={(e) => setConfigText(e.target.value)} placeholder={'{ apiKey: "…", authDomain: "…", projectId: "…", appId: "…" }'} spellCheck={false} />
              </label>
              {configError && <p className="gate-notice">{configError}</p>}
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  const err = setCloudConfig(configText);
                  setConfigError(err);
                  if (!err) {
                    toast('কনফিগ সেভ হয়েছে · Config saved');
                    setConfigText('');
                  }
                }}
              >
                সেভ করুন · Save
              </button>
            </details>
          </>
        ) : profile.google ? (
          <>
            <div className="account-row">
              <GoogleIcon />
              <div>
                <strong>{profile.google.name ?? profile.google.email}</strong>
                <small>{profile.google.email}</small>
              </div>
            </div>
            <p className={`sync-status ${sync.status}`} role="status">
              {sync.status === 'syncing'
                ? 'Sync হচ্ছে…'
                : sync.status === 'error'
                  ? sync.error
                  : sync.lastSynced
                    ? `শেষ sync: ${formatAgo(sync.lastSynced)}`
                    : 'Sync চালু'}
            </p>
            <div className="button-row">
              <button type="button" className="btn" onClick={() => void sync.syncNow()} disabled={sync.status === 'syncing'}>
                এখনই Sync করুন
              </button>
              <TwoTapButton className="btn ghost" onConfirm={unlinkGoogle} confirmLabel="আবার চাপুন · Tap again">
                Google আলাদা করুন
              </TwoTapButton>
            </div>
          </>
        ) : (
          <>
            <p className="setting-text">এই প্রোফাইলকে Google অ্যাকাউন্টের সাথে যুক্ত করুন — অন্য ডিভাইসে একই Google দিয়ে সাইন ইন করলে একই জায়গা থেকে শুনতে পারবেন।</p>
            <button type="button" className="btn google" onClick={linkGoogle} disabled={linking}>
              <GoogleIcon /> {linking ? 'Signing in…' : 'Google দিয়ে যুক্ত করুন'}
            </button>
          </>
        )}
        {cloudReady && !isCloudConfigBuiltIn() && (
          <TwoTapButton className="btn ghost sm" onConfirm={() => (setCloudConfig(null), toast('কনফিগ সরানো হয়েছে'))} confirmLabel="আবার চাপুন">
            Firebase কনফিগ সরান
          </TwoTapButton>
        )}
      </Section>

      <Section title="প্লেব্যাক · Playback">
        <div className="setting-block">
          <div className="setting-label">পিছনে যান · Skip back</div>
          <Segmented label="Skip back seconds" value={settings.skipBack} options={SKIP_BACK} onChange={(v) => updateSettings({ skipBack: v })} format={(v) => `${v}s`} />
        </div>
        <div className="setting-block">
          <div className="setting-label">সামনে যান · Skip forward</div>
          <Segmented label="Skip forward seconds" value={settings.skipForward} options={SKIP_FORWARD} onChange={(v) => updateSettings({ skipForward: v })} format={(v) => `${v}s`} />
        </div>
        <label className="switch-row">
          <input id="auto-rewind" type="checkbox" checked={settings.autoRewind} onChange={(e) => updateSettings({ autoRewind: e.target.checked })} />
          <span>
            ফিরে এলে একটু পিছিয়ে দিন · Auto-rewind
            <small>After a pause, resume a few seconds earlier (5s after 30s, 15s after 5 min, 30s after an hour)</small>
          </span>
        </label>
        <label className="switch-row">
          <input id="auto-next" type="checkbox" checked={settings.autoPlayNext} onChange={(e) => updateSettings({ autoPlayNext: e.target.checked })} />
          <span>
            পরের পর্ব নিজে থেকে চালান · Auto-play next
            <small>When an episode ends, start the next one in your queue or list</small>
          </span>
        </label>
      </Section>

      <Section title="সাউন্ড · Sound">
        <EffectsControls settings={settings} savedSeconds={savedSeconds} onSettings={updateSettings} />
      </Section>

      <Section title="চেহারা · Appearance">
        <div className="setting-block">
          <div className="setting-label">থিম · Theme</div>
          <Segmented label="Theme" value={settings.theme} options={THEMES.map((t) => t.value)} onChange={(v) => updateSettings({ theme: v })} format={(v) => THEMES.find((t) => t.value === v)!.label} />
        </div>
      </Section>

      <Section title="স্টোরেজ · Storage">
        <dl className="kv">
          <div>
            <dt>শ্রুতির লাইব্রেরি</dt>
            <dd>
              {lib.tracks.length} পর্ব · {formatBytes(libraryBytes)}
            </dd>
          </div>
          {estimate && (
            <div>
              <dt>ব্রাউজারের জায়গা</dt>
              <dd>
                {formatBytes(estimate.usage)} / {formatBytes(estimate.quota)}
              </dd>
            </div>
          )}
          <div>
            <dt>মুছে যাওয়া থেকে সুরক্ষিত</dt>
            <dd>{store.mode === 'memory' ? 'না — এই সেশন শেষে হারাবে' : persisted ? 'হ্যাঁ ✓' : persisted === false ? 'না' : 'অজানা'}</dd>
          </div>
        </dl>
        {store.mode === 'indexeddb' && persisted === false && (
          <button
            type="button"
            className="btn"
            onClick={async () => {
              const ok = await requestPersistence();
              setPersisted(ok);
              toast(ok ? 'সুরক্ষিত করা হয়েছে · Storage protected' : 'ব্রাউজার এখন অনুমতি দিল না। অ্যাপটা হোম স্ক্রিনে যোগ করলে সাধারণত দেয়।');
            }}
          >
            সুরক্ষিত করুন · Protect storage
          </button>
        )}
        <TwoTapButton
          disabled={finished.length === 0}
          onConfirm={async () => {
            for (const t of finished) await lib.removeTrack(t.id);
            toast(`${finished.length}টি শোনা-শেষ পর্ব মুছে ${formatBytes(finishedBytes)} খালি হয়েছে`);
          }}
          confirmLabel={`আবার চাপুন — ${finished.length}টি মুছবে`}
        >
          শোনা-শেষ পর্বগুলো মুছুন ({finished.length} · {formatBytes(finishedBytes)})
        </TwoTapButton>
        <p className="fine">মুছলে ফাইলটা শুধু শ্রুতি থেকে যায়; আপনার ফোনের আসল ফোল্ডারে যেমন ছিল তেমনই থাকবে।</p>
      </Section>

      <Section title="ব্যাকআপ · Backup">
        <p className="setting-text">অগ্রগতি, প্রিয় আর বুকমার্ক একটা ছোট ফাইলে সেভ করে রাখুন, বা অন্য ফোনে নিয়ে যান। Audio files are not included.</p>
        <div className="button-row">
          <button type="button" className="btn" onClick={exportBackup}>
            <DownloadIcon /> ব্যাকআপ নিন
          </button>
          <button type="button" className="btn" onClick={() => importInput.current?.click()}>
            <UploadIcon /> ব্যাকআপ থেকে ফেরান
          </button>
          <input
            ref={importInput}
            id="backup-file"
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              void importBackup(e.currentTarget.files?.[0]);
              e.currentTarget.value = '';
            }}
          />
        </div>
      </Section>

      <Section title="প্রোফাইল মুছুন">
        <p className="setting-text">
          “{profile.name}”-এর অগ্রগতি, বুকমার্ক আর শোনার হিসাব মুছে যাবে। লাইব্রেরির অডিও ফাইলগুলো থাকবে। Total listening so far: {formatDuration([...lib.stats.values()].reduce((s, d) => s + d.seconds, 0))}.
        </p>
        <TwoTapButton onConfirm={() => void profiles.remove(profile.id)} confirmLabel="আবার চাপুন — প্রোফাইল মুছবে">
          এই প্রোফাইল মুছুন
        </TwoTapButton>
      </Section>

      <p className="about">
        শ্রুতি · Shruti — সব কিছু এই ডিভাইসেই থাকে; অডিও কোথাও আপলোড হয় না। Works offline after the first import.
      </p>
    </div>
  );
}
