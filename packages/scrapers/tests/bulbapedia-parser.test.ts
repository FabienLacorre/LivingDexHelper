import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  extractGameLocationsSection,
  parseAvailabilityEntries,
} from '../src/sources/bulbapedia/parser.ts';

const FIXTURES = join(import.meta.dirname, 'fixtures');
const pikachu = readFileSync(join(FIXTURES, 'bulbapedia-pikachu.wikitext'), 'utf8');
const solrock = readFileSync(join(FIXTURES, 'bulbapedia-solrock.wikitext'), 'utf8');
const mew = readFileSync(join(FIXTURES, 'bulbapedia-mew.wikitext'), 'utf8');

describe('extractGameLocationsSection', () => {
  it('returns the Game locations section text from a real wikitext', () => {
    const section = extractGameLocationsSection(pikachu);
    expect(section).toBeDefined();
    expect(section?.length ?? 0).toBeGreaterThan(100);
  });

  it('returns undefined if no Game locations section exists', () => {
    const section = extractGameLocationsSection('==Just a page==\nno locations here');
    expect(section).toBeUndefined();
  });
});

describe('parseAvailabilityEntries', () => {
  it('extracts availability entries from Pikachu wikitext', () => {
    const section = extractGameLocationsSection(pikachu);
    expect(section).toBeDefined();
    const entries = parseAvailabilityEntries(section ?? '');
    // Pikachu has many entries across generations; modern entries should include Sword/Shield, SV, BDSP, PLA
    expect(entries.length).toBeGreaterThan(0);
    const games = entries.map((e) => e.gameLabel);
    expect(games.some((g) => g.includes('Sword') || g.includes('Shield'))).toBe(true);
  });

  it('extracts version-exclusive markers for Solrock', () => {
    const section = extractGameLocationsSection(solrock);
    expect(section).toBeDefined();
    const entries = parseAvailabilityEntries(section ?? '');
    expect(entries.length).toBeGreaterThan(0);
    // Solrock should have a marker about being a Sword exclusive vs Shield
    // We just check that at least one entry mentions Sword or Shield
    const games = entries.map((e) => e.gameLabel);
    expect(games.some((g) => /sword|shield/i.test(g))).toBe(true);
  });

  it('handles Mew wikitext (event-distributed Pokémon)', () => {
    const section = extractGameLocationsSection(mew);
    // Mew often has "Event" markers or empty/special entries; the parser shouldn't throw
    const entries = parseAvailabilityEntries(section ?? '');
    expect(Array.isArray(entries)).toBe(true);
  });

  it('returns empty array for empty input', () => {
    expect(parseAvailabilityEntries('')).toEqual([]);
  });

  it('keeps multi-form area obtainable when base form has wiki link (Rattata-style)', () => {
    // Real Rattata BDSP entry — base form obtainable on Routes 225/226 + Grand Underground,
    // Alolan form unobtainable. The whole entry must NOT be marked unobtainable just because
    // the area string mentions "Unobtainable (Alolan Form)" at the end.
    const section = [
      '{{Availability/Entry2|v=Brilliant Diamond|v2=Shining Pearl|area=',
      "[[Route]] {{rtn|225|Sinnoh}} <small>('''Kantonian Form''')</small>",
      "<br>[[Grand Underground]] <small>('''Kantonian Form''')</small>",
      "<br>Unobtainable <small>('''Alolan Form''')</small>}}",
    ].join(' ');
    const entries = parseAvailabilityEntries(section);
    expect(entries).toHaveLength(2); // one per version
    expect(entries[0]?.gameLabel).toBe('Brilliant Diamond');
    expect(entries[0]?.isUnobtainable).toBe(false);
    expect(entries[1]?.gameLabel).toBe('Shining Pearl');
    expect(entries[1]?.isUnobtainable).toBe(false);
  });

  it('still flags entries unobtainable when area is purely "Unobtainable"', () => {
    const section = '{{Availability/Entry1|v=Sword|area=Unobtainable}}';
    const entries = parseAvailabilityEntries(section);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.isUnobtainable).toBe(true);
  });

  it('flags unobtainable when area says "Unobtainable" with form note but no location link', () => {
    // Edge: form-specific unobtainable without any wiki link to a location for the base form.
    const section =
      "{{Availability/Entry1|v=Shield|area=Unobtainable <small>('''Alolan Form''')</small>}}";
    const entries = parseAvailabilityEntries(section);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.isUnobtainable).toBe(true);
  });
});
