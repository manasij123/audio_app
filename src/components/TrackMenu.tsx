import { useEffect, useRef, useState } from 'react';
import { formatBytes, formatTime } from '../lib/format';
import type { Track } from '../lib/types';
import { Cover } from './Cover';
import { tagLabel } from '../lib/genres';
import { BookmarkIcon, CheckIcon, EditIcon, EyeIcon, MasksIcon, PauseIcon, PlayIcon, PlusIcon, QueueIcon, StarIcon, TrashIcon } from './Icons';
import { Sheet } from './Sheet';

interface Props {
  track: Track;
  coverUrl?: string;
  isPlaying: boolean;
  queued: boolean;
  bookmarkCount: number;
  onClose(): void;
  onPlay(): void;
  onPlayNext(): void;
  onToggleQueue(): void;
  onToggleFavorite(): void;
  onSetFinished(finished: boolean): void;
  onBookmarks(): void;
  /** Present only for admins: catalogue edits that affect every listener. */
  admin?: {
    onGenres(): void;
    onRename(title: string): void;
    onTogglePublish(): void;
    onDelete(): void;
  };
}

const CONFIRM_WINDOW_MS = 4000;

/** Per-track action sheet (the "⋯" menu). */
export function TrackMenu(p: Props) {
  const { track } = p;
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(track.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const act = (fn: () => void) => () => {
    fn();
    p.onClose();
  };

  const del = () => {
    clearTimeout(timer.current);
    if (confirmDelete) {
      p.admin?.onDelete();
      p.onClose();
      return;
    }
    setConfirmDelete(true);
    timer.current = window.setTimeout(() => setConfirmDelete(false), CONFIRM_WINDOW_MS);
  };

  return (
    <Sheet title="পর্ব · Episode" onClose={p.onClose}>
      <div className="menu-head">
        <Cover url={p.coverUrl} title={track.title} size="md" />
        <div>
          <div className="menu-title">
            {track.title} {track.published === false && <span className="pill draft">খসড়া</span>}
          </div>
          <div className="menu-sub">
            {[track.trackNo != null ? `#${track.trackNo}` : null, formatTime(track.duration), track.album].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>

      {renaming ? (
        <form
          className="rename"
          onSubmit={(e) => {
            e.preventDefault();
            p.admin?.onRename(title);
            p.onClose();
          }}
        >
          <label className="field">
            <span>নতুন নাম · New title</span>
            <input id="rename-title" data-autofocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </label>
          <div className="row-actions">
            <button type="button" className="btn ghost" onClick={() => setRenaming(false)}>
              বাতিল
            </button>
            <button type="submit" className="btn primary">
              সেভ করুন · Save
            </button>
          </div>
        </form>
      ) : (
        <ul className="menu-list">
          <li>
            <button type="button" data-autofocus onClick={act(p.onPlay)}>
              {p.isPlaying ? <PauseIcon /> : <PlayIcon />} {p.isPlaying ? 'থামান · Pause' : 'চালান · Play'}
            </button>
          </li>
          <li>
            <button type="button" onClick={act(p.onPlayNext)}>
              <QueueIcon /> এর পরে চালান · Play next
            </button>
          </li>
          <li>
            <button type="button" onClick={act(p.onToggleQueue)}>
              <PlusIcon /> {p.queued ? 'তালিকা থেকে সরান · Remove from queue' : 'তালিকায় যোগ করুন · Add to queue'}
            </button>
          </li>
          <li>
            <button type="button" onClick={act(p.onToggleFavorite)}>
              <StarIcon filled={track.favorite} /> {track.favorite ? 'প্রিয় থেকে সরান · Unfavourite' : 'প্রিয় · Favourite'}
            </button>
          </li>
          <li>
            <button type="button" onClick={act(() => p.onSetFinished(!track.finished))}>
              <CheckIcon /> {track.finished ? 'শোনা হয়নি চিহ্নিত করুন · Mark as unplayed' : 'শোনা হয়েছে চিহ্নিত করুন · Mark as played'}
            </button>
          </li>
          <li>
            <button type="button" onClick={act(p.onBookmarks)}>
              <BookmarkIcon /> বুকমার্ক · Bookmarks {p.bookmarkCount > 0 && <span className="count">{p.bookmarkCount}</span>}
            </button>
          </li>
          {p.admin && (
            <>
              <li className="menu-divider" aria-hidden>
                অ্যাডমিন · সবার জন্য বদলাবে
              </li>
              <li>
                <button type="button" onClick={act(p.admin.onGenres)}>
                  <MasksIcon /> ধরন · Genre
                  <span className="count">{track.genres?.length ? track.genres.map(tagLabel).join(', ') : 'দেওয়া হয়নি'}</span>
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setRenaming(true)}>
                  <EditIcon /> নাম বদলান · Rename
                </button>
              </li>
              <li>
                <button type="button" onClick={act(p.admin.onTogglePublish)}>
                  <EyeIcon /> {track.published ? 'শ্রোতাদের থেকে লুকান · Unpublish' : 'প্রকাশ করুন · Publish'}
                </button>
              </li>
              <li>
                <button type="button" className={`danger${confirmDelete ? ' confirm' : ''}`} onClick={del}>
                  <TrashIcon /> {confirmDelete ? 'আবার চাপুন, সার্ভার থেকে মুছে যাবে · Tap again to delete' : 'সার্ভার থেকে মুছুন · Delete for everyone'}
                </button>
              </li>
            </>
          )}
        </ul>
      )}

      <dl className="menu-info">
        <div>
          <dt>ফাইল</dt>
          <dd>{track.fileName}</dd>
        </div>
        <div>
          <dt>সাইজ</dt>
          <dd>{formatBytes(track.sizeBytes)}</dd>
        </div>
        {track.artist && (
          <div>
            <dt>শিল্পী</dt>
            <dd>{track.artist}</dd>
          </div>
        )}
        <div>
          <dt>যোগ হয়েছে</dt>
          <dd>{new Date(track.addedAt).toLocaleDateString()}</dd>
        </div>
      </dl>
    </Sheet>
  );
}
