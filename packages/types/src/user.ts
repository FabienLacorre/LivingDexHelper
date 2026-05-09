import type { GameId } from './game.ts';

export type OwnedGame = {
  gameId: GameId;
  ownedDlcs: string[];
};

export type HomeStatus = 'missing' | 'caught' | 'transferred';

export type PerGameStatus = 'untouched' | 'planned' | 'caught';

export type CollectionEntry = {
  pokemonId: string;
  homeStatus: HomeStatus;
  perGameStatus?: Partial<Record<GameId, PerGameStatus>>;
  note?: string;
  updatedAt: string;
};

export type Theme = 'light' | 'dark' | 'system';

export type SpriteStyle = '2d' | 'artwork' | 'icon';

export type Language = 'fr' | 'en';

export type GranularitySettings = {
  includeRegionalForms: boolean;
  includeGigamax: boolean;
  includeAltForms: boolean;
  includeGenderDifferences: boolean;
  includeShiny: boolean;
};

export type FeatureSettings = {
  enablePerGameTracking: boolean;
};

export type UiSettings = {
  theme: Theme;
  primarySpriteStyle: SpriteStyle;
};

export type UserSettings = {
  language: Language;
  soloMode: boolean;
  granularity: GranularitySettings;
  features: FeatureSettings;
  ui: UiSettings;
};

export const DEFAULT_USER_SETTINGS = {
  language: 'fr',
  soloMode: false,
  granularity: {
    includeRegionalForms: true,
    includeGigamax: true,
    includeAltForms: true,
    includeGenderDifferences: false,
    includeShiny: false,
  },
  features: {
    enablePerGameTracking: false,
  },
  ui: {
    theme: 'system',
    primarySpriteStyle: '2d',
  },
} as const satisfies UserSettings;
