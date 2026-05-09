import type { Game, GameId } from '@livingdex/types';

export const GAMES: Game[] = [
  {
    id: 'sword',
    names: { en: 'Pokémon Sword', fr: 'Pokémon Épée' },
    generation: 8,
    platform: 'switch',
    releaseDate: '2019-11-15',
    dlcs: [
      {
        id: 'isle-of-armor',
        names: { en: 'The Isle of Armor', fr: "L'Île Solitaire de l'Armure" },
        releaseDate: '2020-06-17',
      },
      {
        id: 'crown-tundra',
        names: { en: 'The Crown Tundra', fr: 'Les Terres Enneigées de la Couronne' },
        releaseDate: '2020-10-22',
      },
    ],
    pairedVersionId: 'shield',
    supportsLinkingCord: true,
    homeTransfer: 'direct',
  },
  {
    id: 'shield',
    names: { en: 'Pokémon Shield', fr: 'Pokémon Bouclier' },
    generation: 8,
    platform: 'switch',
    releaseDate: '2019-11-15',
    dlcs: [
      {
        id: 'isle-of-armor',
        names: { en: 'The Isle of Armor', fr: "L'Île Solitaire de l'Armure" },
        releaseDate: '2020-06-17',
      },
      {
        id: 'crown-tundra',
        names: { en: 'The Crown Tundra', fr: 'Les Terres Enneigées de la Couronne' },
        releaseDate: '2020-10-22',
      },
    ],
    pairedVersionId: 'sword',
    supportsLinkingCord: true,
    homeTransfer: 'direct',
  },
  {
    id: 'bdsp-d',
    names: { en: 'Pokémon Brilliant Diamond', fr: 'Pokémon Diamant Étincelant' },
    generation: 8,
    platform: 'switch',
    releaseDate: '2021-11-19',
    dlcs: [],
    pairedVersionId: 'bdsp-p',
    supportsLinkingCord: true,
    homeTransfer: 'direct',
  },
  {
    id: 'bdsp-p',
    names: { en: 'Pokémon Shining Pearl', fr: 'Pokémon Perle Scintillante' },
    generation: 8,
    platform: 'switch',
    releaseDate: '2021-11-19',
    dlcs: [],
    pairedVersionId: 'bdsp-d',
    supportsLinkingCord: true,
    homeTransfer: 'direct',
  },
  {
    id: 'pla',
    names: { en: 'Pokémon Legends: Arceus', fr: 'Légendes Pokémon : Arceus' },
    generation: 8,
    platform: 'switch',
    releaseDate: '2022-01-28',
    dlcs: [],
    supportsLinkingCord: true,
    homeTransfer: 'direct',
  },
  {
    id: 'scarlet',
    names: { en: 'Pokémon Scarlet', fr: 'Pokémon Écarlate' },
    generation: 9,
    platform: 'switch',
    releaseDate: '2022-11-18',
    dlcs: [
      {
        id: 'teal-mask',
        names: { en: 'The Teal Mask', fr: 'Le Masque Turquoise' },
        releaseDate: '2023-09-13',
      },
      {
        id: 'indigo-disk',
        names: { en: 'The Indigo Disk', fr: 'Le Disque Indigo' },
        releaseDate: '2023-12-14',
      },
    ],
    pairedVersionId: 'violet',
    supportsLinkingCord: true,
    homeTransfer: 'direct',
  },
  {
    id: 'violet',
    names: { en: 'Pokémon Violet', fr: 'Pokémon Violet' },
    generation: 9,
    platform: 'switch',
    releaseDate: '2022-11-18',
    dlcs: [
      {
        id: 'teal-mask',
        names: { en: 'The Teal Mask', fr: 'Le Masque Turquoise' },
        releaseDate: '2023-09-13',
      },
      {
        id: 'indigo-disk',
        names: { en: 'The Indigo Disk', fr: 'Le Disque Indigo' },
        releaseDate: '2023-12-14',
      },
    ],
    pairedVersionId: 'scarlet',
    supportsLinkingCord: true,
    homeTransfer: 'direct',
  },
  {
    id: 'frlg-fr',
    names: { en: 'Pokémon FireRed (Switch)', fr: 'Pokémon Rouge Feu (Switch)' },
    generation: 3,
    platform: 'switch',
    releaseDate: '2004-09-09',
    dlcs: [],
    pairedVersionId: 'frlg-lg',
    supportsLinkingCord: false,
    homeTransfer: 'unsupported',
  },
  {
    id: 'frlg-lg',
    names: { en: 'Pokémon LeafGreen (Switch)', fr: 'Pokémon Vert Feuille (Switch)' },
    generation: 3,
    platform: 'switch',
    releaseDate: '2004-09-09',
    dlcs: [],
    pairedVersionId: 'frlg-fr',
    supportsLinkingCord: false,
    homeTransfer: 'unsupported',
  },
];

export function getGameById(id: GameId): Game | undefined {
  return GAMES.find((g) => g.id === id);
}

export function getPairedVersionId(id: GameId): GameId | undefined {
  return getGameById(id)?.pairedVersionId;
}
