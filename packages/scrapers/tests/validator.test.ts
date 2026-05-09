import { describe, expect, it } from 'vitest';
import { validateDataset, validatePokemon } from '../src/output/validator.ts';

describe('validateDataset', () => {
  it('accepts an empty valid dataset', () => {
    const dataset = {
      meta: {
        version: '2026-05-09T14:30:00.000Z',
        schemaVersion: 1,
        scrapedFrom: ['pokeapi'],
        generations: [1],
        pokemonCount: 0,
        encountersCount: 0,
      },
      pokemon: [],
      games: [],
      encounters: [],
    };
    expect(() => validateDataset(dataset)).not.toThrow();
  });

  it('rejects a dataset missing the meta block', () => {
    const dataset = { pokemon: [], games: [], encounters: [] };
    expect(() => validateDataset(dataset)).toThrow();
  });

  it('rejects a Pokemon with missing names', () => {
    const pokemon = {
      id: 'pikachu',
      nationalDexNumber: 25,
      speciesSlug: 'pikachu',
      formId: null,
      formCategory: 'default',
      names: { en: 'Pikachu' },
      types: ['electric'],
      generation: 1,
      sprites: { default: '', shiny: '', artwork: '', icon: '' },
      evolutions: [],
    };
    expect(() => validatePokemon(pokemon)).toThrow();
  });

  it('rejects a Pokemon with an unknown type', () => {
    const pokemon = {
      id: 'pikachu',
      nationalDexNumber: 25,
      speciesSlug: 'pikachu',
      formId: null,
      formCategory: 'default',
      names: { en: 'Pikachu', fr: 'Pikachu' },
      types: ['lightning'],
      generation: 1,
      sprites: { default: '', shiny: '', artwork: '', icon: '' },
      evolutions: [],
    };
    expect(() => validatePokemon(pokemon)).toThrow();
  });
});
