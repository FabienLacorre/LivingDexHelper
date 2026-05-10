import { create } from 'zustand';
import type { UserSettings } from '@livingdex/types';
import { DEFAULT_USER_SETTINGS } from '@livingdex/types';
import { db } from '@/db/schema';

type SettingsStore = {
  settings: UserSettings;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  update: (partial: Partial<UserSettings>) => Promise<void>;
  reset: () => Promise<void>;
};

export const useSettings = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_USER_SETTINGS,
  hydrated: false,
  hydrate: async () => {
    const row = await db.user_settings.get('settings');
    set({ settings: row?.value ?? DEFAULT_USER_SETTINGS, hydrated: true });
  },
  update: async (partial) => {
    const next = { ...get().settings, ...partial };
    await db.user_settings.put({ key: 'settings', value: next });
    set({ settings: next });
  },
  reset: async () => {
    await db.user_settings.put({ key: 'settings', value: DEFAULT_USER_SETTINGS });
    set({ settings: DEFAULT_USER_SETTINGS });
  },
}));
