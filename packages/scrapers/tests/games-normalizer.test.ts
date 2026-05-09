import { describe, expect, it } from 'vitest';
import { GAMES, getGameById, getPairedVersionId } from '../src/normalizers/games.ts';

describe('GAMES table', () => {
  it('contains exactly 9 games (the v1 supported list)', () => {
    expect(GAMES).toHaveLength(9);
  });

  it('all games are on Switch platform', () => {
    for (const game of GAMES) {
      expect(game.platform).toBe('switch');
    }
  });

  it('Sword and Shield are paired versions', () => {
    const sword = getGameById('sword');
    const shield = getGameById('shield');
    expect(sword?.pairedVersionId).toBe('shield');
    expect(shield?.pairedVersionId).toBe('sword');
  });

  it('Sword has Isle of Armor and Crown Tundra DLCs', () => {
    const sword = getGameById('sword');
    expect(sword?.dlcs.map((d) => d.id)).toEqual(['isle-of-armor', 'crown-tundra']);
  });

  it('FRLG-FR is on generation 3 with homeTransfer unsupported', () => {
    const frlg = getGameById('frlg-fr');
    expect(frlg?.generation).toBe(3);
    expect(frlg?.homeTransfer).toBe('unsupported');
    expect(frlg?.supportsLinkingCord).toBe(false);
  });

  it('Switch games (gen 8/9) support Linking Cord', () => {
    expect(getGameById('sword')?.supportsLinkingCord).toBe(true);
    expect(getGameById('bdsp-d')?.supportsLinkingCord).toBe(true);
    expect(getGameById('pla')?.supportsLinkingCord).toBe(true);
    expect(getGameById('scarlet')?.supportsLinkingCord).toBe(true);
  });

  it('getPairedVersionId returns the correct partner', () => {
    expect(getPairedVersionId('scarlet')).toBe('violet');
    expect(getPairedVersionId('violet')).toBe('scarlet');
    expect(getPairedVersionId('pla')).toBeUndefined();
  });
});
