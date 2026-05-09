import type { PokeApiClient } from './client.ts';

export type PokeApiSpeciesName = {
  language: { name: string };
  name: string;
};

export type PokeApiSpeciesVariety = {
  is_default: boolean;
  pokemon: { name: string; url: string };
};

export type PokeApiSpecies = {
  id: number;
  name: string;
  names: PokeApiSpeciesName[];
  varieties: PokeApiSpeciesVariety[];
  evolution_chain?: { url: string };
  generation?: { name: string };
};

export type PokeApiPokemonType = { type: { name: string } };

export type PokeApiPokemonSprites = {
  front_default?: string | null;
  front_shiny?: string | null;
  other?: {
    'official-artwork'?: { front_default?: string | null };
  };
  versions?: {
    'generation-viii'?: {
      icons?: { front_default?: string | null };
    };
  };
};

export type PokeApiPokemon = {
  id: number;
  name: string;
  types: PokeApiPokemonType[];
  sprites: PokeApiPokemonSprites;
};

export type SpeciesWithVarieties = {
  species: PokeApiSpecies;
  varieties: PokeApiPokemon[];
};

export async function fetchSpeciesWithVarieties(
  client: PokeApiClient,
  speciesId: number,
): Promise<SpeciesWithVarieties> {
  const species = await client.get<PokeApiSpecies>(`/pokemon-species/${speciesId}`);
  const varieties: PokeApiPokemon[] = [];
  for (const variety of species.varieties) {
    try {
      const pokemon = await client.get<PokeApiPokemon>(`/pokemon/${variety.pokemon.name}`);
      varieties.push(pokemon);
    } catch (err) {
      console.warn(`[species] skipping variety ${variety.pokemon.name}: ${(err as Error).message}`);
    }
  }
  return { species, varieties };
}
