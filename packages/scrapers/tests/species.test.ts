import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PokeApiClient } from '../src/sources/pokeapi/client.ts';
import { fetchSpeciesWithVarieties } from '../src/sources/pokeapi/species.ts';

const FIXTURES_DIR = join(import.meta.dirname, 'fixtures');
const speciesFixture = JSON.parse(
  readFileSync(join(FIXTURES_DIR, 'pokeapi-species-pikachu.json'), 'utf8'),
);
const pokemonFixture = JSON.parse(
  readFileSync(join(FIXTURES_DIR, 'pokeapi-pokemon-pikachu.json'), 'utf8'),
);

const clientMock = {
  get: vi.fn(),
} as unknown as PokeApiClient;

beforeEach(() => {
  (clientMock.get as ReturnType<typeof vi.fn>).mockReset();
});

describe('fetchSpeciesWithVarieties', () => {
  it('fetches species + all varieties', async () => {
    (clientMock.get as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      if (path.includes('pokemon-species/25')) return Promise.resolve(speciesFixture);
      if (path.includes('pokemon/pikachu')) return Promise.resolve(pokemonFixture);
      throw new Error(`Unexpected path: ${path}`);
    });

    const result = await fetchSpeciesWithVarieties(clientMock, 25);

    expect(result.species.id).toBe(25);
    expect(result.species.name).toBe('pikachu');
    expect(result.varieties.length).toBeGreaterThanOrEqual(1);
    expect(result.varieties[0]).toMatchObject({ id: expect.any(Number), name: 'pikachu' });
  });

  it('skips varieties with API errors and continues', async () => {
    const speciesWithMissing = {
      ...speciesFixture,
      varieties: [
        { is_default: true, pokemon: { name: 'pikachu', url: 'x' } },
        { is_default: false, pokemon: { name: 'pikachu-totem', url: 'x' } },
      ],
    };
    (clientMock.get as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      if (path.includes('pokemon-species/25')) return Promise.resolve(speciesWithMissing);
      if (path.includes('pokemon/pikachu') && !path.includes('totem')) {
        return Promise.resolve(pokemonFixture);
      }
      return Promise.reject(new Error('PokéAPI 404'));
    });

    const result = await fetchSpeciesWithVarieties(clientMock, 25);
    expect(result.varieties).toHaveLength(1);
  });
});
