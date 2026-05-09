# Pokémon Living Dex — Design

**Date** : 2026-05-09
**Statut** : design validé, prêt pour planification d'implémentation
**Cible** : v1 (offline-first, déployable plus tard en ligne)

---

## 1. Vision & objectifs

Outil personnel offline-first qui aide à constituer un **Living Dex global dans Pokémon HOME**. L'app répond à deux questions :

1. **Audit global** — *"Avec mes jeux, est-ce que je peux théoriquement compléter un living dex HOME complet ?"*
2. **Planification par jeu** — *"Concrètement, qu'est-ce qu'il me reste à attraper, et où ?"*

L'app fonctionne 100% hors-ligne après le premier chargement. Aucun service tiers n'est appelé au runtime. Les données Pokémon (catalogue, méthodes d'obtention, sprites) sont produites par un pipeline de scraping en build-time, versionnées en Git, et embarquées dans le bundle distribué. L'utilisateur final n'attend jamais une API tierce.

L'app doit pouvoir être déployée plus tard en ligne, sans backend, sur n'importe quel hébergeur statique (Vercel, Netlify, GitHub Pages, Cloudflare Pages).

## 2. Périmètre

### Jeux supportés en v1

| GameId | Nom | Génération | DLC modélisés |
|---|---|---|---|
| `sword` | Pokémon Épée | 8 | `isle-of-armor`, `crown-tundra` |
| `shield` | Pokémon Bouclier | 8 | `isle-of-armor`, `crown-tundra` |
| `bdsp-d` | Diamant Étincelant | 8 | — |
| `bdsp-p` | Perle Scintillante | 8 | — |
| `pla` | Légendes Pokémon : Arceus | 8 | — |
| `scarlet` | Pokémon Écarlate | 9 | `teal-mask`, `indigo-disk` |
| `violet` | Pokémon Violet | 9 | `teal-mask`, `indigo-disk` |
| `frlg-fr` | Pokémon Rouge Feu (Switch) | 3 | — |
| `frlg-lg` | Pokémon Vert Feuille (Switch) | 3 | — |

Le modèle de données est extensible : ajouter un jeu = ajouter une entrée dans `games.ts` + des encounters dans le dataset, sans toucher au code applicatif.

### Hors périmètre v1

- Pokémon GO, Pokémon HOME comme source, Let's Go Pikachu/Évoli, jeux mobiles, anciens jeux non-Switch (Bank/VC, GBA cartouche, DS, 3DS), Pokémon Stadium / Colosseum / XD.
- Variantes shiny et différences de genre dans le calcul de complétude (mais flags Settings réservés pour les activer plus tard).
- Sprites animés Showdown.
- Tests E2E (Playwright). Les tests unitaires couvrent la logique critique (parsers Bulbapedia, calcul de statut).

## 3. Définition des "entrées" du Living Dex

### Formes incluses par défaut (toggle dans Settings)

| Catégorie | Inclus par défaut | Exemples | Toggle |
|---|---|---|---|
| Espèces de base | ✅ | Pikachu, Salamèche | (toujours actif) |
| Formes régionales | ✅ | Raichu d'Alola, Goupix de Galar | `includeRegionalForms` |
| Gigamax | ✅ | Carchacrok-Gigamax, Pikachu-Gigamax | `includeGigamax` |
| Autres formes alternatives permanentes | ✅ | Deoxys (4 formes), Kyurem Blanc/Noir, Necrozma, Calyrex monture, Ogerpon (4 masques), Zacian Couronne | `includeAltForms` |
| Différences de genre | ❌ | Goupix mâle/femelle | `includeGenderDifferences` |
| Variantes shiny | ❌ | Tous les Pokémon en shiny | `includeShiny` |

**Méga-évolutions exclues** quoi qu'il arrive : temporaires, non stockées comme entrées séparées dans HOME.

### Mode Solo

Le mode solo est un **toggle global** qui change le rendu et les calculs. Active : signale comme "bloqués" les Pokémon qui ne peuvent pas être obtenus sans aide d'un autre joueur.

Sont considérés bloqués en mode solo :

1. **Évolutions par échange classiques** (Kadabra → Alakazam, Machoke → Mackogneur, etc.), **sauf** si au moins un des jeux possédés par l'utilisateur supporte le **Lien Magique** (BDSP, PLA, EB, EV — pas FRVF).
2. **Pokémon disponibles uniquement via in-game trade** (NPC trades).
3. **Version-exclusives non possédées** (ex : si l'utilisateur a Épée mais pas Bouclier, les exclusivités Bouclier sont bloquées).

**Hors mode solo** : ces Pokémon sont marqués "disponibles via échange".

### Pokémon événementiels

Flag séparé du mode solo. Marqués distinctement (badge orange) car obtenus par distributions limitées dans le temps. Ils ne sont jamais "available" automatiquement — l'utilisateur les coche manuellement s'il les a obtenus.

Exemples : Mew, Celebi, Jirachi, Volcanion, Zarude, Magearna distribuables, etc.

## 4. Architecture

### Trois flux de données distincts

```
FLUX 1 — BUILD-TIME (développeur ou GitHub Action manuelle)
  PokéAPI ──┐
            ├──► packages/scrapers ──► packages/data/dataset.json + sprites/*.png
  Bulbapedia API ──┘         ▲
                             │
  data-overrides/*.json ─────┘ (corrections manuelles)

FLUX 2 — RUNTIME APP (utilisateur final, navigateur)
  Static hosting ──► dataset.json + sprites/
                            │
                            ▼
                     IndexedDB (Dexie)
                     ├─ catalog (read-only seed)
                     └─ userData (lecture/écrit)
                            │
                            ▼
                     React app

FLUX 3 — DEV-MODE LOCAL (développement actif)
  apps/scraper-api (Hono) ◄──── Bouton "Rescrape gen N" dans UI dev
        └──► écrit packages/data/dataset.json
             puis Vite HMR recharge l'app
```

### Principes durs

- L'app web ne fait **jamais** d'appel réseau autre que pour télécharger `dataset.json` au premier chargement et vérifier les MAJ via `dataset-meta.json` (~1 KB).
- `apps/scraper-api` est **strictement un outil de dev**. Pas déployé en prod.
- En prod (`import.meta.env.PROD`), le bouton "Rescrape" devient automatiquement "Vérifier les mises à jour" et télécharge le dataset distant statique.
- En dev (`import.meta.env.DEV`), le bouton ouvre un modal de sélection de générations à rescraper et appelle `apps/scraper-api`.

### Versioning du dataset

`dataset-meta.json` (servi à part pour vérification rapide) :

```json
{
  "version": "2026-05-09T14:30:00Z",
  "schemaVersion": 1,
  "scrapedFrom": ["pokeapi", "bulbapedia"],
  "generations": [1, 2, 3, 4, 5, 6, 7, 8, 9],
  "pokemonCount": 1500,
  "encountersCount": 12000
}
```

L'app stocke `version` en IndexedDB. Au démarrage, fetch `dataset-meta.json` distant et compare. Si différent → propose la mise à jour.

`schemaVersion` permet de migrer la structure JSON sans casser les vieux datasets. Migration IndexedDB déclenchée si schémaVersion change.

## 5. Modèle de données

### Catalogue (read-only, dans `dataset.json`)

```typescript
type Pokemon = {
  id: string;                  // "pikachu" | "raichu-alola" | "charizard-gigamax"
  nationalDexNumber: number;
  speciesSlug: string;         // partagé entre formes d'une même espèce
  formId: string | null;       // null = forme par défaut
  formCategory: 'default' | 'regional' | 'gigamax' | 'alt' | 'gender' | 'cosmetic';
  names: { en: string; fr: string };
  types: PokemonType[];
  generation: number;
  sprites: { default: string; shiny: string; artwork: string; icon: string };
  evolutions: EvolutionLink[];
};

type EvolutionLink = {
  fromId: string;
  toId: string;
  method: 'level' | 'item' | 'trade' | 'friendship' | 'location' | 'move' | 'other';
  conditions: { type: string; value: string | number }[];
  soloAlternative?: 'linking-cord' | 'item' | null;
};

type Game = {
  id: GameId;
  names: { en: string; fr: string };
  generation: number;
  platform: 'switch';
  dlcs: Dlc[];
  pairedVersionId?: GameId;
  supportsLinkingCord: boolean;
  homeTransfer: 'direct' | 'unsupported';
};

type Dlc = {
  id: string;
  names: { en: string; fr: string };
  releaseDate: string;
};

type Encounter = {
  pokemonId: string;
  gameId: GameId;
  dlcRequired?: string;
  method:
    | { type: 'wild'; locations: string[]; rarity?: 'common' | 'uncommon' | 'rare' | 'very-rare' }
    | { type: 'evolution'; fromId: string }
    | { type: 'breeding' }
    | { type: 'gift'; from: string }
    | { type: 'fossil'; fossilItem: string }
    | { type: 'in-game-trade'; npc?: string }
    | { type: 'event'; distributedAs: string };
  notes?: string;
};
```

Plusieurs `Encounter` peuvent exister pour un même `(pokemonId, gameId)` (ex : Pikachu peut être sauvage ET cadeau ET évolution dans le même jeu).

### Données utilisateur (read/write, dans IndexedDB)

```typescript
type OwnedGame = { gameId: GameId; ownedDlcs: string[] };

type CollectionEntry = {
  pokemonId: string;
  homeStatus: 'missing' | 'caught' | 'transferred';
  perGameStatus?: Record<GameId, 'untouched' | 'planned' | 'caught'>;
  note?: string;
  updatedAt: string;
};

type UserSettings = {
  language: 'fr' | 'en';
  soloMode: boolean;
  granularity: {
    includeRegionalForms: boolean;     // défaut true
    includeGigamax: boolean;            // défaut true
    includeAltForms: boolean;           // défaut true
    includeGenderDifferences: boolean;  // défaut false
    includeShiny: boolean;              // défaut false
  };
  features: {
    enablePerGameTracking: boolean;     // défaut false ; active l'écran Planning et le perGameStatus dans les fiches
  };
  ui: {
    theme: 'light' | 'dark' | 'system';
    primarySpriteStyle: '2d' | 'artwork' | 'icon';
  };
};
```

### Logique de statut (calculée à chaque rendu, non stockée)

```
function computeStatus(pokemon, encounters, ownedGames, soloMode, collection):
  if collection[pokemon.id].homeStatus != 'missing': return 'owned'

  paths = encounters
    .filter(e => e.pokemonId == pokemon.id)
    .filter(e => ownedGames.includes(e.gameId))
    .filter(e => !e.dlcRequired || ownedGames[e.gameId].ownedDlcs.includes(e.dlcRequired))

  if paths.empty:
    pairedExclusive = encounters.some(e =>
      ownedGames.some(g => game(e.gameId).id == game(g.gameId).pairedVersionId)
    )
    return pairedExclusive ? 'version-exclusive' : 'unavailable'

  if soloMode:
    soloFriendly = paths.filter(p => isSoloFriendly(p, pokemon, ownedGames))
    return soloFriendly.empty ? 'blocked-solo' : 'available'

  return 'available'

function isSoloFriendly(encounter, pokemon, ownedGames):
  if encounter.method.type == 'in-game-trade': return false
  if encounter.method.type == 'event': return false  // event = flag séparé
  if encounter.method.type == 'evolution':
    evo = pokemon.evolutions.find(e => e.toId == pokemon.id)
    if evo && evo.method == 'trade':
      return ownedGames.some(g => game(g.gameId).supportsLinkingCord)
  return true
```

### Schema IndexedDB (Dexie)

```typescript
db.version(1).stores({
  catalog_meta: '&key',
  catalog_pokemon: '&id, nationalDexNumber, generation, formCategory',
  catalog_games: '&id, generation',
  catalog_encounters: '++id, pokemonId, gameId, [pokemonId+gameId]',
  user_ownedGames: '&gameId',
  user_collection: '&pokemonId, homeStatus',
  user_settings: '&key'
});
```

### Décisions verrouillées

1. **ID Pokémon = `speciesSlug-formId`** (`"raichu-alola"`) plutôt que numérique. Plus lisible et debuggable.
2. **Version exclusivité = absence d'`Encounter`** pour la version qui n'a pas le Pokémon. Détectée à runtime via `pairedVersionId`.
3. **Lien Magique = flag `supportsLinkingCord` au niveau Game**, pas par encounter.
4. **`perGameStatus` désactivé par défaut**, activable via Settings (révèle l'écran Planning).
5. **i18n minimal** : noms FR/EN dans le dataset, structure prête pour d'autres langues sans framework lourd.
6. **FRLG par défaut `homeTransfer: 'unsupported'`** (transfert NSO Switch → HOME non documenté à ma connaissance). Surchargeable via `data-overrides/` si confirmé. L'UI affiche un warning "non transférable vers HOME" sur les encounters FRLG.

## 6. Structure UI

### Navigation

5 sections accessibles via sidebar (desktop) / bottom nav (mobile) :
1. **Dex** — vue principale, grille de tous les Pokémon
2. **Jeux** — gestion des jeux possédés et DLC
3. **Planning** — vue détaillée par jeu (visible uniquement si `enablePerGameTracking` activé)
4. **Stats** — dashboard de progression
5. **Réglages** — settings

### Écran Dex

Grille de cartes (sprite 2D + nom + n° dex + badge statut). 6 statuts visuels par couleur de bordure :

| Statut | Couleur | Signification |
|---|---|---|
| Possédé | 🟢 vert | `homeStatus != 'missing'` |
| Disponible | 🔵 bleu | Attrapable dans tes jeux |
| Bloqué solo | 🟡 jaune | Mode solo + échange/version-exclusive sans alternative |
| Événementiel | 🟠 orange | Flag event, jamais "available" sans condition |
| Indisponible | 🔴 rouge | Aucun jeu possédé ne le contient |
| Filtré | ⚫ masqué | Forme désactivée dans Settings |

**Filtres sticky en haut** : recherche (nom FR/EN, n° dex), statut multi-select, génération multi-select, type, catégorie de forme, tri.

**Action rapide** : clic court = toggle possédé/missing. Clic long ou icône détail = ouvre fiche.

### Écran Fiche Pokémon

Modal full-screen sur mobile, side-panel sur desktop. Contenu :
- HD artwork
- Nom (FR + EN), n° dex, type(s), génération
- Boutons : toggle possédé, ajouter une note
- **Section "Comment l'obtenir avec tes jeux"** : une carte par jeu possédé, listant tous les encounters pour ce Pokémon. Si DLC requis : badge. Si `homeTransfer: 'unsupported'` : warning. Si `enablePerGameTracking` : sélecteur Vierge / Planifié / Attrapé par jeu.
- Chaîne d'évolution graphique (sprites + flèches + conditions)

### Écran Jeux

Liste de tous les jeux supportés, checkbox "je possède" + sous-checkboxes DLC. Chaque carte affiche : couverture, génération, plateforme, **stat de complétude** ("187/400 attrapables avec ta config").

### Écran Planning (conditionnel)

Visible si `enablePerGameTracking` est `true`. Sélecteur de jeu en haut, liste des Pokémon encore à attraper dans ce jeu spécifique, regroupés par zone/route.

### Écran Stats

Dashboard :
- Compteur principal "873 / 1025 entrées possédées (85%)"
- Compteur potentiel "873 possédés + 142 disponibles avec tes jeux = 1015 (99%)"
- Bloqueurs : "7 bloqués mode solo • 3 indisponibles • 0 événementiels manquants"
- Bar chart de progression par génération
- Top 10 "Pokémon les plus accessibles à attraper" (tri par rareté inverse + jeu déjà coché)

### Écran Réglages

Sections :
- **Général** : langue, thème, style sprites
- **Mode de complétion** : toggles solo + granularité (régionales, Gigamax, alt, genres, shiny, per-game tracking)
- **Données** : version dataset, bouton MAJ (dev: rescrape ; prod: download), import/export user data (JSON), reset
- **À propos** : version app, sources, licences, lien GitHub

### Onboarding

Au premier lancement (IndexedDB vide), écran obligatoire "Sélectionne tes jeux". Sans ça, tout serait rouge "indisponible" et l'app serait inutilisable.

### Mode dev — Bouton rescrape

Visible uniquement en `import.meta.env.DEV`. Ouvre un modal :
- Checkbox par génération
- Checkbox par source (PokéAPI, Bulbapedia, overrides)
- Bouton "Lancer". Ouvre une connexion SSE vers `apps/scraper-api`, affiche les logs en temps réel.
- À la fin, le dataset est ré-écrit, Vite HMR recharge l'app, IndexedDB est repeuplée.

## 7. Pipeline de scraping

### `packages/scrapers` — logique pure

```
packages/scrapers/src/
├── index.ts
├── sources/
│   ├── pokeapi/
│   │   ├── client.ts           ← fetch + cache disque
│   │   ├── species.ts
│   │   ├── evolution.ts
│   │   └── sprites.ts          ← download PNG, hash MD5, dedupe
│   └── bulbapedia/
│       ├── client.ts           ← MediaWiki api.php
│       ├── parser.ts           ← parse wikitext "Game locations"
│       └── games-map.ts        ← mapping noms Bulbapedia → GameId
├── normalizers/
│   ├── pokemon.ts
│   ├── encounters.ts
│   └── games.ts
├── overrides/
│   └── apply.ts
├── output/
│   ├── writer.ts
│   └── validator.ts            ← schémas Zod
└── pipeline.ts                 ← orchestrateur
```

**Principes** :
- Pure et testable : chaque normalizer prend des données en entrée et retourne un résultat. Pas de fetch ni d'écriture disque dans la logique.
- **Cache disque** dans `.cache/` (gitignored). Re-scrape sans toucher au cache = quasi instantané. Flag `--no-cache` pour forcer.
- **Validation Zod en sortie** : si un schéma casse (ex : Pokémon sans nom), le pipeline échoue **avant** d'écrire un dataset corrompu.

### Sources

**PokéAPI** (`https://pokeapi.co`) :
- Espèces, formes, types, sprites URLs, chaînes d'évolution, noms localisés
- Auto rate-limit : 10 req/s
- Cache local 100% (les endpoints sont stables)

**Bulbapedia MediaWiki API** (`https://bulbapedia.bulbagarden.net/w/api.php`) :
- `action=parse&page=Pikachu_(Pokémon)&prop=wikitext&format=json`
- Parser récupère sections "Game locations" / "Availability"
- Politesse : 1 req/s, User-Agent custom obligatoire (`PokemonLivingDex-Scraper/1.0 (https://github.com/.../issues)`)
- Mappage noms Bulbapedia → GameId via table dans `bulbapedia/games-map.ts`

**Sprites GitHub** (`https://raw.githubusercontent.com/PokeAPI/sprites/master/...`) :
- 2D default, 2D shiny, HD artwork, box icons 32×32
- Téléchargés en parallèle (20 reqs simultanées)
- Hash MD5 stocké dans le dataset pour détecter les changements ultérieurs

### Manual overrides

Format `data-overrides/encounters.json` (et autres fichiers thématiques) :

```json
[
  {
    "pokemonId": "meltan",
    "gameId": "sword",
    "method": { "type": "event", "distributedAs": "Pokémon HOME Mystery Box" },
    "notes": "Obtenable seulement via Pokémon GO + HOME Mystery Box"
  }
]
```

L'override **ajoute ou écrase** les encounters du même `(pokemonId, gameId, method.type)`. Permet de corriger Bulbapedia sans toucher au scraper.

Le dossier `data-overrides/` contient plusieurs fichiers thématiques :
- `events.json` — Pokémon événementiels
- `version-exclusives.json` — confirmations / corrections de version-exclusivité
- `corrections.json` — corrections diverses du parsing Bulbapedia
- `frlg-transfer.json` — décision finale sur le transfert FRVF → HOME

### Coverage report

À chaque run, le pipeline génère `coverage-report.json` :

```json
{
  "totalPokemon": 1500,
  "coveredByPokeApi": 1495,
  "coveredByBulbapedia": 1380,
  "needsManualOverride": ["meltan-sword", "melmetal-sword", "..."],
  "warnings": [
    "Bulbapedia parsing failed for Pokemon 'foo' on page 'Foo_(Pokémon)': unexpected template format",
    "..."
  ]
}
```

Permet d'identifier en un coup d'œil ce qui doit être corrigé manuellement.

### `apps/scraper-api` — serveur Hono dev

Port 3001, démarré automatiquement avec `pnpm dev` via `concurrently`. Endpoints :

- `GET /api/health` — ping
- `GET /api/scrape?gen=8,9&src=pokeapi,bulbapedia` — lance le pipeline en streaming SSE, chaque event = `{ stage, generation, progress, message }`
- À la fin, écrit `packages/data/dataset.json` + `dataset-meta.json` + sprites sur disque

### Rate limiting & resilience

| Source | Rate limit | Retry strategy |
|---|---|---|
| PokéAPI | 10 req/s | 3× backoff expo sur 5xx, fail-fast sur 4xx (sauf 429 → retry) |
| Bulbapedia | 1 req/s | Idem |
| Sprites GitHub | 20 req/s | Idem |

Le cache disque + l'idempotence permettent de relancer le pipeline après crash sans tout reperdre.

## 8. Stack technique

| Couche | Choix | Raison |
|---|---|---|
| Package manager | **pnpm** | Workspaces natifs, store partagé |
| Frontend | **React + TypeScript** | Standard, exigence utilisateur |
| Bundler | **Vite** | Build instantané, tree-shaking, HMR |
| UI | **Tailwind CSS + shadcn/ui** | Composants copiés dans le repo, zéro lock-in |
| State | **Zustand** | 1KB, API simple, pas de boilerplate |
| Storage local | **Dexie.js** | Wrapper IndexedDB de référence, queries SQL-like, types TS parfaits |
| Routing | **React Router v6** | Standard, mature |
| PWA | **vite-plugin-pwa** | Manifest + service worker, ~30 min de setup |
| Server (dev) | **Hono** | Léger, types parfaits, runs partout |
| Tests | **Vitest** | Cohérent avec Vite, rapide |
| Lint/Format | **Biome** | Moderne, rapide, un seul fichier de config |
| CI | **GitHub Actions** | Lint + typecheck + tests + build sur PR |
| Validation runtime | **Zod** | Validation du dataset à la lecture, schémas TS |

## 9. Structure du monorepo

```
pokemon-livingdex/
├── pnpm-workspace.yaml
├── package.json                 ← scripts root
├── tsconfig.base.json
├── biome.json
├── .github/workflows/
│   ├── ci.yml                   ← lint + typecheck + tests + build sur PR
│   └── refresh-data.yml         ← workflow_dispatch only (manuel optionnel)
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── components/      ← UI atomic
│   │   │   ├── features/        ← logique métier (dex, games, planning, stats, settings)
│   │   │   ├── store/           ← Zustand slices
│   │   │   ├── db/              ← Dexie schema + repositories
│   │   │   ├── lib/             ← computeStatus, filters, sorts
│   │   │   ├── i18n/            ← maps fr/en
│   │   │   ├── routes/
│   │   │   └── App.tsx
│   │   ├── public/              ← favicon, manifest.json
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── scraper-api/
│       ├── src/index.ts         ← Hono server + SSE
│       └── package.json
├── packages/
│   ├── types/                   ← types TS partagés (Pokemon, Game, Encounter, User)
│   ├── data/                    ← dataset.json + sprites/, committés en Git
│   └── scrapers/                ← logique pure + tests
├── data-overrides/              ← corrections manuelles JSON
├── .cache/                      ← gitignored
├── .gitignore
└── README.md
```

### Setup local

```bash
git clone ...
cd pokemon-livingdex
pnpm install

pnpm dev          # apps/web sur :5173 + apps/scraper-api sur :3001
pnpm build        # apps/web/dist statique
pnpm scrape       # CLI : npx tsx packages/scrapers/cli.ts --gen 8,9
pnpm test
pnpm typecheck
pnpm lint
```

### Déploiement prod

Cible : `apps/web/dist` (dossier statique). Compatible Vercel, Netlify, GitHub Pages, Cloudflare Pages, S3+CDN, VPS+nginx. Aucun backend déployé.

Variables d'env :
- `VITE_DATASET_URL` (prod) : URL de `dataset-meta.json` distant. Défaut : `/dataset-meta.json` (même domaine).
- `VITE_DEV_SCRAPER_URL` (dev) : `http://localhost:3001`.

### CI sur PR

```yaml
name: CI
on: [pull_request, push]
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
```

### Tests minimaux ciblés (v1)

- `packages/scrapers/tests/` — normalizers et parser Bulbapedia (avec fixtures wikitext)
- `apps/web/src/lib/computeStatus.test.ts` — logique de statut (solo, version-exclusive, blocked-solo)
- Pas de tests E2E v1.

### Versioning

- **App version** : SemVer dans `apps/web/package.json` (ex: `0.1.0`). Affichée dans Settings.
- **Dataset version** : timestamp ISO dans `dataset-meta.json` (ex: `2026-05-09T14:30:00Z`). Affiché dans Settings.
- **Schema version** : entier incrémenté quand le shape JSON change de manière incompatible. Migrations IndexedDB déclenchées en conséquence.

## 10. Sprites

### Inclus dans le dataset (committés en Git)

| Type | Dimension | Usage | Total ~1500 entrées |
|---|---|---|---|
| 2D default | 96×96 PNG | Vue grille principale (par défaut) | ~3 MB |
| 2D shiny | 96×96 PNG | Variante shiny | ~3 MB |
| HD artwork | 475×475 PNG | Page détail | ~80 MB |
| Box icons | 32×32 PNG | Vue compacte / Planning | ~500 KB |

Total ~90 MB committés. Git compresse correctement, et ils ne changent quasi jamais. Pas de Git LFS pour la v1.

### Hors v1

- HOME-style 3D renders (alternative à HD artwork, exclusive l'autre)
- Showdown animated GIFs (~30 MB additionnels)

### Vue principale

Sprite 2D pixel-art par défaut. L'utilisateur peut basculer vers HD artwork ou box icons via Settings > UI > "Style des sprites".

### Considération légale

Les sprites sont propriété Nintendo/Game Freak. PokéAPI/sprites les héberge sous "fair use éducatif", utilisé par Bulbapedia, Smogon, Showdown, etc. Pour un outil personnel ou open-source non-commercial : usage standard de la communauté Pokémon. À revoir si monétisation envisagée plus tard.

## 11. Roadmap & jalons

Découpage en phases pour la planification d'implémentation (à détailler dans le plan d'implémentation suivant) :

1. **Setup monorepo** — pnpm workspaces, tsconfig, biome, CI minimale
2. **`packages/types`** — types TS partagés
3. **`packages/scrapers` v0** — PokéAPI seulement (espèces + sprites), produit un dataset partiel
4. **`packages/scrapers` v1** — ajout Bulbapedia parser + overrides, dataset complet
5. **`apps/scraper-api`** — serveur Hono + SSE, branchable depuis l'UI dev
6. **`apps/web` foundations** — Vite + React + Tailwind + shadcn + Zustand + Dexie + routing
7. **`apps/web` écrans v1** — Onboarding, Dex (grille + filtres + statuts), Jeux, Settings
8. **`apps/web` écrans v2** — Fiche Pokémon, Stats, Planning (si toggle activé)
9. **PWA** — vite-plugin-pwa, manifest, service worker
10. **i18n** — finalisation FR/EN
11. **Polish** — accessibilité, animations, perf (virtualisation grille)
12. **Documentation** — README, contribution guide, captures

## 12. Hors-périmètre explicite (à reporter v2+)

- Pokémon GO comme source
- Pokémon HOME comme source de Pokémon (récompenses légendaires, distributions)
- Let's Go Pikachu / Évoli
- Anciens jeux non-Switch (Bank, Virtual Console, GBA, DS, 3DS)
- Variantes shiny activées par défaut dans la complétude
- Différences de genre activées par défaut
- Showdown animated GIFs
- HOME-style 3D renders
- Tests E2E (Playwright)
- Multi-utilisateur / cloud sync
- Mobile native app
- Notifications de nouvelles distributions Pokémon

## 13. Risques connus

| Risque | Mitigation |
|---|---|
| Bulbapedia change le format des templates → parser casse | Tests avec fixtures + coverage report + manual overrides comme filet |
| PokéAPI tombe ou change un endpoint | Cache disque persistant ; le dataset déjà committé reste valide |
| Sprites Nintendo deviennent un problème légal si monétisation | App reste personnelle/non-commerciale en v1 ; à revoir plus tard |
| FRVF Switch n'a pas de chaîne de transfert vers HOME | UI marque clairement "non transférable" sur les encounters FRVF ; surchargeable via overrides si confirmation contraire |
| Volume sprites (90 MB) dans Git | Acceptable car peu de churn ; bascule Git LFS possible si problématique |
| Lacunes Bulbapedia sur Gen 9 récente | Coverage report identifie les trous ; manual overrides comblent |
| IndexedDB quota dépassé sur certains navigateurs | Sprites sont des assets HTTP statiques, pas dans IndexedDB. Seules les données catalog/user sont en IDB (~5 MB max) |

## 14. Décisions ouvertes (à trancher pendant l'implémentation)

- Cible de déploiement préférée pour la première mise en ligne (Vercel / Netlify / autres).
- Garder ou supprimer `refresh-data.yml` (workflow_dispatch GitHub Action). Si tu ne comptes jamais l'utiliser, on peut le retirer du squelette.
- Choix exact du composant de virtualisation pour la grille de 1500 cartes (TanStack Virtual vs react-window).
