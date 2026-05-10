import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { Encounter } from '@livingdex/types';

export async function applyOverrides(
  autoEncounters: Encounter[],
  overridesDir: string,
): Promise<Encounter[]> {
  const overrides = loadOverrides(overridesDir);
  if (overrides.length === 0) return autoEncounters;

  // Index auto encounters by (pokemonId, gameId, method.type) for replacement detection.
  const result = new Map<string, Encounter>();
  for (const enc of autoEncounters) {
    result.set(keyOf(enc), enc);
  }
  for (const override of overrides) {
    result.set(keyOf(override), override);
  }
  return Array.from(result.values());
}

function loadOverrides(dir: string): Encounter[] {
  let files: string[];
  try {
    files = readdirSync(dir);
  } catch {
    return [];
  }
  const result: Encounter[] = [];
  for (const file of files) {
    if (extname(file) !== '.json') continue;
    const filePath = join(dir, file);
    try {
      const raw = readFileSync(filePath, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        result.push(...(parsed as Encounter[]));
      }
    } catch (err) {
      console.warn(`[overrides] failed to load ${file}: ${(err as Error).message}`);
    }
  }
  return result;
}

function keyOf(enc: Encounter): string {
  return `${enc.pokemonId}|${enc.gameId}|${enc.method.type}`;
}
