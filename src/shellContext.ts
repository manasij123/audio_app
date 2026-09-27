import { createContext, useContext } from 'react';
import type { Account } from './components/AuthGate';
import type { Library } from './hooks/useLibrary';
import type { useCloudSync } from './hooks/useCloudSync';
import type { LibraryStore } from './lib/db';
import type { Settings } from './lib/settings';
import type { Profile, Track } from './lib/types';

export interface ShellValue {
  store: LibraryStore;
  profile: Profile;
  account: Account;
  catalogError: string | null;
  lib: Library;
  sync: ReturnType<typeof useCloudSync>;
  settings: Settings;
  updateSettings(patch: Partial<Settings>): void;
  sorted: Track[];
  visible: Track[];
  query: string;
  setQuery(q: string): void;
  queue: string[];
  currentId: string | null;
  playing: boolean;
  /** `context`: the list being played from, so previous/next follow it. */
  play(id: string, opts?: { at?: number; context?: string[] }): void;
  openMenu(id: string): void;
  openAdmin(): void;
  toast(message: string): void;
  /** Genre screen selection: "horror", "horror.tantrik", "untagged" or null for the overview. */
  genreSelection: string | null;
  setGenreSelection(sel: string | null): void;
  /** Open the ধরন tab at a genre / sub-genre. */
  openGenre(sel: string | null): void;
  /** Library's genre filter (main genre id) or null for all. */
  libraryGenre: string | null;
  setLibraryGenre(g: string | null): void;
}

export const ShellContext = createContext<ShellValue | null>(null);

export function useShell(): ShellValue {
  const v = useContext(ShellContext);
  if (!v) throw new Error('useShell outside ShellContext');
  return v;
}
