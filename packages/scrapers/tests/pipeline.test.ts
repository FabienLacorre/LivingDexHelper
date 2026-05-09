import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runPokeApiPipeline } from '../src/pipeline.ts';

const speciesPikachu = JSON.parse(
  readFileSync(join(import.meta.dirname, 'fixtures', 'pokeapi-species-pikachu.json'), 'utf8'),
);
const pokemonPikachu = JSON.parse(
  readFileSync(join(import.meta.dirname, 'fixtures', 'pokeapi-pokemon-pikachu.json'), 'utf8'),
);
const evolutionPichu = JSON.parse(
  readFileSync(join(import.meta.dirname, 'fixtures', 'pokeapi-evolution-pichu-chain.json'), 'utf8'),
);

describe('runPokeApiPipeline', () => {
  it('produces a valid Dataset for one species', async () => {
    const fakeClient = {
      get: vi.fn(async (path: string) => {
        if (path.startsWith('/pokemon-species/25')) return speciesPikachu;
        if (path.startsWith('/pokemon/pikachu')) return pokemonPikachu;
        if (path.startsWith('/evolution-chain/')) return evolutionPichu;
        throw new Error(`unexpected path: ${path}`);
      }),
    };

    const dataset = await runPokeApiPipeline({
      client: fakeClient as unknown as Parameters<typeof runPokeApiPipeline>[0]['client'],
      speciesIds: [25],
      generations: [1],
      onProgress: () => {},
    });

    expect(dataset.meta.scrapedFrom).toEqual(['pokeapi']);
    expect(dataset.meta.pokemonCount).toBeGreaterThanOrEqual(1);
    expect(dataset.pokemon[0]?.id).toBe('pikachu');
    expect(dataset.pokemon[0]?.evolutions.length).toBeGreaterThanOrEqual(1);
    expect(dataset.games.length).toBe(9);
  });
});
