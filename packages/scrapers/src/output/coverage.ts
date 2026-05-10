import type { Encounter, GameId, Pokemon } from '@livingdex/types';

export type CoverageReport = {
  generatedAt: string;
  totalPokemon: number;
  pokemonWithAnyEncounter: number;
  pokemonWithoutEncounter: string[];
  byGame: Array<{
    gameId: GameId;
    encounterCount: number;
    uniquePokemonIds: number;
  }>;
};

export function generateCoverageReport(
  pokemon: Pokemon[],
  encounters: Encounter[],
): CoverageReport {
  const pokemonWithEncounter = new Set<string>();
  for (const enc of encounters) pokemonWithEncounter.add(enc.pokemonId);

  const pokemonWithoutEncounter = pokemon
    .filter((p) => !pokemonWithEncounter.has(p.id))
    .map((p) => p.id);

  const byGameMap = new Map<GameId, { count: number; ids: Set<string> }>();
  for (const enc of encounters) {
    const existing = byGameMap.get(enc.gameId) ?? { count: 0, ids: new Set<string>() };
    existing.count++;
    existing.ids.add(enc.pokemonId);
    byGameMap.set(enc.gameId, existing);
  }

  const byGame: CoverageReport['byGame'] = [];
  for (const [gameId, data] of byGameMap.entries()) {
    byGame.push({
      gameId,
      encounterCount: data.count,
      uniquePokemonIds: data.ids.size,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    totalPokemon: pokemon.length,
    pokemonWithAnyEncounter: pokemonWithEncounter.size,
    pokemonWithoutEncounter,
    byGame,
  };
}
