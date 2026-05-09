import type { Dataset, Pokemon } from '@livingdex/types';
import { z } from 'zod';

const PokemonTypeSchema = z.enum([
  'normal',
  'fire',
  'water',
  'grass',
  'electric',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'dark',
  'steel',
  'fairy',
]);

const FormCategorySchema = z.enum(['default', 'regional', 'gigamax', 'alt', 'gender', 'cosmetic']);

const LocalizedNamesSchema = z.object({
  en: z.string().min(1),
  fr: z.string().min(1),
});

const SpritesSchema = z.object({
  default: z.string(),
  shiny: z.string(),
  artwork: z.string(),
  icon: z.string(),
});

const EvolutionLinkSchema = z.object({
  fromId: z.string(),
  toId: z.string(),
  method: z.enum(['level', 'item', 'trade', 'friendship', 'location', 'move', 'other']),
  conditions: z.array(
    z.object({
      type: z.enum([
        'minLevel',
        'item',
        'tradeWith',
        'tradeItem',
        'friendship',
        'location',
        'timeOfDay',
        'move',
        'special',
      ]),
      value: z.union([z.string(), z.number()]),
    }),
  ),
  soloAlternative: z.enum(['linking-cord', 'item']).nullable().optional(),
});

const PokemonSchema = z.object({
  id: z.string().min(1),
  nationalDexNumber: z.number().int().positive(),
  speciesSlug: z.string().min(1),
  formId: z.string().nullable(),
  formCategory: FormCategorySchema,
  names: LocalizedNamesSchema,
  types: z.array(PokemonTypeSchema).min(1).max(2),
  generation: z.number().int().min(1).max(9),
  sprites: SpritesSchema,
  evolutions: z.array(EvolutionLinkSchema),
});

const GameIdSchema = z.enum([
  'sword',
  'shield',
  'bdsp-d',
  'bdsp-p',
  'pla',
  'scarlet',
  'violet',
  'frlg-fr',
  'frlg-lg',
]);

const DlcSchema = z.object({
  id: z.string(),
  names: LocalizedNamesSchema,
  releaseDate: z.string(),
});

const GameSchema = z.object({
  id: GameIdSchema,
  names: LocalizedNamesSchema,
  generation: z.number().int().min(1).max(9),
  platform: z.literal('switch'),
  releaseDate: z.string(),
  dlcs: z.array(DlcSchema),
  pairedVersionId: GameIdSchema.optional(),
  supportsLinkingCord: z.boolean(),
  homeTransfer: z.enum(['direct', 'unsupported']),
});

const EncounterSchema = z.object({
  pokemonId: z.string(),
  gameId: GameIdSchema,
  dlcRequired: z.string().optional(),
  method: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('wild'),
      locations: z.array(z.string()),
      rarity: z.enum(['common', 'uncommon', 'rare', 'very-rare']).optional(),
    }),
    z.object({ type: z.literal('evolution'), fromId: z.string() }),
    z.object({ type: z.literal('breeding') }),
    z.object({ type: z.literal('gift'), from: z.string() }),
    z.object({ type: z.literal('fossil'), fossilItem: z.string() }),
    z.object({ type: z.literal('in-game-trade'), npc: z.string().optional() }),
    z.object({ type: z.literal('event'), distributedAs: z.string() }),
  ]),
  notes: z.string().optional(),
});

const DatasetMetaSchema = z.object({
  version: z.string(),
  schemaVersion: z.literal(1),
  scrapedFrom: z.array(z.enum(['pokeapi', 'bulbapedia', 'manual-overrides'])),
  generations: z.array(z.number().int().min(1).max(9)),
  pokemonCount: z.number().int().nonnegative(),
  encountersCount: z.number().int().nonnegative(),
});

const DatasetSchema = z.object({
  meta: DatasetMetaSchema,
  pokemon: z.array(PokemonSchema),
  games: z.array(GameSchema),
  encounters: z.array(EncounterSchema),
});

export function validateDataset(input: unknown): Dataset {
  return DatasetSchema.parse(input) as Dataset;
}

export function validatePokemon(input: unknown): Pokemon {
  return PokemonSchema.parse(input) as Pokemon;
}

export const datasetSchema = DatasetSchema;
export const pokemonSchema = PokemonSchema;
