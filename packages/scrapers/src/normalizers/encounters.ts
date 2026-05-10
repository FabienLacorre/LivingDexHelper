import type { Encounter, EncounterMethod } from '@livingdex/types';
import { bulbapediaGameToGameIds } from '../sources/bulbapedia/games-map.ts';
import type { RawAvailabilityEntry } from '../sources/bulbapedia/parser.ts';

/**
 * Convert one Bulbapedia raw availability entry into one or more Encounter
 * objects (one per matching GameId — e.g., "Sword/Shield" produces two).
 *
 * Returns [] for unrecognized game labels or explicitly unobtainable entries.
 */
export function normalizeBulbapediaEntry(
  entry: RawAvailabilityEntry,
  pokemonId: string,
): Encounter[] {
  if (entry.isUnobtainable) return [];
  const gameIds = bulbapediaGameToGameIds(entry.gameLabel);
  if (gameIds.length === 0) return [];

  const method = inferMethod(entry.rawDescription);

  return gameIds.map((gameId) => {
    const encounter: Encounter = { pokemonId, gameId, method };
    if (entry.rawDescription) {
      encounter.notes = entry.rawDescription;
    }
    return encounter;
  });
}

function inferMethod(description: string): EncounterMethod {
  const lower = description.toLowerCase();
  if (/^evolv|evolve from|evolve\s/.test(lower) || /\bevolve\b/.test(lower)) {
    return { type: 'evolution', fromId: 'unknown' };
  }
  if (/breed|egg from|hatch/.test(lower)) {
    return { type: 'breeding' };
  }
  if (/gift|given by|received from|professor/.test(lower)) {
    return { type: 'gift', from: extractGiftSource(description) };
  }
  if (/fossil/.test(lower)) {
    return { type: 'fossil', fossilItem: 'unknown' };
  }
  if (/trade with|in-game trade/.test(lower)) {
    return { type: 'in-game-trade' };
  }
  if (/event|distribution/.test(lower)) {
    return { type: 'event', distributedAs: description };
  }
  // Default: wild encounter, parse locations from description.
  const locations = parseLocations(description);
  return { type: 'wild', locations };
}

function parseLocations(description: string): string[] {
  if (!description) return [];
  return description
    .split(/[,;]\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^\(/.test(s));
}

function extractGiftSource(description: string): string {
  const match = /from\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/.exec(description);
  return match?.[1] ?? 'NPC';
}
