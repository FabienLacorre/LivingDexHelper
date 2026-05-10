import type { Game, Pokemon } from '@livingdex/types';
import { describe, expect, it } from 'vitest';
import { type StatusInputs, computeStatus } from './computeStatus';

const baseGame = (
  overrides: Partial<Game> & Pick<Game, 'id' | 'pairedVersionId' | 'supportsLinkingCord'>,
): Game => ({
  names: { en: '', fr: '' },
  generation: 8,
  platform: 'switch',
  releaseDate: '',
  dlcs: [],
  homeTransfer: 'direct',
  ...overrides,
});

const sword = baseGame({ id: 'sword', pairedVersionId: 'shield', supportsLinkingCord: true });
const shield = baseGame({ id: 'shield', pairedVersionId: 'sword', supportsLinkingCord: true });
const frlg = baseGame({ id: 'frlg-fr', pairedVersionId: 'frlg-lg', supportsLinkingCord: false });

const basePokemon = (id: string, overrides: Partial<Pokemon> = {}): Pokemon => ({
  id,
  nationalDexNumber: 1,
  speciesSlug: id,
  formId: null,
  formCategory: 'default',
  names: { en: id, fr: id },
  types: ['normal'],
  generation: 1,
  sprites: { default: '', shiny: '', artwork: '', icon: '' },
  evolutions: [],
  ...overrides,
});

describe('computeStatus', () => {
  it('returns "owned" when collection.homeStatus is caught', () => {
    const input: StatusInputs = {
      pokemon: basePokemon('pikachu'),
      encounters: [],
      games: [sword],
      ownedGames: [{ gameId: 'sword', ownedDlcs: [] }],
      soloMode: false,
      collection: { pokemonId: 'pikachu', homeStatus: 'caught', updatedAt: '' },
    };
    expect(computeStatus(input)).toBe('owned');
  });

  it('returns "available" when an obtainable encounter exists in an owned game', () => {
    const input: StatusInputs = {
      pokemon: basePokemon('pikachu'),
      encounters: [
        { pokemonId: 'pikachu', gameId: 'sword', method: { type: 'wild', locations: ['Route 4'] } },
      ],
      games: [sword],
      ownedGames: [{ gameId: 'sword', ownedDlcs: [] }],
      soloMode: false,
      collection: undefined,
    };
    expect(computeStatus(input)).toBe('available');
  });

  it('returns "unavailable" when no encounter in any owned game and no paired version', () => {
    const input: StatusInputs = {
      pokemon: basePokemon('pikachu'),
      encounters: [
        { pokemonId: 'pikachu', gameId: 'shield', method: { type: 'wild', locations: ['x'] } },
      ],
      games: [sword, shield],
      ownedGames: [],
      soloMode: false,
      collection: undefined,
    };
    expect(computeStatus(input)).toBe('unavailable');
  });

  it('returns "version-exclusive" when only paired version has encounter', () => {
    const input: StatusInputs = {
      pokemon: basePokemon('pikachu'),
      encounters: [
        { pokemonId: 'pikachu', gameId: 'shield', method: { type: 'wild', locations: ['x'] } },
      ],
      games: [sword, shield],
      ownedGames: [{ gameId: 'sword', ownedDlcs: [] }],
      soloMode: false,
      collection: undefined,
    };
    expect(computeStatus(input)).toBe('version-exclusive');
  });

  it('respects DLC requirement', () => {
    const input: StatusInputs = {
      pokemon: basePokemon('pikachu'),
      encounters: [
        {
          pokemonId: 'pikachu',
          gameId: 'sword',
          dlcRequired: 'isle-of-armor',
          method: { type: 'wild', locations: ['x'] },
        },
      ],
      games: [sword],
      ownedGames: [{ gameId: 'sword', ownedDlcs: [] }],
      soloMode: false,
      collection: undefined,
    };
    expect(computeStatus(input)).toBe('unavailable');
  });

  it('returns "available" when DLC is owned', () => {
    const input: StatusInputs = {
      pokemon: basePokemon('pikachu'),
      encounters: [
        {
          pokemonId: 'pikachu',
          gameId: 'sword',
          dlcRequired: 'isle-of-armor',
          method: { type: 'wild', locations: ['x'] },
        },
      ],
      games: [sword],
      ownedGames: [{ gameId: 'sword', ownedDlcs: ['isle-of-armor'] }],
      soloMode: false,
      collection: undefined,
    };
    expect(computeStatus(input)).toBe('available');
  });

  it('soloMode + only in-game-trade encounter → blocked-solo', () => {
    const input: StatusInputs = {
      pokemon: basePokemon('pikachu'),
      encounters: [
        { pokemonId: 'pikachu', gameId: 'sword', method: { type: 'in-game-trade', npc: 'Bob' } },
      ],
      games: [sword],
      ownedGames: [{ gameId: 'sword', ownedDlcs: [] }],
      soloMode: true,
      collection: undefined,
    };
    expect(computeStatus(input)).toBe('blocked-solo');
  });

  it('soloMode false + in-game-trade encounter → available', () => {
    const input: StatusInputs = {
      pokemon: basePokemon('pikachu'),
      encounters: [{ pokemonId: 'pikachu', gameId: 'sword', method: { type: 'in-game-trade' } }],
      games: [sword],
      ownedGames: [{ gameId: 'sword', ownedDlcs: [] }],
      soloMode: false,
      collection: undefined,
    };
    expect(computeStatus(input)).toBe('available');
  });

  it('event encounter → event status (regardless of soloMode)', () => {
    const input: StatusInputs = {
      pokemon: basePokemon('mew'),
      encounters: [
        { pokemonId: 'mew', gameId: 'sword', method: { type: 'event', distributedAs: 'X' } },
      ],
      games: [sword],
      ownedGames: [{ gameId: 'sword', ownedDlcs: [] }],
      soloMode: false,
      collection: undefined,
    };
    expect(computeStatus(input)).toBe('event');
  });

  it('soloMode + trade evolution but owned game supports Linking Cord → available', () => {
    const pokemon = basePokemon('alakazam', {
      evolutions: [
        {
          fromId: 'kadabra',
          toId: 'alakazam',
          method: 'trade',
          conditions: [],
          soloAlternative: 'linking-cord',
        },
      ],
    });
    const input: StatusInputs = {
      pokemon,
      encounters: [
        {
          pokemonId: 'alakazam',
          gameId: 'sword',
          method: { type: 'evolution', fromId: 'kadabra' },
        },
      ],
      games: [sword],
      ownedGames: [{ gameId: 'sword', ownedDlcs: [] }],
      soloMode: true,
      collection: undefined,
    };
    expect(computeStatus(input)).toBe('available');
  });

  it('soloMode + trade evolution in FRLG (no Linking Cord) → blocked-solo', () => {
    const pokemon = basePokemon('alakazam', {
      evolutions: [
        {
          fromId: 'kadabra',
          toId: 'alakazam',
          method: 'trade',
          conditions: [],
          soloAlternative: 'linking-cord',
        },
      ],
    });
    const input: StatusInputs = {
      pokemon,
      encounters: [
        {
          pokemonId: 'alakazam',
          gameId: 'frlg-fr',
          method: { type: 'evolution', fromId: 'kadabra' },
        },
      ],
      games: [frlg],
      ownedGames: [{ gameId: 'frlg-fr', ownedDlcs: [] }],
      soloMode: true,
      collection: undefined,
    };
    expect(computeStatus(input)).toBe('blocked-solo');
  });
});
