import type { CollectionEntry, Encounter, Game, OwnedGame, Pokemon } from '@livingdex/types';

export type PokemonStatus =
  | 'owned'
  | 'available'
  | 'blocked-solo'
  | 'event'
  | 'version-exclusive'
  | 'unavailable';

export type StatusInputs = {
  pokemon: Pokemon;
  encounters: Encounter[];
  games: Game[];
  ownedGames: OwnedGame[];
  soloMode: boolean;
  collection: CollectionEntry | undefined;
};

export function computeStatus(input: StatusInputs): PokemonStatus {
  const { pokemon, encounters, games, ownedGames, soloMode, collection } = input;

  if (collection && collection.homeStatus !== 'missing') return 'owned';

  const ownedGameIds = new Set(ownedGames.map((g) => g.gameId));
  const ownedDlcsByGame = new Map(ownedGames.map((g) => [g.gameId, new Set(g.ownedDlcs)]));

  const obtainablePaths = encounters.filter((e) => {
    if (e.pokemonId !== pokemon.id) return false;
    if (!ownedGameIds.has(e.gameId)) return false;
    if (e.dlcRequired && !ownedDlcsByGame.get(e.gameId)?.has(e.dlcRequired)) return false;
    return true;
  });

  if (obtainablePaths.length === 0) {
    const pairedExclusive = encounters.some((e) => {
      if (e.pokemonId !== pokemon.id) return false;
      const game = games.find((g) => g.id === e.gameId);
      if (!game) return false;
      const paired = game.pairedVersionId;
      return paired ? ownedGameIds.has(paired) : false;
    });
    return pairedExclusive ? 'version-exclusive' : 'unavailable';
  }

  if (obtainablePaths.every((p) => p.method.type === 'event')) {
    return 'event';
  }

  if (soloMode) {
    const soloPaths = obtainablePaths.filter((p) => isSoloFriendly(p, pokemon, games));
    if (soloPaths.length === 0) return 'blocked-solo';
    return 'available';
  }

  return 'available';
}

function isSoloFriendly(encounter: Encounter, pokemon: Pokemon, games: Game[]): boolean {
  if (encounter.method.type === 'in-game-trade') return false;
  if (encounter.method.type === 'event') return false;
  if (encounter.method.type === 'evolution') {
    const evo = pokemon.evolutions.find((e) => e.toId === pokemon.id);
    if (evo?.method === 'trade') {
      const game = games.find((g) => g.id === encounter.gameId);
      return game?.supportsLinkingCord === true && evo.soloAlternative === 'linking-cord';
    }
  }
  return true;
}
