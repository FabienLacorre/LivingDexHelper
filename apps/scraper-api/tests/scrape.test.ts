import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.ts';

vi.mock('@livingdex/scrapers', async (importActual) => {
  const actual = await importActual<typeof import('@livingdex/scrapers')>();
  return {
    ...actual,
    runCombinedPipeline: vi.fn(async (options) => {
      options.onProgress?.({ stage: 'species', current: 1, total: 1, message: 'mock' });
      return {
        dataset: {
          meta: {
            version: 'mock',
            schemaVersion: 1,
            scrapedFrom: ['pokeapi'],
            generations: [1],
            pokemonCount: 0,
            encountersCount: 0,
          },
          pokemon: [],
          games: [],
          encounters: [],
        },
        coverage: {
          generatedAt: 'mock',
          totalPokemon: 0,
          pokemonWithAnyEncounter: 0,
          pokemonWithoutEncounter: [],
          byGame: [],
        },
      };
    }),
  };
});

describe('/api/scrape (SSE)', () => {
  it('returns 400 if gen param is missing', async () => {
    const app = createApp();
    const response = await app.fetch(new Request('http://localhost/api/scrape'));
    expect(response.status).toBe(400);
  });

  it('returns 200 with text/event-stream content-type when gen is valid', async () => {
    const app = createApp();
    const response = await app.fetch(new Request('http://localhost/api/scrape?gen=1'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
  });
});
