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
