import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LivingDexDatabase } from './schema';
import { seedCatalogIfNeeded } from './seed';
import 'fake-indexeddb/auto';

const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

let db: LivingDexDatabase;

const sampleDataset = {
  meta: {
    version: '2026-05-10T00:00:00.000Z',
    schemaVersion: 1,
    scrapedFrom: ['pokeapi'],
    generations: [1],
    pokemonCount: 1,
    encountersCount: 1,
  },
  pokemon: [
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
  ],
  games: [],
  encounters: [
    { pokemonId: 'pikachu', gameId: 'sword', method: { type: 'wild', locations: ['Route 4'] } },
  ],
};

beforeEach(() => {
  db = new LivingDexDatabase();
  fetchMock.mockReset();
});

afterEach(async () => {
  await db.delete();
});

describe('seedCatalogIfNeeded', () => {
  it('seeds catalog tables on first call', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => sampleDataset,
    } as Response);

    const result = await seedCatalogIfNeeded(db, '/dataset.json');
    expect(result.seeded).toBe(true);
    expect(await db.catalog_pokemon.count()).toBe(1);
    expect(await db.catalog_encounters.count()).toBe(1);
  });

  it('skips seed when local meta version matches remote', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => sampleDataset,
    } as Response);
    await seedCatalogIfNeeded(db, '/dataset.json');
    fetchMock.mockClear();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => sampleDataset,
    } as Response);
    const result = await seedCatalogIfNeeded(db, '/dataset.json');
    expect(result.seeded).toBe(false);
  });

  it('throws when fetched dataset is malformed', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ pokemon: 'not an array' }),
    } as Response);
    await expect(seedCatalogIfNeeded(db, '/dataset.json')).rejects.toThrow();
  });

  it('throws when fetch fails', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    } as Response);
    await expect(seedCatalogIfNeeded(db, '/dataset.json')).rejects.toThrow(/500/);
  });
});
