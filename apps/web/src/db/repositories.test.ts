import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LivingDexDatabase } from './schema';
import { getAllPokemon, getEncountersForPokemon, getOwnedGames, setOwnedGame } from './repositories';
import 'fake-indexeddb/auto';

let db: LivingDexDatabase;

beforeEach(async () => {
  db = new LivingDexDatabase();
  await db.open();
  await db.catalog_pokemon.bulkAdd([
    {
      id: 'pikachu',
      nationalDexNumber: 25,
      speciesSlug: 'pikachu',
      formId: null,
      formCategory: 'default',
      names: { en: 'Pikachu', fr: 'Pikachu' },
      types: ['electric'],
      generation: 1,
      sprites: { default: '', shiny: '', artwork: '', icon: '' },
      evolutions: [],
    },
    {
      id: 'bulbasaur',
      nationalDexNumber: 1,
      speciesSlug: 'bulbasaur',
      formId: null,
      formCategory: 'default',
      names: { en: 'Bulbasaur', fr: 'Bulbizarre' },
      types: ['grass', 'poison'],
      generation: 1,
      sprites: { default: '', shiny: '', artwork: '', icon: '' },
      evolutions: [],
    },
  ]);
  await db.catalog_encounters.bulkAdd([
    { pokemonId: 'pikachu', gameId: 'sword', method: { type: 'wild', locations: ['Route 4'] } },
    { pokemonId: 'pikachu', gameId: 'shield', method: { type: 'wild', locations: ['Route 4'] } },
  ]);
});

afterEach(async () => {
  await db.delete();
});

describe('getAllPokemon', () => {
  it('returns all Pokemon sorted by nationalDexNumber', async () => {
    const result = await getAllPokemon(db);
    expect(result.map((p) => p.id)).toEqual(['bulbasaur', 'pikachu']);
  });
});

describe('getEncountersForPokemon', () => {
  it('returns encounters for a given Pokémon and games', async () => {
    const result = await getEncountersForPokemon(db, 'pikachu', ['sword']);
    expect(result).toHaveLength(1);
    expect(result[0]?.gameId).toBe('sword');
  });
});

describe('owned games', () => {
  it('setOwnedGame inserts and getOwnedGames reads back', async () => {
    await setOwnedGame(db, { gameId: 'sword', ownedDlcs: [] });
    const games = await getOwnedGames(db);
    expect(games.map((g) => g.gameId)).toEqual(['sword']);
  });

  it('setOwnedGame replaces existing entry', async () => {
    await setOwnedGame(db, { gameId: 'sword', ownedDlcs: [] });
    await setOwnedGame(db, { gameId: 'sword', ownedDlcs: ['isle-of-armor'] });
    const games = await getOwnedGames(db);
    expect(games[0]?.ownedDlcs).toEqual(['isle-of-armor']);
  });
});
