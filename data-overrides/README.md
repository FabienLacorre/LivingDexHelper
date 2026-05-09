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
