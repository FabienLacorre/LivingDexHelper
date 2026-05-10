import { create } from 'zustand';
import type { GameId, OwnedGame } from '@livingdex/types';
import { db } from '@/db/schema';

type OwnedGamesStore = {
  ownedGames: OwnedGame[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  toggleGame: (gameId: GameId) => Promise<void>;
  toggleDlc: (gameId: GameId, dlcId: string) => Promise<void>;
};

export const useOwnedGames = create<OwnedGamesStore>((set, get) => ({
  ownedGames: [],
  hydrated: false,
  hydrate: async () => {
    const games = await db.user_ownedGames.toArray();
    set({ ownedGames: games, hydrated: true });
  },
  toggleGame: async (gameId) => {
    const existing = get().ownedGames.find((g) => g.gameId === gameId);
    if (existing) {
      await db.user_ownedGames.delete(gameId);
      set({ ownedGames: get().ownedGames.filter((g) => g.gameId !== gameId) });
    } else {
      const newEntry: OwnedGame = { gameId, ownedDlcs: [] };
      await db.user_ownedGames.put(newEntry);
      set({ ownedGames: [...get().ownedGames, newEntry] });
    }
  },
  toggleDlc: async (gameId, dlcId) => {
    const games = get().ownedGames;
    const idx = games.findIndex((g) => g.gameId === gameId);
    if (idx === -1) return;
    const game = games[idx];
    if (!game) return;
    const hasDlc = game.ownedDlcs.includes(dlcId);
    const updated: OwnedGame = {
      ...game,
      ownedDlcs: hasDlc ? game.ownedDlcs.filter((d) => d !== dlcId) : [...game.ownedDlcs, dlcId],
    };
    await db.user_ownedGames.put(updated);
    const next = [...games];
    next[idx] = updated;
    set({ ownedGames: next });
  },
}));
