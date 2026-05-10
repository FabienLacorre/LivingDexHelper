import { db } from '@/db/schema';
import { computeStatus } from '@/lib/computeStatus';
import { useSettings } from '@/store/settings';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { GameCard } from './GameCard';

export function GamesScreen() {
  const games = useLiveQuery(() => db.catalog_games.orderBy('generation').toArray(), []);
  const pokemon = useLiveQuery(() => db.catalog_pokemon.toArray(), []);
  const encounters = useLiveQuery(() => db.catalog_encounters.toArray(), []);
  const soloMode = useSettings((s) => s.settings.soloMode);
  const granularity = useSettings((s) => s.settings.granularity);

  const considered = useMemo(() => {
    if (!pokemon) return [];
    return pokemon.filter((p) => {
      if (!granularity.includeRegionalForms && p.formCategory === 'regional') return false;
      if (!granularity.includeGigamax && p.formCategory === 'gigamax') return false;
      if (!granularity.includeAltForms && p.formCategory === 'alt') return false;
      if (!granularity.includeGenderDifferences && p.formCategory === 'gender') return false;
      return p.formCategory !== 'cosmetic';
    });
  }, [pokemon, granularity]);

  const perGameObtainable = useMemo(() => {
    if (!games || !encounters) return new Map<string, number>();
    const result = new Map<string, number>();
    for (const game of games) {
      let count = 0;
      // Treat each game as if only it were owned (so we get a per-game "potential" count)
      const fakeOwned = [{ gameId: game.id, ownedDlcs: game.dlcs.map((d) => d.id) }];
      for (const p of considered) {
        const status = computeStatus({
          pokemon: p,
          encounters: encounters.filter((e) => e.pokemonId === p.id),
          games,
          ownedGames: fakeOwned,
          soloMode,
          collection: undefined,
        });
        if (status === 'available') count++;
      }
      result.set(game.id, count);
    }
    return result;
  }, [games, encounters, considered, soloMode]);

  if (!games) return <div className="p-8 text-sm text-muted-foreground">Chargement…</div>;

  return (
    <div className="container mx-auto p-4">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Mes jeux</h1>
        <p className="text-sm text-muted-foreground">
          Coche les jeux que tu possèdes. Le compteur montre les Pokémon attrapables si seulement ce
          jeu était possédé (en supposant tous les DLC).
        </p>
      </header>

      <div className="space-y-3">
        {games.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            obtainableCount={perGameObtainable.get(game.id) ?? 0}
            totalConsidered={considered.length}
          />
        ))}
      </div>
    </div>
  );
}
