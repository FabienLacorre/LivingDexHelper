import { describe, expect, it } from 'vitest';
import { normalizeBulbapediaEntry } from '../src/normalizers/encounters.ts';
import type { RawAvailabilityEntry } from '../src/sources/bulbapedia/parser.ts';

describe('normalizeBulbapediaEntry', () => {
  it('produces wild encounter entries for Pikachu in Sword/Shield', () => {
    const entry: RawAvailabilityEntry = {
      gameLabel: 'Sword/Shield',
      rawDescription: 'Route 4, Wild Area',
      isUnobtainable: false,
    };
    const result = normalizeBulbapediaEntry(entry, 'pikachu');
    expect(result).toHaveLength(2); // sword + shield
    expect(result[0]).toMatchObject({
      pokemonId: 'pikachu',
      gameId: 'sword',
      method: { type: 'wild' },
    });
    expect(result[1]?.gameId).toBe('shield');
  });

  it('produces no entries when game label is unrecognized', () => {
    const entry: RawAvailabilityEntry = {
      gameLabel: 'Stadium 2',
      rawDescription: 'doesnt matter',
      isUnobtainable: false,
    };
    const result = normalizeBulbapediaEntry(entry, 'pikachu');
    expect(result).toEqual([]);
  });

  it('produces no entries when isUnobtainable is true', () => {
    const entry: RawAvailabilityEntry = {
      gameLabel: 'Sword',
      rawDescription: 'Unobtainable',
      isUnobtainable: true,
    };
    const result = normalizeBulbapediaEntry(entry, 'pikachu');
    expect(result).toEqual([]);
  });

  it('detects evolution method from "Evolve" keyword in description', () => {
    const entry: RawAvailabilityEntry = {
      gameLabel: 'Scarlet',
      rawDescription: 'Evolve Pichu',
      isUnobtainable: false,
    };
    const result = normalizeBulbapediaEntry(entry, 'pikachu');
    expect(result[0]?.method.type).toBe('evolution');
  });

  it('detects breeding method from "breed" keyword', () => {
    const entry: RawAvailabilityEntry = {
      gameLabel: 'Sword/Shield',
      rawDescription: 'Breed Pikachu',
      isUnobtainable: false,
    };
    const result = normalizeBulbapediaEntry(entry, 'pichu');
    expect(result[0]?.method.type).toBe('breeding');
  });

  it('detects gift method from "gift" keyword', () => {
    const entry: RawAvailabilityEntry = {
      gameLabel: 'Sword/Shield',
      rawDescription: 'Gift from Professor',
      isUnobtainable: false,
    };
    const result = normalizeBulbapediaEntry(entry, 'pikachu');
    expect(result[0]?.method.type).toBe('gift');
  });

  it('extracts location strings for wild encounters', () => {
    const entry: RawAvailabilityEntry = {
      gameLabel: 'Sword',
      rawDescription: 'Route 4, Wild Area',
      isUnobtainable: false,
    };
    const result = normalizeBulbapediaEntry(entry, 'pikachu');
    const method = result[0]?.method;
    expect(method?.type).toBe('wild');
    if (method?.type === 'wild') {
      expect(method.locations.length).toBeGreaterThan(0);
    }
  });
});
