import { GENRES } from '../lib/genres';
import { genreStyle, GenreIcon } from './GenreMark';

/**
 * Multi-select of genre tags. Picking a sub-genre implies its main genre; picking
 * only the main genre stores the bare main tag.
 */
export function GenrePicker({ value, onChange }: { value: string[]; onChange(tags: string[]): void }) {
  const toggleMain = (main: string) => {
    const has = value.some((t) => t === main || t.startsWith(`${main}.`));
    onChange(has ? value.filter((t) => t !== main && !t.startsWith(`${main}.`)) : [...value, main]);
  };
  const toggleSub = (main: string, sub: string) => {
    const tag = `${main}.${sub}`;
    if (value.includes(tag)) onChange(value.filter((t) => t !== tag));
    else onChange([...value.filter((t) => t !== main), tag]);
  };

  return (
    <div className="genre-picker">
      {GENRES.map((g) => {
        const active = value.some((t) => t === g.id || t.startsWith(`${g.id}.`));
        return (
          <fieldset key={g.id} className={`gp-group${active ? ' on' : ''}`} style={genreStyle(g.id)}>
            <legend>
              <button type="button" className="gp-main" aria-pressed={active} onClick={() => toggleMain(g.id)}>
                <GenreIcon id={g.id} />
                {g.name}
              </button>
            </legend>
            <div className="gp-subs">
              {g.subs.map((s) => {
                const on = value.includes(`${g.id}.${s.id}`);
                return (
                  <button key={s.id} type="button" className={`chip sm${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggleSub(g.id, s.id)}>
                    {s.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
