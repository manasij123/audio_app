import { useEffect, useMemo, useRef, useState } from 'react';
import { Cover } from '../components/Cover';
import { GenrePicker } from '../components/GenrePicker';
import { CloudUpIcon, FolderIcon, PlusIcon, SearchIcon, ShieldIcon, UsersIcon } from '../components/Icons';
import { TwoTapButton } from '../components/TwoTapButton';
import { addAdminByEmail, countUsers, listAdmins, recentUsers, removeAdmin, updateTrack, uploadTrack, type AdminEntry, type AppUser } from '../lib/catalog';
import { describeAuthError } from '../lib/firebase';
import { formatAgo, formatBytes, formatTime } from '../lib/format';
import { tagLabel } from '../lib/genres';
import { prepareUploads, type PendingUpload } from '../lib/upload';
import { useShell } from '../shellContext';

type Pane = 'upload' | 'stories' | 'listeners' | 'admins';

export function AdminView() {
  const [pane, setPane] = useState<Pane>('upload');
  const { lib } = useShell();
  const published = lib.tracks.filter((t) => t.published).length;
  const bytes = lib.tracks.reduce((s, t) => s + t.sizeBytes, 0);
  const [listeners, setListeners] = useState<number | null>(null);
  useEffect(() => {
    countUsers().then(setListeners);
  }, []);

  return (
    <div className="view admin">
      <header className="view-head">
        <p className="eyebrow">
          <ShieldIcon className="inline-icon" /> শুধু অ্যাডমিন দেখতে পান
        </p>
        <h1>অ্যাডমিন</h1>
      </header>

      <div className="admin-stats">
        <div className="stat">
          <strong>{lib.tracks.length}</strong>
          <span>মোট গল্প</span>
        </div>
        <div className="stat">
          <strong>{published}</strong>
          <span>প্রকাশিত</span>
        </div>
        <div className="stat">
          <strong>{formatBytes(bytes)}</strong>
          <span>সার্ভারে</span>
        </div>
        <div className="stat">
          <strong>{listeners ?? '—'}</strong>
          <span>শ্রোতা</span>
        </div>
      </div>

      <div className="segmented wide" role="tablist" aria-label="Admin sections">
        {(
          [
            ['upload', 'আপলোড'],
            ['stories', 'গল্প'],
            ['listeners', 'শ্রোতা'],
            ['admins', 'অ্যাডমিন'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={pane === k} className={pane === k ? 'on' : ''} onClick={() => setPane(k)}>
            {label}
          </button>
        ))}
      </div>

      {pane === 'upload' && <UploadPane />}
      {pane === 'stories' && <StoriesPane />}
      {pane === 'listeners' && <ListenersPane />}
      {pane === 'admins' && <AdminsPane />}
    </div>
  );
}

/* ------------------------------------------------------------------ upload */

function UploadPane() {
  const { lib, toast } = useShell();
  const folderInput = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<PendingUpload[]>([]);
  const [preparing, setPreparing] = useState<{ done: number; total: number } | null>(null);
  const [genreMode, setGenreMode] = useState<'auto' | 'manual'>('auto');
  const [manualGenres, setManualGenres] = useState<string[]>([]);
  const [publish, setPublish] = useState(true);
  const [uploading, setUploading] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    folderInput.current?.setAttribute('webkitdirectory', '');
  }, []);

  // Don't let the admin close the tab mid-upload by accident.
  useEffect(() => {
    if (!uploading) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [uploading]);

  const existing = useMemo(
    () => lib.tracks.map((t) => ({ sourcePath: t.sourcePath ?? t.fileName, fileName: t.fileName, sizeBytes: t.sizeBytes })),
    [lib.tracks],
  );

  const onPicked = async (input: HTMLInputElement) => {
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    if (!files.length) return;
    setPreparing({ done: 0, total: files.length });
    const prepared = await prepareUploads(files, existing, (done, total) => setPreparing({ done, total }));
    setPreparing(null);
    if (!prepared.length) {
      toast('কোনো অডিও ফাইল পাওয়া যায়নি · No audio files in that selection');
      return;
    }
    setItems(prepared);
  };

  const patch = (key: string, p: Partial<PendingUpload>) => setItems((list) => list.map((x) => (x.key === key ? { ...x, ...p } : x)));

  const start = async () => {
    const ctrl = new AbortController();
    abort.current = ctrl;
    setUploading(true);
    let ok = 0;
    let skipped = 0;
    let failed = 0;
    for (const item of items) {
      if (ctrl.signal.aborted) break;
      if (item.status === 'done') continue;
      if (item.duplicate) {
        patch(item.key, { status: 'skipped' });
        skipped++;
        continue;
      }
      patch(item.key, { status: 'uploading', progress: 0 });
      try {
        await uploadTrack(
          {
            file: item.file,
            sourcePath: item.sourcePath,
            tags: item.tags,
            title: item.title.trim() || item.file.name,
            trackNo: item.trackNo,
            genres: genreMode === 'manual' ? manualGenres : item.genres,
            chapters: item.chapters,
            duration: item.duration,
            mimeType: item.mimeType,
            published: publish,
          },
          (f) => patch(item.key, { progress: f }),
          ctrl.signal,
        );
        patch(item.key, { status: 'done', progress: 1 });
        ok++;
      } catch (e) {
        const cancelled = (e as { code?: string }).code === 'storage/canceled';
        patch(item.key, { status: cancelled ? 'ready' : 'failed', error: cancelled ? undefined : describeAuthError(e) });
        if (!cancelled) failed++;
      }
    }
    setUploading(false);
    abort.current = null;
    toast(`${ok}টি আপলোড হয়েছে · ${skipped}টি আগেই ছিল${failed ? ` · ${failed}টি ব্যর্থ` : ''}`);
  };

  const ready = items.filter((i) => i.status !== 'done' && !i.duplicate).length;
  const totalBytes = items.filter((i) => !i.duplicate).reduce((s, i) => s + i.file.size, 0);

  return (
    <section className="admin-pane">
      <input ref={folderInput} type="file" multiple accept="audio/*" hidden onChange={(e) => void onPicked(e.currentTarget)} />
      <input ref={filesInput} type="file" multiple accept="audio/*,.mp3,.m4a,.m4b,.ogg,.opus" hidden onChange={(e) => void onPicked(e.currentTarget)} />

      <div className="settings-card">
        <p className="setting-text">
          ফোল্ডার বা ফাইল বাছুন। নাম, পর্ব নম্বর, কভার, দৈর্ঘ্য আর ধরন ফাইল থেকেই পড়ে নেওয়া হবে। আগে আপলোড করা ফাইল আবার যাবে না।
        </p>
        <div className="button-row">
          <button type="button" className="btn primary" onClick={() => folderInput.current?.click()} disabled={uploading || preparing != null}>
            <FolderIcon /> ফোল্ডার বাছুন
          </button>
          <button type="button" className="btn" onClick={() => filesInput.current?.click()} disabled={uploading || preparing != null}>
            <PlusIcon /> ফাইল বাছুন
          </button>
        </div>
        {preparing && (
          <div className="progress" role="status">
            <div className="progress-text">
              <span>
                ফাইল পড়া হচ্ছে {preparing.done}/{preparing.total}
              </span>
            </div>
            <div className="bar">
              <i style={{ width: `${(preparing.done / Math.max(1, preparing.total)) * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <>
          <div className="settings-card">
            <div className="choice-list" role="radiogroup" aria-label="Genre">
              <label className={`choice${genreMode === 'auto' ? ' on' : ''}`}>
                <input id="up-genre-auto" type="radio" name="up-genre" checked={genreMode === 'auto'} onChange={() => setGenreMode('auto')} />
                <span>
                  ধরন নাম দেখে বুঝে নিক
                  <small>{items.filter((i) => i.genres.length).length}/{items.length}টির ধরন বোঝা গেছে; বাকিগুলো পরে ⋯ মেনু থেকে দেওয়া যাবে</small>
                </span>
              </label>
              <label className={`choice${genreMode === 'manual' ? ' on' : ''}`}>
                <input id="up-genre-manual" type="radio" name="up-genre" checked={genreMode === 'manual'} onChange={() => setGenreMode('manual')} />
                <span>
                  সবগুলোর জন্য আমি ধরন বেছে দিচ্ছি
                  <small>যেমন পুরো ফোল্ডারটাই তারানাথ তান্ত্রিক</small>
                </span>
              </label>
            </div>
            {genreMode === 'manual' && <GenrePicker value={manualGenres} onChange={setManualGenres} />}
            <label className="switch-row">
              <input id="up-publish" type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
              <span>
                আপলোড হলেই প্রকাশ করুন
                <small>বন্ধ রাখলে “খসড়া” থাকবে — শুধু অ্যাডমিন দেখবেন, পরে প্রকাশ করতে পারবেন</small>
              </span>
            </label>
            <div className="button-row">
              {uploading ? (
                <button type="button" className="btn" onClick={() => abort.current?.abort()}>
                  থামান · Stop
                </button>
              ) : (
                <button type="button" className="btn primary" onClick={() => void start()} disabled={ready === 0 || (genreMode === 'manual' && manualGenres.length === 0)}>
                  <CloudUpIcon /> {ready}টি আপলোড করুন · {formatBytes(totalBytes)}
                </button>
              )}
              {!uploading && (
                <button type="button" className="btn ghost" onClick={() => setItems([])}>
                  তালিকা মুছুন
                </button>
              )}
            </div>
          </div>

          <ul className="upload-list">
            {items.map((it) => (
              <li key={it.key} className={`up-item ${it.status}${it.duplicate ? ' dup' : ''}`}>
                <div className="up-main">
                  <input
                    id={`up-title-${it.key}`}
                    className="up-title"
                    value={it.title}
                    onChange={(e) => patch(it.key, { title: e.target.value })}
                    disabled={uploading || it.status === 'done'}
                    aria-label="Title"
                  />
                  <div className="up-meta">
                    {it.trackNo != null && <span>#{it.trackNo}</span>}
                    <span>{formatTime(it.duration)}</span>
                    <span>{formatBytes(it.file.size)}</span>
                    {it.tags.picture && <span>🖼 কভার</span>}
                    {(genreMode === 'manual' ? manualGenres : it.genres).slice(0, 2).map((g) => (
                      <span key={g} className="pill">
                        {tagLabel(g)}
                      </span>
                    ))}
                  </div>
                  {(it.status === 'uploading' || it.status === 'done') && (
                    <div className="bar" aria-label={`${Math.round(it.progress * 100)}%`}>
                      <i style={{ width: `${it.progress * 100}%` }} />
                    </div>
                  )}
                  {it.error && <p className="gate-notice">{it.error}</p>}
                </div>
                <span className="up-status">
                  {it.duplicate
                    ? 'আগেই আছে'
                    : it.status === 'uploading'
                      ? `${Math.round(it.progress * 100)}%`
                      : it.status === 'done'
                        ? '✓'
                        : it.status === 'failed'
                          ? 'ব্যর্থ'
                          : it.status === 'skipped'
                            ? 'বাদ'
                            : ''}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/* ----------------------------------------------------------------- stories */

function StoriesPane() {
  const { lib, sorted, openMenu, toast } = useShell();
  const [q, setQ] = useState('');
  const [show, setShow] = useState<'all' | 'published' | 'draft'>('all');
  const list = sorted.filter(
    (t) => (show === 'all' || (show === 'published' ? t.published : !t.published)) && (!q || t.title.toLocaleLowerCase().includes(q.toLocaleLowerCase())),
  );

  return (
    <section className="admin-pane">
      <label className="search">
        <SearchIcon />
        <input id="admin-search" type="search" placeholder="গল্প খুঁজুন" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search stories" />
      </label>
      <div className="chips" role="radiogroup" aria-label="Show">
        {(
          [
            ['all', 'সব'],
            ['published', 'প্রকাশিত'],
            ['draft', 'খসড়া'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" role="radio" aria-checked={show === k} className={`chip${show === k ? ' on' : ''}`} onClick={() => setShow(k)}>
            {label}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="empty-note center">কিছু নেই · Nothing here</p>
      ) : (
        <ul className="list admin-list">
          {list.map((t) => (
            <li key={t.id} className="row">
              <button type="button" className="row-main" onClick={() => openMenu(t.id)}>
                <Cover url={lib.coverUrls.get(t.id)} title={t.title} size="sm" />
                <span className="row-info">
                  <span className="row-title">{t.title}</span>
                  <span className="row-meta">
                    {t.trackNo != null && <span className="row-no">#{t.trackNo}</span>}
                    <span>{formatTime(t.duration)}</span>
                    <span>{formatBytes(t.sizeBytes)}</span>
                    {(t.genres ?? []).slice(0, 1).map((g) => (
                      <span key={g} className="row-genre">
                        {tagLabel(g)}
                      </span>
                    ))}
                  </span>
                </span>
              </button>
              <label className="publish-toggle" title={t.published ? 'প্রকাশিত' : 'খসড়া'}>
                <input
                  id={`pub-${t.id}`}
                  type="checkbox"
                  checked={!!t.published}
                  onChange={(e) =>
                    updateTrack(t.id, { published: e.target.checked }).then(
                      () => toast(e.target.checked ? 'প্রকাশিত · Published' : 'খসড়া করা হয়েছে · Unpublished'),
                      (err) => toast(describeAuthError(err)),
                    )
                  }
                  aria-label={`Published: ${t.title}`}
                />
                <span>{t.published ? 'প্রকাশিত' : 'খসড়া'}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <p className="fine">গল্পে চাপলে নাম, ধরন, প্রকাশ আর মুছে ফেলার অপশন পাবেন।</p>
    </section>
  );
}

/* --------------------------------------------------------------- listeners */

function ListenersPane() {
  const [users, setUsers] = useState<(AppUser & { createdAt: number; lastSeen: number })[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    recentUsers(50).then(setUsers, (e) => setError(describeAuthError(e)));
  }, []);
  return (
    <section className="admin-pane">
      <div className="settings-card">
        <h2 className="section-title">
          <UsersIcon className="inline-icon" /> সাম্প্রতিক শ্রোতা
        </h2>
        {error && <p className="gate-notice">{error}</p>}
        {!users ? (
          <p className="fine">লোড হচ্ছে…</p>
        ) : users.length === 0 ? (
          <p className="fine">এখনও কেউ নেই</p>
        ) : (
          <ul className="people">
            {users.map((u) => (
              <li key={u.uid}>
                <span className="avatar sm" aria-hidden>
                  {u.photoURL ? <img src={u.photoURL} alt="" referrerPolicy="no-referrer" /> : (u.name || '?').slice(0, 1)}
                </span>
                <span className="person">
                  <strong>{u.name}</strong>
                  <small>{u.email}</small>
                </span>
                <small className="seen">{formatAgo(u.lastSeen)}</small>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ admins */

function AdminsPane() {
  const { account, toast } = useShell();
  const [admins, setAdmins] = useState<AdminEntry[] | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => listAdmins().then(setAdmins, (e) => toast(describeAuthError(e)));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="admin-pane">
      <div className="settings-card">
        <h2 className="section-title">
          <ShieldIcon className="inline-icon" /> অ্যাডমিনরা
        </h2>
        <ul className="people">
          {(admins ?? []).map((a) => (
            <li key={a.uid}>
              <span className="avatar sm" aria-hidden>
                {(a.name || a.email || '?').slice(0, 1)}
              </span>
              <span className="person">
                <strong>{a.name || a.email}</strong>
                <small>
                  {a.email}
                  {a.uid === account.user.uid ? ' · আপনি' : ''}
                </small>
              </span>
              {a.uid !== account.user.uid && (
                <TwoTapButton
                  className="btn ghost sm"
                  confirmLabel="নিশ্চিত?"
                  onConfirm={() =>
                    removeAdmin(a.uid).then(
                      () => (toast('অ্যাডমিন থেকে সরানো হয়েছে'), void load()),
                      (e) => toast(describeAuthError(e)),
                    )
                  }
                >
                  সরান
                </TwoTapButton>
              )}
            </li>
          ))}
        </ul>
      </div>
      <form
        className="settings-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const added = await addAdminByEmail(email, account.user.uid);
            if (!added) toast('এই ইমেলে কোনো শ্রোতা নেই — তাঁকে আগে অ্যাপে একবার লগইন করতে বলুন');
            else {
              toast(`${added.name || added.email} এখন অ্যাডমিন`);
              setEmail('');
              void load();
            }
          } catch (err) {
            toast(describeAuthError(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          <span>নতুন অ্যাডমিনের ইমেল</span>
          <input id="new-admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <p className="fine">যাঁকে অ্যাডমিন করবেন, তাঁকে আগে একবার অ্যাপে লগইন করতে হবে। মালিককে কেউ সরাতে পারবেন না।</p>
        <button type="submit" className="btn primary" disabled={busy}>
          অ্যাডমিন করুন
        </button>
      </form>
    </section>
  );
}
