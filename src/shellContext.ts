import { createContext, useContext } from 'react';
import type { ProfileApi } from './components/ProfileGate';
import type { Library, ImportResult } from './hooks/useLibrary';
import type { useCloudSync } from './hooks/useCloudSync';
import type { LibraryStore } from './lib/db';
import type { Settings } from './lib/settings';
import type { Profile, Track } from './lib/types';

export interface ShellValue {
  store: LibraryStore;
  profile: Profile;
  profiles: ProfileApi;
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
  play(id: string, opts?: { at?: number }): void;
  openMenu(id: string): void;
  importFiles(files: File[]): Promise<ImportResult | null>;
  pickFolder(): void;
  pickFiles(): void;
  toast(message: string): void;
}

export const ShellContext = createContext<ShellValue | null>(null);

export function useShell(): ShellValue {
  const v = useContext(ShellContext);
  if (!v) throw new Error('useShell outside ShellContext');
  return v;
}
