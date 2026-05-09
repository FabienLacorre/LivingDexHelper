# Plan 01 — Foundation (Monorepo + Types + Skeleton apps)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the pnpm monorepo with shared TS types, an empty dataset stub, a React+Vite hello-world web app, and a Hono dev API. After this plan, `pnpm install && pnpm dev` should boot both apps locally, CI should pass on PRs, and types should be ready to be consumed by Plan 02 (Scrapers).

**Architecture:** pnpm workspace at the root with `apps/*` (web, scraper-api) and `packages/*` (types, data, scrapers). All packages reference each other via `workspace:*`. Shared TS config in `tsconfig.base.json`, shared lint/format in `biome.json`. No business logic yet — just structure, types, and verifiable scaffolding.

**Tech Stack:** pnpm 9, TypeScript 5.6, Biome 1.9, Vite 5, React 18, Hono 4, Vitest 2, tsx 4.

**Spec reference:** `docs/superpowers/specs/2026-05-09-pokemon-livingdex-design.md` (sections 5, 8, 9).

---

## File Structure (created by this plan)

```
pokemon-livingdex/                      (root)
├── pnpm-workspace.yaml                 ← workspace declaration
├── package.json                        ← root scripts (dev, build, test, lint, typecheck, scrape)
├── tsconfig.base.json                  ← shared TS strict config
├── biome.json                          ← lint + format
├── README.md                           ← minimal stack + setup
├── .github/workflows/ci.yml            ← typecheck + lint + test + build on PR/push
├── apps/
│   ├── web/
│   │   ├── package.json                ← @livingdex/web
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   ├── postcss.config.js
│   │   ├── tailwind.config.ts
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       └── index.css
│   └── scraper-api/
│       ├── package.json                ← @livingdex/scraper-api
│       ├── tsconfig.json
│       └── src/index.ts                ← Hono /api/health
├── packages/
│   ├── types/
│   │   ├── package.json                ← @livingdex/types
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts                ← barrel
│   │       ├── pokemon.ts              ← Pokemon, EvolutionLink, sprites, types
│   │       ├── game.ts                 ← Game, Dlc, GameId
│   │       ├── encounter.ts            ← Encounter, EncounterMethod
│   │       ├── user.ts                 ← OwnedGame, CollectionEntry, UserSettings, DEFAULT_USER_SETTINGS
│   │       └── dataset.ts              ← DatasetMeta, Dataset, SchemaVersion
│   ├── data/
│   │   ├── package.json                ← @livingdex/data
│   │   ├── tsconfig.json
│   │   ├── dataset.json                ← stub: empty arrays
│   │   ├── dataset-meta.json           ← stub: schemaVersion 1, counts 0
│   │   └── src/index.ts                ← typed re-exports
│   └── scrapers/
│       ├── package.json                ← @livingdex/scrapers
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts                ← exports SCRAPER_VERSION
│           └── cli.ts                  ← stub CLI entrypoint
└── data-overrides/
    └── README.md                       ← marker explaining the folder's purpose
```

**Files NOT created in this plan (reserved for Plan 02+):**
- `packages/scrapers/src/sources/*` (PokéAPI, Bulbapedia clients) — Plan 02
- `packages/scrapers/src/normalizers/*` — Plan 02
- `apps/scraper-api/src/routes/scrape.ts` (SSE endpoint) — Plan 02
- `apps/web/src/db/*` (Dexie schema) — Plan 03
- `apps/web/src/features/*` (screens) — Plan 03
- `data-overrides/*.json` (actual overrides) — Plan 02

---

## Task 1: Initialize pnpm workspace + root config

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json` (root)
- Create: `tsconfig.base.json`
- Create: `biome.json`

- [ ] **Step 1.1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 1.2: Create root `package.json`**

```json
{
  "name": "livingdex-helper",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22",
    "pnpm": ">=9"
  },
  "scripts": {
    "dev": "concurrently -n web,api -c blue,magenta \"pnpm --filter @livingdex/web dev\" \"pnpm --filter @livingdex/scraper-api dev\"",
    "build": "pnpm -r --filter \"!@livingdex/scraper-api\" build",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "scrape": "pnpm --filter @livingdex/scrapers cli"
  },
  "devDependencies": {
    "@biomejs/biome": "1.9.4",
    "concurrently": "9.0.1",
    "typescript": "5.6.3"
  },
  "packageManager": "pnpm@9.12.3"
}
```

- [ ] **Step 1.3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "forceConsistentCasingInFileNames": true,
    "allowImportingTsExtensions": true
  }
}
```

- [ ] **Step 1.4: Create `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignoreUnknown": false,
    "ignore": [
      "dist",
      "node_modules",
      ".cache",
      ".pnpm-store",
      "packages/data/sprites",
      "packages/data/dataset.json",
      "packages/data/dataset-meta.json"
    ]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": {
        "noNonNullAssertion": "off",
        "useImportType": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      },
      "correctness": {
        "noUnusedImports": "error"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "always",
      "trailingCommas": "all",
      "arrowParentheses": "always",
      "jsxQuoteStyle": "double"
    }
  }
}
```

- [ ] **Step 1.5: Run `pnpm install`**

Run: `pnpm install`
Expected: pnpm installs `@biomejs/biome`, `concurrently`, `typescript` at root. No workspace packages yet — output mentions `0 workspaces found` warning is acceptable at this point (we add them in next tasks).

- [ ] **Step 1.6: Verify Biome runs**

Run: `pnpm lint`
Expected: `Checked 0 files in <Xms>. No fixes applied.` or similar. Should NOT error. Biome detects no source files yet, that's fine.

- [ ] **Step 1.7: Commit**

```bash
git add pnpm-workspace.yaml package.json tsconfig.base.json biome.json pnpm-lock.yaml
git commit -m "feat(setup): initialize pnpm monorepo with biome and tsconfig"
```

---

## Task 2: `packages/types` — shared TypeScript types

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/src/pokemon.ts`
- Create: `packages/types/src/game.ts`
- Create: `packages/types/src/encounter.ts`
- Create: `packages/types/src/user.ts`
- Create: `packages/types/src/dataset.ts`
- Create: `packages/types/src/index.ts`

- [ ] **Step 2.1: Create `packages/types/package.json`**

```json
{
  "name": "@livingdex/types",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "echo \"no tests for types yet\" && exit 0"
  },
  "devDependencies": {
    "typescript": "5.6.3"
  }
}
```

- [ ] **Step 2.2: Create `packages/types/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "noEmit": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 2.3: Create `packages/types/src/pokemon.ts`**

```typescript
export type PokemonType =
  | 'normal'
  | 'fire'
  | 'water'
  | 'grass'
  | 'electric'
  | 'ice'
  | 'fighting'
  | 'poison'
  | 'ground'
  | 'flying'
  | 'psychic'
  | 'bug'
  | 'rock'
  | 'ghost'
  | 'dragon'
  | 'dark'
  | 'steel'
  | 'fairy';

export type FormCategory =
  | 'default'
  | 'regional'
  | 'gigamax'
  | 'alt'
  | 'gender'
  | 'cosmetic';

export type LocalizedNames = {
  en: string;
  fr: string;
};

export type PokemonSprites = {
  default: string;
  shiny: string;
  artwork: string;
  icon: string;
};

export type EvolutionMethod =
  | 'level'
  | 'item'
  | 'trade'
  | 'friendship'
  | 'location'
  | 'move'
  | 'other';

export type EvolutionConditionType =
  | 'minLevel'
  | 'item'
  | 'tradeWith'
  | 'tradeItem'
  | 'friendship'
  | 'location'
  | 'timeOfDay'
  | 'move'
  | 'special';

export type EvolutionCondition = {
  type: EvolutionConditionType;
  value: string | number;
};

export type EvolutionLink = {
  fromId: string;
  toId: string;
  method: EvolutionMethod;
  conditions: EvolutionCondition[];
  soloAlternative?: 'linking-cord' | 'item' | null;
};

export type Pokemon = {
  id: string;
  nationalDexNumber: number;
  speciesSlug: string;
  formId: string | null;
  formCategory: FormCategory;
  names: LocalizedNames;
  types: PokemonType[];
  generation: number;
  sprites: PokemonSprites;
  evolutions: EvolutionLink[];
};
```

- [ ] **Step 2.4: Create `packages/types/src/game.ts`**

```typescript
import type { LocalizedNames } from './pokemon.ts';

export type GameId =
  | 'sword'
  | 'shield'
  | 'bdsp-d'
  | 'bdsp-p'
  | 'pla'
  | 'scarlet'
  | 'violet'
  | 'frlg-fr'
  | 'frlg-lg';

export type Dlc = {
  id: string;
  names: LocalizedNames;
  releaseDate: string;
};

export type HomeTransfer = 'direct' | 'unsupported';

export type Game = {
  id: GameId;
  names: LocalizedNames;
  generation: number;
  platform: 'switch';
  releaseDate: string;
  dlcs: Dlc[];
  pairedVersionId?: GameId;
  supportsLinkingCord: boolean;
  homeTransfer: HomeTransfer;
};
```

- [ ] **Step 2.5: Create `packages/types/src/encounter.ts`**

```typescript
import type { GameId } from './game.ts';

export type EncounterRarity = 'common' | 'uncommon' | 'rare' | 'very-rare';

export type EncounterMethod =
  | { type: 'wild'; locations: string[]; rarity?: EncounterRarity }
  | { type: 'evolution'; fromId: string }
  | { type: 'breeding' }
  | { type: 'gift'; from: string }
  | { type: 'fossil'; fossilItem: string }
  | { type: 'in-game-trade'; npc?: string }
  | { type: 'event'; distributedAs: string };

export type Encounter = {
  pokemonId: string;
  gameId: GameId;
  dlcRequired?: string;
  method: EncounterMethod;
  notes?: string;
};
```

- [ ] **Step 2.6: Create `packages/types/src/user.ts`**

```typescript
import type { GameId } from './game.ts';

export type OwnedGame = {
  gameId: GameId;
  ownedDlcs: string[];
};

export type HomeStatus = 'missing' | 'caught' | 'transferred';

export type PerGameStatus = 'untouched' | 'planned' | 'caught';

export type CollectionEntry = {
  pokemonId: string;
  homeStatus: HomeStatus;
  perGameStatus?: Partial<Record<GameId, PerGameStatus>>;
  note?: string;
  updatedAt: string;
};

export type Theme = 'light' | 'dark' | 'system';

export type SpriteStyle = '2d' | 'artwork' | 'icon';

export type Language = 'fr' | 'en';

export type GranularitySettings = {
  includeRegionalForms: boolean;
  includeGigamax: boolean;
  includeAltForms: boolean;
  includeGenderDifferences: boolean;
  includeShiny: boolean;
};

export type FeatureSettings = {
  enablePerGameTracking: boolean;
};

export type UiSettings = {
  theme: Theme;
  primarySpriteStyle: SpriteStyle;
};

export type UserSettings = {
  language: Language;
  soloMode: boolean;
  granularity: GranularitySettings;
  features: FeatureSettings;
  ui: UiSettings;
};

export const DEFAULT_USER_SETTINGS: UserSettings = {
  language: 'fr',
  soloMode: false,
  granularity: {
    includeRegionalForms: true,
    includeGigamax: true,
    includeAltForms: true,
    includeGenderDifferences: false,
    includeShiny: false,
  },
  features: {
    enablePerGameTracking: false,
  },
  ui: {
    theme: 'system',
    primarySpriteStyle: '2d',
  },
};
```

- [ ] **Step 2.7: Create `packages/types/src/dataset.ts`**

```typescript
import type { Encounter } from './encounter.ts';
import type { Game } from './game.ts';
import type { Pokemon } from './pokemon.ts';

export type SchemaVersion = 1;

export const CURRENT_SCHEMA_VERSION: SchemaVersion = 1;

export type DatasetSource = 'pokeapi' | 'bulbapedia' | 'manual-overrides';

export type DatasetMeta = {
  version: string;
  schemaVersion: SchemaVersion;
  scrapedFrom: DatasetSource[];
  generations: number[];
  pokemonCount: number;
  encountersCount: number;
};

export type Dataset = {
  meta: DatasetMeta;
  pokemon: Pokemon[];
  games: Game[];
  encounters: Encounter[];
};
```

- [ ] **Step 2.8: Create `packages/types/src/index.ts`**

```typescript
export type * from './dataset.ts';
export type * from './encounter.ts';
export type * from './game.ts';
export type * from './pokemon.ts';
export type * from './user.ts';
export { CURRENT_SCHEMA_VERSION } from './dataset.ts';
export { DEFAULT_USER_SETTINGS } from './user.ts';
```

- [ ] **Step 2.9: Run `pnpm install` to register the workspace package**

Run: `pnpm install`
Expected: `@livingdex/types` is now recognized as a workspace package. Output should show `+ 1 workspaces` or similar.

- [ ] **Step 2.10: Run typecheck**

Run: `pnpm --filter @livingdex/types typecheck`
Expected: PASS with no output (or `Done in <Xms>`).

- [ ] **Step 2.11: Run lint**

Run: `pnpm lint`
Expected: PASS, all files clean.

- [ ] **Step 2.12: Commit**

```bash
git add packages/types/ pnpm-lock.yaml
git commit -m "feat(types): add shared TypeScript types for catalog and user data"
```

---

## Task 3: `packages/data` — dataset stubs

**Files:**
- Create: `packages/data/package.json`
- Create: `packages/data/tsconfig.json`
- Create: `packages/data/dataset.json`
- Create: `packages/data/dataset-meta.json`
- Create: `packages/data/src/index.ts`

- [ ] **Step 3.1: Create `packages/data/package.json`**

```json
{
  "name": "@livingdex/data",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./dataset.json": "./dataset.json",
    "./dataset-meta.json": "./dataset-meta.json"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "echo \"no tests for data yet\" && exit 0"
  },
  "dependencies": {
    "@livingdex/types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "5.6.3"
  }
}
```

- [ ] **Step 3.2: Create `packages/data/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "noEmit": true
  },
  "include": ["src/**/*", "dataset.json", "dataset-meta.json"]
}
```

- [ ] **Step 3.3: Create `packages/data/dataset-meta.json`**

```json
{
  "version": "1970-01-01T00:00:00.000Z",
  "schemaVersion": 1,
  "scrapedFrom": [],
  "generations": [],
  "pokemonCount": 0,
  "encountersCount": 0
}
```

- [ ] **Step 3.4: Create `packages/data/dataset.json`**

```json
{
  "meta": {
    "version": "1970-01-01T00:00:00.000Z",
    "schemaVersion": 1,
    "scrapedFrom": [],
    "generations": [],
    "pokemonCount": 0,
    "encountersCount": 0
  },
  "pokemon": [],
  "games": [],
  "encounters": []
}
```

- [ ] **Step 3.5: Create `packages/data/src/index.ts`**

```typescript
import type { Dataset, DatasetMeta } from '@livingdex/types';
import datasetJson from '../dataset.json';
import datasetMetaJson from '../dataset-meta.json';

export const dataset: Dataset = datasetJson as Dataset;
export const datasetMeta: DatasetMeta = datasetMetaJson as DatasetMeta;
```

- [ ] **Step 3.6: Run `pnpm install`**

Run: `pnpm install`
Expected: `@livingdex/data` registered, links to `@livingdex/types` via workspace protocol.

- [ ] **Step 3.7: Run typecheck**

Run: `pnpm --filter @livingdex/data typecheck`
Expected: PASS.

- [ ] **Step 3.8: Commit**

```bash
git add packages/data/ pnpm-lock.yaml
git commit -m "feat(data): add empty dataset stubs typed against @livingdex/types"
```

---

## Task 4: `packages/scrapers` — skeleton

**Files:**
- Create: `packages/scrapers/package.json`
- Create: `packages/scrapers/tsconfig.json`
- Create: `packages/scrapers/src/index.ts`
- Create: `packages/scrapers/src/cli.ts`

- [ ] **Step 4.1: Create `packages/scrapers/package.json`**

```json
{
  "name": "@livingdex/scrapers",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "cli": "tsx src/cli.ts"
  },
  "dependencies": {
    "@livingdex/data": "workspace:*",
    "@livingdex/types": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "22.7.5",
    "tsx": "4.19.1",
    "typescript": "5.6.3",
    "vitest": "2.1.2"
  }
}
```

- [ ] **Step 4.2: Create `packages/scrapers/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4.3: Create `packages/scrapers/src/index.ts`**

```typescript
export const SCRAPER_VERSION = '0.1.0';
```

- [ ] **Step 4.4: Create `packages/scrapers/src/cli.ts`**

```typescript
#!/usr/bin/env node
import { SCRAPER_VERSION } from './index.ts';

console.log(`@livingdex/scrapers CLI v${SCRAPER_VERSION}`);
console.log('Pipeline not yet implemented. See plan 02 (scrapers) for implementation.');
process.exit(0);
```

- [ ] **Step 4.5: Run `pnpm install`**

Run: `pnpm install`
Expected: `@livingdex/scrapers` registered with deps installed (`@types/node`, `tsx`, `vitest`).

- [ ] **Step 4.6: Run typecheck**

Run: `pnpm --filter @livingdex/scrapers typecheck`
Expected: PASS.

- [ ] **Step 4.7: Run the stub CLI**

Run: `pnpm scrape`
Expected output (literal):
```
@livingdex/scrapers CLI v0.1.0
Pipeline not yet implemented. See plan 02 (scrapers) for implementation.
```

- [ ] **Step 4.8: Commit**

```bash
git add packages/scrapers/ pnpm-lock.yaml
git commit -m "feat(scrapers): add skeleton package with CLI stub"
```

---

## Task 5: `apps/web` — Vite + React + Tailwind hello-world

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/index.css`

- [ ] **Step 5.1: Create `apps/web/package.json`**

```json
{
  "name": "@livingdex/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@livingdex/data": "workspace:*",
    "@livingdex/types": "workspace:*",
    "react": "18.3.1",
    "react-dom": "18.3.1"
  },
  "devDependencies": {
    "@types/react": "18.3.11",
    "@types/react-dom": "18.3.0",
    "@vitejs/plugin-react": "4.3.2",
    "autoprefixer": "10.4.20",
    "postcss": "8.4.47",
    "tailwindcss": "3.4.13",
    "typescript": "5.6.3",
    "vite": "5.4.8",
    "vitest": "2.1.2"
  }
}
```

- [ ] **Step 5.2: Create `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vite/client"]
  },
  "include": ["src/**/*", "vite.config.ts", "tailwind.config.ts", "postcss.config.js"]
}
```

- [ ] **Step 5.3: Create `apps/web/vite.config.ts`**

```typescript
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
});
```

- [ ] **Step 5.4: Create `apps/web/index.html`**

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Living Dex Helper</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5.5: Create `apps/web/postcss.config.js`**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5.6: Create `apps/web/tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 5.7: Create `apps/web/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5.8: Create `apps/web/src/main.tsx`**

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 5.9: Create `apps/web/src/App.tsx`**

```typescript
import { datasetMeta } from '@livingdex/data';

export function App() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold">Living Dex Helper</h1>
        <p className="mt-4 text-slate-600 dark:text-slate-400">
          Bootstrap OK. Dataset version: <code>{datasetMeta.version}</code>
        </p>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          {datasetMeta.pokemonCount} Pokémon · {datasetMeta.encountersCount} encounters
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 5.10: Run `pnpm install`**

Run: `pnpm install`
Expected: All web deps installed.

- [ ] **Step 5.11: Run typecheck**

Run: `pnpm --filter @livingdex/web typecheck`
Expected: PASS.

- [ ] **Step 5.12: Run build to verify**

Run: `pnpm --filter @livingdex/web build`
Expected: Vite produces `apps/web/dist/` with `index.html`, `assets/*.js`, `assets/*.css`. No errors.

- [ ] **Step 5.13: Commit**

```bash
git add apps/web/ pnpm-lock.yaml
git commit -m "feat(web): add Vite+React+Tailwind hello-world consuming @livingdex/data"
```

---

## Task 6: `apps/scraper-api` — Hono /api/health

**Files:**
- Create: `apps/scraper-api/package.json`
- Create: `apps/scraper-api/tsconfig.json`
- Create: `apps/scraper-api/src/index.ts`

- [ ] **Step 6.1: Create `apps/scraper-api/package.json`**

```json
{
  "name": "@livingdex/scraper-api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@hono/node-server": "1.13.2",
    "@livingdex/scrapers": "workspace:*",
    "@livingdex/types": "workspace:*",
    "hono": "4.6.5"
  },
  "devDependencies": {
    "@types/node": "22.7.5",
    "tsx": "4.19.1",
    "typescript": "5.6.3",
    "vitest": "2.1.2"
  }
}
```

- [ ] **Step 6.2: Create `apps/scraper-api/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 6.3: Create `apps/scraper-api/src/index.ts`**

```typescript
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { SCRAPER_VERSION } from '@livingdex/scrapers';

const app = new Hono();

app.use(
  '/api/*',
  cors({
    origin: ['http://localhost:5173'],
    allowMethods: ['GET', 'POST'],
  }),
);

app.get('/api/health', (c) =>
  c.json({
    ok: true,
    service: 'livingdex-scraper-api',
    scraperVersion: SCRAPER_VERSION,
    timestamp: new Date().toISOString(),
  }),
);

const port = Number.parseInt(process.env.PORT ?? '3001', 10);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`scraper-api listening on http://localhost:${info.port}`);
});
```

- [ ] **Step 6.4: Run `pnpm install`**

Run: `pnpm install`
Expected: All scraper-api deps installed (`hono`, `@hono/node-server`).

- [ ] **Step 6.5: Run typecheck**

Run: `pnpm --filter @livingdex/scraper-api typecheck`
Expected: PASS.

- [ ] **Step 6.6: Smoke-test the server**

Run in one terminal: `pnpm --filter @livingdex/scraper-api start`
Expected: Console prints `scraper-api listening on http://localhost:3001`.

In another terminal: `curl http://localhost:3001/api/health`
Expected JSON response (formatting may vary):
```json
{"ok":true,"service":"livingdex-scraper-api","scraperVersion":"0.1.0","timestamp":"..."}
```

Stop the server (Ctrl-C in the first terminal).

- [ ] **Step 6.7: Commit**

```bash
git add apps/scraper-api/ pnpm-lock.yaml
git commit -m "feat(scraper-api): add Hono server with /api/health endpoint"
```

---

## Task 7: Verify `pnpm dev` orchestrates both apps

This task has no new files — it verifies the orchestration script in root `package.json` works end-to-end.

- [ ] **Step 7.1: Run `pnpm dev`**

Run: `pnpm dev`
Expected: `concurrently` spawns two labelled processes:
- `[web]` — Vite dev server on http://localhost:5173
- `[api]` — Hono server on http://localhost:3001

Both apps should be reachable. The web hello-world should render in the browser. `curl http://localhost:3001/api/health` should return the health JSON.

Stop both with Ctrl-C.

- [ ] **Step 7.2: No commit (verification only)**

If the orchestration didn't work, fix the issue (likely a typo in the root `dev` script) and commit a fix.

---

## Task 8: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 8.1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm typecheck

      - name: Test
        run: pnpm test

      - name: Build
        run: pnpm build
```

- [ ] **Step 8.2: Commit and push**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow (lint + typecheck + test + build)"
git push
```

- [ ] **Step 8.3: Verify CI passes on the remote**

Open https://github.com/FabienLacorre/LivingDexHelper/actions in a browser. The "CI" workflow should appear, triggered by the push, and complete with a green checkmark within ~2 minutes.

If it fails:
- Read the failing step's logs
- Fix the issue locally
- Commit and push again
- Repeat until green

---

## Task 9: README + data-overrides folder marker

**Files:**
- Create: `README.md`
- Create: `data-overrides/README.md`

- [ ] **Step 9.1: Create `README.md`**

````markdown
# Living Dex Helper

Outil offline-first pour planifier la complétion d'un Living Dex global dans **Pokémon HOME** à partir de tes jeux Switch.

## Stack

- **pnpm** monorepo (workspaces)
- **React + Vite + TypeScript** — frontend, déployable statique
- **Hono** — serveur dev pour le scraping en local (jamais déployé en prod)
- **Dexie** (IndexedDB) — storage utilisateur côté navigateur
- **Tailwind CSS + shadcn/ui** — UI
- **Zustand** — state management
- **Biome** — lint et format
- **Vitest** — tests

## Structure

```
apps/
  web/             frontend React (déployable statique)
  scraper-api/     serveur Hono pour rescraper en mode dev (local uniquement)
packages/
  types/           types TypeScript partagés
  data/            dataset Pokémon committé en Git + sprites
  scrapers/        pipeline build-time PokéAPI + Bulbapedia + overrides
data-overrides/    corrections manuelles JSON
docs/              specs et plans (voir docs/superpowers/)
```

## Setup

Pré-requis : Node 22+, pnpm 9+.

```bash
pnpm install        # installe le monorepo
pnpm dev            # web sur :5173 + scraper-api sur :3001
pnpm build          # build statique de apps/web (sortie : apps/web/dist/)
pnpm scrape         # rescrape le dataset depuis PokéAPI + Bulbapedia
pnpm test           # tous les tests
pnpm typecheck
pnpm lint
pnpm lint:fix       # auto-fix
```

## Documentation

- Design : [docs/superpowers/specs/2026-05-09-pokemon-livingdex-design.md](docs/superpowers/specs/2026-05-09-pokemon-livingdex-design.md)
- Plans d'implémentation : [docs/superpowers/plans/](docs/superpowers/plans/)

## Statut

🚧 En construction — Plan 01 (Foundation) en cours/terminé. Voir les plans suivants pour la roadmap.
````

- [ ] **Step 9.2: Create `data-overrides/README.md`**

```markdown
# data-overrides/

Manual corrections layered on top of automated scraper output.

Files in this folder are merged **after** PokéAPI and Bulbapedia data during the build pipeline.
Each file is a JSON array of override entries that **add or replace** auto-detected entries.

Files (created in Plan 02):

- `events.json` — event-distributed Pokémon (Mew, Celebi, Magearna, etc.)
- `version-exclusives.json` — confirmed version-exclusive overrides
- `corrections.json` — fixes for Bulbapedia parsing errors
- `frlg-transfer.json` — final decision on FRLG → HOME transferability

This folder exists in Plan 01 as a placeholder. Actual override files are introduced in Plan 02.
```

- [ ] **Step 9.3: Commit**

```bash
git add README.md data-overrides/
git commit -m "docs: add README and data-overrides folder marker"
```

---

## Task 10: Final verification + push

- [ ] **Step 10.1: Run the full root pipeline locally**

Run sequentially:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all four pass with no errors. `pnpm build` produces `apps/web/dist/` with the static bundle.

- [ ] **Step 10.2: Smoke test `pnpm dev` one more time**

Run: `pnpm dev`
Verify:
- http://localhost:5173 shows "Living Dex Helper · Bootstrap OK · Dataset version: 1970-01-01..."
- `curl http://localhost:3001/api/health` returns ok JSON

Stop with Ctrl-C.

- [ ] **Step 10.3: Push to GitHub and confirm CI green**

Run: `git push`
Open https://github.com/FabienLacorre/LivingDexHelper/actions and confirm the latest CI run is green.

- [ ] **Step 10.4: Mark Plan 01 as done**

The plan is complete when:
- ✅ `pnpm install && pnpm dev` boots both apps locally
- ✅ `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass
- ✅ CI is green on `main`
- ✅ All types from spec section 5 are defined in `@livingdex/types`
- ✅ Web app reads `datasetMeta` from `@livingdex/data` and renders without errors
- ✅ Scraper-api `/api/health` returns the scraper version

We're now ready for **Plan 02 — Scrapers + Dataset**.

---

## Notes for engineers executing this plan

- **Versions are pinned exact** in `package.json` (no `^` for direct deps). This avoids surprise breakage during a multi-week implementation. We'll bump intentionally later.
- **`allowImportingTsExtensions: true`** in tsconfig — enables the `.ts` extensions in imports (e.g. `from './pokemon.ts'`). This is required for `verbatimModuleSyntax` ESM correctness and works with both Vite (transpiles them) and tsx.
- **No tests yet** — `packages/types` and `packages/data` have placeholder `test` scripts that exit 0. Real tests come in Plan 02 for `packages/scrapers` (parser/normalizer tests) and Plan 03 for `apps/web` (computeStatus tests).
- **Sprites NOT committed yet** — `packages/data/sprites/` doesn't exist in this plan. Plan 02 will create it during the first scrape. Biome already ignores the path.
- **No `concurrently` cleanup script** — if `pnpm dev` leaves a process hung, kill manually (`taskkill /F /IM node.exe` on Windows).
- **Strict TS settings** (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) will catch real bugs but may need workarounds in subsequent plans. We accept this cost for the safety.
