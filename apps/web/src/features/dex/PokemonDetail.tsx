import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { db } from '@/db/schema';
import { useCollection } from '@/store/collection';
import { useOwnedGames } from '@/store/ownedGames';
import type { Encounter, EncounterMethod, Game, Pokemon, PokemonType } from '@livingdex/types';
import { useLiveQuery } from 'dexie-react-hooks';
import * as React from 'react';

// ─── helpers ────────────────────────────────────────────────────────────────

const FRENCH_TYPE: Record<PokemonType, string> = {
  normal: 'Normal',
  fire: 'Feu',
  water: 'Eau',
  grass: 'Plante',
  electric: 'Électrik',
  ice: 'Glace',
  fighting: 'Combat',
  poison: 'Poison',
  ground: 'Sol',
  flying: 'Vol',
  psychic: 'Psy',
  bug: 'Insecte',
  rock: 'Roche',
  ghost: 'Spectre',
  dragon: 'Dragon',
  dark: 'Ténèbres',
  steel: 'Acier',
  fairy: 'Fée',
};

const TYPE_COLORS: Record<PokemonType, string> = {
  normal: 'bg-gray-400 text-white',
  fire: 'bg-orange-500 text-white',
  water: 'bg-blue-500 text-white',
  grass: 'bg-green-500 text-white',
  electric: 'bg-yellow-400 text-black',
  ice: 'bg-cyan-300 text-black',
  fighting: 'bg-red-700 text-white',
  poison: 'bg-purple-500 text-white',
  ground: 'bg-yellow-700 text-white',
  flying: 'bg-indigo-300 text-black',
  psychic: 'bg-pink-500 text-white',
  bug: 'bg-lime-500 text-white',
  rock: 'bg-stone-500 text-white',
  ghost: 'bg-violet-700 text-white',
  dragon: 'bg-blue-700 text-white',
  dark: 'bg-stone-800 text-white',
  steel: 'bg-slate-400 text-white',
  fairy: 'bg-pink-300 text-black',
};

const METHOD_LABEL: Record<EncounterMethod['type'], string> = {
  wild: 'Sauvage',
  evolution: 'Évolution',
  breeding: 'Élevage',
  gift: 'Cadeau',
  fossil: 'Fossile',
  'in-game-trade': 'Échange en jeu',
  event: 'Événement',
};

function methodDetail(method: EncounterMethod): string {
  switch (method.type) {
    case 'wild':
      return method.locations.length > 0 ? method.locations.join(', ') : '';
    case 'evolution':
      return `depuis ${method.fromId}`;
    case 'breeding':
      return '';
    case 'gift':
      return method.from;
    case 'fossil':
      return method.fossilItem;
    case 'in-game-trade':
      return method.npc ?? '';
    case 'event':
      return method.distributedAs;
  }
}

function buildEvolutionText(pokemon: Pokemon): string | null {
  if (pokemon.evolutions.length === 0) return null;
  const links = pokemon.evolutions
    .map((evo) => {
      const conditionStr = evo.conditions.map((c) => String(c.value)).join(', ');
      return `${evo.fromId} → ${evo.toId}${conditionStr ? ` (${conditionStr})` : ''}`;
    })
    .join(' → ');
  return links;
}

// ─── sub-components ──────────────────────────────────────────────────────────

type GameEncounterCardProps = {
  game: Game;
  encounters: Encounter[];
};

function GameEncounterCard({ game, encounters }: GameEncounterCardProps) {
  const hasDlcRequired = encounters.some((e) => e.dlcRequired);

  return (
    <div className="rounded-md border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-medium">{game.names.fr}</span>
        {hasDlcRequired && (
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-600 dark:text-amber-400">
            DLC requis
          </span>
        )}
        {game.homeTransfer === 'unsupported' && (
          <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">
            ⚠ Pas de transfert vers HOME
          </span>
        )}
      </div>

      {encounters.length === 0 ? (
        <p className="text-sm text-muted-foreground">Pas attrapable dans ce jeu</p>
      ) : (
        <ul className="space-y-1">
          {encounters.map((enc) => {
            const label = METHOD_LABEL[enc.method.type];
            const detail = methodDetail(enc.method);
            const key = `${enc.method.type}-${detail}`;
            return (
              <li key={key} className="flex gap-2 text-sm">
                <span className="shrink-0 font-medium text-muted-foreground">{label}</span>
                {detail && <span className="text-foreground">{detail}</span>}
                {enc.dlcRequired && (
                  <span className="text-xs text-muted-foreground">(DLC: {enc.dlcRequired})</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

type PokemonDetailProps = {
  pokemonId: string | null;
  onClose: () => void;
};

export function PokemonDetail({ pokemonId, onClose }: PokemonDetailProps) {
  const pokemon = useLiveQuery<Pokemon | undefined>(
    () => (pokemonId != null ? db.catalog_pokemon.get(pokemonId) : Promise.resolve(undefined)),
    [pokemonId],
  );

  const allGames = useLiveQuery<Game[]>(() => db.catalog_games.toArray(), []);

  const encounters = useLiveQuery<Encounter[]>(
    () =>
      pokemonId != null
        ? db.catalog_encounters
            .where('[pokemonId+gameId]')
            .between([pokemonId, ''], [pokemonId, '￿'])
            .toArray()
        : Promise.resolve([]),
    [pokemonId],
  );

  const ownedGames = useOwnedGames((s) => s.ownedGames);
  const collection = useCollection((s) => s.collection);
  const toggleOwned = useCollection((s) => s.toggleOwned);

  const [artworkError, setArtworkError] = React.useState(false);

  // Reset artwork error when pokemon changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: pokemonId is a prop, resetting on change is intentional
  React.useEffect(() => {
    setArtworkError(false);
  }, [pokemonId]);

  // Encounters grouped by game
  const encountersByGame = React.useMemo(() => {
    const map = new Map<string, Encounter[]>();
    for (const enc of encounters ?? []) {
      const list = map.get(enc.gameId);
      if (list) list.push(enc);
      else map.set(enc.gameId, [enc]);
    }
    return map;
  }, [encounters]);

  if (pokemonId === null) return null;

  const isLoading = pokemon === undefined || allGames === undefined || encounters === undefined;

  const isOwned =
    !!collection.get(pokemonId) && collection.get(pokemonId)?.homeStatus !== 'missing';

  const ownedGameIds = new Set(ownedGames.map((og) => og.gameId));
  const userGames = (allGames ?? []).filter((g) => ownedGameIds.has(g.id));

  const dexNumber = pokemon ? `#${String(pokemon.nationalDexNumber).padStart(4, '0')}` : '';
  const artworkSrc = pokemon ? `/sprites/artwork/${pokemon.nationalDexNumber}.png` : '';
  const fallbackSrc = pokemon?.sprites.default ? `/sprites/${pokemon.sprites.default}` : '';
  const evolutionText = pokemon ? buildEvolutionText(pokemon) : null;

  return (
    <Dialog
      open={pokemonId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            Chargement…
          </div>
        ) : (
          <>
            {/* Header */}
            <DialogHeader>
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-4">
                {/* Artwork */}
                <div className="shrink-0">
                  <img
                    src={artworkError ? fallbackSrc : artworkSrc}
                    alt={pokemon.names.fr}
                    className="h-32 w-32 object-contain"
                    onError={() => setArtworkError(true)}
                  />
                </div>

                {/* Info */}
                <div className="flex flex-col gap-1 text-center sm:text-left">
                  <DialogTitle className="text-2xl">{pokemon.names.fr}</DialogTitle>
                  <DialogDescription className="text-sm">{pokemon.names.en}</DialogDescription>
                  <p className="text-sm text-muted-foreground">{dexNumber}</p>

                  {/* Types */}
                  <div className="mt-1 flex flex-wrap justify-center gap-1 sm:justify-start">
                    {pokemon.types.map((t) => (
                      <span
                        key={t}
                        className={`rounded px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[t]}`}
                      >
                        {FRENCH_TYPE[t]}
                      </span>
                    ))}
                  </div>

                  {/* Generation */}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Génération {pokemon.generation}
                  </p>
                </div>
              </div>
            </DialogHeader>

            {/* How to obtain */}
            <section>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Comment l&apos;obtenir avec tes jeux
              </h3>

              {userGames.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun jeu sélectionné. Configure tes jeux dans l&apos;onglet Jeux.
                </p>
              ) : (
                <div className="space-y-2">
                  {userGames.map((game) => (
                    <GameEncounterCard
                      key={game.id}
                      game={game}
                      encounters={encountersByGame.get(game.id) ?? []}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Evolution chain */}
            {evolutionText && (
              <section>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Chaîne d&apos;évolution
                </h3>
                <p className="text-sm">{evolutionText}</p>
              </section>
            )}

            {/* Owned toggle */}
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label
                htmlFor="pokemon-owned-toggle"
                className="cursor-pointer text-base font-medium"
              >
                {isOwned ? 'Possédé' : 'Manquant'}
              </Label>
              <Switch
                id="pokemon-owned-toggle"
                checked={isOwned}
                onCheckedChange={() => void toggleOwned(pokemonId)}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
