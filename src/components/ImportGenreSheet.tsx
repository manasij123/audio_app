import { useMemo, useState } from 'react';
import { isAudioFile } from '../lib/filename';
import { detectGenres } from '../lib/genres';
import { GenrePicker } from './GenrePicker';
import { Sheet } from './Sheet';

/** Asked right after files are picked: detect each file's genre, or give all of them the same genres. */
export function ImportGenreSheet({ files, onCancel, onImport }: { files: File[]; onCancel(): void; onImport(genres: string[] | undefined): void }) {
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [tags, setTags] = useState<string[]>([]);
  const audio = useMemo(() => files.filter(isAudioFile), [files]);
  const detected = useMemo(() => audio.filter((f) => detectGenres(f.name, f.webkitRelativePath).length > 0).length, [audio]);

  return (
    <Sheet title="এগুলো কোন ধরনের গল্প?" onClose={onCancel}>
      <p className="setting-text">{audio.length}টি অডিও ফাইল বেছে নেওয়া হয়েছে।</p>
      <div className="choice-list" role="radiogroup">
        <label className={`choice${mode === 'auto' ? ' on' : ''}`}>
          <input id="genre-auto" type="radio" name="genre-mode" checked={mode === 'auto'} onChange={() => setMode('auto')} />
          <span>
            নিজে থেকে বুঝে নিক
            <small>
              নামে ফেলুদা, ব্যোমকেশ, তারানাথ, কাকাবাবু, শঙ্কু, ভূত… থাকলে ধরন বসে যাবে। এখানে {detected}/{audio.length}টির ধরন নাম থেকে বোঝা যাচ্ছে; বাকিগুলো
              পরে ⋯ মেনু থেকে দিতে পারবেন।
            </small>
          </span>
        </label>
        <label className={`choice${mode === 'manual' ? ' on' : ''}`}>
          <input id="genre-manual" type="radio" name="genre-mode" checked={mode === 'manual'} onChange={() => setMode('manual')} />
          <span>
            আমি বেছে দিচ্ছি
            <small>সবকটা ফাইল একই ধরনের হবে (যেমন পুরো ফোল্ডারটাই তারানাথ তান্ত্রিক)</small>
          </span>
        </label>
      </div>
      {mode === 'manual' && <GenrePicker value={tags} onChange={setTags} />}
      <div className="sheet-actions">
        <button type="button" className="btn ghost" onClick={onCancel}>
          বাতিল
        </button>
        <button type="button" className="btn primary" data-autofocus onClick={() => onImport(mode === 'auto' ? undefined : tags)} disabled={mode === 'manual' && tags.length === 0}>
          ইমপোর্ট করুন
        </button>
      </div>
    </Sheet>
  );
}
