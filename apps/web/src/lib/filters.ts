import type { Pokemon, PokemonType } from '@livingdex/types';
import type { PokemonStatus } from './computeStatus';

export type DexFilters = {
  search: string;
  statuses: Set<PokemonStatus>;
  generations: Set<number>;
  types: Set<PokemonType>;
};

export const EMPTY_FILTERS: DexFilters = {
  search: '',
  statuses: new Set(),
  generations: new Set(),
  types: new Set(),
};

export function matchesSearch(pokemon: Pokemon, search: string): boolean {
  if (!search) return true;
  const lower = search.toLowerCase();
  return (
    pokemon.names.fr.toLowerCase().includes(lower) ||
    pokemon.names.en.toLowerCase().includes(lower) ||
    pokemon.id.toLowerCase().includes(lower) ||
    String(pokemon.nationalDexNumber).includes(lower)
  );
}

export function matchesGeneration(pokemon: Pokemon, gens: Set<number>): boolean {
  if (gens.size === 0) return true;
  return gens.has(pokemon.generation);
}

export function matchesType(pokemon: Pokemon, types: Set<PokemonType>): boolean {
  if (types.size === 0) return true;
  return pokemon.types.some((t) => types.has(t));
}
