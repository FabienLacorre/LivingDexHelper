import type { GameId } from './game.ts';

export type EncounterRarity = 'common' | 'uncommon' | 'rare' | 'very-rare';

export type EncounterMethod =
  | { type: 'wild'; locations: string[]; rarity?: EncounterRarity }
  | { type: 'evolution'; fromId: string }
  | { type: 'breeding' }
  | { type: 'gift'; from: string }
  | { type: 'fossil'; fossilItem: string }
  | { type: 'in-game-trade'; npc?: string }
  | { type: 'event'; distributedAs: string };

export type Encounter = {
  pokemonId: string;
  gameId: GameId;
  dlcRequired?: string;
  method: EncounterMethod;
  notes?: string;
};
