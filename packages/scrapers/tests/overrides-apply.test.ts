import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Encounter } from '@livingdex/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyOverrides } from '../src/overrides/apply.ts';

let overridesDir: string;

beforeEach(() => {
  overridesDir = mkdtempSync(join(tmpdir(), 'overrides-'));
});

afterEach(() => {
  rmSync(overridesDir, { recursive: true, force: true });
});

describe('applyOverrides', () => {
  it('returns auto encounters unchanged when no override files exist', async () => {
    const auto: Encounter[] = [
      {
        pokemonId: 'pikachu',
        gameId: 'sword',
        method: { type: 'wild', locations: ['Route 4'] },
      },
    ];
    const result = await applyOverrides(auto, overridesDir);
    expect(result).toEqual(auto);
  });

  it('adds new entries from overrides', async () => {
    writeFileSync(
      join(overridesDir, 'events.json'),
      JSON.stringify([
        {
          pokemonId: 'mew',
          gameId: 'sword',
          method: { type: 'event', distributedAs: 'Pokémon HOME distribution' },
        },
      ]),
    );
    const auto: Encounter[] = [];
    const result = await applyOverrides(auto, overridesDir);
    expect(result).toHaveLength(1);
    expect(result[0]?.pokemonId).toBe('mew');
    expect(result[0]?.method.type).toBe('event');
  });

  it('replaces existing entry when override has same (pokemonId, gameId, method.type)', async () => {
    const auto: Encounter[] = [
      {
        pokemonId: 'pikachu',
        gameId: 'sword',
        method: { type: 'wild', locations: ['old loc'] },
      },
    ];
    writeFileSync(
      join(overridesDir, 'corrections.json'),
      JSON.stringify([
        {
          pokemonId: 'pikachu',
          gameId: 'sword',
          method: { type: 'wild', locations: ['new loc'] },
        },
      ]),
    );
    const result = await applyOverrides(auto, overridesDir);
    expect(result).toHaveLength(1);
    const method = result[0]?.method;
    expect(method?.type).toBe('wild');
    if (method?.type === 'wild') {
      expect(method.locations).toEqual(['new loc']);
    }
  });

  it('keeps both auto and override when (pokemonId, gameId, method.type) differ', async () => {
    const auto: Encounter[] = [
      {
        pokemonId: 'pikachu',
        gameId: 'sword',
        method: { type: 'wild', locations: ['Route 4'] },
      },
    ];
    writeFileSync(
      join(overridesDir, 'corrections.json'),
      JSON.stringify([
        {
          pokemonId: 'pikachu',
          gameId: 'sword',
          method: { type: 'evolution', fromId: 'pichu' },
        },
      ]),
    );
    const result = await applyOverrides(auto, overridesDir);
    expect(result).toHaveLength(2);
  });

  it('reads multiple JSON files in the overrides dir', async () => {
    writeFileSync(
      join(overridesDir, 'events.json'),
      JSON.stringify([
        { pokemonId: 'mew', gameId: 'sword', method: { type: 'event', distributedAs: 'A' } },
      ]),
    );
    writeFileSync(
      join(overridesDir, 'version-exclusives.json'),
      JSON.stringify([
        { pokemonId: 'solrock', gameId: 'sword', method: { type: 'wild', locations: ['X'] } },
      ]),
    );
    const result = await applyOverrides([], overridesDir);
    expect(result).toHaveLength(2);
  });

  it('skips non-JSON files in the overrides dir', async () => {
    writeFileSync(join(overridesDir, 'README.md'), 'not json');
    writeFileSync(join(overridesDir, 'events.json'), JSON.stringify([]));
    const result = await applyOverrides([], overridesDir);
    expect(result).toEqual([]);
  });
});
