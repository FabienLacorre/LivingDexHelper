import type { Dataset, Pokemon } from '@livingdex/types';
import { CURRENT_SCHEMA_VERSION } from '@livingdex/types';
import { GAMES } from './normalizers/games.ts';
import { normalizePokemon } from './normalizers/pokemon.ts';
import type { PokeApiClient } from './sources/pokeapi/client.ts';
import { fetchEvolutionLinks } from './sources/pokeapi/evolution.ts';
import { fetchSpeciesWithVarieties } from './sources/pokeapi/species.ts';

export type ProgressEvent = {
  stage: 'species' | 'evolution' | 'sprites' | 'write';
  current: number;
  total: number;
  message: string;
};

export type PipelineOptions = {
  client: PokeApiClient;
  speciesIds: number[];
  generations: number[];
  onProgress?: (event: ProgressEvent) => void;
};

export async function runPokeApiPipeline(options: PipelineOptions): Promise<Dataset> {
  const { client, speciesIds, generations, onProgress } = options;
  const pokemon: Pokemon[] = [];
  const evolutionChainsSeen = new Set<string>();
  const evolutionsBySpecies = new Map<string, Pokemon['evolutions']>();

  for (let i = 0; i < speciesIds.length; i++) {
    const speciesId = speciesIds[i] ?? 0;
    onProgress?.({
      stage: 'species',
      current: i + 1,
      total: speciesIds.length,
      message: `Fetching species ${speciesId}`,
    });

    const { species, varieties } = await fetchSpeciesWithVarieties(client, speciesId);

    for (const variety of varieties) {
      const normalized = normalizePokemon(species, variety);
      if (normalized) pokemon.push(normalized);
    }

    if (species.evolution_chain?.url) {
      const chainId = parseChainId(species.evolution_chain.url);
      if (chainId != null && !evolutionChainsSeen.has(species.name)) {
        evolutionChainsSeen.add(species.name);
        const links = await fetchEvolutionLinks(client, chainId);
        for (const link of links) {
          const existing = evolutionsBySpecies.get(link.fromId) ?? [];
          existing.push(link);
          evolutionsBySpecies.set(link.fromId, existing);
        }
      }
    }
  }

  for (const p of pokemon) {
    p.evolutions = evolutionsBySpecies.get(p.speciesSlug) ?? [];
  }

  return {
    meta: {
      version: new Date().toISOString(),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      scrapedFrom: ['pokeapi'],
      generations,
      pokemonCount: pokemon.length,
      encountersCount: 0,
    },
    pokemon,
    games: GAMES,
    encounters: [],
  };
}

function parseChainId(url: string): number | null {
  const match = url.match(/\/evolution-chain\/(\d+)\//);
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
}
