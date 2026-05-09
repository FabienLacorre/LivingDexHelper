import type { FormCategory, Pokemon, PokemonType } from '@livingdex/types';
import type { PokeApiPokemon, PokeApiSpecies } from '../sources/pokeapi/species.ts';

const REGIONAL_SUFFIXES = ['alola', 'galar', 'hisui', 'paldea'];
const GIGAMAX_SUFFIX = 'gmax';
const EXCLUDED_SUFFIXES = ['mega', 'mega-x', 'mega-y', 'primal', 'totem'];
const ALT_PREFIXES = new Set([
  'deoxys',
  'kyurem',
  'necrozma',
  'calyrex',
  'ogerpon',
  'zacian',
  'zamazenta',
  'urshifu',
  'wishiwashi',
  'minior',
  'oricorio',
  'lycanroc',
  'rotom',
  'shaymin',
  'giratina',
  'darmanitan',
  'meloetta',
  'tornadus',
  'thundurus',
  'landorus',
  'enamorus',
]);

const GENERATION_NAME_TO_NUMBER: Record<string, number> = {
  'generation-i': 1,
  'generation-ii': 2,
  'generation-iii': 3,
  'generation-iv': 4,
  'generation-v': 5,
  'generation-vi': 6,
  'generation-vii': 7,
  'generation-viii': 8,
  'generation-ix': 9,
};

export function classifyForm(varietySlug: string, speciesSlug: string): FormCategory {
  if (varietySlug === speciesSlug) return 'default';

  const suffix = varietySlug.slice(speciesSlug.length + 1);

  if (EXCLUDED_SUFFIXES.some((s) => suffix === s || suffix.startsWith(`${s}-`))) {
    return 'cosmetic';
  }
  if (REGIONAL_SUFFIXES.some((s) => suffix === s || suffix.startsWith(`${s}-`))) {
    return 'regional';
  }
  if (suffix === GIGAMAX_SUFFIX) {
    return 'gigamax';
  }
  if (ALT_PREFIXES.has(speciesSlug)) {
    return 'alt';
  }
  return 'cosmetic';
}

export function isExcludedForm(varietySlug: string, speciesSlug: string): boolean {
  if (varietySlug === speciesSlug) return false;
  const suffix = varietySlug.slice(speciesSlug.length + 1);
  return EXCLUDED_SUFFIXES.some((s) => suffix === s || suffix.startsWith(`${s}-`));
}

function extractFormId(varietySlug: string, speciesSlug: string): string | null {
  if (varietySlug === speciesSlug) return null;
  const suffix = varietySlug.slice(speciesSlug.length + 1);
  if (suffix.length === 0) return null;
  return suffix;
}

function pickName(names: PokeApiSpecies['names'], lang: 'en' | 'fr'): string {
  const found = names.find((n) => n.language.name === lang);
  return found?.name ?? '';
}

function extractTypes(pokemon: PokeApiPokemon): PokemonType[] {
  return pokemon.types.map((t) => t.type.name as PokemonType);
}

function extractSprites(pokemon: PokeApiPokemon): Pokemon['sprites'] {
  // Use numeric ID for filenames so they match the PokeAPI sprite URL scheme
  // (e.g. sprites/pokemon/1.png, sprites/pokemon/10195.png for forms)
  const variantPath = `${pokemon.id}.png`;
  return {
    default: pokemon.sprites.front_default ? `default/${variantPath}` : '',
    shiny: pokemon.sprites.front_shiny ? `shiny/${variantPath}` : '',
    artwork: pokemon.sprites.other?.['official-artwork']?.front_default
      ? `artwork/${variantPath}`
      : '',
    icon: pokemon.sprites.versions?.['generation-viii']?.icons?.front_default
      ? `icons/${variantPath}`
      : '',
  };
}

export type NormalizePokemonOptions = {
  forceSpeciesSlug?: string;
};

export function normalizePokemon(
  species: PokeApiSpecies,
  pokemon: PokeApiPokemon,
  options: NormalizePokemonOptions = {},
): Pokemon | null {
  const speciesSlug = options.forceSpeciesSlug ?? species.name;
  if (isExcludedForm(pokemon.name, speciesSlug)) {
    return null;
  }

  const formId = extractFormId(pokemon.name, speciesSlug);
  const formCategory = classifyForm(pokemon.name, speciesSlug);
  const generation = species.generation?.name
    ? (GENERATION_NAME_TO_NUMBER[species.generation.name] ?? 1)
    : 1;

  return {
    id: pokemon.name,
    nationalDexNumber: species.id,
    speciesSlug,
    formId,
    formCategory,
    names: {
      en: pickName(species.names, 'en') || species.name,
      fr: pickName(species.names, 'fr') || pickName(species.names, 'en') || species.name,
    },
    types: extractTypes(pokemon),
    generation,
    sprites: extractSprites(pokemon),
    evolutions: [],
  };
}
