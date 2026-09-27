import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Avatar } from '../components/Avatar';
import { CloudIcon, DownloadIcon, ShieldIcon, UploadIcon } from '../components/Icons';
import { EffectsControls } from '../components/PlayerSheets';
import { TwoTapButton } from '../components/TwoTapButton';
import { claimOwnership } from '../lib/catalog';
import { isPersisted, storageEstimate } from '../lib/db';
import { describeAuthError } from '../lib/firebase';
import { formatAgo, formatBytes, formatDuration } from '../lib/format';
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
  const { profile, account, settings, updateSettings, lib, store, sync, toast, openAdmin } = useShell();
  const [claiming, setClaiming] = useState(false);

  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => {
    storageEstimate().then(setEstimate);
    isPersisted().then(setPersisted);
  }, []);
  const savedSeconds = useMemo(() => [...lib.stats.values()].reduce((s, d) => s + d.savedSeconds, 0), [lib.stats]);
  const listened = useMemo(() => [...lib.stats.values()].reduce((s, d) => s + d.seconds, 0), [lib.stats]);

  const role = account.isOwner ? 'মালিক · Owner' : account.isAdmin ? 'অ্যাডমিন · Admin' : 'শ্রোতা · Listener';

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
      toast(`ব্যাকআপ থেকে ${merged.localProgress.length}টি গল্প ও ${merged.localBookmarks.length}টি বুকমার্ক আপডেট হয়েছে`);
    } catch {
      toast('এটা শ্রুতির ব্যাকআপ ফাইল নয় · That file isn’t a Shruti backup');
    }
  };

  return (
    <div className="view settings">
      <header className="view-head">
        <h1>সেটিংস</h1>
      </header>

      <Section title="অ্যাকাউন্ট · Account">
        <div className="profile-card">
          <Avatar profile={profile} size={56} />
          <div className="profile-card-text">
            <strong>{account.user.name}</strong>
            <small>{account.user.email}</small>
            <span className={`pill role${account.isAdmin ? ' admin' : ''}`}>{role}</span>
          </div>
        </div>
        <div className="button-row">
          {account.isAdmin && (
            <button type="button" className="btn" onClick={openAdmin}>
              <ShieldIcon /> অ্যাডমিন প্যানেল
            </button>
          )}
          <TwoTapButton className="btn ghost" onConfirm={() => void account.signOut()} confirmLabel="আবার চাপুন · Tap again to log out">
            লগআউট
          </TwoTapButton>
        </div>
      </Section>

      {!account.ownerExists && (
        <Section title="অ্যাপের মালিকানা · Ownership" icon={<ShieldIcon />}>
          <p className="setting-text">
            এই অ্যাপের এখনও কোনো মালিক নেই। প্রথম যিনি নিচের বোতাম চাপবেন তিনিই মালিক আর প্রথম অ্যাডমিন হবেন — তারপর আর কেউ পারবে না। অ্যাপ চালু করেই আপনি নিজে এটা করে
            নিন।
          </p>
          <button
            type="button"
            className="btn primary"
            disabled={claiming}
            onClick={async () => {
              setClaiming(true);
              try {
                await claimOwnership(account.user);
                await account.refreshRole();
                toast('আপনি এখন এই অ্যাপের মালিক ও অ্যাডমিন · You are now the owner and admin');
              } catch (e) {
                toast(describeAuthError(e));
                await account.refreshRole();
              } finally {
                setClaiming(false);
              }
            }}
          >
            আমি মালিক · Claim ownership
          </button>
        </Section>
      )}

      <Section title="Sync" icon={<CloudIcon />}>
        <p className={`sync-status ${sync.status}`} role="status">
          {sync.status === 'syncing'
            ? 'Sync হচ্ছে…'
            : sync.status === 'error'
              ? sync.error
              : sync.lastSynced
                ? `আপনার অগ্রগতি, প্রিয় আর বুকমার্ক অ্যাকাউন্টে সেভ আছে · শেষ sync ${formatAgo(sync.lastSynced)}`
                : 'আপনার অগ্রগতি, প্রিয় আর বুকমার্ক অ্যাকাউন্টে সেভ হয়'}
        </p>
        <button type="button" className="btn" onClick={() => void sync.syncNow()} disabled={sync.status === 'syncing'}>
          এখনই Sync করুন
        </button>
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

      <Section title="এই ডিভাইস · This device">
        <dl className="kv">
          <div>
            <dt>মোট শোনা</dt>
            <dd>{formatDuration(listened)}</dd>
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
            <dt>স্থানীয় সংরক্ষণ</dt>
            <dd>{store.mode === 'memory' ? 'নেই (প্রাইভেট মোড?)' : persisted ? 'সুরক্ষিত ✓' : 'আছে'}</dd>
          </div>
        </dl>
        <p className="fine">গল্পগুলো সার্ভার থেকে স্ট্রিম হয়; এই ডিভাইসে শুধু আপনার শোনার তথ্যের একটা কপি থাকে, যাতে নেট চলে গেলেও অগ্রগতি না হারায়।</p>
      </Section>

      <Section title="ব্যাকআপ · Backup">
        <p className="setting-text">অগ্রগতি, প্রিয় আর বুকমার্ক একটা ছোট ফাইলে সেভ করে রাখুন। Your account already syncs these; this is an extra copy.</p>
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

      <p className="about">শ্রুতি · Shruti — গল্প শুনুন যখন খুশি। Stories stream from the Shruti server; your listening data belongs to your account.</p>
    </div>
  );
}
