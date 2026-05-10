import { db } from '@/db/schema';
import { EMPTY_FILTERS, matchesGeneration, matchesSearch, matchesType } from '@/lib/filters';
import { useCollection } from '@/store/collection';
import { useOwnedGames } from '@/store/ownedGames';
import { useSettings } from '@/store/settings';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { FiltersBar } from './FiltersBar';
import { PokemonCard } from './PokemonCard';

export function DexScreen() {
  const pokemon = useLiveQuery(() => db.catalog_pokemon.orderBy('nationalDexNumber').toArray(), []);
  const games = useLiveQuery(() => db.catalog_games.toArray(), []);
  const allEncounters = useLiveQuery(() => db.catalog_encounters.toArray(), []);
  const ownedGames = useOwnedGames((s) => s.ownedGames);
  const collection = useCollection((s) => s.collection);
  const toggleOwned = useCollection((s) => s.toggleOwned);
  const soloMode = useSettings((s) => s.settings.soloMode);
  const granularity = useSettings((s) => s.settings.granularity);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const filteredPokemon = useMemo(() => {
    if (!pokemon) return [];
    return pokemon.filter((p) => {
      if (!granularity.includeRegionalForms && p.formCategory === 'regional') return false;
      if (!granularity.includeGigamax && p.formCategory === 'gigamax') return false;
      if (!granularity.includeAltForms && p.formCategory === 'alt') return false;
      if (!granularity.includeGenderDifferences && p.formCategory === 'gender') return false;
      if (p.formCategory === 'cosmetic') return false;
      if (!matchesSearch(p, filters.search)) return false;
      if (!matchesGeneration(p, filters.generations)) return false;
      if (!matchesType(p, filters.types)) return false;
      return true;
    });
  }, [pokemon, granularity, filters]);

  if (!pokemon || !games || !allEncounters) {
    return <div className="p-8 text-sm text-muted-foreground">Chargement du dex…</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">Living Dex</h1>
        <p className="text-sm text-muted-foreground">{filteredPokemon.length} Pokémon affichés</p>
      </header>

      <FiltersBar filters={filters} onChange={setFilters} />

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
        {filteredPokemon.map((p) => (
          <PokemonCard
            key={p.id}
            pokemon={p}
            inputs={{
              encounters: allEncounters.filter((e) => e.pokemonId === p.id),
              games,
              ownedGames,
              soloMode,
              collection: collection.get(p.id),
            }}
            onClick={() => void toggleOwned(p.id)}
          />
        ))}
      </div>
    </div>
  );
}
