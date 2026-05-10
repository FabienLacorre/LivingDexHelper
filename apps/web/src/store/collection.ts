import { db } from '@/db/schema';
import type { CollectionEntry } from '@livingdex/types';
import { create } from 'zustand';

type CollectionStore = {
  collection: Map<string, CollectionEntry>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  toggleOwned: (pokemonId: string) => Promise<void>;
  setStatus: (pokemonId: string, status: CollectionEntry['homeStatus']) => Promise<void>;
};

export const useCollection = create<CollectionStore>((set, get) => ({
  collection: new Map(),
  hydrated: false,
  hydrate: async () => {
    const entries = await db.user_collection.toArray();
    const map = new Map(entries.map((e) => [e.pokemonId, e]));
    set({ collection: map, hydrated: true });
  },
  toggleOwned: async (pokemonId) => {
    const existing = get().collection.get(pokemonId);
    const nextStatus = existing && existing.homeStatus !== 'missing' ? 'missing' : 'caught';
    const entry: CollectionEntry = {
      pokemonId,
      homeStatus: nextStatus,
      updatedAt: new Date().toISOString(),
    };
    await db.user_collection.put(entry);
    const next = new Map(get().collection);
    next.set(pokemonId, entry);
    set({ collection: next });
  },
  setStatus: async (pokemonId, status) => {
    const entry: CollectionEntry = {
      pokemonId,
      homeStatus: status,
      updatedAt: new Date().toISOString(),
    };
    await db.user_collection.put(entry);
    const next = new Map(get().collection);
    next.set(pokemonId, entry);
    set({ collection: next });
  },
}));
