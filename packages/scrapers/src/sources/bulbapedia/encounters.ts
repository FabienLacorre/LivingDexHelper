import type { Encounter } from '@livingdex/types';
import { normalizeBulbapediaEntry } from '../../normalizers/encounters.ts';
import type { BulbapediaClient } from './client.ts';
import { extractGameLocationsSection, parseAvailabilityEntries } from './parser.ts';

export async function fetchBulbapediaEncounters(
  client: BulbapediaClient,
  pokemonId: string,
  pageTitle: string,
): Promise<Encounter[]> {
  let wikitext: string;
  try {
    wikitext = await client.getWikitext(pageTitle);
  } catch (err) {
    console.warn(`[bulbapedia] failed to fetch ${pageTitle}: ${(err as Error).message}`);
    return [];
  }

  const section = extractGameLocationsSection(wikitext);
  if (!section) return [];

  const rawEntries = parseAvailabilityEntries(section);
  const encounters: Encounter[] = [];
  for (const entry of rawEntries) {
    encounters.push(...normalizeBulbapediaEntry(entry, pokemonId));
  }
  return encounters;
}
