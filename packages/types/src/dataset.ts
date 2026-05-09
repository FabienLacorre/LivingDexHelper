import type { Encounter } from './encounter.ts';
import type { Game } from './game.ts';
import type { Pokemon } from './pokemon.ts';

export type SchemaVersion = 1;

export const CURRENT_SCHEMA_VERSION: SchemaVersion = 1;

export type DatasetSource = 'pokeapi' | 'bulbapedia' | 'manual-overrides';

export type DatasetMeta = {
  version: string;
  schemaVersion: SchemaVersion;
  scrapedFrom: DatasetSource[];
  generations: number[];
  pokemonCount: number;
  encountersCount: number;
};

export type Dataset = {
  meta: DatasetMeta;
  pokemon: Pokemon[];
  games: Game[];
  encounters: Encounter[];
};
