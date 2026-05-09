# Plan 02 — PokéAPI Scrapers + First Real Dataset

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the PokéAPI half of the build-time data pipeline. After this plan, `pnpm scrape` produces a real, validated `dataset.json` populated with ~1500 Pokémon (species + forms), full evolution chains, and downloaded sprites. The web app's `datasetMeta` reads non-zero counts. Encounters per game and manual overrides are deferred to Plan 03 (Bulbapedia).

**Architecture:**
- Pure-logic scrapers package (`packages/scrapers`): no top-level I/O, every function takes inputs and returns outputs. Disk I/O lives in dedicated client/writer modules with thin interfaces.
- PokéAPI fetched with disk caching in `.cache/pokeapi/` (gitignored). Re-scrape skips network for unchanged endpoints.
- Form classification (default/regional/gigamax/alt) is heuristic-driven via a curated mapping in `normalizers/pokemon.ts`. Megas, totem forms, and cosmetic event costumes are explicitly skipped.
- Sprites (4 styles × ~1500 variants ≈ 6000 PNGs, ~90 MB) downloaded in parallel from `raw.githubusercontent.com/PokeAPI/sprites`, hash-verified, and committed in `packages/data/sprites/`.
- Zod schemas guard the dataset shape: pipeline fails before writing if the output is malformed.

**Tech Stack:** zod (runtime validation), @std/p-limit or simple semaphore (concurrency), node:util.parseArgs (CLI), node:crypto (MD5), tsx (runtime), vitest (tests).

**Spec reference:** `docs/superpowers/specs/2026-05-09-pokemon-livingdex-design.md` sections 7 (Pipeline de scraping), 10 (Sprites).

**Hors scope (Plan 03):** Bulbapedia parser, encounters per game, manual overrides, scraper-api SSE endpoint.

---

## File Structure (created/modified by this plan)

```
packages/scrapers/
├── package.json                          ← UPDATE: add zod
├── src/
│   ├── index.ts                          ← UPDATE: export public API
│   ├── cli.ts                            ← REPLACE: real CLI with arg parsing
│   ├── sources/
│   │   └── pokeapi/
│   │       ├── client.ts                 ← fetch + cache + rate limit
│   │       ├── species.ts                ← /pokemon-species/{id}, /pokemon/{slug}
│   │       ├── evolution.ts              ← /evolution-chain/{id}
│   │       └── sprites.ts                ← download PNGs in parallel
│   ├── normalizers/
│   │   ├── pokemon.ts                    ← variety classification + Pokemon shape
│   │   └── games.ts                      ← static games table
│   ├── output/
│   │   ├── writer.ts                     ← write dataset.json + sprites/
│   │   └── validator.ts                  ← Zod schemas
│   └── pipeline.ts                       ← orchestrator
└── tests/
    ├── fixtures/
    │   ├── pokeapi-species-pikachu.json
    │   ├── pokeapi-species-raichu.json
    │   ├── pokeapi-pokemon-pikachu.json
    │   ├── pokeapi-pokemon-raichu-alola.json
    │   ├── pokeapi-evolution-pichu-chain.json
    │   └── pokeapi-pokemon-charizard-gmax.json
    ├── client.test.ts
    ├── species.test.ts
    ├── evolution.test.ts
    ├── pokemon-normalizer.test.ts
    ├── games-normalizer.test.ts
    ├── validator.test.ts
    └── pipeline.test.ts

packages/data/
├── dataset.json                          ← UPDATE: populated with ~1500 Pokémon
├── dataset-meta.json                     ← UPDATE: real counts and timestamp
└── sprites/                              ← NEW: ~90 MB of PNGs (committed)
    ├── default/
    ├── shiny/
    ├── artwork/
    └── icons/
```

**Files NOT created in this plan (reserved for Plan 03+):**
- `packages/scrapers/src/sources/bulbapedia/` — Plan 03
- `packages/scrapers/src/normalizers/encounters.ts` — Plan 03
- `packages/scrapers/src/overrides/apply.ts` — Plan 03
- `data-overrides/*.json` — Plan 03
- `apps/scraper-api/src/routes/scrape.ts` (SSE endpoint) — Plan 04

---

## Task 1: Add Zod and define output validator schemas

**Files:**
- Modify: `packages/scrapers/package.json` (add `zod` dep)
- Create: `packages/scrapers/src/output/validator.ts`
- Create: `packages/scrapers/tests/validator.test.ts`

- [ ] **Step 1.1: Add zod to scrapers package**

Edit `packages/scrapers/package.json`. Add `"zod": "3.23.8"` to `dependencies` (after `@livingdex/data`):

```json
"dependencies": {
  "@livingdex/data": "workspace:*",
  "@livingdex/types": "workspace:*",
  "zod": "3.23.8"
},
```

- [ ] **Step 1.2: Run `pnpm install`**

Run: `pnpm install`
Expected: zod 3.23.8 installed in `packages/scrapers/node_modules/`.

- [ ] **Step 1.3: Write the failing test**

Create `packages/scrapers/tests/validator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateDataset, validatePokemon } from '../src/output/validator.ts';

describe('validateDataset', () => {
  it('accepts an empty valid dataset', () => {
    const dataset = {
      meta: {
        version: '2026-05-09T14:30:00.000Z',
        schemaVersion: 1,
        scrapedFrom: ['pokeapi'],
        generations: [1],
        pokemonCount: 0,
        encountersCount: 0,
      },
      pokemon: [],
      games: [],
      encounters: [],
    };
    expect(() => validateDataset(dataset)).not.toThrow();
  });

  it('rejects a dataset missing the meta block', () => {
    const dataset = { pokemon: [], games: [], encounters: [] };
    expect(() => validateDataset(dataset)).toThrow();
  });

  it('rejects a Pokemon with missing names', () => {
    const pokemon = {
      id: 'pikachu',
      nationalDexNumber: 25,
      speciesSlug: 'pikachu',
      formId: null,
      formCategory: 'default',
      names: { en: 'Pikachu' },
      types: ['electric'],
      generation: 1,
      sprites: { default: '', shiny: '', artwork: '', icon: '' },
      evolutions: [],
    };
    expect(() => validatePokemon(pokemon)).toThrow();
  });

  it('rejects a Pokemon with an unknown type', () => {
    const pokemon = {
      id: 'pikachu',
      nationalDexNumber: 25,
      speciesSlug: 'pikachu',
      formId: null,
      formCategory: 'default',
      names: { en: 'Pikachu', fr: 'Pikachu' },
      types: ['lightning'],
      generation: 1,
      sprites: { default: '', shiny: '', artwork: '', icon: '' },
      evolutions: [],
    };
    expect(() => validatePokemon(pokemon)).toThrow();
  });
});
```

- [ ] **Step 1.4: Run test to confirm failure**

Run: `pnpm --filter @livingdex/scrapers test`
Expected: 4 failing tests because `../src/output/validator.ts` doesn't exist.

- [ ] **Step 1.5: Implement the validator**

Create `packages/scrapers/src/output/validator.ts`:

```typescript
import { z } from 'zod';
import type { Dataset, Pokemon } from '@livingdex/types';

const PokemonTypeSchema = z.enum([
  'normal',
  'fire',
  'water',
  'grass',
  'electric',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'dark',
  'steel',
  'fairy',
]);

const FormCategorySchema = z.enum([
  'default',
  'regional',
  'gigamax',
  'alt',
  'gender',
  'cosmetic',
]);

const LocalizedNamesSchema = z.object({
  en: z.string().min(1),
  fr: z.string().min(1),
});

const SpritesSchema = z.object({
  default: z.string(),
  shiny: z.string(),
  artwork: z.string(),
  icon: z.string(),
});

const EvolutionLinkSchema = z.object({
  fromId: z.string(),
  toId: z.string(),
  method: z.enum(['level', 'item', 'trade', 'friendship', 'location', 'move', 'other']),
  conditions: z.array(
    z.object({
      type: z.enum([
        'minLevel',
        'item',
        'tradeWith',
        'tradeItem',
        'friendship',
        'location',
        'timeOfDay',
        'move',
        'special',
      ]),
      value: z.union([z.string(), z.number()]),
    }),
  ),
  soloAlternative: z.enum(['linking-cord', 'item']).nullable().optional(),
});

const PokemonSchema = z.object({
  id: z.string().min(1),
  nationalDexNumber: z.number().int().positive(),
  speciesSlug: z.string().min(1),
  formId: z.string().nullable(),
  formCategory: FormCategorySchema,
  names: LocalizedNamesSchema,
  types: z.array(PokemonTypeSchema).min(1).max(2),
  generation: z.number().int().min(1).max(9),
  sprites: SpritesSchema,
  evolutions: z.array(EvolutionLinkSchema),
});

const GameIdSchema = z.enum([
  'sword',
  'shield',
  'bdsp-d',
  'bdsp-p',
  'pla',
  'scarlet',
  'violet',
  'frlg-fr',
  'frlg-lg',
]);

const DlcSchema = z.object({
  id: z.string(),
  names: LocalizedNamesSchema,
  releaseDate: z.string(),
});

const GameSchema = z.object({
  id: GameIdSchema,
  names: LocalizedNamesSchema,
  generation: z.number().int().min(1).max(9),
  platform: z.literal('switch'),
  releaseDate: z.string(),
  dlcs: z.array(DlcSchema),
  pairedVersionId: GameIdSchema.optional(),
  supportsLinkingCord: z.boolean(),
  homeTransfer: z.enum(['direct', 'unsupported']),
});

const EncounterSchema = z.object({
  pokemonId: z.string(),
  gameId: GameIdSchema,
  dlcRequired: z.string().optional(),
  method: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('wild'),
      locations: z.array(z.string()),
      rarity: z.enum(['common', 'uncommon', 'rare', 'very-rare']).optional(),
    }),
    z.object({ type: z.literal('evolution'), fromId: z.string() }),
    z.object({ type: z.literal('breeding') }),
    z.object({ type: z.literal('gift'), from: z.string() }),
    z.object({ type: z.literal('fossil'), fossilItem: z.string() }),
    z.object({ type: z.literal('in-game-trade'), npc: z.string().optional() }),
    z.object({ type: z.literal('event'), distributedAs: z.string() }),
  ]),
  notes: z.string().optional(),
});

const DatasetMetaSchema = z.object({
  version: z.string(),
  schemaVersion: z.literal(1),
  scrapedFrom: z.array(z.enum(['pokeapi', 'bulbapedia', 'manual-overrides'])),
  generations: z.array(z.number().int().min(1).max(9)),
  pokemonCount: z.number().int().nonnegative(),
  encountersCount: z.number().int().nonnegative(),
});

const DatasetSchema = z.object({
  meta: DatasetMetaSchema,
  pokemon: z.array(PokemonSchema),
  games: z.array(GameSchema),
  encounters: z.array(EncounterSchema),
});

export function validateDataset(input: unknown): Dataset {
  return DatasetSchema.parse(input) as Dataset;
}

export function validatePokemon(input: unknown): Pokemon {
  return PokemonSchema.parse(input) as Pokemon;
}

export const datasetSchema = DatasetSchema;
export const pokemonSchema = PokemonSchema;
```

- [ ] **Step 1.6: Run tests to confirm pass**

Run: `pnpm --filter @livingdex/scrapers test`
Expected: 4 passing tests.

- [ ] **Step 1.7: Run typecheck and lint**

Run: `pnpm --filter @livingdex/scrapers typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 1.8: Commit**

```bash
git add packages/scrapers/ pnpm-lock.yaml
git commit -m "feat(scrapers): add Zod schemas and dataset validator"
```

---

## Task 2: Static games table

**Files:**
- Create: `packages/scrapers/src/normalizers/games.ts`
- Create: `packages/scrapers/tests/games-normalizer.test.ts`

- [ ] **Step 2.1: Write the failing test**

Create `packages/scrapers/tests/games-normalizer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { GAMES, getGameById, getPairedVersionId } from '../src/normalizers/games.ts';

describe('GAMES table', () => {
  it('contains exactly 9 games (the v1 supported list)', () => {
    expect(GAMES).toHaveLength(9);
  });

  it('all games are on Switch platform', () => {
    for (const game of GAMES) {
      expect(game.platform).toBe('switch');
    }
  });

  it('Sword and Shield are paired versions', () => {
    const sword = getGameById('sword');
    const shield = getGameById('shield');
    expect(sword?.pairedVersionId).toBe('shield');
    expect(shield?.pairedVersionId).toBe('sword');
  });

  it('Sword has Isle of Armor and Crown Tundra DLCs', () => {
    const sword = getGameById('sword');
    expect(sword?.dlcs.map((d) => d.id)).toEqual(['isle-of-armor', 'crown-tundra']);
  });

  it('FRLG-FR is on generation 3 with homeTransfer unsupported', () => {
    const frlg = getGameById('frlg-fr');
    expect(frlg?.generation).toBe(3);
    expect(frlg?.homeTransfer).toBe('unsupported');
    expect(frlg?.supportsLinkingCord).toBe(false);
  });

  it('Switch games (gen 8/9) support Linking Cord', () => {
    expect(getGameById('sword')?.supportsLinkingCord).toBe(true);
    expect(getGameById('bdsp-d')?.supportsLinkingCord).toBe(true);
    expect(getGameById('pla')?.supportsLinkingCord).toBe(true);
    expect(getGameById('scarlet')?.supportsLinkingCord).toBe(true);
  });

  it('getPairedVersionId returns the correct partner', () => {
    expect(getPairedVersionId('scarlet')).toBe('violet');
    expect(getPairedVersionId('violet')).toBe('scarlet');
    expect(getPairedVersionId('pla')).toBeUndefined();
  });
});
```

- [ ] **Step 2.2: Run test to confirm failure**

Run: `pnpm --filter @livingdex/scrapers test`
Expected: 7 failing tests for `games-normalizer.test.ts`.

- [ ] **Step 2.3: Implement**

Create `packages/scrapers/src/normalizers/games.ts`:

```typescript
import type { Game, GameId } from '@livingdex/types';

export const GAMES: Game[] = [
  {
    id: 'sword',
    names: { en: 'Pokémon Sword', fr: 'Pokémon Épée' },
    generation: 8,
    platform: 'switch',
    releaseDate: '2019-11-15',
    dlcs: [
      {
        id: 'isle-of-armor',
        names: { en: 'The Isle of Armor', fr: "L'Île Solitaire de l'Armure" },
        releaseDate: '2020-06-17',
      },
      {
        id: 'crown-tundra',
        names: { en: 'The Crown Tundra', fr: 'Les Terres Enneigées de la Couronne' },
        releaseDate: '2020-10-22',
      },
    ],
    pairedVersionId: 'shield',
    supportsLinkingCord: true,
    homeTransfer: 'direct',
  },
  {
    id: 'shield',
    names: { en: 'Pokémon Shield', fr: 'Pokémon Bouclier' },
    generation: 8,
    platform: 'switch',
    releaseDate: '2019-11-15',
    dlcs: [
      {
        id: 'isle-of-armor',
        names: { en: 'The Isle of Armor', fr: "L'Île Solitaire de l'Armure" },
        releaseDate: '2020-06-17',
      },
      {
        id: 'crown-tundra',
        names: { en: 'The Crown Tundra', fr: 'Les Terres Enneigées de la Couronne' },
        releaseDate: '2020-10-22',
      },
    ],
    pairedVersionId: 'sword',
    supportsLinkingCord: true,
    homeTransfer: 'direct',
  },
  {
    id: 'bdsp-d',
    names: { en: 'Pokémon Brilliant Diamond', fr: 'Pokémon Diamant Étincelant' },
    generation: 8,
    platform: 'switch',
    releaseDate: '2021-11-19',
    dlcs: [],
    pairedVersionId: 'bdsp-p',
    supportsLinkingCord: true,
    homeTransfer: 'direct',
  },
  {
    id: 'bdsp-p',
    names: { en: 'Pokémon Shining Pearl', fr: 'Pokémon Perle Scintillante' },
    generation: 8,
    platform: 'switch',
    releaseDate: '2021-11-19',
    dlcs: [],
    pairedVersionId: 'bdsp-d',
    supportsLinkingCord: true,
    homeTransfer: 'direct',
  },
  {
    id: 'pla',
    names: { en: 'Pokémon Legends: Arceus', fr: 'Légendes Pokémon : Arceus' },
    generation: 8,
    platform: 'switch',
    releaseDate: '2022-01-28',
    dlcs: [],
    supportsLinkingCord: true,
    homeTransfer: 'direct',
  },
  {
    id: 'scarlet',
    names: { en: 'Pokémon Scarlet', fr: 'Pokémon Écarlate' },
    generation: 9,
    platform: 'switch',
    releaseDate: '2022-11-18',
    dlcs: [
      {
        id: 'teal-mask',
        names: { en: 'The Teal Mask', fr: 'Le Masque Turquoise' },
        releaseDate: '2023-09-13',
      },
      {
        id: 'indigo-disk',
        names: { en: 'The Indigo Disk', fr: 'Le Disque Indigo' },
        releaseDate: '2023-12-14',
      },
    ],
    pairedVersionId: 'violet',
    supportsLinkingCord: true,
    homeTransfer: 'direct',
  },
  {
    id: 'violet',
    names: { en: 'Pokémon Violet', fr: 'Pokémon Violet' },
    generation: 9,
    platform: 'switch',
    releaseDate: '2022-11-18',
    dlcs: [
      {
        id: 'teal-mask',
        names: { en: 'The Teal Mask', fr: 'Le Masque Turquoise' },
        releaseDate: '2023-09-13',
      },
      {
        id: 'indigo-disk',
        names: { en: 'The Indigo Disk', fr: 'Le Disque Indigo' },
        releaseDate: '2023-12-14',
      },
    ],
    pairedVersionId: 'scarlet',
    supportsLinkingCord: true,
    homeTransfer: 'direct',
  },
  {
    id: 'frlg-fr',
    names: { en: 'Pokémon FireRed (Switch)', fr: 'Pokémon Rouge Feu (Switch)' },
    generation: 3,
    platform: 'switch',
    releaseDate: '2004-09-09',
    dlcs: [],
    pairedVersionId: 'frlg-lg',
    supportsLinkingCord: false,
    homeTransfer: 'unsupported',
  },
  {
    id: 'frlg-lg',
    names: { en: 'Pokémon LeafGreen (Switch)', fr: 'Pokémon Vert Feuille (Switch)' },
    generation: 3,
    platform: 'switch',
    releaseDate: '2004-09-09',
    dlcs: [],
    pairedVersionId: 'frlg-fr',
    supportsLinkingCord: false,
    homeTransfer: 'unsupported',
  },
];

export function getGameById(id: GameId): Game | undefined {
  return GAMES.find((g) => g.id === id);
}

export function getPairedVersionId(id: GameId): GameId | undefined {
  return getGameById(id)?.pairedVersionId;
}
```

- [ ] **Step 2.4: Run tests to confirm pass**

Run: `pnpm --filter @livingdex/scrapers test`
Expected: 7 passing tests in `games-normalizer.test.ts`. Total: 11 tests passing across the package.

- [ ] **Step 2.5: Run typecheck and lint**

Run: `pnpm --filter @livingdex/scrapers typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 2.6: Commit**

```bash
git add packages/scrapers/
git commit -m "feat(scrapers): add static games table for v1 supported titles"
```

---

## Task 3: PokéAPI HTTP client with disk cache

**Files:**
- Create: `packages/scrapers/src/sources/pokeapi/client.ts`
- Create: `packages/scrapers/tests/client.test.ts`
- Modify: `.gitignore` (already ignores `.cache/` — verify only)

- [ ] **Step 3.1: Verify `.cache/` is gitignored**

Read `.gitignore`. Confirm `.cache/` is listed (it should be — added in Plan 01). If missing, add it.

- [ ] **Step 3.2: Write the failing test**

Create `packages/scrapers/tests/client.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PokeApiClient } from '../src/sources/pokeapi/client.ts';

let cacheDir: string;
const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

beforeEach(() => {
  cacheDir = mkdtempSync(join(tmpdir(), 'pokeapi-cache-'));
  fetchMock.mockReset();
});

afterEach(() => {
  rmSync(cacheDir, { recursive: true, force: true });
});

describe('PokeApiClient', () => {
  it('fetches from network on cache miss and writes cache', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 25, name: 'pikachu' }),
    } as Response);

    const client = new PokeApiClient({ cacheDir });
    const result = await client.get('/pokemon/25');

    expect(result).toEqual({ id: 25, name: 'pikachu' });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/pokemon/25'), expect.anything());

    const cachePath = join(cacheDir, 'pokemon', '25.json');
    expect(existsSync(cachePath)).toBe(true);
    expect(JSON.parse(readFileSync(cachePath, 'utf8'))).toEqual({ id: 25, name: 'pikachu' });
  });

  it('reads from cache on second call without network', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 25, name: 'pikachu' }),
    } as Response);

    const client = new PokeApiClient({ cacheDir });
    await client.get('/pokemon/25');
    fetchMock.mockClear();

    const result = await client.get('/pokemon/25');
    expect(result).toEqual({ id: 25, name: 'pikachu' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('respects noCache option and re-fetches', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 25, name: 'pikachu' }),
    } as Response);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 25, name: 'pikachu-updated' }),
    } as Response);

    const client = new PokeApiClient({ cacheDir, noCache: true });
    await client.get('/pokemon/25');
    const result = await client.get('/pokemon/25');

    expect(result).toEqual({ id: 25, name: 'pikachu-updated' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws on 4xx without retry', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({}),
    } as Response);

    const client = new PokeApiClient({ cacheDir });
    await expect(client.get('/pokemon/9999')).rejects.toThrow(/404/);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3.3: Run test to confirm failure**

Run: `pnpm --filter @livingdex/scrapers test`
Expected: 4 failures for client tests (file doesn't exist).

- [ ] **Step 3.4: Implement**

Create `packages/scrapers/src/sources/pokeapi/client.ts`:

```typescript
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
const USER_AGENT = 'PokemonLivingDex-Scraper/0.1.0 (+https://github.com/FabienLacorre/LivingDexHelper)';

export type PokeApiClientOptions = {
  cacheDir: string;
  noCache?: boolean;
  baseUrl?: string;
  rateLimitMs?: number;
};

export class PokeApiClient {
  private readonly cacheDir: string;
  private readonly noCache: boolean;
  private readonly baseUrl: string;
  private readonly rateLimitMs: number;
  private nextRequestAllowedAt = 0;

  constructor(options: PokeApiClientOptions) {
    this.cacheDir = options.cacheDir;
    this.noCache = options.noCache ?? false;
    this.baseUrl = options.baseUrl ?? POKEAPI_BASE;
    this.rateLimitMs = options.rateLimitMs ?? 100;
    mkdirSync(this.cacheDir, { recursive: true });
  }

  async get<T>(path: string): Promise<T> {
    const cachePath = this.cachePathFor(path);
    if (!this.noCache && existsSync(cachePath)) {
      return JSON.parse(readFileSync(cachePath, 'utf8')) as T;
    }
    const data = await this.fetchWithRetry<T>(path);
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf8');
    return data;
  }

  private cachePathFor(path: string): string {
    const sanitized = path.replace(/^\/+/, '').replace(/\/+$/, '');
    return join(this.cacheDir, `${sanitized}.json`);
  }

  private async fetchWithRetry<T>(path: string, attempt = 1): Promise<T> {
    await this.respectRateLimit();
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });

    if (response.ok) {
      return (await response.json()) as T;
    }

    const isRetriable = response.status >= 500 || response.status === 429;
    if (isRetriable && attempt < 3) {
      const backoffMs = 2 ** attempt * 500;
      await sleep(backoffMs);
      return this.fetchWithRetry<T>(path, attempt + 1);
    }

    throw new Error(`PokéAPI ${response.status} ${response.statusText} for ${path}`);
  }

  private async respectRateLimit(): Promise<void> {
    const now = Date.now();
    if (now < this.nextRequestAllowedAt) {
      await sleep(this.nextRequestAllowedAt - now);
    }
    this.nextRequestAllowedAt = Date.now() + this.rateLimitMs;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

- [ ] **Step 3.5: Run tests to confirm pass**

Run: `pnpm --filter @livingdex/scrapers test`
Expected: all 4 client tests pass.

- [ ] **Step 3.6: Run typecheck and lint**

Run: `pnpm --filter @livingdex/scrapers typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 3.7: Commit**

```bash
git add packages/scrapers/
git commit -m "feat(scrapers): add PokeApiClient with disk cache and rate limiting"
```

---

## Task 4: PokéAPI species and pokemon (form variant) fetchers

**Files:**
- Create: `packages/scrapers/src/sources/pokeapi/species.ts`
- Create: `packages/scrapers/tests/fixtures/pokeapi-species-pikachu.json` (real fixture from PokéAPI)
- Create: `packages/scrapers/tests/fixtures/pokeapi-pokemon-pikachu.json`
- Create: `packages/scrapers/tests/species.test.ts`

- [ ] **Step 4.1: Capture real fixtures from PokéAPI**

The implementer should fetch one species and one Pokemon endpoint manually and save the trimmed JSON as fixtures. Use these commands (the curl outputs become the fixture files):

```bash
mkdir -p packages/scrapers/tests/fixtures
curl -s https://pokeapi.co/api/v2/pokemon-species/pikachu > packages/scrapers/tests/fixtures/pokeapi-species-pikachu.json
curl -s https://pokeapi.co/api/v2/pokemon/pikachu > packages/scrapers/tests/fixtures/pokeapi-pokemon-pikachu.json
```

If the fixture files are large (>100 KB each), trim irrelevant fields manually to keep tests fast. Keep at minimum: `id`, `name`, `names` (with en/fr), `varieties`, `types`, `sprites` (URLs only), `evolution_chain.url`, `generation.name`. Document in a comment what was trimmed.

- [ ] **Step 4.2: Write the failing test**

Create `packages/scrapers/tests/species.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchSpeciesWithVarieties } from '../src/sources/pokeapi/species.ts';
import type { PokeApiClient } from '../src/sources/pokeapi/client.ts';

const FIXTURES_DIR = join(import.meta.dirname, 'fixtures');
const speciesFixture = JSON.parse(
  readFileSync(join(FIXTURES_DIR, 'pokeapi-species-pikachu.json'), 'utf8'),
);
const pokemonFixture = JSON.parse(
  readFileSync(join(FIXTURES_DIR, 'pokeapi-pokemon-pikachu.json'), 'utf8'),
);

const clientMock = {
  get: vi.fn(),
} as unknown as PokeApiClient;

beforeEach(() => {
  (clientMock.get as ReturnType<typeof vi.fn>).mockReset();
});

describe('fetchSpeciesWithVarieties', () => {
  it('fetches species + all varieties', async () => {
    (clientMock.get as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      if (path.includes('pokemon-species/25')) return Promise.resolve(speciesFixture);
      if (path.includes('pokemon/pikachu')) return Promise.resolve(pokemonFixture);
      throw new Error(`Unexpected path: ${path}`);
    });

    const result = await fetchSpeciesWithVarieties(clientMock, 25);

    expect(result.species.id).toBe(25);
    expect(result.species.name).toBe('pikachu');
    expect(result.varieties.length).toBeGreaterThanOrEqual(1);
    expect(result.varieties[0]).toMatchObject({ id: expect.any(Number), name: 'pikachu' });
  });

  it('skips varieties with API errors and continues', async () => {
    const speciesWithMissing = {
      ...speciesFixture,
      varieties: [
        { is_default: true, pokemon: { name: 'pikachu', url: 'x' } },
        { is_default: false, pokemon: { name: 'pikachu-totem', url: 'x' } },
      ],
    };
    (clientMock.get as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      if (path.includes('pokemon-species/25')) return Promise.resolve(speciesWithMissing);
      if (path.includes('pokemon/pikachu') && !path.includes('totem')) {
        return Promise.resolve(pokemonFixture);
      }
      return Promise.reject(new Error('PokéAPI 404'));
    });

    const result = await fetchSpeciesWithVarieties(clientMock, 25);
    expect(result.varieties).toHaveLength(1);
  });
});
```

- [ ] **Step 4.3: Run test to confirm failure**

Run: `pnpm --filter @livingdex/scrapers test`
Expected: 2 failures for species tests.

- [ ] **Step 4.4: Implement**

Create `packages/scrapers/src/sources/pokeapi/species.ts`:

```typescript
import type { PokeApiClient } from './client.ts';

export type PokeApiSpeciesName = {
  language: { name: string };
  name: string;
};

export type PokeApiSpeciesVariety = {
  is_default: boolean;
  pokemon: { name: string; url: string };
};

export type PokeApiSpecies = {
  id: number;
  name: string;
  names: PokeApiSpeciesName[];
  varieties: PokeApiSpeciesVariety[];
  evolution_chain?: { url: string };
  generation?: { name: string };
};

export type PokeApiPokemonType = { type: { name: string } };

export type PokeApiPokemonSprites = {
  front_default?: string | null;
  front_shiny?: string | null;
  other?: {
    'official-artwork'?: { front_default?: string | null };
  };
  versions?: {
    'generation-viii'?: {
      icons?: { front_default?: string | null };
    };
  };
};

export type PokeApiPokemon = {
  id: number;
  name: string;
  types: PokeApiPokemonType[];
  sprites: PokeApiPokemonSprites;
};

export type SpeciesWithVarieties = {
  species: PokeApiSpecies;
  varieties: PokeApiPokemon[];
};

export async function fetchSpeciesWithVarieties(
  client: PokeApiClient,
  speciesId: number,
): Promise<SpeciesWithVarieties> {
  const species = await client.get<PokeApiSpecies>(`/pokemon-species/${speciesId}`);
  const varieties: PokeApiPokemon[] = [];
  for (const variety of species.varieties) {
    try {
      const pokemon = await client.get<PokeApiPokemon>(`/pokemon/${variety.pokemon.name}`);
      varieties.push(pokemon);
    } catch (err) {
      console.warn(
        `[species] skipping variety ${variety.pokemon.name}: ${(err as Error).message}`,
      );
    }
  }
  return { species, varieties };
}
```

- [ ] **Step 4.5: Run tests**

Run: `pnpm --filter @livingdex/scrapers test`
Expected: 2 species tests pass. Total cumulative tests passing.

- [ ] **Step 4.6: Run typecheck and lint**

Run: `pnpm --filter @livingdex/scrapers typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 4.7: Commit**

```bash
git add packages/scrapers/
git commit -m "feat(scrapers): add PokéAPI species + variety fetcher"
```

---

## Task 5: PokéAPI evolution chain fetcher

**Files:**
- Create: `packages/scrapers/src/sources/pokeapi/evolution.ts`
- Create: `packages/scrapers/tests/fixtures/pokeapi-evolution-pichu-chain.json`
- Create: `packages/scrapers/tests/evolution.test.ts`

- [ ] **Step 5.1: Capture real fixture**

```bash
curl -s https://pokeapi.co/api/v2/evolution-chain/10 > packages/scrapers/tests/fixtures/pokeapi-evolution-pichu-chain.json
```

(Pichu → Pikachu → Raichu / Raichu-Alola, with friendship + thunder-stone conditions.)

- [ ] **Step 5.2: Write the failing test**

Create `packages/scrapers/tests/evolution.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchEvolutionLinks } from '../src/sources/pokeapi/evolution.ts';
import type { PokeApiClient } from '../src/sources/pokeapi/client.ts';

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, 'fixtures', 'pokeapi-evolution-pichu-chain.json'), 'utf8'),
);

const clientMock = { get: vi.fn() } as unknown as PokeApiClient;
beforeEach(() => (clientMock.get as ReturnType<typeof vi.fn>).mockReset());

describe('fetchEvolutionLinks', () => {
  it('returns links from the Pichu chain (pichu -> pikachu -> raichu / raichu-alola)', async () => {
    (clientMock.get as ReturnType<typeof vi.fn>).mockResolvedValue(fixture);
    const links = await fetchEvolutionLinks(clientMock, 10);

    const fromIds = links.map((l) => l.fromId);
    const toIds = links.map((l) => l.toId);
    expect(fromIds).toContain('pichu');
    expect(fromIds).toContain('pikachu');
    expect(toIds).toContain('pikachu');
    expect(toIds).toContain('raichu');

    const pichuToPikachu = links.find((l) => l.fromId === 'pichu' && l.toId === 'pikachu');
    expect(pichuToPikachu?.method).toBe('friendship');

    const pikachuToRaichu = links.find((l) => l.fromId === 'pikachu' && l.toId === 'raichu');
    expect(pikachuToRaichu?.method).toBe('item');
  });
});
```

- [ ] **Step 5.3: Run test to confirm failure**

Run: `pnpm --filter @livingdex/scrapers test`
Expected: failure (file doesn't exist).

- [ ] **Step 5.4: Implement**

Create `packages/scrapers/src/sources/pokeapi/evolution.ts`:

```typescript
import type { EvolutionLink, EvolutionMethod, EvolutionCondition } from '@livingdex/types';
import type { PokeApiClient } from './client.ts';

type ChainLink = {
  species: { name: string };
  evolves_to: ChainLink[];
  evolution_details?: Array<{
    min_level?: number | null;
    item?: { name: string } | null;
    held_item?: { name: string } | null;
    trigger?: { name: string };
    min_happiness?: number | null;
    location?: { name: string } | null;
    time_of_day?: string | null;
    known_move?: { name: string } | null;
    trade_species?: { name: string } | null;
  }>;
};

type EvolutionChain = { id: number; chain: ChainLink };

export async function fetchEvolutionLinks(
  client: PokeApiClient,
  chainId: number,
): Promise<EvolutionLink[]> {
  const chain = await client.get<EvolutionChain>(`/evolution-chain/${chainId}`);
  const links: EvolutionLink[] = [];
  walk(chain.chain, links);
  return links;
}

function walk(node: ChainLink, out: EvolutionLink[]): void {
  for (const child of node.evolves_to) {
    for (const detail of child.evolution_details ?? []) {
      const trigger = detail.trigger?.name ?? 'level-up';
      const conditions: EvolutionCondition[] = [];
      let method: EvolutionMethod = 'other';

      if (detail.min_level != null) conditions.push({ type: 'minLevel', value: detail.min_level });
      if (detail.item) {
        method = 'item';
        conditions.push({ type: 'item', value: detail.item.name });
      }
      if (detail.held_item) conditions.push({ type: 'tradeItem', value: detail.held_item.name });
      if (detail.min_happiness != null) {
        method = 'friendship';
        conditions.push({ type: 'friendship', value: detail.min_happiness });
      }
      if (detail.location) {
        method = 'location';
        conditions.push({ type: 'location', value: detail.location.name });
      }
      if (detail.time_of_day) conditions.push({ type: 'timeOfDay', value: detail.time_of_day });
      if (detail.known_move) {
        method = 'move';
        conditions.push({ type: 'move', value: detail.known_move.name });
      }
      if (detail.trade_species) conditions.push({ type: 'tradeWith', value: detail.trade_species.name });

      if (trigger === 'trade') method = 'trade';
      else if (trigger === 'level-up' && method === 'other' && detail.min_level != null) {
        method = 'level';
      }

      const link: EvolutionLink = {
        fromId: node.species.name,
        toId: child.species.name,
        method,
        conditions,
        ...(method === 'trade' ? { soloAlternative: 'linking-cord' as const } : {}),
      };
      out.push(link);
    }
    walk(child, out);
  }
}
```

- [ ] **Step 5.5: Run tests**

Run: `pnpm --filter @livingdex/scrapers test`
Expected: evolution test passes.

- [ ] **Step 5.6: Typecheck + lint + commit**

```bash
pnpm --filter @livingdex/scrapers typecheck
pnpm lint
git add packages/scrapers/
git commit -m "feat(scrapers): add PokéAPI evolution chain fetcher"
```

---

## Task 6: Pokémon normalizer (PokéAPI → our Pokemon type)

**Files:**
- Create: `packages/scrapers/src/normalizers/pokemon.ts`
- Create: `packages/scrapers/tests/fixtures/pokeapi-pokemon-raichu-alola.json`
- Create: `packages/scrapers/tests/fixtures/pokeapi-pokemon-charizard-gmax.json`
- Create: `packages/scrapers/tests/pokemon-normalizer.test.ts`

- [ ] **Step 6.1: Capture additional fixtures**

```bash
curl -s https://pokeapi.co/api/v2/pokemon/raichu-alola > packages/scrapers/tests/fixtures/pokeapi-pokemon-raichu-alola.json
curl -s https://pokeapi.co/api/v2/pokemon/charizard-gmax > packages/scrapers/tests/fixtures/pokeapi-pokemon-charizard-gmax.json
```

- [ ] **Step 6.2: Write the failing test**

Create `packages/scrapers/tests/pokemon-normalizer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { classifyForm, normalizePokemon } from '../src/normalizers/pokemon.ts';

const FIXTURES = join(import.meta.dirname, 'fixtures');
const speciesPikachu = JSON.parse(
  readFileSync(join(FIXTURES, 'pokeapi-species-pikachu.json'), 'utf8'),
);
const pokemonPikachu = JSON.parse(
  readFileSync(join(FIXTURES, 'pokeapi-pokemon-pikachu.json'), 'utf8'),
);
const pokemonRaichuAlola = JSON.parse(
  readFileSync(join(FIXTURES, 'pokeapi-pokemon-raichu-alola.json'), 'utf8'),
);
const pokemonCharizardGmax = JSON.parse(
  readFileSync(join(FIXTURES, 'pokeapi-pokemon-charizard-gmax.json'), 'utf8'),
);

describe('classifyForm', () => {
  it('default form when slug == speciesSlug', () => {
    expect(classifyForm('pikachu', 'pikachu')).toBe('default');
  });
  it('regional for -alola / -galar / -hisui / -paldea suffixes', () => {
    expect(classifyForm('raichu-alola', 'raichu')).toBe('regional');
    expect(classifyForm('ponyta-galar', 'ponyta')).toBe('regional');
    expect(classifyForm('typhlosion-hisui', 'typhlosion')).toBe('regional');
    expect(classifyForm('tauros-paldea-combat', 'tauros')).toBe('regional');
  });
  it('gigamax for -gmax suffix', () => {
    expect(classifyForm('charizard-gmax', 'charizard')).toBe('gigamax');
  });
  it('alt for known alt-form prefixes', () => {
    expect(classifyForm('deoxys-attack', 'deoxys')).toBe('alt');
    expect(classifyForm('kyurem-black', 'kyurem')).toBe('alt');
    expect(classifyForm('necrozma-ultra', 'necrozma')).toBe('alt');
    expect(classifyForm('calyrex-ice', 'calyrex')).toBe('alt');
    expect(classifyForm('ogerpon-wellspring-mask', 'ogerpon')).toBe('alt');
  });
  it('cosmetic for -mega / -primal / -totem (will be filtered out by isExcluded)', () => {
    expect(classifyForm('mewtwo-mega-x', 'mewtwo')).toBe('cosmetic');
    expect(classifyForm('rayquaza-mega', 'rayquaza')).toBe('cosmetic');
  });
});

describe('normalizePokemon', () => {
  it('produces a default Pokemon entry from species + default variety', () => {
    const result = normalizePokemon(speciesPikachu, pokemonPikachu);
    expect(result).toMatchObject({
      id: 'pikachu',
      nationalDexNumber: 25,
      speciesSlug: 'pikachu',
      formId: null,
      formCategory: 'default',
      types: ['electric'],
      generation: 1,
    });
    expect(result?.names.en).toBe('Pikachu');
    expect(result?.names.fr).toBe('Pikachu');
    expect(result?.sprites.default).toMatch(/\.png$/);
  });

  it('produces a regional Pokemon entry for raichu-alola', () => {
    const result = normalizePokemon(speciesPikachu, pokemonRaichuAlola, {
      forceSpeciesSlug: 'raichu',
    });
    expect(result).toMatchObject({
      id: 'raichu-alola',
      formId: 'alola',
      formCategory: 'regional',
    });
  });

  it('returns null for excluded forms (mega, totem)', () => {
    const totem = { ...pokemonPikachu, name: 'pikachu-totem' };
    const result = normalizePokemon(speciesPikachu, totem);
    expect(result).toBeNull();
  });

  it('produces a gigamax Pokemon entry', () => {
    const speciesCharizard = {
      ...speciesPikachu,
      id: 6,
      name: 'charizard',
      names: [
        { language: { name: 'en' }, name: 'Charizard' },
        { language: { name: 'fr' }, name: 'Dracaufeu' },
      ],
      generation: { name: 'generation-i' },
    };
    const result = normalizePokemon(speciesCharizard, pokemonCharizardGmax);
    expect(result?.formCategory).toBe('gigamax');
    expect(result?.formId).toBe('gmax');
  });
});
```

- [ ] **Step 6.3: Run test to confirm failure**

Run: `pnpm --filter @livingdex/scrapers test`
Expected: 9 failures.

- [ ] **Step 6.4: Implement**

Create `packages/scrapers/src/normalizers/pokemon.ts`:

```typescript
import type { FormCategory, Pokemon, PokemonType } from '@livingdex/types';
import type {
  PokeApiPokemon,
  PokeApiSpecies,
} from '../sources/pokeapi/species.ts';

const REGIONAL_SUFFIXES = ['alola', 'galar', 'hisui', 'paldea'];
const GIGAMAX_SUFFIX = 'gmax';
const EXCLUDED_SUFFIXES = ['mega', 'mega-x', 'mega-y', 'primal', 'totem'];
const ALT_PREFIXES = new Set([
  'deoxys',
  'kyurem',
  'necrozma',
  'calyrex',
  'ogerpon',
  'zacian',
  'zamazenta',
  'urshifu',
  'wishiwashi',
  'minior',
  'oricorio',
  'lycanroc',
  'rotom',
  'shaymin',
  'giratina',
  'darmanitan',
  'meloetta',
  'tornadus',
  'thundurus',
  'landorus',
  'enamorus',
]);

const GENERATION_NAME_TO_NUMBER: Record<string, number> = {
  'generation-i': 1,
  'generation-ii': 2,
  'generation-iii': 3,
  'generation-iv': 4,
  'generation-v': 5,
  'generation-vi': 6,
  'generation-vii': 7,
  'generation-viii': 8,
  'generation-ix': 9,
};

export function classifyForm(varietySlug: string, speciesSlug: string): FormCategory {
  if (varietySlug === speciesSlug) return 'default';

  const suffix = varietySlug.slice(speciesSlug.length + 1);

  if (EXCLUDED_SUFFIXES.some((s) => suffix === s || suffix.startsWith(`${s}-`))) {
    return 'cosmetic';
  }
  if (REGIONAL_SUFFIXES.some((s) => suffix === s || suffix.startsWith(`${s}-`))) {
    return 'regional';
  }
  if (suffix === GIGAMAX_SUFFIX) {
    return 'gigamax';
  }
  if (ALT_PREFIXES.has(speciesSlug)) {
    return 'alt';
  }
  return 'cosmetic';
}

export function isExcludedForm(varietySlug: string, speciesSlug: string): boolean {
  if (varietySlug === speciesSlug) return false;
  const suffix = varietySlug.slice(speciesSlug.length + 1);
  return EXCLUDED_SUFFIXES.some((s) => suffix === s || suffix.startsWith(`${s}-`));
}

function extractFormId(varietySlug: string, speciesSlug: string): string | null {
  if (varietySlug === speciesSlug) return null;
  const suffix = varietySlug.slice(speciesSlug.length + 1);
  if (suffix.length === 0) return null;
  return suffix;
}

function pickName(names: PokeApiSpecies['names'], lang: 'en' | 'fr'): string {
  const found = names.find((n) => n.language.name === lang);
  return found?.name ?? '';
}

function extractTypes(pokemon: PokeApiPokemon): PokemonType[] {
  return pokemon.types.map((t) => t.type.name as PokemonType);
}

function extractSprites(pokemon: PokeApiPokemon): Pokemon['sprites'] {
  const variantPath = `${pokemon.name}.png`;
  return {
    default: pokemon.sprites.front_default ? `default/${variantPath}` : '',
    shiny: pokemon.sprites.front_shiny ? `shiny/${variantPath}` : '',
    artwork: pokemon.sprites.other?.['official-artwork']?.front_default
      ? `artwork/${variantPath}`
      : '',
    icon: pokemon.sprites.versions?.['generation-viii']?.icons?.front_default
      ? `icons/${variantPath}`
      : '',
  };
}

export type NormalizePokemonOptions = {
  forceSpeciesSlug?: string;
};

export function normalizePokemon(
  species: PokeApiSpecies,
  pokemon: PokeApiPokemon,
  options: NormalizePokemonOptions = {},
): Pokemon | null {
  const speciesSlug = options.forceSpeciesSlug ?? species.name;
  if (isExcludedForm(pokemon.name, speciesSlug)) {
    return null;
  }

  const formId = extractFormId(pokemon.name, speciesSlug);
  const formCategory = classifyForm(pokemon.name, speciesSlug);
  const generation =
    species.generation?.name ? (GENERATION_NAME_TO_NUMBER[species.generation.name] ?? 1) : 1;

  return {
    id: pokemon.name,
    nationalDexNumber: species.id,
    speciesSlug,
    formId,
    formCategory,
    names: {
      en: pickName(species.names, 'en') || species.name,
      fr: pickName(species.names, 'fr') || pickName(species.names, 'en') || species.name,
    },
    types: extractTypes(pokemon),
    generation,
    sprites: extractSprites(pokemon),
    evolutions: [],
  };
}
```

- [ ] **Step 6.5: Run tests**

Run: `pnpm --filter @livingdex/scrapers test`
Expected: all 9 normalizer tests pass.

- [ ] **Step 6.6: Typecheck + lint + commit**

```bash
pnpm --filter @livingdex/scrapers typecheck
pnpm lint
git add packages/scrapers/
git commit -m "feat(scrapers): add Pokémon normalizer with form classification"
```

---

## Task 7: Sprites downloader

**Files:**
- Create: `packages/scrapers/src/sources/pokeapi/sprites.ts`
- Create: `packages/scrapers/tests/sprites.test.ts`

- [ ] **Step 7.1: Write the failing test**

Create `packages/scrapers/tests/sprites.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { downloadSprites } from '../src/sources/pokeapi/sprites.ts';

let outDir: string;
const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

beforeEach(() => {
  outDir = mkdtempSync(join(tmpdir(), 'sprites-'));
  fetchMock.mockReset();
});

afterEach(() => {
  rmSync(outDir, { recursive: true, force: true });
});

describe('downloadSprites', () => {
  it('downloads multiple sprites in parallel', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    } as unknown as Response);

    const downloads = [
      { url: 'https://example.com/a.png', destPath: join(outDir, 'a.png') },
      { url: 'https://example.com/b.png', destPath: join(outDir, 'b.png') },
      { url: 'https://example.com/c.png', destPath: join(outDir, 'c.png') },
    ];

    await downloadSprites(downloads, { concurrency: 2 });

    expect(existsSync(join(outDir, 'a.png'))).toBe(true);
    expect(existsSync(join(outDir, 'b.png'))).toBe(true);
    expect(existsSync(join(outDir, 'c.png'))).toBe(true);
    expect(readFileSync(join(outDir, 'a.png'))).toEqual(Buffer.from([1, 2, 3, 4]));
  });

  it('skips downloads when destination already exists', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1]).buffer,
    } as unknown as Response);

    const downloads = [
      { url: 'https://example.com/a.png', destPath: join(outDir, 'a.png') },
    ];
    await downloadSprites(downloads);
    fetchMock.mockClear();

    await downloadSprites(downloads);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws on network error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    } as Response);

    await expect(
      downloadSprites([
        { url: 'https://example.com/x.png', destPath: join(outDir, 'x.png') },
      ]),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 7.2: Run test to confirm failure**

Run: `pnpm --filter @livingdex/scrapers test`
Expected: 3 failures for sprites tests.

- [ ] **Step 7.3: Implement**

Create `packages/scrapers/src/sources/pokeapi/sprites.ts`:

```typescript
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export type SpriteDownload = {
  url: string;
  destPath: string;
};

export type DownloadOptions = {
  concurrency?: number;
};

export async function downloadSprites(
  downloads: SpriteDownload[],
  options: DownloadOptions = {},
): Promise<void> {
  const concurrency = options.concurrency ?? 20;
  const queue = [...downloads];
  const workers: Promise<void>[] = [];

  for (let i = 0; i < concurrency; i++) {
    workers.push(worker(queue));
  }
  await Promise.all(workers);
}

async function worker(queue: SpriteDownload[]): Promise<void> {
  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) return;
    if (existsSync(next.destPath)) continue;
    await downloadOne(next);
  }
}

async function downloadOne(download: SpriteDownload): Promise<void> {
  const response = await fetch(download.url);
  if (!response.ok) {
    throw new Error(`Sprite download failed: ${response.status} ${response.statusText} (${download.url})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  mkdirSync(dirname(download.destPath), { recursive: true });
  writeFileSync(download.destPath, Buffer.from(arrayBuffer));
}
```

- [ ] **Step 7.4: Run tests**

Run: `pnpm --filter @livingdex/scrapers test`
Expected: 3 sprites tests pass.

- [ ] **Step 7.5: Typecheck + lint + commit**

```bash
pnpm --filter @livingdex/scrapers typecheck
pnpm lint
git add packages/scrapers/
git commit -m "feat(scrapers): add sprites downloader with concurrency limit"
```

---

## Task 8: Output writer

**Files:**
- Create: `packages/scrapers/src/output/writer.ts`
- Create: `packages/scrapers/tests/writer.test.ts`

- [ ] **Step 8.1: Write the failing test**

Create `packages/scrapers/tests/writer.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeDataset } from '../src/output/writer.ts';
import type { Dataset } from '@livingdex/types';

let outDir: string;

beforeEach(() => {
  outDir = mkdtempSync(join(tmpdir(), 'dataset-out-'));
});

afterEach(() => {
  rmSync(outDir, { recursive: true, force: true });
});

describe('writeDataset', () => {
  const dataset: Dataset = {
    meta: {
      version: '2026-05-09T14:30:00.000Z',
      schemaVersion: 1,
      scrapedFrom: ['pokeapi'],
      generations: [1],
      pokemonCount: 1,
      encountersCount: 0,
    },
    pokemon: [
      {
        id: 'pikachu',
        nationalDexNumber: 25,
        speciesSlug: 'pikachu',
        formId: null,
        formCategory: 'default',
        names: { en: 'Pikachu', fr: 'Pikachu' },
        types: ['electric'],
        generation: 1,
        sprites: { default: '', shiny: '', artwork: '', icon: '' },
        evolutions: [],
      },
    ],
    games: [],
    encounters: [],
  };

  it('writes dataset.json and dataset-meta.json', async () => {
    await writeDataset(dataset, { outDir });
    expect(existsSync(join(outDir, 'dataset.json'))).toBe(true);
    expect(existsSync(join(outDir, 'dataset-meta.json'))).toBe(true);

    const written = JSON.parse(readFileSync(join(outDir, 'dataset.json'), 'utf8'));
    expect(written.meta.pokemonCount).toBe(1);
    expect(written.pokemon).toHaveLength(1);

    const meta = JSON.parse(readFileSync(join(outDir, 'dataset-meta.json'), 'utf8'));
    expect(meta).toEqual(dataset.meta);
  });

  it('throws when dataset fails Zod validation', async () => {
    const broken = { ...dataset, pokemon: [{ ...dataset.pokemon[0], types: ['lightning'] }] };
    await expect(writeDataset(broken as unknown as Dataset, { outDir })).rejects.toThrow();
  });
});
```

- [ ] **Step 8.2: Run test to confirm failure**

Run: `pnpm --filter @livingdex/scrapers test`
Expected: 2 failures for writer tests.

- [ ] **Step 8.3: Implement**

Create `packages/scrapers/src/output/writer.ts`:

```typescript
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Dataset } from '@livingdex/types';
import { validateDataset } from './validator.ts';

export type WriteOptions = {
  outDir: string;
};

export async function writeDataset(dataset: Dataset, options: WriteOptions): Promise<void> {
  validateDataset(dataset);
  mkdirSync(options.outDir, { recursive: true });
  writeFileSync(
    join(options.outDir, 'dataset.json'),
    JSON.stringify(dataset, null, 2),
    'utf8',
  );
  writeFileSync(
    join(options.outDir, 'dataset-meta.json'),
    JSON.stringify(dataset.meta, null, 2),
    'utf8',
  );
}
```

- [ ] **Step 8.4: Run tests**

Run: `pnpm --filter @livingdex/scrapers test`
Expected: 2 writer tests pass.

- [ ] **Step 8.5: Typecheck + lint + commit**

```bash
pnpm --filter @livingdex/scrapers typecheck
pnpm lint
git add packages/scrapers/
git commit -m "feat(scrapers): add dataset writer with Zod validation gate"
```

---

## Task 9: Pipeline orchestrator

**Files:**
- Create: `packages/scrapers/src/pipeline.ts`
- Create: `packages/scrapers/tests/pipeline.test.ts`
- Modify: `packages/scrapers/src/index.ts` (export the orchestrator)

- [ ] **Step 9.1: Write the failing test**

Create `packages/scrapers/tests/pipeline.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { runPokeApiPipeline } from '../src/pipeline.ts';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const speciesPikachu = JSON.parse(
  readFileSync(join(import.meta.dirname, 'fixtures', 'pokeapi-species-pikachu.json'), 'utf8'),
);
const pokemonPikachu = JSON.parse(
  readFileSync(join(import.meta.dirname, 'fixtures', 'pokeapi-pokemon-pikachu.json'), 'utf8'),
);
const evolutionPichu = JSON.parse(
  readFileSync(join(import.meta.dirname, 'fixtures', 'pokeapi-evolution-pichu-chain.json'), 'utf8'),
);

describe('runPokeApiPipeline', () => {
  it('produces a valid Dataset for one species', async () => {
    const fakeClient = {
      get: vi.fn(async (path: string) => {
        if (path.startsWith('/pokemon-species/25')) return speciesPikachu;
        if (path.startsWith('/pokemon/pikachu')) return pokemonPikachu;
        if (path.startsWith('/evolution-chain/')) return evolutionPichu;
        throw new Error(`unexpected path: ${path}`);
      }),
    };

    const dataset = await runPokeApiPipeline({
      client: fakeClient as unknown as Parameters<typeof runPokeApiPipeline>[0]['client'],
      speciesIds: [25],
      generations: [1],
      onProgress: () => {},
    });

    expect(dataset.meta.scrapedFrom).toEqual(['pokeapi']);
    expect(dataset.meta.pokemonCount).toBeGreaterThanOrEqual(1);
    expect(dataset.pokemon[0]?.id).toBe('pikachu');
    expect(dataset.pokemon[0]?.evolutions.length).toBeGreaterThanOrEqual(1);
    expect(dataset.games.length).toBe(9);
  });
});
```

- [ ] **Step 9.2: Run test to confirm failure**

Run: `pnpm --filter @livingdex/scrapers test`
Expected: 1 failure for pipeline test.

- [ ] **Step 9.3: Implement**

Create `packages/scrapers/src/pipeline.ts`:

```typescript
import type { Dataset, Pokemon } from '@livingdex/types';
import { CURRENT_SCHEMA_VERSION } from '@livingdex/types';
import type { PokeApiClient } from './sources/pokeapi/client.ts';
import { fetchSpeciesWithVarieties } from './sources/pokeapi/species.ts';
import { fetchEvolutionLinks } from './sources/pokeapi/evolution.ts';
import { normalizePokemon } from './normalizers/pokemon.ts';
import { GAMES } from './normalizers/games.ts';

export type ProgressEvent = {
  stage: 'species' | 'evolution' | 'sprites' | 'write';
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
```

- [ ] **Step 9.4: Update `packages/scrapers/src/index.ts`**

Replace the contents of `packages/scrapers/src/index.ts` with:

```typescript
export const SCRAPER_VERSION = '0.2.0';
export { runPokeApiPipeline } from './pipeline.ts';
export { PokeApiClient } from './sources/pokeapi/client.ts';
export { GAMES } from './normalizers/games.ts';
export { writeDataset } from './output/writer.ts';
export { downloadSprites } from './sources/pokeapi/sprites.ts';
```

- [ ] **Step 9.5: Run tests**

Run: `pnpm --filter @livingdex/scrapers test`
Expected: pipeline test passes. All cumulative tests pass.

- [ ] **Step 9.6: Typecheck + lint + commit**

```bash
pnpm --filter @livingdex/scrapers typecheck
pnpm lint
git add packages/scrapers/
git commit -m "feat(scrapers): add pipeline orchestrator and bump SCRAPER_VERSION to 0.2.0"
```

---

## Task 10: Real CLI with arg parsing

**Files:**
- Replace: `packages/scrapers/src/cli.ts`

- [ ] **Step 10.1: Replace the stub CLI**

Replace `packages/scrapers/src/cli.ts` with:

```typescript
#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PokeApiClient } from './sources/pokeapi/client.ts';
import { runPokeApiPipeline } from './pipeline.ts';
import { writeDataset } from './output/writer.ts';
import { downloadSprites } from './sources/pokeapi/sprites.ts';
import { SCRAPER_VERSION } from './index.ts';

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
    process.stdout.write(`\r[${event.stage}] ${event.current}/${event.total}: ${event.message}`.padEnd(80));
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
console.log(`\nDataset written to ${outDir}/dataset.json (${dataset.pokemon.length} Pokémon, ${dataset.encounters.length} encounters)`);

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
```

- [ ] **Step 10.2: Smoke test the CLI**

Run: `pnpm scrape --help`
Expected: Help text printed, exit 0.

Run: `pnpm scrape --gen 1 --no-sprites --no-cache`
Expected: Logs progress for ~150 species, ends with "Dataset written to .../dataset.json (X Pokémon, 0 encounters)". Takes 1-3 minutes due to PokéAPI rate limit. Verify `packages/data/dataset.json` is now ~few MB.

⚠️ **Important:** This actually hits the PokéAPI network. If it fails, debug. After verifying it works, you may delete the produced `packages/data/dataset.json` and let Task 12 do the real full run.

- [ ] **Step 10.3: Run typecheck and lint**

Run: `pnpm --filter @livingdex/scrapers typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 10.4: Commit**

```bash
git add packages/scrapers/
git commit -m "feat(scrapers): replace CLI stub with real arg-parsed pipeline runner"
```

---

## Task 11: Update web App.tsx to surface real counts

**Files:**
- Modify: `apps/web/src/App.tsx`

The current App.tsx shows `datasetMeta.pokemonCount` and `datasetMeta.encountersCount`. After Task 12 produces a real dataset, those numbers will be non-zero automatically. But the App.tsx should also display the dataset's `version` more user-friendly (formatted date) and show generations.

- [ ] **Step 11.1: Update App.tsx**

Replace the contents of `apps/web/src/App.tsx`:

```typescript
import { datasetMeta } from '@livingdex/data';

function formatVersion(iso: string): string {
  if (iso === '1970-01-01T00:00:00.000Z') return 'no dataset yet';
  return new Date(iso).toLocaleString('fr-FR');
}

export function App() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold">Living Dex Helper</h1>
        <p className="mt-4 text-slate-600 dark:text-slate-400">
          Dataset version: <code className="text-sm">{formatVersion(datasetMeta.version)}</code>
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Pokémon" value={datasetMeta.pokemonCount} />
          <Stat label="Encounters" value={datasetMeta.encountersCount} />
          <Stat label="Generations" value={datasetMeta.generations.length} />
          <Stat label="Schema" value={`v${datasetMeta.schemaVersion}`} />
        </div>
        <p className="mt-6 text-xs text-slate-500 dark:text-slate-500">
          Sources: {datasetMeta.scrapedFrom.length === 0 ? 'none' : datasetMeta.scrapedFrom.join(', ')}
        </p>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-800">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </div>
    </div>
  );
}
```

- [ ] **Step 11.2: Verify typecheck + build**

Run: `pnpm --filter @livingdex/web typecheck`
Expected: PASS.

Run: `pnpm --filter @livingdex/web build`
Expected: Builds cleanly. Dist generated.

- [ ] **Step 11.3: Lint**

Run: `pnpm lint`
Expected: PASS (Biome may auto-fix import order).

- [ ] **Step 11.4: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat(web): expand hello-world to show dataset stats grid"
```

---

## Task 12: Run the real scrape and commit the dataset

**Files:**
- Update: `packages/data/dataset.json` (will become ~3 MB)
- Update: `packages/data/dataset-meta.json`
- New: `packages/data/sprites/**/*.png` (~6000 files, ~90 MB)

This is the only task that performs real network I/O on the live PokéAPI and commits the result.

⚠️ **Time budget:** ~10-15 min for the first scrape (network bound by PokéAPI's 10 req/s limit + sprite downloads).

⚠️ **Disk space:** ~100 MB committed to Git (sprites). The user explicitly accepted this in the spec.

- [ ] **Step 12.1: Run the full scrape**

Run from repo root: `pnpm scrape --gen 1-9`

Expected:
- Progress logs for each generation
- Final message: `Dataset written to .../packages/data/dataset.json (~1500 Pokémon, 0 encounters)`
- `packages/data/sprites/` populated with thousands of PNGs

If it fails partway: re-run. The cache means already-fetched data is reused.

- [ ] **Step 12.2: Verify the dataset**

Run: `pnpm --filter @livingdex/scrapers test`
Expected: all tests still pass (some operate on the test fixtures, separate from the real dataset).

Run a quick sanity check via Node REPL or a one-off script:
```bash
node --eval 'import("./packages/data/dataset.json", { with: { type: "json" } }).then(m => console.log(`pokemon: ${m.default.pokemon.length}, gen 1 pokemon: ${m.default.pokemon.filter(p => p.generation === 1).length}, with regional: ${m.default.pokemon.filter(p => p.formCategory === "regional").length}, with gigamax: ${m.default.pokemon.filter(p => p.formCategory === "gigamax").length}`))'
```

Expected: pokemon: ~1500+, gen 1 pokemon: ~190+, regional: ~80+, gigamax: ~30+.

- [ ] **Step 12.3: Verify the web app picks up the new data**

Run: `pnpm --filter @livingdex/web build`
Expected: Build succeeds. Bundle size will grow because the dataset.json is now larger (this is OK for now — Plan 03 will switch to fetch-based loading).

Run: `pnpm dev` in background, curl http://localhost:5173/, verify the rendered HTML still mentions "Living Dex Helper". Read `apps/web/dist/index.html` after build to confirm. Kill background.

- [ ] **Step 12.4: Stage the dataset and sprites**

```bash
git add packages/data/dataset.json packages/data/dataset-meta.json packages/data/sprites/
```

⚠️ This adds ~6000 files. `git status` will be huge — that's expected.

- [ ] **Step 12.5: Verify git is happy**

Run: `git status --short | wc -l`
Expected: ~6000+ lines (each sprite is a separate file).

Run: `git diff --stat HEAD --staged | tail -5`
Expected: shows the ~90 MB total addition.

- [ ] **Step 12.6: Commit (this is the big one)**

```bash
git commit -m "data: add first PokéAPI dataset (gens 1-9, ~1500 Pokémon + sprites)"
```

⚠️ The commit will be large but succeed. Git handles binary blobs fine; it's the GitHub push limit (100 MB per push) we need to watch.

- [ ] **Step 12.7: Push (split if needed)**

Run: `git push`
Expected: succeeds.

If it fails because of pack size (>2 GB per push) — unlikely but possible — split the push into smaller batches. To avoid this issue, the implementer may instead split the data commit into multiple smaller commits before pushing (e.g., one commit per sprite category).

- [ ] **Step 12.8: Verify CI green**

Wait ~30s for the workflow to start. Query:
```bash
curl -s https://api.github.com/repos/FabienLacorre/LivingDexHelper/actions/runs?per_page=3
```

Wait for the latest run (head_sha matches your push) to reach `conclusion: success`. CI must be green.

If CI fails on `pnpm install --frozen-lockfile`: lockfile drift. Re-run `pnpm install` locally, commit, push.

If CI fails on `pnpm test`: a real test broke. Read logs, fix, push.

If CI runs out of disk space because of the 90 MB dataset: this is a real concern; flag as DONE_WITH_CONCERNS so the controller can decide whether to add Git LFS or split the data into a separate repo.

- [ ] **Step 12.9: Mark Plan 02 done**

The plan is complete when:
- ✅ `pnpm scrape` produces a valid dataset with ~1500 Pokémon
- ✅ `packages/data/dataset.json` is committed with real data
- ✅ `packages/data/sprites/` has the four sprite categories populated
- ✅ The web app's hello-world shows non-zero `pokemonCount` and a list of generations
- ✅ All tests pass (`pnpm test`)
- ✅ CI green on `main`

---

## Notes for engineers executing this plan

- **Cache discipline:** the disk cache at `.cache/pokeapi/` is gitignored and persistent across runs. Re-running the scrape WITHOUT `--no-cache` is fast (~30s if all data is cached). Use `--no-cache` only when you suspect upstream changes.
- **Form classification is heuristic:** the curated `ALT_PREFIXES` set covers known multi-form species at the time of writing. Plan 03's overrides are the right place to fix any misclassifications you discover.
- **Sprite file naming:** `{form-slug}.png` (e.g., `pikachu.png`, `raichu-alola.png`, `charizard-gmax.png`). Same name across the 4 categories; different folders distinguish style.
- **Evolution chain caching:** chains are fetched once per species but linked to all forms of that species. If a species has multiple chains (rare — Eevee), the simplest model is to fetch by species' `evolution_chain.url` only.
- **No encounters yet:** `dataset.encounters` is `[]` after this plan. Plan 03 brings Bulbapedia + manual overrides to populate it.
- **Strict TS settings will catch real bugs:** if you see `noUncheckedIndexedAccess` errors when implementing the pipeline, those are usually correct — handle the `T | undefined` case explicitly.
- **`--no-sprites` is your friend during dev iteration:** lets you re-test the pipeline logic without re-downloading 90 MB.
- **Don't trust PokéAPI to be 100% complete for Gen 9:** some recent additions (DLC Pokémon) may be missing. If you spot gaps, add them to the spec's "known limitations" rather than fixing in Plan 02 — Plan 03 with Bulbapedia + overrides is where holes get patched.

## Forward-looking concerns (deferred to Plans 03/04)

- Bulbapedia parser for encounters per game
- Manual overrides for events, version-exclusives, FRLG transfer, parser corrections
- scraper-api SSE endpoint (real-time progress in dev UI)
- Dynamic JSON loading in apps/web (avoid bundling 3 MB into the JS chunk)
- Zod parse at runtime in apps/web's IndexedDB seeder
- Splitting `apps/scraper-api/src/index.ts` into `app.ts` + `server.ts` for testability
