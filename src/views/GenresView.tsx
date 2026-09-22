import { useCallback, useMemo } from 'react';
import { genreStyle, GenreIcon } from '../components/GenreMark';
import { ChevronLeftIcon, ChevronRightIcon, MasksIcon } from '../components/Icons';
import { TrackRow } from '../components/TrackRow';
import { GENRE_BY_ID, GENRE_TERMS, GENRES, hasTag, mainOf, type GenreId } from '../lib/genres';
import type { Track } from '../lib/types';
import { useShell } from '../shellContext';

/** "horror", "horror.tantrik", or "untagged" for stories with no genre yet. */
type Selection = string | null;
const UNTAGGED = 'untagged';

const inSelection = (t: Track, sel: string) => (sel === UNTAGGED ? !t.genres?.length : hasTag(t.genres ?? [], sel));

export function genreCounts(tracks: Track[]): Map<string, number> {
  const c = new Map<string, number>();
  const bump = (k: string) => c.set(k, (c.get(k) ?? 0) + 1);
  for (const t of tracks) {
    const tags = t.genres ?? [];
    if (!tags.length) bump(UNTAGGED);
    for (const main of new Set(tags.map(mainOf))) bump(main);
    for (const tag of tags) if (tag.includes('.')) bump(tag);
  }
  return c;
}

export function GenresView() {
  const { sorted, genreSelection: selection, setGenreSelection: setSelection } = useShell();

  const counts = useMemo(() => genreCounts(sorted), [sorted]);

  if (selection) return <GenreDetail selection={selection} counts={counts} onSelect={setSelection} />;

  return (
    <div className="view genres">
      <header className="view-head">
        <h1>ধরন</h1>
        <p className="summary">একটা ধরন বা উপ-ধরন ছুঁলেই সেই গল্পগুলো</p>
      </header>

      <details className="terms">
        <summary>
          <MasksIcon /> রহস্য, থ্রিলার, সাসপেন্স, হরর: তফাত কী?
        </summary>
        <dl>
          {GENRE_TERMS.map((t) => (
            <div key={t.en}>
              <dt>
                {t.name} <span>{t.en}</span>
              </dt>
              <dd>{t.about}</dd>
            </div>
          ))}
        </dl>
      </details>

      <div className="genre-cards">
        {GENRES.map((g) => (
          <section key={g.id} className="genre-card" style={genreStyle(g.id)}>
            <button type="button" className="genre-card-head" onClick={() => setSelection(g.id)}>
              <span className="genre-icon">
                <GenreIcon id={g.id} />
              </span>
              <span className="genre-titles">
                <span className="genre-name">{g.name}</span>
                <span className="genre-en">
                  {g.en} · {counts.get(g.id) ?? 0}টি গল্প
                </span>
              </span>
              <ChevronRightIcon className="genre-go" />
            </button>
            <p className="genre-about">{g.about}</p>
            <div className="genre-subs">
              {g.subs.map((s) => {
                const n = counts.get(`${g.id}.${s.id}`) ?? 0;
                return (
                  <button key={s.id} type="button" className={`sub-chip${n ? '' : ' empty'}`} onClick={() => setSelection(`${g.id}.${s.id}`)}>
                    {s.name}
                    <span>{n}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {(counts.get(UNTAGGED) ?? 0) > 0 && (
        <button type="button" className="untagged-link" onClick={() => setSelection(UNTAGGED)}>
          ধরন দেওয়া হয়নি এমন গল্প · {counts.get(UNTAGGED)}টি
          <ChevronRightIcon />
        </button>
      )}
    </div>
  );
}

function GenreDetail({ selection, counts, onSelect }: { selection: string; counts: Map<string, number>; onSelect(s: Selection): void }) {
  const { sorted, lib, queue, currentId, playing, play, openMenu } = useShell();
  const untagged = selection === UNTAGGED;
  const main = untagged ? null : GENRE_BY_ID.get(mainOf(selection) as GenreId)!;
  const sub = main && selection.includes('.') ? main.subs.find((s) => `${main.id}.${s.id}` === selection) : undefined;
  const list = useMemo(() => sorted.filter((t) => inSelection(t, selection)), [sorted, selection]);
  const ids = useMemo(() => list.map((t) => t.id), [list]);
  const queued = useMemo(() => new Set(queue), [queue]);
  // Next/previous follow this list while playing from it.
  const playHere = useCallback((id: string) => play(id, { context: ids }), [play, ids]);

  return (
    <div className="view genre-detail" style={main ? genreStyle(main.id) : undefined}>
      <button type="button" className="back-link" onClick={() => onSelect(sub ? main!.id : null)}>
        <ChevronLeftIcon /> {sub ? main!.name : 'সব ধরন'}
      </button>
      <header className="genre-hero">
        {main && (
          <span className="genre-icon lg">
            <GenreIcon id={main.id} />
          </span>
        )}
        <div>
          <h1>{untagged ? 'ধরন দেওয়া হয়নি' : (sub?.name ?? main!.name)}</h1>
          <p className="summary">
            {untagged ? 'প্রতিটা গল্পের ⋯ মেনু থেকে “ধরন” বেছে দিন' : sub ? `${sub.en} · ${main!.name}` : main!.en} · {list.length}টি গল্প
          </p>
        </div>
      </header>
      {!untagged && (
        <p className="genre-about">
          {sub?.about ?? main!.about}
          {sub?.examples && <span className="examples"> যেমন: {sub.examples}</span>}
        </p>
      )}

      {main && (
        <div className="chips" role="radiogroup" aria-label="Sub-genre">
          <button type="button" role="radio" aria-checked={!sub} className={`chip${!sub ? ' on' : ''}`} onClick={() => onSelect(main.id)}>
            সব <span className="chip-count">{counts.get(main.id) ?? 0}</span>
          </button>
          {main.subs.map((s) => {
            const tag = `${main.id}.${s.id}`;
            return (
              <button key={s.id} type="button" role="radio" aria-checked={selection === tag} className={`chip${selection === tag ? ' on' : ''}`} onClick={() => onSelect(tag)}>
                {s.name} <span className="chip-count">{counts.get(tag) ?? 0}</span>
              </button>
            );
          })}
        </div>
      )}

      {list.length === 0 ? (
        <div className="empty-state">
          <p>
            এই ধরনে এখনও কোনো গল্প নেই। ইমপোর্টের সময় ধরন বেছে দিন, অথবা লাইব্রেরিতে কোনো গল্পের <strong>⋯ → ধরন</strong> থেকে এটা দিন।
          </p>
        </div>
      ) : (
        <ul className="list">
          {list.map((t) => (
            <TrackRow
              key={t.id}
              track={t}
              coverUrl={lib.coverUrls.get(t.id)}
              isCurrent={currentId === t.id}
              isPlaying={currentId === t.id && playing}
              queued={queued.has(t.id)}
              onPlay={playHere}
              onToggleFavorite={lib.toggleFavorite}
              onMore={openMenu}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
