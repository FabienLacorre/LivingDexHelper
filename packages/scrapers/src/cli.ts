#!/usr/bin/env node
import { join } from 'node:path';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { SCRAPER_VERSION } from './index.ts';
import { writeDataset } from './output/writer.ts';
import { runPokeApiPipeline } from './pipeline.ts';
import { PokeApiClient } from './sources/pokeapi/client.ts';
import { downloadSprites } from './sources/pokeapi/sprites.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');

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

const POKEAPI_SPRITES_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites';

const { values } = parseArgs({
  options: {
    gen: { type: 'string', multiple: false },
    'no-cache': { type: 'boolean', default: false },
    'no-sprites': { type: 'boolean', default: false },
    out: { type: 'string', multiple: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
  strict: true,
});

if (values.help) {
  console.log(`@livingdex/scrapers v${SCRAPER_VERSION}

Usage:
  pnpm scrape [options]

Options:
  --gen <ranges>      Generation range, e.g. "1-9", "8,9", "8" (default: 1-9)
  --no-cache          Skip disk cache for PokéAPI requests
  --no-sprites        Skip sprite downloads (faster for testing)
  --out <dir>         Output dir (default: packages/data)
  -h, --help          Show this help

Examples:
  pnpm scrape --gen 1
  pnpm scrape --gen 8,9 --no-sprites
  pnpm scrape --no-cache
`);
  process.exit(0);
}

const generations = parseGenerations(values.gen ?? '1-9');
const cacheDir = join(REPO_ROOT, '.cache', 'pokeapi');
const outDir = values.out ? resolve(values.out) : join(REPO_ROOT, 'packages', 'data');
const spritesDir = join(outDir, 'sprites');

const speciesIds: number[] = [];
for (const gen of generations) {
  const range = GENERATION_RANGES[gen];
  if (!range) {
    console.error(`Unknown generation: ${gen}`);
    process.exit(1);
  }
  for (let id = range[0]; id <= range[1]; id++) speciesIds.push(id);
}

console.log(`@livingdex/scrapers v${SCRAPER_VERSION}`);
console.log(`Generations: ${generations.join(', ')}`);
console.log(`Species count: ${speciesIds.length}`);
console.log(`Cache: ${values['no-cache'] ? 'disabled' : cacheDir}`);
console.log(`Output: ${outDir}`);
console.log('');

const client = new PokeApiClient({ cacheDir, noCache: values['no-cache'] === true });

const dataset = await runPokeApiPipeline({
  client,
  speciesIds,
  generations,
  onProgress: (event) => {
    process.stdout.write(
      `\r[${event.stage}] ${event.current}/${event.total}: ${event.message}`.padEnd(80),
    );
  },
});
process.stdout.write('\n');

console.log(`\nFetched ${dataset.pokemon.length} Pokémon entries (with forms).`);

if (values['no-sprites'] !== true) {
  console.log('Downloading sprites...');
  const downloads = collectSpriteDownloads(dataset.pokemon, spritesDir);
  console.log(`Sprites to fetch: ${downloads.length}`);
  await downloadSprites(downloads, { concurrency: 20 });
  console.log('Sprites downloaded.');
} else {
  console.log('Skipping sprites (--no-sprites).');
}

await writeDataset(dataset, { outDir });
console.log(
  `\nDataset written to ${outDir}/dataset.json (${dataset.pokemon.length} Pokémon, ${dataset.encounters.length} encounters)`,
);

function parseGenerations(input: string): number[] {
  const result = new Set<number>();
  for (const segment of input.split(',')) {
    const trimmed = segment.trim();
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-').map((s) => Number.parseInt(s, 10));
      if (!start || !end) continue;
      for (let i = start; i <= end; i++) result.add(i);
    } else {
      const n = Number.parseInt(trimmed, 10);
      if (!Number.isNaN(n)) result.add(n);
    }
  }
  return Array.from(result).sort((a, b) => a - b);
}

function collectSpriteDownloads(
  pokemon: ReadonlyArray<{
    id: string;
    sprites: { default: string; shiny: string; artwork: string; icon: string };
  }>,
  spritesDir: string,
): Array<{ url: string; destPath: string }> {
  const result: Array<{ url: string; destPath: string }> = [];
  for (const p of pokemon) {
    if (p.sprites.default) {
      result.push({
        url: `${POKEAPI_SPRITES_BASE}/pokemon/${idFromPath(p.sprites.default)}`,
        destPath: join(spritesDir, p.sprites.default),
      });
    }
    if (p.sprites.shiny) {
      result.push({
        url: `${POKEAPI_SPRITES_BASE}/pokemon/shiny/${idFromPath(p.sprites.shiny)}`,
        destPath: join(spritesDir, p.sprites.shiny),
      });
    }
    if (p.sprites.artwork) {
      result.push({
        url: `${POKEAPI_SPRITES_BASE}/pokemon/other/official-artwork/${idFromPath(p.sprites.artwork)}`,
        destPath: join(spritesDir, p.sprites.artwork),
      });
    }
    if (p.sprites.icon) {
      result.push({
        url: `${POKEAPI_SPRITES_BASE}/pokemon/versions/generation-viii/icons/${idFromPath(p.sprites.icon)}`,
        destPath: join(spritesDir, p.sprites.icon),
      });
    }
  }
  return result;
}

function idFromPath(path: string): string {
  return path.split('/').pop() ?? path;
}
