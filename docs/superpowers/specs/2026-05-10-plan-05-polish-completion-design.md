# Plan 05 — Polish & Completion — Design

**Date** : 2026-05-10
**Statut** : design validé, prêt pour planification d'implémentation
**Cible** : finition produit web post-v1 (Plans 01–04 shippés)
**Prérequis** : Plan 04 (web app v1) livré · dataset 1244 Pokémon / 4784 encounters / 78.7% coverage

---

## 1. Vision

L'app web v1 (Plans 01–04) est utilisable end-to-end : sélection des jeux, grille des 1244 Pokémon avec statuts colorés, mode solo, granularité des formes, thèmes. Mais elle reste **utilitaire au premier degré** :

- Le clic sur une card ouvre un **modal** étriqué qui ne montre que les encounters formatés en wikitext brut (`[[Route]]s {{rtn|225|Sinnoh}}`).
- Pas de **navigation** Pokémon → Pokémon, pas de **deep-link** vers un Pokémon spécifique.
- Pas de **vue d'ensemble** de la progression (stats globales / par jeu / par génération).
- L'app **n'est pas installable** (pas de PWA), ne fonctionne pas hors-ligne après la première visite.
- L'i18n est **figée** : le champ `language` existe mais aucun toggle UI ne l'expose.

Plan 05 corrige ces points dans une logique de **polish & completion** : passer d'une grille utilitaire à un produit qu'on a envie d'utiliser au quotidien.

Le scope est découpé en **3 sous-plans indépendants** pour pouvoir shipper la valeur par incréments et arrêter après n'importe lequel sans bloquer les autres.

---

## 2. Découpage en 3 sous-plans

| Sous-plan | Scope | Valeur livrée | Dépend de |
|---|---|---|---|
| **05a** | Page détail Pokémon dédiée | Remplace le modal par une expérience complète avec navigation, formes, évolutions, encounters lisibles, notes perso | — |
| **05b** | Stats dashboard | Vue d'ensemble de la progression sous tous ses angles + historique temporel | — |
| **05c** | PWA + i18n switcher | App installable, marche offline complet, langue switchable depuis l'UI | — |

Les trois sous-plans sont **indépendants** : on peut shipper 05a sans toucher 05b/05c, etc. Aucun ne se base sur les autres au niveau code.

---

## 3. Plan 05a — Page détail Pokémon

### 3.1 Objectif

Remplacer le modal `apps/web/src/features/dex/PokemonDetail.tsx` (commit `c361d36`) par une **page dédiée** déployée sur la route `/dex/:pokemonId`. Le modal est supprimé du codebase.

### 3.2 Raisons du choix page vs modal

| Critère | Modal | Page dédiée |
|---|---|---|
| Deep-linkable (URL partageable, bookmarkable) | ❌ | ✅ |
| Browser back/forward natif | ❌ | ✅ |
| Espace pour contenu riche (sprites par forme, chaîne évo, notes) | Cramped | Confortable |
| Navigation Pokémon précédent/suivant | Inadapté | Trivial |
| Expérience mobile | Limité au viewport | Full screen natif |
| Cohérence avec ambition "produit pro" | Faible | Forte |

### 3.3 Sections de la page

La page suit l'ordre suivant, top-to-bottom :

1. **Hero**
   - Artwork HD (fallback sprite default si absent)
   - Nom FR + EN
   - Numéro National Dex (`#019`)
   - Badges types
   - Génération (`Gen 1`)
   - Bouton **Owned / Manquant** (toggle, sync avec IndexedDB)

2. **Sélecteur de formes** — affiché uniquement si le Pokémon a >1 forme dans le dataset (`speciesSlug` partagé)
   - Onglets : `Kantonian` / `Alolan` / `Galarian` / `Hisuian` / `Gigamax` / etc.
   - Changer d'onglet remplace dynamiquement l'artwork du hero et les encounters affichés dans la section "Comment l'obtenir"
   - L'URL ne change pas (la forme est state local côté React) — chaque forme reste accessible via son `pokemonId` direct si on veut un deep-link

3. **Chaîne d'évolution visuelle**
   - Sprites enfilés horizontalement avec flèches entre les nœuds
   - Conditions d'évolution sous chaque flèche (`niveau 16`, `Pierre Eau`, `échange`, `bonheur`, etc.)
   - Évolutions branchues (ex. Eevee → 8 formes) rendues comme arbre vertical à partir du nœud de branchement
   - Cliquer un nœud navigue vers `/dex/:thatPokemonId`

4. **Comment l'obtenir avec tes jeux**
   - Liste des encounters filtrés par `ownedGames`
   - Groupés par jeu, dans chaque groupe groupés par `method.type` (wild / evolution / breeding / gift / trade / fossil / event)
   - Wiki markup nettoyé via util `formatWikitext()` (voir §3.5)

5. **Disponible dans tous les jeux v1**
   - Même rendu que (4) mais pour les 9 jeux v1, y compris ceux non possédés
   - Section collapsible (collapsed par défaut pour ne pas écraser la section "tes jeux")

6. **Notes personnelles**
   - Textarea libre
   - Sauvée dans IndexedDB sur blur (debounce 500ms côté code)
   - Vide par défaut, max ~1000 caractères

7. **Lien externe Bulbapedia**
   - Bouton "Voir sur Bulbapedia" qui ouvre `https://bulbapedia.bulbagarden.net/wiki/<slug>_(Pokémon)` dans un nouvel onglet

8. **Navigation prev/next**
   - Footer fixe : `← #018 Pidgeot` · `#020 Raticate →`
   - Skip les formes alternatives (`rattata-alola` est sauté quand on est sur `rattata`, on va direct à `raticate`)
   - Wrap-around : `#1024 Pecharunt` → `#001 Bulbasaur` (et inverse)
   - Raccourcis clavier : `←` / `→`

### 3.4 Quick-toggle Owned sur card grille

Sur l'écran `/dex`, chaque card a maintenant deux zones cliquables distinctes :

- **Cercle/checkbox en haut à droite** de la card (~22px) : click = toggle owned (comportement actuel du card click entier)
- **Reste de la card** : click = navigation vers `/dex/:pokemonId`

Conséquence : on **garde la capacité de cocher en masse** depuis la grille, et l'utilisateur explore les détails en cliquant sur le corps de la card.

L'événement de toggle doit avoir `event.stopPropagation()` pour ne pas trigger la navigation parent.

### 3.5 Wiki markup cleanup côté UI

Le dataset garde le wikitext brut tel quel (option assumée : data source d'archive, UI gère le rendu). Un nouvel util `apps/web/src/lib/formatWikitext.ts` transforme à l'affichage :

| Pattern wikitext | Sortie |
|---|---|
| `[[Route]]s {{rtn|225|Sinnoh}}` | `Routes 225 (Sinnoh)` |
| `[[Grand Underground]]` | `Grand Underground` |
| `[[Pokémon Sword|Sword]]` (lien avec label) | `Sword` |
| `<small>('''Kantonian Form''')</small>` | `(Kantonian Form)` ou `[Kantonian Form]` |
| `<br>` | newline / `<br>` selon contexte |
| `'''X'''` (gras) | `X` (ou `<strong>X</strong>` si on garde la sémantique) |
| `{{tt|X|tooltip}}` | `X` |

L'util retourne **du texte brut nettoyé** (pas du JSX). Si on veut un jour rendre les noms de routes cliquables, on upgrade vers un util qui retourne du JSX. Pour Plan 05a : texte propre suffit.

Tests unitaires : `formatWikitext.test.ts` avec ~10 fixtures couvrant les patterns ci-dessus.

### 3.6 Données manquantes à traiter dans Plan 05a

- **Évolutions vides ou dupliquées** : le dataset actuel a parfois 4× la même évolution `rattata → raticate`. Cause probable : le pipeline boucle sur les varieties de l'espèce sans dédup. À fixer dans `packages/scrapers/src/normalizers/evolution.ts` pour produire 1 entrée par paire `fromId|toId|method|conditions`.
- **Sprites par forme** : déjà téléchargés par le pipeline (`packages/data/sprites/<id>.png`). Le sélecteur de formes pointe sur le sprite du Pokémon de la forme correspondante (`rattata-alola.png` quand on est sur l'onglet Alolan de Rattata).
- **`form` data manquante côté évolutions** : la chaîne d'évolution ignorera les formes pour l'instant (l'arbre montre les espèces de base). À revisiter si insatisfaisant.

### 3.7 Hors-scope Plan 05a

- Stats par Pokémon (HP/Atk/Def/Spa/Spd/Spe) — non présentes dans le dataset
- Movesets — non scrapés
- Abilities — non scrapées
- Encounters par DLC distingués (`dlcRequired` field non rempli, cf. limitation Plan 03)
- Recherche/filtre dans les encounters

---

## 4. Plan 05b — Stats dashboard

### 4.1 Objectif

Nouvelle route `/stats`. Vue d'ensemble de la progression du Living Dex sous **tous les angles** + historique temporel.

### 4.2 Sections du dashboard

1. **Headline complétion globale**
   - Grand chiffre : `342 / 1244 (27.5%)` selon la granularité Settings active
   - Barre de progression

2. **Par génération**
   - Tableau ou barres horizontales : Gen 1 `145/151`, Gen 2 `87/100`, ..., Gen 9 `12/120`
   - % de complétion par génération

3. **Par jeu possédé**
   - Une ligne par jeu dans `ownedGames`
   - `Sword : 230/400 obtainable owned` (numérateur = owned ET dispo dans ce jeu, dénominateur = obtainable solo dans ce jeu en respectant Settings)
   - Excluant les jeux non possédés (l'utilisateur s'en fout)

4. **Par type**
   - 18 types (Normal, Feu, Eau, …) avec leur logo
   - `Eau : 80/142` par type
   - Un Pokémon dual-type compte dans chaque type (cohérent avec la perception)

5. **Par catégorie**
   - `default : 870 / 1025`, `regional : 25 / 70`, `gigamax : 15 / 32`, `alt : 32 / 117`
   - Ignorant les catégories désactivées dans Settings

6. **Bloqués actuellement**
   - 3 compteurs :
     - `blocked-solo : 28` (échanges sans Lien Magique disponible)
     - `version-exclusive : 12` (exclusivité jeu non possédé)
     - `event : 25` (event-only, non cochés)
   - Click sur chaque compteur → navigation `/dex?filter=blocked-solo` (réutilise le filtre existant de Plan 04)

7. **Graphique de progression dans le temps**
   - Line chart : axe X = date, axe Y = nombre total owned
   - Données issues d'une nouvelle table `user_collection_events` (cf. §4.3)
   - Si moins de 7 jours d'historique : afficher placeholder "Continue à cocher des Pokémon pour voir ton évolution"

### 4.3 Nouvelle table IndexedDB `user_collection_events`

Schéma :

```ts
type CollectionEvent = {
  id: number;            // autoincrement
  pokemonId: string;
  action: 'owned' | 'unowned';
  timestamp: number;     // Date.now()
};
```

Chaque toggle owned ajoute une row. La table peut grossir indéfiniment (~1244 Pokémon × N toggles), mais on garde tout pour l'instant — 10000 events = ~500 KB IndexedDB, tolérable.

Migration : nouvelle table dans Dexie schema version `N+1`. Migration code dans `apps/web/src/db/schema.ts` (incrémenter le version et déclarer la table dans la nouvelle migration).

### 4.4 Choix techniques

- **Pas de lib de charts lourde** pour le graphique (Recharts = ~80 KB gzip, Chart.js = ~60 KB). Préférer une **lib légère** : `uplot` (~50 KB) ou un SVG fait main si le besoin reste simple (1 line chart). Décision finale au moment de l'implémentation.
- **Toutes les agrégations côté client** depuis IndexedDB. Pas de pré-calcul en build.
- **Performance** : agréger 1244 Pokémon × stats est trivial (< 5ms). Pas de virtualisation ou worker requis.

### 4.5 Hors-scope Plan 05b

- Export CSV / partage social
- Comparaison avec d'autres users (l'app reste personnelle)
- Suggestions ("tu pourrais finir Gen 3 facilement") — relève d'un éventuel mode planning
- Achievements / milestones (50%, 75%, 100%)

---

## 5. Plan 05c — PWA + i18n switcher

### 5.1 PWA installable

**Stack** : `vite-plugin-pwa` (~maintenu, intégration native Vite, support Workbox).

**Manifest** (`apps/web/public/manifest.json` ou généré par vite-plugin-pwa) :
- `name` : "Living Dex Helper"
- `short_name` : "LivingDex"
- `description` : "Outil offline-first pour planifier un Living Dex global Pokémon HOME"
- `theme_color` : cohérent avec `--primary` du thème actuel
- `background_color` : neutre (blanc / sombre selon préférence système)
- `display` : `standalone`
- `start_url` : `/`
- `icons` : 192×192 + 512×512 PNG (à générer ; option : utiliser un sprite ou un logo Poké Ball stylisé)

**Service worker** :
- Stratégie : `precache` complet du shell app au build (HTML/CSS/JS) + `dataset.json` + `dataset-meta.json` + tous les sprites
- Au runtime : `cacheFirst` pour les sprites, `staleWhileRevalidate` pour le dataset (au cas où une nouvelle version est déployée)
- Le `precache` couvre intégralement l'app — une fois la première visite faite, l'app marche offline complet sans aucune requête réseau

**Update flow** : quand une nouvelle version est détectée, afficher un toast / bandeau "Nouvelle version disponible, recharger ?" avec bouton Recharger.

**Bouton "Installer l'app"** : afficher uniquement quand l'événement `beforeinstallprompt` est dispo (Chrome PC, Edge, Android Chrome). Sur iOS Safari : afficher juste un help text "Pour installer : Partager → Sur l'écran d'accueil".

### 5.2 i18n switcher

Le champ `language: 'fr' | 'en'` existe déjà dans `UserSettings` (cf. Plan 04, `packages/types/src/user.ts`). Il est juste **pas exposé dans l'UI**.

Implémentation :
- Toggle FR/EN dans `apps/web/src/features/settings/SettingsScreen.tsx` sous une nouvelle section "Langue"
- L'écran Settings écrit `language` dans Zustand + IndexedDB (déjà câblé)
- Tous les composants qui lisent un label Pokémon ou jeu utilisent `pokemon.names[settings.language]` (déjà cohérent dans le code Plan 04 normalement — à vérifier au moment de l'implémentation)
- **Périmètre : FR + EN only**. JP/ES/DE/IT/KR exclus (PokéAPI les fournit mais zéro traduction de l'UI = pas de valeur)

**Texte de l'UI lui-même** : actuellement codé en français en dur dans le code (boutons "Mes Pokémon", "Réglages", etc.). Décision : pour Plan 05c, **on ne traduit que les noms de Pokémon / jeux** (déjà dans le dataset). Le texte UI reste FR. Une vraie i18n complète de l'UI (avec une lib type `react-intl` ou `i18next`) est hors-scope — relève d'un futur plan si jamais.

### 5.3 Hors-scope Plan 05c

- Traduction UI complète (boutons, labels, messages) avec lib i18n
- Notifications push (PWA permet, mais aucun cas d'usage v1)
- Sync cloud entre devices (resterait à designer)

---

## 6. Impacts transversaux

### 6.1 Routes ajoutées

| Route | Composant | Sous-plan |
|---|---|---|
| `/dex/:pokemonId` | `apps/web/src/features/dex/PokemonDetailPage.tsx` | 05a |
| `/stats` | `apps/web/src/features/stats/StatsPage.tsx` | 05b |

Existant : `/`, `/onboarding`, `/dex`, `/jeux`, `/settings`. Navigation principale (à étendre) : Dex · Jeux · **Stats** · Réglages.

### 6.2 Modifications IndexedDB

Nouvelle table `user_collection_events` (cf. §4.3) — migration Dexie incrémentant le numéro de version du schema.

Aucun changement au schema existant pour 05a et 05c (les notes perso de 05a sont stockées comme une nouvelle entrée dans une table existante — cf. §6.3).

### 6.3 Notes perso (Plan 05a)

Option **A** (préférée) : ajouter un champ `notes?: string` à la table existante `user_collection` (la row du Pokémon).
Option **B** : nouvelle table `user_notes` avec `{ pokemonId, notes, updatedAt }`. Plus propre mais plus de boulot.

Décision à figer au moment de l'implémentation Plan 05a, mais penchant pour A (YAGNI).

### 6.4 Suppressions

- `apps/web/src/components/ui/dialog.tsx` — composant Dialog ne sera plus utilisé après suppression du modal (à vérifier qu'aucun autre écran ne s'en sert).
- `apps/web/src/features/dex/PokemonDetail.tsx` — modal supprimé, remplacé par `PokemonDetailPage.tsx`.
- Dépendance `@radix-ui/react-dialog` — à retirer du `package.json` apps/web si plus aucun usage.

### 6.5 Modifications grille Dex

`apps/web/src/features/dex/PokemonCard.tsx` :
- Ajout d'un sous-composant `OwnedToggle` (cercle ~22px en haut à droite)
- Click sur la card body → `navigate(/dex/${id})` (au lieu du `setSelectedPokemonId` actuel qui ouvre le modal)
- Click sur le toggle → `toggleOwned(id)` avec `stopPropagation`

### 6.6 Pipeline (Plan 05a uniquement)

Fix optionnel des doublons d'évolutions dans `packages/scrapers/src/normalizers/evolution.ts`. Re-scrape déclenché à la fin de Plan 05a.

---

## 7. Tests

Tests minimaux **par sous-plan** :

### 05a
- `formatWikitext.test.ts` (~10 fixtures couvrant les patterns wikitext)
- `PokemonDetailPage.test.tsx` (smoke render avec données mockées)
- Test de navigation prev/next dans le router

### 05b
- `stats.test.ts` — agrégations (par génération, type, catégorie, bloqués) avec dataset mocké
- `user_collection_events.test.ts` — write/read events depuis Dexie + agrégation timeline

### 05c
- Test du manifest généré (présence des icons, name, theme_color)
- Pas de tests E2E PWA (relève de Playwright, hors-scope)
- `settings.test.tsx` — le toggle FR/EN écrit bien `language` en DB

---

## 8. Risques connus

| Risque | Sous-plan | Mitigation |
|---|---|---|
| `formatWikitext` ne couvre pas tous les patterns Bulbapedia | 05a | Tests avec fixtures réelles + fallback : retourner le texte tel quel si parse rate ; l'utilisateur voit du wiki markup mais l'app ne crash pas |
| Chaîne d'évolution branchue rendue moche (Eevee 8 formes) | 05a | Layout arbre vertical sous le nœud de branchement ; si trop grand on collapse derrière un "Voir toutes les évolutions" |
| `user_collection_events` grossit indéfiniment | 05b | Surveiller la taille sur la durée ; à 100k events on envisage compaction (1 event par jour par Pokémon max) |
| Service worker cache stale après deploy | 05c | Bandeau "Nouvelle version disponible" avec `skipWaiting` quand l'utilisateur recharge |
| iOS Safari PWA limitations | 05c | Documentation "Pour iOS : Partager → Écran d'accueil", pas de bouton install natif |
| Granularité Settings change le compte global | 05b | Toutes les agrégations recomputent quand `granularity` change (déjà le cas dans Plan 04 pour la grille) |

---

## 9. Découpage en plans d'implémentation

Trois plans à produire avec la skill `writing-plans` :

1. **`docs/superpowers/plans/2026-05-XX-plan-05a-pokemon-detail-page.md`**
2. **`docs/superpowers/plans/2026-05-XX-plan-05b-stats-dashboard.md`**
3. **`docs/superpowers/plans/2026-05-XX-plan-05c-pwa-i18n.md`**

Chaque plan est indépendant et peut être réalisé dans l'ordre voulu. Ordre recommandé pour shipper la valeur la plus visible en premier : **05a → 05b → 05c**.

---

## 10. Décisions ouvertes (à trancher au moment de l'implémentation)

- Lib charts pour Plan 05b (uplot vs SVG fait main vs Recharts si vraiment utile).
- Notes perso : champ `notes` dans `user_collection` (option A) vs table `user_notes` séparée (option B).
- Doit-on garder la dépendance `@radix-ui/react-dialog` au cas où on en aurait besoin pour d'autres usages futurs (confirmation dialogs, etc.) ou la retirer dès Plan 05a ?
- Sélecteur de formes : tabs horizontaux vs dropdown vs segmented control. Décision UI au moment de l'implémentation.
- Icons PWA : générer depuis un asset existant (sprite, logo) ou créer un design dédié ?
