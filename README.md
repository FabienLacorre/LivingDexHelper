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

🚧 En construction — Plan 01 (Foundation) terminé. Voir les plans suivants pour la roadmap.
