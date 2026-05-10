import type { Dataset, Encounter, Pokemon } from '@livingdex/types';
import { CURRENT_SCHEMA_VERSION } from '@livingdex/types';
import { applyOverrides } from './overrides/apply.ts';
import { generateCoverageReport, type CoverageReport } from './output/coverage.ts';
import { GAMES } from './normalizers/games.ts';
import { normalizePokemon } from './normalizers/pokemon.ts';
import type { BulbapediaClient } from './sources/bulbapedia/client.ts';
import { fetchBulbapediaEncounters } from './sources/bulbapedia/encounters.ts';
import type { PokeApiClient } from './sources/pokeapi/client.ts';
import { fetchEvolutionLinks } from './sources/pokeapi/evolution.ts';
import { fetchSpeciesWithVarieties } from './sources/pokeapi/species.ts';

export type ProgressEvent = {
  stage: 'species' | 'evolution' | 'sprites' | 'bulbapedia' | 'overrides' | 'write';
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

export type CombinedPipelineOptions = {
  pokeApiClient: PokeApiClient;
  bulbapediaClient: BulbapediaClient;
  speciesIds: number[];
  generations: number[];
  overridesDir: string;
  onProgress?: (event: ProgressEvent) => void;
};

export type CombinedPipelineResult = {
  dataset: Dataset;
  coverage: CoverageReport;
};

export async function runCombinedPipeline(
  options: CombinedPipelineOptions,
): Promise<CombinedPipelineResult> {
  const { pokeApiClient, bulbapediaClient, speciesIds, generations, overridesDir, onProgress } =
    options;

  // Phase 1: PokéAPI for Pokemon catalog
  const baseDataset = await runPokeApiPipeline({
    client: pokeApiClient,
    speciesIds,
    generations,
    ...(onProgress ? { onProgress } : {}),
  });

  // Phase 2: Bulbapedia for encounters per Pokemon
  const allEncounters: Encounter[] = [];
  const seenSpecies = new Set<string>();
  for (let i = 0; i < baseDataset.pokemon.length; i++) {
    const p = baseDataset.pokemon[i];
    if (!p) continue;
    if (seenSpecies.has(p.speciesSlug)) continue;
    seenSpecies.add(p.speciesSlug);

    onProgress?.({
      stage: 'bulbapedia',
      current: i + 1,
      total: baseDataset.pokemon.length,
      message: `Fetching Bulbapedia for ${p.speciesSlug}`,
    });

    const pageTitle = `${capitalize(p.speciesSlug)}_(Pokémon)`;
    const speciesEncounters = await fetchBulbapediaEncounters(
      bulbapediaClient,
      p.id,
      pageTitle,
    );
    allEncounters.push(...speciesEncounters);
  }

  // Phase 3: Apply manual overrides
  const finalEncounters = await applyOverrides(allEncounters, overridesDir);

  // Phase 4: Generate coverage report
  const coverage = generateCoverageReport(baseDataset.pokemon, finalEncounters);

  const dataset: Dataset = {
    ...baseDataset,
    meta: {
      ...baseDataset.meta,
      scrapedFrom: ['pokeapi', 'bulbapedia', 'manual-overrides'],
      encountersCount: finalEncounters.length,
    },
    encounters: finalEncounters,
  };

  return { dataset, coverage };
}

function capitalize(slug: string): string {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('_');
}
