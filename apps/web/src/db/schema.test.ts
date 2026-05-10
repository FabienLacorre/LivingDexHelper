import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LivingDexDatabase } from './schema';
import 'fake-indexeddb/auto';

let db: LivingDexDatabase;

beforeEach(() => {
  db = new LivingDexDatabase();
});

afterEach(async () => {
  await db.delete();
});

describe('LivingDexDatabase schema', () => {
  it('opens version 1 successfully', async () => {
    await db.open();
    expect(db.verno).toBe(1);
  });

  it('exposes all expected tables', async () => {
    await db.open();
    const names = db.tables.map((t) => t.name).sort();
    expect(names).toEqual([
      'catalog_encounters',
      'catalog_games',
      'catalog_meta',
      'catalog_pokemon',
      'user_collection',
      'user_ownedGames',
      'user_settings',
    ]);
  });

  it('catalog_pokemon supports inserting and querying by id', async () => {
    await db.open();
    await db.catalog_pokemon.put({
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
    });
    const fetched = await db.catalog_pokemon.get('pikachu');
    expect(fetched?.nationalDexNumber).toBe(25);
  });

  it('catalog_encounters supports compound (pokemonId, gameId) lookup', async () => {
    await db.open();
    await db.catalog_encounters.add({
      pokemonId: 'pikachu',
      gameId: 'sword',
      method: { type: 'wild', locations: ['Route 4'] },
    });
    const results = await db.catalog_encounters
      .where('[pokemonId+gameId]')
      .equals(['pikachu', 'sword'])
      .toArray();
    expect(results).toHaveLength(1);
  });
});
