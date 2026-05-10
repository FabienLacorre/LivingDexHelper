import { join, resolve } from 'node:path';
import {
  BulbapediaClient,
  PokeApiClient,
  type ProgressEvent,
  runCombinedPipeline,
} from '@livingdex/scrapers';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';

export const scrapeRouter = new Hono();

const GENERATION_RANGES: Record<number, [number, number]> = {
  1: [1, 151],
  2: [152, 251],
  3: [252, 386],
  4: [387, 493],
  5: [494, 649],
  6: [650, 721],
  7: [722, 809],
  8: [810, 905],
  9: [906, 1025],
};

scrapeRouter.get('/scrape', (c) => {
  const genParam = c.req.query('gen');
  if (!genParam) {
    return c.json({ error: 'Missing required query param: gen' }, 400);
  }
  const generations = parseGenerations(genParam);
  if (generations.length === 0) {
    return c.json({ error: 'Invalid gen param' }, 400);
  }

  const speciesIds: number[] = [];
  for (const g of generations) {
    const range = GENERATION_RANGES[g];
    if (range) {
      for (let id = range[0]; id <= range[1]; id++) speciesIds.push(id);
    }
  }

  return streamSSE(c, async (stream) => {
    const repoRoot = resolve(process.cwd());
    const pokeApiClient = new PokeApiClient({
      cacheDir: join(repoRoot, '.cache', 'pokeapi'),
    });
    const bulbapediaClient = new BulbapediaClient({
      cacheDir: join(repoRoot, '.cache', 'bulbapedia'),
    });
    const overridesDir = join(repoRoot, 'data-overrides');

    let eventId = 0;
    const send = (event: ProgressEvent | { stage: 'done'; message: string }) =>
      stream.writeSSE({
        id: String(eventId++),
        event: 'progress',
        data: JSON.stringify(event),
      });

    try {
      const result = await runCombinedPipeline({
        pokeApiClient,
        bulbapediaClient,
        speciesIds,
        generations,
        overridesDir,
        onProgress: (e) => {
          void send(e);
        },
      });
      await send({
        stage: 'done',
        message: `Scrape complete: ${result.dataset.pokemon.length} Pokémon, ${result.dataset.encounters.length} encounters`,
      });
    } catch (err) {
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({ error: (err as Error).message }),
      });
    }
  });
});

function parseGenerations(input: string): number[] {
  const result = new Set<number>();
  for (const segment of input.split(',')) {
    const trimmed = segment.trim();
    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-');
      const start = startStr ? Number.parseInt(startStr, 10) : Number.NaN;
      const end = endStr ? Number.parseInt(endStr, 10) : Number.NaN;
      if (!Number.isNaN(start) && !Number.isNaN(end)) {
        for (let i = start; i <= end; i++) result.add(i);
      }
    } else {
      const n = Number.parseInt(trimmed, 10);
      if (!Number.isNaN(n)) result.add(n);
    }
  }
  return Array.from(result).sort((a, b) => a - b);
}
