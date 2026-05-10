import type { CollectionEntry, Encounter, GameId, OwnedGame, Pokemon } from '@livingdex/types';
import type { LivingDexDatabase } from './schema';

export async function getAllPokemon(db: LivingDexDatabase): Promise<Pokemon[]> {
  return db.catalog_pokemon.orderBy('nationalDexNumber').toArray();
}

export async function getPokemonById(
  db: LivingDexDatabase,
  id: string,
): Promise<Pokemon | undefined> {
  return db.catalog_pokemon.get(id);
}

export async function getEncountersForPokemon(
  db: LivingDexDatabase,
  pokemonId: string,
  gameIds: GameId[],
): Promise<Encounter[]> {
  if (gameIds.length === 0) return [];
  return db.catalog_encounters
    .where('pokemonId')
    .equals(pokemonId)
    .filter((e) => gameIds.includes(e.gameId))
    .toArray();
}

export async function getAllEncounters(db: LivingDexDatabase): Promise<Encounter[]> {
  return db.catalog_encounters.toArray();
}

export async function getOwnedGames(db: LivingDexDatabase): Promise<OwnedGame[]> {
  return db.user_ownedGames.toArray();
}

export async function setOwnedGame(db: LivingDexDatabase, game: OwnedGame): Promise<void> {
  await db.user_ownedGames.put(game);
}

export async function removeOwnedGame(db: LivingDexDatabase, gameId: GameId): Promise<void> {
  await db.user_ownedGames.delete(gameId);
}

export async function getCollection(db: LivingDexDatabase): Promise<CollectionEntry[]> {
  return db.user_collection.toArray();
}

export async function setCollectionEntry(
  db: LivingDexDatabase,
  entry: CollectionEntry,
): Promise<void> {
  await db.user_collection.put(entry);
}
