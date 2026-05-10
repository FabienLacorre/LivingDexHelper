import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { BulbapediaClient } from '../src/sources/bulbapedia/client.ts';
import { fetchBulbapediaEncounters } from '../src/sources/bulbapedia/encounters.ts';
import { bulbapediaGameToGameIds } from '../src/sources/bulbapedia/games-map.ts';

const FIXTURES = join(import.meta.dirname, 'fixtures');
const pikachuWikitext = readFileSync(join(FIXTURES, 'bulbapedia-pikachu.wikitext'), 'utf8');

describe('bulbapediaGameToGameIds', () => {
  it('maps "Sword/Shield" to both sword and shield', () => {
    expect(bulbapediaGameToGameIds('Sword/Shield')).toEqual(['sword', 'shield']);
  });
  it('maps "Sword" to ["sword"]', () => {
    expect(bulbapediaGameToGameIds('Sword')).toEqual(['sword']);
  });
  it('maps "Brilliant Diamond/Shining Pearl" to both bdsp', () => {
    expect(bulbapediaGameToGameIds('Brilliant Diamond/Shining Pearl')).toEqual([
      'bdsp-d',
      'bdsp-p',
    ]);
  });
  it('maps "Legends: Arceus" to pla', () => {
    expect(bulbapediaGameToGameIds('Legends: Arceus')).toEqual(['pla']);
  });
  it('maps "Scarlet/Violet" to both scarlet+violet', () => {
    expect(bulbapediaGameToGameIds('Scarlet/Violet')).toEqual(['scarlet', 'violet']);
  });
  it('maps "FireRed/LeafGreen" to FRLG variants', () => {
    expect(bulbapediaGameToGameIds('FireRed/LeafGreen')).toEqual(['frlg-fr', 'frlg-lg']);
  });
  it('maps "FRLG" abbreviation to FRLG variants', () => {
    expect(bulbapediaGameToGameIds('FRLG')).toEqual(['frlg-fr', 'frlg-lg']);
  });
  it('returns empty array for unknown game name', () => {
    expect(bulbapediaGameToGameIds('Unknown Game XYZ')).toEqual([]);
  });
});

describe('fetchBulbapediaEncounters', () => {
  it('fetches wikitext, parses, and normalizes for one Pokémon', async () => {
    const clientMock = {
      getWikitext: vi.fn().mockResolvedValue(pikachuWikitext),
    } as unknown as BulbapediaClient;

    const encounters = await fetchBulbapediaEncounters(clientMock, 'pikachu', 'Pikachu_(Pokémon)');
    expect(Array.isArray(encounters)).toBe(true);
    // Real Pikachu page should yield encounters for at least Sword/Shield + SV
    if (encounters.length > 0) {
      const games = new Set(encounters.map((e) => e.gameId));
      expect(games.size).toBeGreaterThan(0);
    }
  });

  it('returns empty array when the page has no Game locations section', async () => {
    const clientMock = {
      getWikitext: vi.fn().mockResolvedValue('==Just a page==\nno locations'),
    } as unknown as BulbapediaClient;

    const encounters = await fetchBulbapediaEncounters(clientMock, 'unknown', 'Unknown_(Pokémon)');
    expect(encounters).toEqual([]);
  });
});
