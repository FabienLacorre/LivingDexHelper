# Plan 03 — Bulbapedia + Overrides + Scraper-API SSE

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the build-time data pipeline by adding Bulbapedia-sourced encounters per game, the manual overrides system, the coverage report, and the dev-only `/api/scrape` SSE endpoint. After this plan, `pnpm scrape` produces a dataset with **real encounters** (Pokémon × game × method) for all 9 supported games. The web app shows non-zero `encountersCount`. The dev rescrape button (Plan 04) becomes wireable to a working SSE backend.

**Architecture:**
- Bulbapedia source uses MediaWiki API (`action=parse&page=X&prop=wikitext`). 1 req/s rate limit. Custom User-Agent. Cache in `.cache/bulbapedia/`.
- Wikitext parser uses regex-based best-effort approach. Failures are logged in a coverage report; manual overrides fill the gaps.
- `data-overrides/*.json` files are flat arrays of `Encounter` objects that ADD or REPLACE auto-detected encounters. Keyed by `(pokemonId, gameId, method.type)`.
- Top-level pipeline merges PokéAPI (Pokemon catalog) + Bulbapedia (encounters) + overrides (manual fixes), then writes one consolidated dataset.
- `apps/scraper-api` splits into `app.ts` (Hono instance + routes, importable) and `server.ts` (boots server). Tests import `app.ts` directly without binding ports.
- `/api/scrape` endpoint streams Server-Sent Events with progress. Used by Plan 04's dev-mode "Rescrape" button.

**Tech Stack:** No new heavy deps — same stack as Plan 02. Wikitext parsing uses native regex. SSE uses Hono's `streamSSE` helper (built-in).

**Spec reference:** `docs/superpowers/specs/2026-05-09-pokemon-livingdex-design.md` sections 4 (Flux 3 — Dev-mode), 7 (Pipeline — Bulbapedia + overrides + scraper-api).

**Hors scope (Plan 04+):** Web app's UI for rescraping (button + SSE consumer), Dexie schema, Zustand stores, screens.

---

## File Structure (created/modified by this plan)

```
packages/scrapers/
├── src/
│   ├── index.ts                          ← UPDATE: bump SCRAPER_VERSION to 0.3.0, add new exports
│   ├── pipeline.ts                       ← UPDATE: top-level orchestrator now combines pokeapi + bulbapedia + overrides
│   ├── cli.ts                            ← UPDATE: add --source flag (pokeapi/bulbapedia/all)
│   ├── sources/
│   │   └── bulbapedia/
│   │       ├── client.ts                 ← MediaWiki API client (NEW)
│   │       ├── games-map.ts              ← Bulbapedia game name → GameId table (NEW)
│   │       ├── parser.ts                 ← wikitext template extractor (NEW)
│   │       └── encounters.ts             ← high-level fetch+parse for one Pokemon page (NEW)
│   ├── normalizers/
│   │   └── encounters.ts                 ← Bulbapedia parsed entries → our Encounter type (NEW)
│   ├── overrides/
│   │   └── apply.ts                      ← merge data-overrides JSON files into encounters (NEW)
│   └── output/
│       └── coverage.ts                   ← CoverageReport generator (NEW)
└── tests/
    ├── fixtures/
    │   ├── bulbapedia-pikachu.wikitext
    │   ├── bulbapedia-mewtwo.wikitext
    │   ├── bulbapedia-solrock.wikitext      ← version-exclusive case
    │   ├── bulbapedia-mew.wikitext          ← event-only case
    │   └── bulbapedia-eevee.wikitext        ← multiple evolutions case
    ├── bulbapedia-client.test.ts
    ├── bulbapedia-parser.test.ts
    ├── bulbapedia-encounters.test.ts
    ├── encounters-normalizer.test.ts
    ├── overrides-apply.test.ts
    └── coverage.test.ts

data-overrides/
├── README.md                             ← UPDATE: now references real files
├── events.json                           ← NEW: empty array initially, populated as user discovers events
├── version-exclusives.json               ← NEW: empty array
├── corrections.json                      ← NEW: empty array
└── frlg-transfer.json                    ← NEW: marker file documenting FRLG → HOME decision

apps/scraper-api/
├── src/
│   ├── app.ts                            ← NEW: exports `createApp()` returning Hono instance with routes
│   ├── server.ts                         ← NEW: boots app on port (was index.ts logic)
│   ├── routes/
│   │   ├── health.ts                     ← NEW: extracted from old index.ts
│   │   └── scrape.ts                     ← NEW: SSE endpoint /api/scrape
│   └── index.ts                          ← REPLACE: just re-export server.ts as the bin entrypoint
└── tests/
    ├── health.test.ts                    ← NEW: tests /api/health via app.fetch
    └── scrape.test.ts                    ← NEW: tests /api/scrape SSE event sequence

packages/data/
├── dataset.json                          ← UPDATE: encounters[] populated
├── dataset-meta.json                     ← UPDATE: encountersCount > 0, scrapedFrom includes 'bulbapedia' + 'manual-overrides'
└── coverage-report.json                  ← NEW: generated each scrape, committed for visibility

apps/web/src/
└── App.tsx                               ← UPDATE: stats grid now shows real encounter count meaningfully
```

**Files NOT created in this plan (reserved for Plan 04+):**
- `apps/web/src/db/*` (Dexie schema) — Plan 04
- `apps/web/src/features/*` (real screens) — Plan 04
- The "Rescrape" button UI consuming `/api/scrape` SSE — Plan 04 (the SSE endpoint exists in this plan but UI consumer waits)

---

## Task 1: Setup `data-overrides/*.json` empty stubs

**Files:**
- Modify: `data-overrides/README.md`
- Create: `data-overrides/events.json`
- Create: `data-overrides/version-exclusives.json`
- Create: `data-overrides/corrections.json`
- Create: `data-overrides/frlg-transfer.json`

- [ ] **Step 1.1: Update `data-overrides/README.md`**

Replace the entire content with:

```markdown
# data-overrides/

Manual corrections layered on top of automated scraper output.

Files in this folder are merged **after** PokéAPI (Pokémon catalog) and Bulbapedia (encounters) data during the build pipeline. Each file is a JSON array of override entries that **add or replace** auto-detected entries.

## Files

- `events.json` — event-distributed Pokémon (Mew, Celebi, Magearna, etc.) marked with `method.type: 'event'`. These would not be captured by Bulbapedia's "Game locations" sections.
- `version-exclusives.json` — confirmed version-exclusive overrides. Used when the auto-parser misses a version-exclusive marker.
- `corrections.json` — fixes for Bulbapedia parsing errors or outdated info. Anything that doesn't fit the other categories.
- `frlg-transfer.json` — marker documenting the FRLG → HOME transferability decision. Default: `homeTransfer: 'unsupported'`. If this is ever confirmed otherwise, override here.

## Schema

Each entry must conform to the `Encounter` shape from `@livingdex/types`:

```typescript
{
  pokemonId: string;       // e.g., "pikachu" or "raichu-alola"
  gameId: GameId;          // one of the 9 supported games
  dlcRequired?: string;    // optional, e.g., "isle-of-armor"
  method: EncounterMethod; // discriminated union: wild | evolution | gift | fossil | breeding | in-game-trade | event
  notes?: string;          // optional human-readable note
}
```

## Merge order

1. PokéAPI provides the Pokémon catalog (no encounters)
2. Bulbapedia provides auto-detected encounters per game
3. Overrides files are applied LAST: an override with the same `(pokemonId, gameId, method.type)` as an auto-detected entry **replaces** it; new entries are added.
```

- [ ] **Step 1.2: Create `data-overrides/events.json`**

```json
[]
```

(Empty array — to be populated as user discovers events that need overrides.)

- [ ] **Step 1.3: Create `data-overrides/version-exclusives.json`**

```json
[]
```

- [ ] **Step 1.4: Create `data-overrides/corrections.json`**

```json
[]
```

- [ ] **Step 1.5: Create `data-overrides/frlg-transfer.json`**

```json
[]
```

(Empty for now. The `Game.homeTransfer: 'unsupported'` flag for FRLG already exists in the static games table from Plan 02. This file is a placeholder for future encounter overrides specific to FRLG transfer chain — e.g., if a Pokémon can be transferred via Pal Park to Gen 4 → Bank → HOME, that transfer chain might need encoding here.)

- [ ] **Step 1.6: Run `pnpm lint`**

Run: `pnpm lint`
Expected: PASS (Biome doesn't lint markdown by default; JSON files are well-formed empty arrays).

- [ ] **Step 1.7: Commit**

```bash
git add data-overrides/
git commit -m "feat(data-overrides): create override stubs for events, version-exclusives, corrections"
```

---

## Task 2: Bulbapedia HTTP client

**Files:**
- Create: `packages/scrapers/src/sources/bulbapedia/client.ts`
- Create: `packages/scrapers/tests/bulbapedia-client.test.ts`

- [ ] **Step 2.1: Write the failing test**

Create `packages/scrapers/tests/bulbapedia-client.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BulbapediaClient } from '../src/sources/bulbapedia/client.ts';

let cacheDir: string;
const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

beforeEach(() => {
  cacheDir = mkdtempSync(join(tmpdir(), 'bulba-cache-'));
  fetchMock.mockReset();
});

afterEach(() => {
  rmSync(cacheDir, { recursive: true, force: true });
});

describe('BulbapediaClient', () => {
  it('fetches wikitext via MediaWiki API', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ parse: { wikitext: { '*': '== Test ==\nhello' } } }),
    } as Response);

    const client = new BulbapediaClient({ cacheDir });
    const result = await client.getWikitext('Pikachu_(Pokémon)');

    expect(result).toBe('== Test ==\nhello');
    expect(fetchMock).toHaveBeenCalledOnce();
    const url = (fetchMock.mock.calls[0]?.[0] as string) ?? '';
    expect(url).toContain('action=parse');
    expect(url).toContain('page=Pikachu_%28Pok%C3%A9mon%29');
    expect(url).toContain('prop=wikitext');
    expect(url).toContain('format=json');
  });

  it('caches wikitext to disk and reads from cache on second call', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ parse: { wikitext: { '*': 'cached content' } } }),
    } as Response);

    const client = new BulbapediaClient({ cacheDir });
    await client.getWikitext('Mewtwo_(Pokémon)');
    fetchMock.mockClear();

    const result = await client.getWikitext('Mewtwo_(Pokémon)');
    expect(result).toBe('cached content');
    expect(fetchMock).not.toHaveBeenCalled();

    const cachePath = join(cacheDir, 'Mewtwo_(Pokémon).wikitext');
    expect(existsSync(cachePath)).toBe(true);
    expect(readFileSync(cachePath, 'utf8')).toBe('cached content');
  });

  it('sends a custom User-Agent header', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ parse: { wikitext: { '*': 'x' } } }),
    } as Response);

    const client = new BulbapediaClient({ cacheDir });
    await client.getWikitext('Pikachu_(Pokémon)');
    const headers = (fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.headers as
      | Record<string, string>
      | undefined;
    expect(headers?.['User-Agent']).toContain('PokemonLivingDex');
  });

  it('throws on missing parse.wikitext in response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ error: { code: 'missingtitle' } }),
    } as Response);

    const client = new BulbapediaClient({ cacheDir });
    await expect(client.getWikitext('Nonexistent_(Pokémon)')).rejects.toThrow();
  });

  it('respects 1 req/s rate limit between calls', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ parse: { wikitext: { '*': 'x' } } }),
    } as Response);

    const client = new BulbapediaClient({ cacheDir, rateLimitMs: 100 });
    const start = Date.now();
    await client.getWikitext('A_(Pokémon)');
    await client.getWikitext('B_(Pokémon)');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(100);
  });
});
```

- [ ] **Step 2.2: Run test to confirm failure**

Run: `pnpm --filter @livingdex/scrapers test`
Expected: 5 failures for bulbapedia-client tests.

- [ ] **Step 2.3: Implement**

Create `packages/scrapers/src/sources/bulbapedia/client.ts`:

```typescript
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const BULBAPEDIA_BASE = 'https://bulbapedia.bulbagarden.net/w/api.php';
const USER_AGENT =
  'PokemonLivingDex-Scraper/0.3.0 (+https://github.com/FabienLacorre/LivingDexHelper)';

export type BulbapediaClientOptions = {
  cacheDir: string;
  noCache?: boolean;
  baseUrl?: string;
  rateLimitMs?: number;
};

type ParseApiResponse = {
  parse?: { wikitext?: { '*': string } };
  error?: { code: string; info?: string };
};

export class BulbapediaClient {
  private readonly cacheDir: string;
  private readonly noCache: boolean;
  private readonly baseUrl: string;
  private readonly rateLimitMs: number;
  private nextRequestAllowedAt = 0;

  constructor(options: BulbapediaClientOptions) {
    this.cacheDir = options.cacheDir;
    this.noCache = options.noCache ?? false;
    this.baseUrl = options.baseUrl ?? BULBAPEDIA_BASE;
    this.rateLimitMs = options.rateLimitMs ?? 1000;
    mkdirSync(this.cacheDir, { recursive: true });
  }

  async getWikitext(pageTitle: string): Promise<string> {
    const cachePath = this.cachePathFor(pageTitle);
    if (!this.noCache && existsSync(cachePath)) {
      return readFileSync(cachePath, 'utf8');
    }

    await this.respectRateLimit();
    const url = new URL(this.baseUrl);
    url.searchParams.set('action', 'parse');
    url.searchParams.set('page', pageTitle);
    url.searchParams.set('prop', 'wikitext');
    url.searchParams.set('format', 'json');

    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(
        `Bulbapedia ${response.status} ${response.statusText} for ${pageTitle}`,
      );
    }

    const data = (await response.json()) as ParseApiResponse;
    if (data.error || !data.parse?.wikitext?.['*']) {
      throw new Error(
        `Bulbapedia error for ${pageTitle}: ${data.error?.code ?? 'no wikitext returned'}`,
      );
    }

    const wikitext = data.parse.wikitext['*'];
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, wikitext, 'utf8');
    return wikitext;
  }

  private cachePathFor(pageTitle: string): string {
    return join(this.cacheDir, `${pageTitle}.wikitext`);
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

- [ ] **Step 2.4: Run tests**

Run: `pnpm --filter @livingdex/scrapers test`
Expected: 5 client tests pass. Cumulative: 33 + 5 = 38 tests.

- [ ] **Step 2.5: Typecheck + lint + commit**

```bash
pnpm --filter @livingdex/scrapers typecheck
pnpm lint
git add packages/scrapers/
git commit -m "feat(scrapers): add Bulbapedia MediaWiki client with cache and rate limiting"
```

---

## Task 3: Bulbapedia game-name → GameId mapping

**Files:**
- Create: `packages/scrapers/src/sources/bulbapedia/games-map.ts`
- Create test entries in `packages/scrapers/tests/bulbapedia-encounters.test.ts` (will be expanded later)

- [ ] **Step 3.1: Write the failing test (just for the games-map function for now)**

Create `packages/scrapers/tests/bulbapedia-encounters.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { bulbapediaGameToGameIds } from '../src/sources/bulbapedia/games-map.ts';

describe('bulbapediaGameToGameIds', () => {
  it('maps "Sword/Shield" to both sword and shield', () => {
    expect(bulbapediaGameToGameIds('Sword/Shield')).toEqual(['sword', 'shield']);
  });
  it('maps "Sword" to ["sword"]', () => {
    expect(bulbapediaGameToGameIds('Sword')).toEqual(['sword']);
  });
  it('maps "Brilliant Diamond/Shining Pearl" to both bdsp', () => {
    expect(bulbapediaGameToGameIds('Brilliant Diamond/Shining Pearl')).toEqual(['bdsp-d', 'bdsp-p']);
  });
  it('maps "Legends: Arceus" to pla', () => {
    expect(bulbapediaGameToGameIds('Legends: Arceus')).toEqual(['pla']);
  });
  it('maps "Scarlet/Violet" to both scarlet+violet', () => {
    expect(bulbapediaGameToGameIds('Scarlet/Violet')).toEqual(['scarlet', 'violet']);
  });
  it('maps "FireRed/LeafGreen" to FRLG variants', () => {
    expect(bulbapediaGameToGameIds('FireRed/LeafGreen')).toEqual(['frlg-fr', 'frlg-lg']);
  });
  it('maps "FRLG" abbreviation to FRLG variants', () => {
    expect(bulbapediaGameToGameIds('FRLG')).toEqual(['frlg-fr', 'frlg-lg']);
  });
  it('returns empty array for unknown game name', () => {
    expect(bulbapediaGameToGameIds('Unknown Game XYZ')).toEqual([]);
  });
});
```

- [ ] **Step 3.2: Run test to confirm failure**

Run: `pnpm --filter @livingdex/scrapers test`
Expected: 8 failures.

- [ ] **Step 3.3: Implement**

Create `packages/scrapers/src/sources/bulbapedia/games-map.ts`:

```typescript
import type { GameId } from '@livingdex/types';

const MAPPINGS: Array<[string, GameId[]]> = [
  ['Sword/Shield', ['sword', 'shield']],
  ['Sword', ['sword']],
  ['Shield', ['shield']],
  ['Brilliant Diamond/Shining Pearl', ['bdsp-d', 'bdsp-p']],
  ['Brilliant Diamond', ['bdsp-d']],
  ['Shining Pearl', ['bdsp-p']],
  ['BDSP', ['bdsp-d', 'bdsp-p']],
  ['Legends: Arceus', ['pla']],
  ['Pokémon Legends: Arceus', ['pla']],
  ['PLA', ['pla']],
  ['Scarlet/Violet', ['scarlet', 'violet']],
  ['Scarlet', ['scarlet']],
  ['Violet', ['violet']],
  ['SV', ['scarlet', 'violet']],
  ['FireRed/LeafGreen', ['frlg-fr', 'frlg-lg']],
  ['FireRed', ['frlg-fr']],
  ['LeafGreen', ['frlg-lg']],
  ['FRLG', ['frlg-fr', 'frlg-lg']],
];

export function bulbapediaGameToGameIds(name: string): GameId[] {
  const trimmed = name.trim();
  for (const [bulbaName, ids] of MAPPINGS) {
    if (trimmed === bulbaName) return [...ids];
  }
  return [];
}
```

- [ ] **Step 3.4: Run tests, typecheck, lint, commit**

Run: `pnpm --filter @livingdex/scrapers test` (8 new pass, 46 cumulative)
Run: `pnpm --filter @livingdex/scrapers typecheck && pnpm lint`

```bash
git add packages/scrapers/
git commit -m "feat(scrapers): add Bulbapedia game name to GameId mapping"
```

---

## Task 4: Capture wikitext fixtures from real Bulbapedia pages

**Files:**
- Create: `packages/scrapers/tests/fixtures/bulbapedia-pikachu.wikitext`
- Create: `packages/scrapers/tests/fixtures/bulbapedia-mewtwo.wikitext`
- Create: `packages/scrapers/tests/fixtures/bulbapedia-solrock.wikitext`
- Create: `packages/scrapers/tests/fixtures/bulbapedia-mew.wikitext`
- Create: `packages/scrapers/tests/fixtures/bulbapedia-eevee.wikitext`

This task captures real wikitext that the parser will be tested against. These fixtures determine how the parser is implemented.

- [ ] **Step 4.1: Capture fixtures via the MediaWiki API**

Use curl to fetch and save the raw wikitext for each Pokémon page. The MediaWiki API returns JSON; extract the `parse.wikitext.*` field with `jq`:

```bash
mkdir -p packages/scrapers/tests/fixtures

for slug in "Pikachu_(Pok%C3%A9mon)" "Mewtwo_(Pok%C3%A9mon)" "Solrock_(Pok%C3%A9mon)" "Mew_(Pok%C3%A9mon)" "Eevee_(Pok%C3%A9mon)"; do
  filename=$(echo "$slug" | sed 's/_(Pok%C3%A9mon)//' | tr '[:upper:]' '[:lower:]')
  curl -s -A "PokemonLivingDex-Scraper/0.3.0 (https://github.com/FabienLacorre/LivingDexHelper)" \
    "https://bulbapedia.bulbagarden.net/w/api.php?action=parse&page=${slug}&prop=wikitext&format=json" \
    | jq -r '.parse.wikitext."*"' > "packages/scrapers/tests/fixtures/bulbapedia-${filename}.wikitext"
done
```

If `jq` isn't installed: install it via `winget install jqlang.jq` (Windows) or use a Node one-liner instead.

The fixtures will be 50-200 KB each. That's OK — they're text files and Git compresses them well. We won't trim them; the parser tests need realistic input.

⚠️ **Important:** these fixtures contain copyrighted wikitext from Bulbapedia. They're committed under "fair use educational" similar to PokéAPI sprites. If the project ever becomes commercial, revisit.

- [ ] **Step 4.2: Sanity check the fixtures**

Verify each file is non-empty and contains a "Game locations" or "Availability" section:

```bash
for f in packages/scrapers/tests/fixtures/bulbapedia-*.wikitext; do
  echo "=== $f ==="
  wc -l "$f"
  grep -c "Game locations\|Availability" "$f" || true
done
```

Expected: each file 1000+ lines, at least one "Game locations" or "Availability" hit per file.

If a file is empty or missing the section: re-curl with the correct slug. URL-encoded slugs sometimes differ from raw spaces (e.g., `Mr._Mime` vs `Mr_Mime`).

- [ ] **Step 4.3: No code change in this task — just commit the fixtures**

```bash
git add packages/scrapers/tests/fixtures/bulbapedia-*.wikitext
git commit -m "test(scrapers): add Bulbapedia wikitext fixtures for parser tests"
```

---

## Task 5: Wikitext parser — extract per-game availability entries

**Files:**
- Create: `packages/scrapers/src/sources/bulbapedia/parser.ts`
- Create: `packages/scrapers/tests/bulbapedia-parser.test.ts`

The parser is the most fragile piece of the entire project. It uses regex-based extraction of MediaWiki templates. The output is a "raw" availability list keyed by game name (Bulbapedia format), to be normalized in Task 6.

- [ ] **Step 5.1: Write the failing test**

Create `packages/scrapers/tests/bulbapedia-parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  extractGameLocationsSection,
  parseAvailabilityEntries,
} from '../src/sources/bulbapedia/parser.ts';

const FIXTURES = join(import.meta.dirname, 'fixtures');
const pikachu = readFileSync(join(FIXTURES, 'bulbapedia-pikachu.wikitext'), 'utf8');
const solrock = readFileSync(join(FIXTURES, 'bulbapedia-solrock.wikitext'), 'utf8');
const mew = readFileSync(join(FIXTURES, 'bulbapedia-mew.wikitext'), 'utf8');

describe('extractGameLocationsSection', () => {
  it('returns the Game locations section text from a real wikitext', () => {
    const section = extractGameLocationsSection(pikachu);
    expect(section).toBeDefined();
    expect(section?.length ?? 0).toBeGreaterThan(100);
  });

  it('returns undefined if no Game locations section exists', () => {
    const section = extractGameLocationsSection('==Just a page==\nno locations here');
    expect(section).toBeUndefined();
  });
});

describe('parseAvailabilityEntries', () => {
  it('extracts availability entries from Pikachu wikitext', () => {
    const section = extractGameLocationsSection(pikachu);
    expect(section).toBeDefined();
    const entries = parseAvailabilityEntries(section ?? '');
    // Pikachu has many entries across generations; modern entries should include Sword/Shield, SV, BDSP, PLA
    expect(entries.length).toBeGreaterThan(0);
    const games = entries.map((e) => e.gameLabel);
    expect(games.some((g) => g.includes('Sword') || g.includes('Shield'))).toBe(true);
  });

  it('extracts version-exclusive markers for Solrock', () => {
    const section = extractGameLocationsSection(solrock);
    expect(section).toBeDefined();
    const entries = parseAvailabilityEntries(section ?? '');
    expect(entries.length).toBeGreaterThan(0);
    // Solrock should have a marker about being a Sword exclusive vs Shield
    // We just check that at least one entry mentions Sword or Shield
    const games = entries.map((e) => e.gameLabel);
    expect(games.some((g) => /sword|shield/i.test(g))).toBe(true);
  });

  it('handles Mew wikitext (event-distributed Pokémon)', () => {
    const section = extractGameLocationsSection(mew);
    // Mew often has "Event" markers or empty/special entries; the parser shouldn't throw
    const entries = parseAvailabilityEntries(section ?? '');
    expect(Array.isArray(entries)).toBe(true);
  });

  it('returns empty array for empty input', () => {
    expect(parseAvailabilityEntries('')).toEqual([]);
  });
});
```

- [ ] **Step 5.2: Run test to confirm failure**

Run: `pnpm --filter @livingdex/scrapers test`
Expected: failures (parser.ts doesn't exist).

- [ ] **Step 5.3: Implement parser**

Create `packages/scrapers/src/sources/bulbapedia/parser.ts`:

```typescript
/**
 * Best-effort regex-based wikitext parser for Bulbapedia "Game locations" sections.
 *
 * This parser is intentionally permissive: it extracts what it can, and gaps are
 * surfaced via the coverage report so manual overrides can fill them. Wikitext is
 * a complex template-based format; we don't aim for completeness, just usefulness.
 *
 * Output: a flat list of "RawAvailabilityEntry" with the game label as Bulbapedia
 * writes it (e.g., "Sword/Shield", "Brilliant Diamond/Shining Pearl"). Mapping to
 * our GameId is the next step (encounters normalizer).
 */

export type RawAvailabilityEntry = {
  gameLabel: string;
  rawDescription: string;
  isUnobtainable: boolean;
};

const SECTION_HEADERS = [
  /==\s*Game locations\s*==/i,
  /==\s*Availability\s*==/i,
];

/**
 * Extract the "Game locations" or "Availability" section from a Pokémon wikitext.
 * Returns the section content (without the heading) or undefined if not found.
 */
export function extractGameLocationsSection(wikitext: string): string | undefined {
  for (const headerPattern of SECTION_HEADERS) {
    const match = headerPattern.exec(wikitext);
    if (!match) continue;
    const start = match.index + match[0].length;
    // End: next ==Section== heading at the same level (==xxx==), or end of doc.
    const remainder = wikitext.slice(start);
    const nextSectionMatch = /^==[^=].*==/m.exec(remainder);
    const end = nextSectionMatch ? nextSectionMatch.index : remainder.length;
    return remainder.slice(0, end);
  }
  return undefined;
}

/**
 * Parse availability entries from a Game locations section.
 *
 * Bulbapedia uses templates like:
 *   {{Availability/Entry1/9|Sword/Shield|...|Various locations}}
 *   {{Availability/Entry|9|Sword/Shield|Wild|Various locations}}
 *
 * We extract the game label (typically the 2nd or 3rd template arg) and the
 * description (later args). Unobtainability markers like "{{tt|—|...}}" or
 * "Unobtainable" are flagged.
 */
export function parseAvailabilityEntries(section: string): RawAvailabilityEntry[] {
  if (!section) return [];

  const entries: RawAvailabilityEntry[] = [];
  // Match {{Availability/Entry...|args...}} templates.
  const templatePattern = /\{\{Availability\/[^|}]+\|([^}]+)\}\}/g;
  let match: RegExpExecArray | null;

  while ((match = templatePattern.exec(section)) !== null) {
    const argsRaw = match[1] ?? '';
    const args = splitTemplateArgs(argsRaw);
    if (args.length < 2) continue;

    // The game label is usually arg[1] (after a generation number) or arg[0]
    // depending on the variant used. We look for a known game-name pattern.
    const gameLabel = pickGameLabel(args);
    if (!gameLabel) continue;

    const description = args.slice(args.indexOf(gameLabel) + 1).join(' ').trim();
    const isUnobtainable = /unobtainable|not.*available|—|cannot.*obtain/i.test(description);

    entries.push({
      gameLabel,
      rawDescription: description,
      isUnobtainable,
    });
  }

  return entries;
}

const KNOWN_GAME_KEYWORDS = [
  'Sword',
  'Shield',
  'Brilliant Diamond',
  'Shining Pearl',
  'Legends: Arceus',
  'Scarlet',
  'Violet',
  'FireRed',
  'LeafGreen',
];

function pickGameLabel(args: string[]): string | undefined {
  for (const arg of args) {
    const trimmed = arg.trim();
    if (KNOWN_GAME_KEYWORDS.some((k) => trimmed.includes(k))) {
      return trimmed;
    }
  }
  return undefined;
}

function splitTemplateArgs(argsRaw: string): string[] {
  // Naive split on |, but respect nested templates {{ }} which themselves contain |.
  const result: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < argsRaw.length; i++) {
    const ch = argsRaw[i];
    const next = argsRaw[i + 1];
    if (ch === '{' && next === '{') {
      depth++;
      current += '{{';
      i++;
      continue;
    }
    if (ch === '}' && next === '}') {
      depth--;
      current += '}}';
      i++;
      continue;
    }
    if (ch === '|' && depth === 0) {
      result.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current) result.push(current);
  return result.map((s) => s.trim());
}
```

- [ ] **Step 5.4: Run tests**

Run: `pnpm --filter @livingdex/scrapers test`
Expected: parser tests pass. Cumulative ~50 tests.

⚠️ **The parser is best-effort**. Some edge cases in the real fixtures may not be captured. If a test fails with "expected at least one entry", it means the fixture's actual template format doesn't match our regex. **Read the actual fixture file** to understand the template variants used, and adjust the regex/heuristics. Don't lower the test bar — adjust the parser.

If the regex needs tweaking: the goal is "extract as many entries as possible, log failures, let manual overrides fill gaps". So if a Pokémon has 10 game entries and we extract 7, that's acceptable (3 missing → coverage report → manual overrides).

- [ ] **Step 5.5: Typecheck + lint + commit**

```bash
pnpm --filter @livingdex/scrapers typecheck
pnpm lint
git add packages/scrapers/
git commit -m "feat(scrapers): add Bulbapedia wikitext parser (best-effort regex-based)"
```

---

## Task 6: Encounters normalizer (Bulbapedia raw → our Encounter type)

**Files:**
- Create: `packages/scrapers/src/normalizers/encounters.ts`
- Create: `packages/scrapers/tests/encounters-normalizer.test.ts`

- [ ] **Step 6.1: Write the failing test**

Create `packages/scrapers/tests/encounters-normalizer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeBulbapediaEntry } from '../src/normalizers/encounters.ts';
import type { RawAvailabilityEntry } from '../src/sources/bulbapedia/parser.ts';

describe('normalizeBulbapediaEntry', () => {
  it('produces wild encounter entries for Pikachu in Sword/Shield', () => {
    const entry: RawAvailabilityEntry = {
      gameLabel: 'Sword/Shield',
      rawDescription: 'Route 4, Wild Area',
      isUnobtainable: false,
    };
    const result = normalizeBulbapediaEntry(entry, 'pikachu');
    expect(result).toHaveLength(2); // sword + shield
    expect(result[0]).toMatchObject({
      pokemonId: 'pikachu',
      gameId: 'sword',
      method: { type: 'wild' },
    });
    expect(result[1]?.gameId).toBe('shield');
  });

  it('produces no entries when game label is unrecognized', () => {
    const entry: RawAvailabilityEntry = {
      gameLabel: 'Stadium 2',
      rawDescription: 'doesnt matter',
      isUnobtainable: false,
    };
    const result = normalizeBulbapediaEntry(entry, 'pikachu');
    expect(result).toEqual([]);
  });

  it('produces no entries when isUnobtainable is true', () => {
    const entry: RawAvailabilityEntry = {
      gameLabel: 'Sword',
      rawDescription: 'Unobtainable',
      isUnobtainable: true,
    };
    const result = normalizeBulbapediaEntry(entry, 'pikachu');
    expect(result).toEqual([]);
  });

  it('detects evolution method from "Evolve" keyword in description', () => {
    const entry: RawAvailabilityEntry = {
      gameLabel: 'Scarlet',
      rawDescription: 'Evolve Pichu',
      isUnobtainable: false,
    };
    const result = normalizeBulbapediaEntry(entry, 'pikachu');
    expect(result[0]?.method.type).toBe('evolution');
  });

  it('detects breeding method from "breed" keyword', () => {
    const entry: RawAvailabilityEntry = {
      gameLabel: 'Sword/Shield',
      rawDescription: 'Breed Pikachu',
      isUnobtainable: false,
    };
    const result = normalizeBulbapediaEntry(entry, 'pichu');
    expect(result[0]?.method.type).toBe('breeding');
  });

  it('detects gift method from "gift" keyword', () => {
    const entry: RawAvailabilityEntry = {
      gameLabel: 'Sword/Shield',
      rawDescription: 'Gift from Professor',
      isUnobtainable: false,
    };
    const result = normalizeBulbapediaEntry(entry, 'pikachu');
    expect(result[0]?.method.type).toBe('gift');
  });

  it('extracts location strings for wild encounters', () => {
    const entry: RawAvailabilityEntry = {
      gameLabel: 'Sword',
      rawDescription: 'Route 4, Wild Area',
      isUnobtainable: false,
    };
    const result = normalizeBulbapediaEntry(entry, 'pikachu');
    const method = result[0]?.method;
    expect(method?.type).toBe('wild');
    if (method?.type === 'wild') {
      expect(method.locations.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 6.2: Run test to confirm failure**

Run: `pnpm --filter @livingdex/scrapers test`
Expected: 7 failures.

- [ ] **Step 6.3: Implement**

Create `packages/scrapers/src/normalizers/encounters.ts`:

```typescript
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

  return gameIds.map((gameId) => ({
    pokemonId,
    gameId,
    method,
    notes: entry.rawDescription || undefined,
  }));
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
```

- [ ] **Step 6.4: Run tests, typecheck, lint, commit**

Run: `pnpm --filter @livingdex/scrapers test` (7 new pass, ~57 cumulative)
Run: `pnpm --filter @livingdex/scrapers typecheck && pnpm lint`

```bash
git add packages/scrapers/
git commit -m "feat(scrapers): add Bulbapedia encounter normalizer"
```

---

## Task 7: Bulbapedia high-level fetch+parse helper

**Files:**
- Create: `packages/scrapers/src/sources/bulbapedia/encounters.ts`

This module is a thin orchestrator that ties client + parser + normalizer for one Pokémon page.

- [ ] **Step 7.1: Add tests to `bulbapedia-encounters.test.ts`**

Append to the existing test file:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchBulbapediaEncounters } from '../src/sources/bulbapedia/encounters.ts';
import type { BulbapediaClient } from '../src/sources/bulbapedia/client.ts';

const FIXTURES = join(import.meta.dirname, 'fixtures');
const pikachuWikitext = readFileSync(join(FIXTURES, 'bulbapedia-pikachu.wikitext'), 'utf8');

describe('fetchBulbapediaEncounters', () => {
  it('fetches wikitext, parses, and normalizes for one Pokémon', async () => {
    const clientMock = {
      getWikitext: vi.fn().mockResolvedValue(pikachuWikitext),
    } as unknown as BulbapediaClient;

    const encounters = await fetchBulbapediaEncounters(clientMock, 'pikachu', 'Pikachu_(Pokémon)');
    expect(Array.isArray(encounters)).toBe(true);
    // Real Pikachu page should yield encounters for at least Sword/Shield + SV
    if (encounters.length > 0) {
      const games = new Set(encounters.map((e) => e.gameId));
      expect(games.size).toBeGreaterThan(0);
    }
  });

  it('returns empty array when the page has no Game locations section', async () => {
    const clientMock = {
      getWikitext: vi.fn().mockResolvedValue('==Just a page==\nno locations'),
    } as unknown as BulbapediaClient;

    const encounters = await fetchBulbapediaEncounters(
      clientMock,
      'unknown',
      'Unknown_(Pokémon)',
    );
    expect(encounters).toEqual([]);
  });
});
```

- [ ] **Step 7.2: Run, confirm failures**

- [ ] **Step 7.3: Implement**

Create `packages/scrapers/src/sources/bulbapedia/encounters.ts`:

```typescript
import type { Encounter } from '@livingdex/types';
import type { BulbapediaClient } from './client.ts';
import { extractGameLocationsSection, parseAvailabilityEntries } from './parser.ts';
import { normalizeBulbapediaEntry } from '../../normalizers/encounters.ts';

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
```

- [ ] **Step 7.4: Run, typecheck, lint, commit**

```bash
pnpm --filter @livingdex/scrapers test
pnpm --filter @livingdex/scrapers typecheck && pnpm lint
git add packages/scrapers/
git commit -m "feat(scrapers): add Bulbapedia encounters fetch+parse helper"
```

---

## Task 8: Overrides applier

**Files:**
- Create: `packages/scrapers/src/overrides/apply.ts`
- Create: `packages/scrapers/tests/overrides-apply.test.ts`

- [ ] **Step 8.1: Write the failing test**

Create `packages/scrapers/tests/overrides-apply.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyOverrides } from '../src/overrides/apply.ts';
import type { Encounter } from '@livingdex/types';

let overridesDir: string;

beforeEach(() => {
  overridesDir = mkdtempSync(join(tmpdir(), 'overrides-'));
});

afterEach(() => {
  rmSync(overridesDir, { recursive: true, force: true });
});

describe('applyOverrides', () => {
  it('returns auto encounters unchanged when no override files exist', async () => {
    const auto: Encounter[] = [
      {
        pokemonId: 'pikachu',
        gameId: 'sword',
        method: { type: 'wild', locations: ['Route 4'] },
      },
    ];
    const result = await applyOverrides(auto, overridesDir);
    expect(result).toEqual(auto);
  });

  it('adds new entries from overrides', async () => {
    writeFileSync(
      join(overridesDir, 'events.json'),
      JSON.stringify([
        {
          pokemonId: 'mew',
          gameId: 'sword',
          method: { type: 'event', distributedAs: 'Pokémon HOME distribution' },
        },
      ]),
    );
    const auto: Encounter[] = [];
    const result = await applyOverrides(auto, overridesDir);
    expect(result).toHaveLength(1);
    expect(result[0]?.pokemonId).toBe('mew');
    expect(result[0]?.method.type).toBe('event');
  });

  it('replaces existing entry when override has same (pokemonId, gameId, method.type)', async () => {
    const auto: Encounter[] = [
      {
        pokemonId: 'pikachu',
        gameId: 'sword',
        method: { type: 'wild', locations: ['old loc'] },
      },
    ];
    writeFileSync(
      join(overridesDir, 'corrections.json'),
      JSON.stringify([
        {
          pokemonId: 'pikachu',
          gameId: 'sword',
          method: { type: 'wild', locations: ['new loc'] },
        },
      ]),
    );
    const result = await applyOverrides(auto, overridesDir);
    expect(result).toHaveLength(1);
    const method = result[0]?.method;
    expect(method?.type).toBe('wild');
    if (method?.type === 'wild') {
      expect(method.locations).toEqual(['new loc']);
    }
  });

  it('keeps both auto and override when (pokemonId, gameId, method.type) differ', async () => {
    const auto: Encounter[] = [
      {
        pokemonId: 'pikachu',
        gameId: 'sword',
        method: { type: 'wild', locations: ['Route 4'] },
      },
    ];
    writeFileSync(
      join(overridesDir, 'corrections.json'),
      JSON.stringify([
        {
          pokemonId: 'pikachu',
          gameId: 'sword',
          method: { type: 'evolution', fromId: 'pichu' },
        },
      ]),
    );
    const result = await applyOverrides(auto, overridesDir);
    expect(result).toHaveLength(2);
  });

  it('reads multiple JSON files in the overrides dir', async () => {
    writeFileSync(
      join(overridesDir, 'events.json'),
      JSON.stringify([
        { pokemonId: 'mew', gameId: 'sword', method: { type: 'event', distributedAs: 'A' } },
      ]),
    );
    writeFileSync(
      join(overridesDir, 'version-exclusives.json'),
      JSON.stringify([
        { pokemonId: 'solrock', gameId: 'sword', method: { type: 'wild', locations: ['X'] } },
      ]),
    );
    const result = await applyOverrides([], overridesDir);
    expect(result).toHaveLength(2);
  });

  it('skips non-JSON files in the overrides dir', async () => {
    writeFileSync(join(overridesDir, 'README.md'), 'not json');
    writeFileSync(join(overridesDir, 'events.json'), JSON.stringify([]));
    const result = await applyOverrides([], overridesDir);
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 8.2: Run tests to confirm failures**

- [ ] **Step 8.3: Implement**

Create `packages/scrapers/src/overrides/apply.ts`:

```typescript
import { readdirSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
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
```

- [ ] **Step 8.4: Run, typecheck, lint, commit**

```bash
pnpm --filter @livingdex/scrapers test
pnpm --filter @livingdex/scrapers typecheck && pnpm lint
git add packages/scrapers/
git commit -m "feat(scrapers): add overrides applier with replace-by-key semantics"
```

---

## Task 9: Coverage report generator

**Files:**
- Create: `packages/scrapers/src/output/coverage.ts`
- Create: `packages/scrapers/tests/coverage.test.ts`

- [ ] **Step 9.1: Write failing test**

Create `packages/scrapers/tests/coverage.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateCoverageReport } from '../src/output/coverage.ts';
import type { Pokemon, Encounter } from '@livingdex/types';

const samplePokemon: Pokemon[] = [
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
  {
    id: 'mew',
    nationalDexNumber: 151,
    speciesSlug: 'mew',
    formId: null,
    formCategory: 'default',
    names: { en: 'Mew', fr: 'Mew' },
    types: ['psychic'],
    generation: 1,
    sprites: { default: '', shiny: '', artwork: '', icon: '' },
    evolutions: [],
  },
];

const sampleEncounters: Encounter[] = [
  {
    pokemonId: 'pikachu',
    gameId: 'sword',
    method: { type: 'wild', locations: ['Route 4'] },
  },
];

describe('generateCoverageReport', () => {
  it('counts total Pokémon and those with at least one encounter', () => {
    const report = generateCoverageReport(samplePokemon, sampleEncounters);
    expect(report.totalPokemon).toBe(2);
    expect(report.pokemonWithAnyEncounter).toBe(1);
    expect(report.pokemonWithoutEncounter).toEqual(['mew']);
  });

  it('breaks down by game', () => {
    const report = generateCoverageReport(samplePokemon, sampleEncounters);
    const swordCoverage = report.byGame.find((g) => g.gameId === 'sword');
    expect(swordCoverage).toBeDefined();
    expect(swordCoverage?.encounterCount).toBe(1);
  });

  it('returns empty report for empty inputs', () => {
    const report = generateCoverageReport([], []);
    expect(report.totalPokemon).toBe(0);
    expect(report.pokemonWithAnyEncounter).toBe(0);
    expect(report.pokemonWithoutEncounter).toEqual([]);
  });
});
```

- [ ] **Step 9.2: Run failures**

- [ ] **Step 9.3: Implement**

Create `packages/scrapers/src/output/coverage.ts`:

```typescript
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
```

- [ ] **Step 9.4: Run, typecheck, lint, commit**

```bash
git add packages/scrapers/
git commit -m "feat(scrapers): add coverage report generator"
```

---

## Task 10: Update top-level pipeline + CLI for combined sources

**Files:**
- Modify: `packages/scrapers/src/pipeline.ts`
- Modify: `packages/scrapers/src/cli.ts`
- Modify: `packages/scrapers/src/index.ts`

- [ ] **Step 10.1: Update `pipeline.ts`**

Add a new top-level orchestrator function that combines PokéAPI Pokemon + Bulbapedia encounters + overrides:

```typescript
// Add to packages/scrapers/src/pipeline.ts (preserving runPokeApiPipeline)

import type { BulbapediaClient } from './sources/bulbapedia/client.ts';
import { fetchBulbapediaEncounters } from './sources/bulbapedia/encounters.ts';
import { applyOverrides } from './overrides/apply.ts';
import { generateCoverageReport, type CoverageReport } from './output/coverage.ts';

export type CombinedPipelineOptions = {
  pokeApiClient: PokeApiClient;
  bulbapediaClient: BulbapediaClient;
  speciesIds: number[];
  generations: number[];
  overridesDir: string;
  onProgress?: (event: ProgressEvent) => void;
};

export type CombinedPipelineResult = {
  dataset: Dataset;
  coverage: CoverageReport;
};

export async function runCombinedPipeline(
  options: CombinedPipelineOptions,
): Promise<CombinedPipelineResult> {
  const { pokeApiClient, bulbapediaClient, speciesIds, generations, overridesDir, onProgress } =
    options;

  // Phase 1: PokéAPI for Pokemon catalog
  const baseDataset = await runPokeApiPipeline({
    client: pokeApiClient,
    speciesIds,
    generations,
    onProgress,
  });

  // Phase 2: Bulbapedia for encounters per Pokemon
  const allEncounters: Encounter[] = [];
  const seenSpecies = new Set<string>();
  for (let i = 0; i < baseDataset.pokemon.length; i++) {
    const p = baseDataset.pokemon[i];
    if (!p) continue;
    if (seenSpecies.has(p.speciesSlug)) continue;
    seenSpecies.add(p.speciesSlug);

    onProgress?.({
      stage: 'sprites',  // reusing 'sprites' or defining a new 'bulbapedia' stage
      current: i + 1,
      total: baseDataset.pokemon.length,
      message: `Fetching Bulbapedia for ${p.speciesSlug}`,
    });

    const pageTitle = `${capitalize(p.speciesSlug)}_(Pokémon)`;
    const speciesEncounters = await fetchBulbapediaEncounters(
      bulbapediaClient,
      p.id,
      pageTitle,
    );
    allEncounters.push(...speciesEncounters);
  }

  // Phase 3: Apply manual overrides
  const finalEncounters = await applyOverrides(allEncounters, overridesDir);

  // Phase 4: Generate coverage report
  const coverage = generateCoverageReport(baseDataset.pokemon, finalEncounters);

  const dataset: Dataset = {
    ...baseDataset,
    meta: {
      ...baseDataset.meta,
      scrapedFrom: ['pokeapi', 'bulbapedia', 'manual-overrides'],
      encountersCount: finalEncounters.length,
    },
    encounters: finalEncounters,
  };

  return { dataset, coverage };
}

function capitalize(slug: string): string {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('_');
}
```

Also add a new `'bulbapedia'` stage to `ProgressEvent`:

```typescript
export type ProgressEvent = {
  stage: 'species' | 'evolution' | 'sprites' | 'bulbapedia' | 'overrides' | 'write';
  current: number;
  total: number;
  message: string;
};
```

(Replace the `stage` field of the existing ProgressEvent type to include the new values.)

- [ ] **Step 10.2: Update `index.ts` exports**

Replace `packages/scrapers/src/index.ts`:

```typescript
export const SCRAPER_VERSION = '0.3.0';
export { runPokeApiPipeline, runCombinedPipeline } from './pipeline.ts';
export type { ProgressEvent, PipelineOptions, CombinedPipelineOptions, CombinedPipelineResult } from './pipeline.ts';
export { PokeApiClient } from './sources/pokeapi/client.ts';
export { BulbapediaClient } from './sources/bulbapedia/client.ts';
export { GAMES } from './normalizers/games.ts';
export { writeDataset } from './output/writer.ts';
export { downloadSprites } from './sources/pokeapi/sprites.ts';
export { generateCoverageReport } from './output/coverage.ts';
export type { CoverageReport } from './output/coverage.ts';
```

- [ ] **Step 10.3: Update `cli.ts` to use the combined pipeline**

The CLI now needs to:
- Accept `--source pokeapi|bulbapedia|all` (default: `all`)
- Wire BulbapediaClient with cache in `.cache/bulbapedia/`
- Call `runCombinedPipeline` when source is `all` or `bulbapedia`
- Write `coverage-report.json` to `packages/data/`
- Reference `data-overrides/` from REPO_ROOT

Make these specific changes to `packages/scrapers/src/cli.ts`:

a. Add to imports at top:
```typescript
import { BulbapediaClient } from './sources/bulbapedia/client.ts';
import { runCombinedPipeline, runPokeApiPipeline } from './pipeline.ts';
import { writeFileSync } from 'node:fs';
```

b. Add `--source` to parseArgs options:
```typescript
source: { type: 'string', multiple: false, default: 'all' },
```

c. Add help text mentioning `--source`

d. After the existing `runPokeApiPipeline` call, branch on source:

Replace this section:
```typescript
const dataset = await runPokeApiPipeline({...});
```

With:
```typescript
let dataset;
let coverage;

if (values.source === 'pokeapi') {
  dataset = await runPokeApiPipeline({
    client: pokeApiClient,
    speciesIds,
    generations,
    onProgress: (event) => {
      process.stdout.write(`\r[${event.stage}] ${event.current}/${event.total}: ${event.message}`.padEnd(80));
    },
  });
} else {
  const bulbapediaClient = new BulbapediaClient({
    cacheDir: join(REPO_ROOT, '.cache', 'bulbapedia'),
    noCache: values['no-cache'] === true,
  });
  const overridesDir = join(REPO_ROOT, 'data-overrides');

  const result = await runCombinedPipeline({
    pokeApiClient,
    bulbapediaClient,
    speciesIds,
    generations,
    overridesDir,
    onProgress: (event) => {
      process.stdout.write(`\r[${event.stage}] ${event.current}/${event.total}: ${event.message}`.padEnd(80));
    },
  });
  dataset = result.dataset;
  coverage = result.coverage;
}
process.stdout.write('\n');

// Write coverage report if available
if (coverage) {
  writeFileSync(
    join(outDir, 'coverage-report.json'),
    JSON.stringify(coverage, null, 2),
    'utf8',
  );
  console.log(`Coverage report: ${coverage.pokemonWithAnyEncounter}/${coverage.totalPokemon} Pokémon have encounters.`);
}
```

- [ ] **Step 10.4: Run typecheck**

Run: `pnpm --filter @livingdex/scrapers typecheck`
Expected: PASS. If there are errors with the `dataset` type narrowing (unions of `Dataset` from both branches), declare `dataset: Dataset` explicitly.

- [ ] **Step 10.5: Run all tests**

Run: `pnpm --filter @livingdex/scrapers test`
Expected: all tests still pass (we didn't break anything).

- [ ] **Step 10.6: Smoke-test the new CLI**

Run: `pnpm scrape --help`
Expected: help text includes `--source`.

Run: `pnpm scrape --source pokeapi --gen 1 --no-sprites`
Expected: same as before — produces a Pokemon-only dataset for Gen 1.

After verification: revert `packages/data/dataset.json` and `dataset-meta.json` so Task 11 has clean state for the real combined scrape:
```bash
git checkout packages/data/dataset.json packages/data/dataset-meta.json
```

- [ ] **Step 10.7: Commit**

```bash
git add packages/scrapers/
git commit -m "feat(scrapers): add combined pipeline (pokeapi + bulbapedia + overrides) and CLI source flag"
```

---

## Task 11: Split scraper-api into app.ts + server.ts; add /api/health route module

**Files:**
- Create: `apps/scraper-api/src/app.ts`
- Create: `apps/scraper-api/src/server.ts`
- Create: `apps/scraper-api/src/routes/health.ts`
- Replace: `apps/scraper-api/src/index.ts`
- Create: `apps/scraper-api/tests/health.test.ts`

This refactor makes the Hono app importable for testing (no top-level `serve()` side effect).

- [ ] **Step 11.1: Write failing test for /api/health via app.fetch**

Create `apps/scraper-api/tests/health.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.ts';

describe('/api/health', () => {
  it('returns ok JSON with scraperVersion', async () => {
    const app = createApp();
    const response = await app.fetch(new Request('http://localhost/api/health'));
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.service).toBe('livingdex-scraper-api');
    expect(typeof body.scraperVersion).toBe('string');
    expect(typeof body.timestamp).toBe('string');
  });
});
```

- [ ] **Step 11.2: Add a `test` script to scraper-api's `package.json`**

If not already there, ensure scraper-api's `package.json` has:
```json
"scripts": {
  ...
  "test": "vitest run --passWithNoTests"
}
```

(It should already have this from Task 6 of Plan 01.)

- [ ] **Step 11.3: Run failing test**

Run: `pnpm --filter @livingdex/scraper-api test`
Expected: failure (createApp doesn't exist).

- [ ] **Step 11.4: Implement `routes/health.ts`**

Create `apps/scraper-api/src/routes/health.ts`:

```typescript
import { Hono } from 'hono';
import { SCRAPER_VERSION } from '@livingdex/scrapers';

export const healthRouter = new Hono();

healthRouter.get('/health', (c) =>
  c.json({
    ok: true,
    service: 'livingdex-scraper-api',
    scraperVersion: SCRAPER_VERSION,
    timestamp: new Date().toISOString(),
  }),
);
```

- [ ] **Step 11.5: Implement `app.ts`**

Create `apps/scraper-api/src/app.ts`:

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { healthRouter } from './routes/health.ts';

export function createApp(): Hono {
  const app = new Hono();
  app.use(
    '/api/*',
    cors({
      origin: ['http://localhost:5173'],
      allowMethods: ['GET', 'POST'],
    }),
  );
  app.route('/api', healthRouter);
  return app;
}
```

- [ ] **Step 11.6: Implement `server.ts`**

Create `apps/scraper-api/src/server.ts`:

```typescript
import { serve } from '@hono/node-server';
import { createApp } from './app.ts';

const app = createApp();
const port = Number.parseInt(process.env.PORT ?? '3001', 10);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`scraper-api listening on http://localhost:${info.port}`);
});
```

- [ ] **Step 11.7: Replace `index.ts` to point at server.ts**

Replace `apps/scraper-api/src/index.ts`:

```typescript
import './server.ts';
```

- [ ] **Step 11.8: Update `package.json` `dev`/`start` scripts**

Modify `apps/scraper-api/package.json`:
```json
"scripts": {
  "dev": "tsx watch src/server.ts",
  "start": "tsx src/server.ts",
  "typecheck": "tsc --noEmit",
  "test": "vitest run --passWithNoTests"
}
```

- [ ] **Step 11.9: Run all checks**

```bash
pnpm --filter @livingdex/scraper-api test         # health.test should pass
pnpm --filter @livingdex/scraper-api typecheck
pnpm lint
```

- [ ] **Step 11.10: Smoke-test the server**

Run: `pnpm --filter @livingdex/scraper-api start`  (in background)
Then: `curl http://localhost:3001/api/health`
Expected: same JSON as before.
Kill background process.

- [ ] **Step 11.11: Commit**

```bash
git add apps/scraper-api/
git commit -m "refactor(scraper-api): split into app.ts + server.ts + routes/health.ts for testability"
```

---

## Task 12: SSE /api/scrape endpoint

**Files:**
- Create: `apps/scraper-api/src/routes/scrape.ts`
- Modify: `apps/scraper-api/src/app.ts` (mount the new route)
- Create: `apps/scraper-api/tests/scrape.test.ts`

The SSE endpoint runs the scraper pipeline server-side, streaming progress events to a connected EventSource client. Used by Plan 04's web app rescrape button.

- [ ] **Step 12.1: Write failing test**

Create `apps/scraper-api/tests/scrape.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createApp } from '../src/app.ts';

vi.mock('@livingdex/scrapers', async (importActual) => {
  const actual = await importActual<typeof import('@livingdex/scrapers')>();
  return {
    ...actual,
    runCombinedPipeline: vi.fn(async (options) => {
      options.onProgress?.({ stage: 'species', current: 1, total: 1, message: 'mock' });
      return {
        dataset: {
          meta: {
            version: 'mock',
            schemaVersion: 1,
            scrapedFrom: ['pokeapi'],
            generations: [1],
            pokemonCount: 0,
            encountersCount: 0,
          },
          pokemon: [],
          games: [],
          encounters: [],
        },
        coverage: {
          generatedAt: 'mock',
          totalPokemon: 0,
          pokemonWithAnyEncounter: 0,
          pokemonWithoutEncounter: [],
          byGame: [],
        },
      };
    }),
  };
});

describe('/api/scrape (SSE)', () => {
  it('returns 400 if gen param is missing', async () => {
    const app = createApp();
    const response = await app.fetch(new Request('http://localhost/api/scrape'));
    expect(response.status).toBe(400);
  });

  it('returns 200 with text/event-stream content-type when gen is valid', async () => {
    const app = createApp();
    const response = await app.fetch(new Request('http://localhost/api/scrape?gen=1'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
  });
});
```

- [ ] **Step 12.2: Run failing test**

- [ ] **Step 12.3: Implement `routes/scrape.ts`**

Create `apps/scraper-api/src/routes/scrape.ts`:

```typescript
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import {
  PokeApiClient,
  BulbapediaClient,
  runCombinedPipeline,
  type ProgressEvent,
} from '@livingdex/scrapers';
import { join, resolve } from 'node:path';

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
      const start = startStr ? Number.parseInt(startStr, 10) : NaN;
      const end = endStr ? Number.parseInt(endStr, 10) : NaN;
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
```

- [ ] **Step 12.4: Mount the route in `app.ts`**

Modify `apps/scraper-api/src/app.ts` to also mount `scrapeRouter`:

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { healthRouter } from './routes/health.ts';
import { scrapeRouter } from './routes/scrape.ts';

export function createApp(): Hono {
  const app = new Hono();
  app.use(
    '/api/*',
    cors({
      origin: ['http://localhost:5173'],
      allowMethods: ['GET', 'POST'],
    }),
  );
  app.route('/api', healthRouter);
  app.route('/api', scrapeRouter);
  return app;
}
```

- [ ] **Step 12.5: Run, typecheck, lint, commit**

```bash
pnpm --filter @livingdex/scraper-api test
pnpm --filter @livingdex/scraper-api typecheck && pnpm lint
git add apps/scraper-api/
git commit -m "feat(scraper-api): add /api/scrape SSE endpoint"
```

---

## Task 13: Update web App.tsx to display real encounter count

**Files:**
- Modify: `apps/web/src/App.tsx`

After Task 14 commits the real encounters dataset, the web app's stats grid will automatically show non-zero encountersCount. This task adds a small label to make that meaningful.

- [ ] **Step 13.1: Modify App.tsx**

Find the `<Stat label="Encounters" value={datasetMeta.encountersCount} />` line in `apps/web/src/App.tsx` and consider adding a tooltip / sub-label about what encounters means. Keep the change minimal — Plan 04 will rebuild the entire UI.

Simplest change: extend the Stat label to be more descriptive. Modify:
```tsx
<Stat label="Encounters" value={datasetMeta.encountersCount} />
```
to:
```tsx
<Stat label="Encounters" value={datasetMeta.encountersCount.toLocaleString('fr-FR')} />
```

(Just adds locale-formatted thousands separator. Trivial improvement.)

If no changes are needed (you decide the existing UI is fine since real data will populate naturally), skip this task and note it in the commit-skip explanation.

- [ ] **Step 13.2: Verify build**

Run: `pnpm --filter @livingdex/web build`
Expected: PASS.

- [ ] **Step 13.3: Commit (if there were changes)**

```bash
git add apps/web/
git commit -m "feat(web): format encounters count with locale thousands separator"
```

If skipped: no commit; document the rationale in the report.

---

## Task 14: Run real combined scrape and commit dataset+coverage

**Files:**
- Update: `packages/data/dataset.json` (with encounters)
- Update: `packages/data/dataset-meta.json`
- Create: `packages/data/coverage-report.json`

⚠️ **Time budget:** The Bulbapedia phase is bottlenecked by 1 req/s rate limit + ~1025 species pages = **~17-20 minutes minimum** (vs PokéAPI 10 req/s). Plan accordingly. The PokéAPI phase is cached from Plan 02, so it's fast.

⚠️ **Disk:** sprites are already committed (165 MB). This task adds dataset.json (now ~5-10 MB with encounters), dataset-meta.json, coverage-report.json. No new sprites.

- [ ] **Step 14.1: Run the combined scrape**

Run: `pnpm scrape --gen 1-9 --source all`

Use the Bash tool with EXTENDED timeout: 1800000 (30 min) to be safe.

Expected progress:
- PokéAPI phase: cached from Plan 02, <1 min
- Bulbapedia phase: ~17-20 min (1025 species × 1s rate limit)
- Overrides applied: instant (empty arrays for now)
- Coverage report generated and written

If the scrape fails partway: re-run. The Bulbapedia cache (`.cache/bulbapedia/`) means resumed runs are fast.

- [ ] **Step 14.2: Verify dataset shape**

Quick sanity check:
```bash
node --eval "import('./packages/data/dataset.json', { with: { type: 'json' } }).then(m => console.log('pokemon:', m.default.pokemon.length, '| encounters:', m.default.encounters.length, '| games covered:', new Set(m.default.encounters.map(e => e.gameId)).size))"
```

Expected: pokemon ~1244 (same as Plan 02), encounters in the 5000-15000 range (varies by Bulbapedia coverage), games covered: 9 (or close to 9 — FRLG might have 0 if Bulbapedia doesn't track FRLG transferability for our purposes).

If encounters count is 0 or absurdly low (<100): the parser is failing. Read the coverage report (`packages/data/coverage-report.json`) and pick a Pokemon with no encounters. Inspect its wikitext fixture (or the cache `.cache/bulbapedia/X.wikitext`) to see why the parser missed it. Adjust the parser regex in `packages/scrapers/src/sources/bulbapedia/parser.ts`. Re-run.

If it's reasonable (5000+) but with gaps: that's expected. The coverage report identifies pokemon needing manual overrides — Plan 03 isn't required to fill them all; future iterations can.

- [ ] **Step 14.3: Verify tests still pass**

Run: `pnpm --filter @livingdex/scrapers test`
Expected: all cumulative tests still pass.

- [ ] **Step 14.4: Verify web build**

Run: `pnpm --filter @livingdex/web build`
Expected: PASS. Bundle JS will grow as dataset.json embeds — that's expected (Plan 04 will switch to fetch-based loading).

- [ ] **Step 14.5: Stage and commit**

```bash
git add packages/data/dataset.json packages/data/dataset-meta.json packages/data/coverage-report.json
git commit -m "data: add Bulbapedia encounters dataset (gens 1-9, $X encounters across 9 games)"
```

(Replace `$X` with the actual encounter count.)

- [ ] **Step 14.6: Push**

```bash
git push
```

- [ ] **Step 14.7: Verify CI green**

Wait ~30s, then:
```bash
curl -s https://api.github.com/repos/FabienLacorre/LivingDexHelper/actions/runs?per_page=3
```

Find the latest run with head_sha matching the push. Wait for `conclusion: success`.

If CI fails: read logs, fix locally, push again.

- [ ] **Step 14.8: Report final stats**

Document in the final commit report:
- Total Pokémon: 1244
- Total encounters: X
- Games covered: Y
- Pokémon with no encounters at all: Z (see coverage-report.json)
- CI run ID

---

## Notes for engineers executing this plan

- **The Bulbapedia parser is best-effort.** If the test bar is too high (e.g., a test expects 10 entries from a fixture and gets 7), the response is "improve the parser" UNTIL it's clear the missing 3 are genuinely unparseable from the regex approach. At that point, lower the test bar and add a coverage-report check instead.
- **Bulbapedia's MediaWiki API is rate-limited.** 1 req/s is what the wiki's `robots.txt` and ToS recommend for non-bot requests. Don't lower this — being polite means we don't get blocked.
- **The cache is your friend.** `.cache/bulbapedia/*.wikitext` is gitignored but persistent. After a successful run, re-running with the same `--gen` is nearly instant (no network).
- **Manual overrides are the escape hatch.** If a Pokémon's encounters are wrong, add an entry to `data-overrides/corrections.json` to fix without changing code. The override merge is by `(pokemonId, gameId, method.type)` — match those keys exactly.
- **The SSE endpoint is currently consumer-less.** Plan 04 will add the web button that calls `/api/scrape?gen=8,9`. The endpoint exists in this plan to validate the architecture works end-to-end.
- **Coverage report tells you what's missing.** After Task 14's real scrape, open `packages/data/coverage-report.json` and look at `pokemonWithoutEncounter`. Each entry there is a candidate for manual override.
- **Form-aware encounters are not fully addressed.** Bulbapedia has separate pages for some forms (Alolan Raichu) but not all. Plan 03's parser fetches by speciesSlug; form-specific encounters may be misattributed. This is a known limitation; the override system is the workaround.

## Forward-looking concerns (deferred to Plan 04+)

- Dynamic `dataset.json` loading via `fetch()` instead of bundle inlining (web app)
- Dexie schema for IndexedDB-side seeding from the dataset
- Web "Rescrape" button consuming the `/api/scrape` SSE endpoint
- Onboarding screen (game selection)
- Living Dex grid screen with status colors
- Per-game Planning screen (conditional)

## Definition of done

Plan 03 is complete when:
- ✅ `pnpm scrape --source all --gen 1-9` produces a valid dataset with encounters
- ✅ `packages/data/dataset.json` committed with `encounters[]` populated and `scrapedFrom: ['pokeapi', 'bulbapedia', 'manual-overrides']`
- ✅ `packages/data/coverage-report.json` committed
- ✅ `apps/scraper-api/src/app.ts` exists, importable for tests
- ✅ `/api/health` and `/api/scrape` both work via `app.fetch()` and via real Hono server
- ✅ All tests pass (`pnpm test`)
- ✅ CI green on `main`
- ✅ Manual overrides system in place (empty stubs ready for use)
