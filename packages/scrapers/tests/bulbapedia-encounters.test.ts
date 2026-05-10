import { describe, expect, it } from 'vitest';
import { bulbapediaGameToGameIds } from '../src/sources/bulbapedia/games-map.ts';

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
