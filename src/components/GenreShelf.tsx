import { useMemo } from 'react';
import { GENRES } from '../lib/genres';
import { useShell } from '../shellContext';
import { genreCounts } from '../views/GenresView';
import { genreStyle, GenreIcon } from './GenreMark';
import { ChevronRightIcon } from './Icons';

/** Home-screen row of the five genres; a tap opens that genre's stories. */
export function GenreShelf() {
  const { sorted, openGenre } = useShell();
  const counts = useMemo(() => genreCounts(sorted), [sorted]);
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">ধরন অনুযায়ী শুনুন · Genres</h2>
        <button type="button" className="see-all" onClick={() => openGenre(null)}>
          সব ধরন <ChevronRightIcon />
        </button>
      </div>
      <div className="genre-shelf">
        {GENRES.map((g) => (
          <button key={g.id} type="button" className="genre-tile" style={genreStyle(g.id)} onClick={() => openGenre(g.id)}>
            <span className="genre-icon">
              <GenreIcon id={g.id} />
            </span>
            <span className="genre-tile-name">{g.name}</span>
            <span className="genre-tile-count">{counts.get(g.id) ?? 0}টি গল্প</span>
          </button>
        ))}
      </div>
    </section>
  );
}
