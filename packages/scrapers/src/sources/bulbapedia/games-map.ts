import type { GameId } from '@livingdex/types';

const MAPPINGS: Array<[string, GameId[]]> = [
  ['Sword/Shield', ['sword', 'shield']],
  ['Sword', ['sword']],
  ['Shield', ['shield']],
  ['Brilliant Diamond/Shining Pearl', ['bdsp-d', 'bdsp-p']],
  ['Brilliant Diamond', ['bdsp-d']],
  ['Shining Pearl', ['bdsp-p']],
  ['BDSP', ['bdsp-d', 'bdsp-p']],
  ['Legends: Arceus', ['pla']],
  ['Pokémon Legends: Arceus', ['pla']],
  ['PLA', ['pla']],
  ['Scarlet/Violet', ['scarlet', 'violet']],
  ['Scarlet', ['scarlet']],
  ['Violet', ['violet']],
  ['SV', ['scarlet', 'violet']],
  ['FireRed/LeafGreen', ['frlg-fr', 'frlg-lg']],
  ['FireRed', ['frlg-fr']],
  ['LeafGreen', ['frlg-lg']],
  ['FRLG', ['frlg-fr', 'frlg-lg']],
  // SwSh DLC labels (maps to base GameId; dlcRequired tracking is TODO)
  ['Expansion Pass', ['sword', 'shield']],
  ['The Isle of Armor', ['sword', 'shield']],
  ['Crown Tundra', ['sword', 'shield']],
  ['The Crown Tundra', ['sword', 'shield']],
  // SV DLC labels (maps to base GameId; dlcRequired tracking is TODO)
  ['The Teal Mask', ['scarlet', 'violet']],
  ['The Indigo Disk', ['scarlet', 'violet']],
  ['The Hidden Treasure of Area Zero', ['scarlet', 'violet']],
];

export function bulbapediaGameToGameIds(name: string): GameId[] {
  const trimmed = name.trim();
  for (const [bulbaName, ids] of MAPPINGS) {
    if (trimmed === bulbaName) return [...ids];
  }
  return [];
}
