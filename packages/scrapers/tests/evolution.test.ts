import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PokeApiClient } from '../src/sources/pokeapi/client.ts';
import { fetchEvolutionLinks } from '../src/sources/pokeapi/evolution.ts';

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, 'fixtures', 'pokeapi-evolution-pichu-chain.json'), 'utf8'),
);

const clientMock = { get: vi.fn() } as unknown as PokeApiClient;
beforeEach(() => (clientMock.get as ReturnType<typeof vi.fn>).mockReset());

describe('fetchEvolutionLinks', () => {
  it('returns links from the Pichu chain (pichu -> pikachu -> raichu / raichu-alola)', async () => {
    (clientMock.get as ReturnType<typeof vi.fn>).mockResolvedValue(fixture);
    const links = await fetchEvolutionLinks(clientMock, 10);

    const fromIds = links.map((l) => l.fromId);
    const toIds = links.map((l) => l.toId);
    expect(fromIds).toContain('pichu');
    expect(fromIds).toContain('pikachu');
    expect(toIds).toContain('pikachu');
    expect(toIds).toContain('raichu');

    const pichuToPikachu = links.find((l) => l.fromId === 'pichu' && l.toId === 'pikachu');
    expect(pichuToPikachu?.method).toBe('friendship');

    const pikachuToRaichu = links.find((l) => l.fromId === 'pikachu' && l.toId === 'raichu');
    expect(pikachuToRaichu?.method).toBe('item');
  });
});
