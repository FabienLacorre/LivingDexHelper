import type {
  CollectionEntry,
  DatasetMeta,
  Encounter,
  Game,
  OwnedGame,
  Pokemon,
  UserSettings,
} from '@livingdex/types';
import Dexie, { type Table } from 'dexie';

type CatalogMetaRow = { key: 'meta'; value: DatasetMeta };
type UserSettingsRow = { key: 'settings'; value: UserSettings };

export class LivingDexDatabase extends Dexie {
  catalog_meta!: Table<CatalogMetaRow, string>;
  catalog_pokemon!: Table<Pokemon, string>;
  catalog_games!: Table<Game, string>;
  catalog_encounters!: Table<Encounter & { id?: number }, number>;
  user_ownedGames!: Table<OwnedGame, string>;
  user_collection!: Table<CollectionEntry, string>;
  user_settings!: Table<UserSettingsRow, string>;

  constructor() {
    super('livingdex');
    this.version(1).stores({
      catalog_meta: '&key',
      catalog_pokemon: '&id, nationalDexNumber, generation, formCategory',
      catalog_games: '&id, generation',
      catalog_encounters: '++id, pokemonId, gameId, [pokemonId+gameId]',
      user_ownedGames: '&gameId',
      user_collection: '&pokemonId, homeStatus',
      user_settings: '&key',
    });
  }
}

export const db = new LivingDexDatabase();
