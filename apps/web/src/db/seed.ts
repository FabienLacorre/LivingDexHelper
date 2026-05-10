import type { Dataset } from '@livingdex/types';
import { z } from 'zod';
import type { LivingDexDatabase } from './schema';

const DatasetSchema = z.object({
  meta: z.object({
    version: z.string(),
    schemaVersion: z.literal(1),
    scrapedFrom: z.array(z.string()),
    generations: z.array(z.number()),
    pokemonCount: z.number(),
    encountersCount: z.number(),
  }),
  pokemon: z.array(z.unknown()),
  games: z.array(z.unknown()),
  encounters: z.array(z.unknown()),
});

export type SeedResult = {
  seeded: boolean;
  version: string;
};

export async function seedCatalogIfNeeded(
  db: LivingDexDatabase,
  datasetUrl: string,
): Promise<SeedResult> {
  const response = await fetch(datasetUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch dataset: ${response.status} ${response.statusText}`);
  }
  const raw: unknown = await response.json();
  const validated = DatasetSchema.parse(raw);
  const dataset = raw as Dataset;

  const localMeta = await db.catalog_meta.get('meta');
  if (localMeta?.value?.version === validated.meta.version) {
    return { seeded: false, version: validated.meta.version };
  }

  await db.transaction(
    'rw',
    [db.catalog_meta, db.catalog_pokemon, db.catalog_games, db.catalog_encounters],
    async () => {
      await db.catalog_pokemon.clear();
      await db.catalog_games.clear();
      await db.catalog_encounters.clear();
      await db.catalog_pokemon.bulkPut(dataset.pokemon);
      await db.catalog_games.bulkPut(dataset.games);
      await db.catalog_encounters.bulkPut(
        dataset.encounters as Array<(typeof dataset.encounters)[number] & { id?: number }>,
      );
      await db.catalog_meta.put({ key: 'meta', value: dataset.meta });
    },
  );

  return { seeded: true, version: validated.meta.version };
}
