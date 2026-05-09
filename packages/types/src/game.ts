import type { LocalizedNames } from './pokemon.ts';

export type GameId =
  | 'sword'
  | 'shield'
  | 'bdsp-d'
  | 'bdsp-p'
  | 'pla'
  | 'scarlet'
  | 'violet'
  | 'frlg-fr'
  | 'frlg-lg';

export type Dlc = {
  id: string;
  names: LocalizedNames;
  releaseDate: string;
};

export type HomeTransfer = 'direct' | 'unsupported';

export type Game = {
  id: GameId;
  names: LocalizedNames;
  generation: number;
  platform: 'switch';
  releaseDate: string;
  dlcs: Dlc[];
  pairedVersionId?: GameId;
  supportsLinkingCord: boolean;
  homeTransfer: HomeTransfer;
};
