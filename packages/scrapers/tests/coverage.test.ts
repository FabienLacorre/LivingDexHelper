import { describe, it, expect } from 'vitest';
import { generateCoverageReport } from '../src/output/coverage.ts';
import type { Pokemon, Encounter } from '@livingdex/types';

const samplePokemon: Pokemon[] = [
  {
    id: 'pikachu',
    nationalDexNumber: 25,
    speciesSlug: 'pikachu',
    formId: null,
    formCategory: 'default',
    names: { en: 'Pikachu', fr: 'Pikachu' },
    types: ['electric'],
    generation: 1,
    sprites: { default: '', shiny: '', artwork: '', icon: '' },
    evolutions: [],
  },
  {
    id: 'mew',
    nationalDexNumber: 151,
    speciesSlug: 'mew',
    formId: null,
    formCategory: 'default',
    names: { en: 'Mew', fr: 'Mew' },
    types: ['psychic'],
    generation: 1,
    sprites: { default: '', shiny: '', artwork: '', icon: '' },
    evolutions: [],
  },
];

const sampleEncounters: Encounter[] = [
  {
    pokemonId: 'pikachu',
    gameId: 'sword',
    method: { type: 'wild', locations: ['Route 4'] },
  },
];

describe('generateCoverageReport', () => {
  it('counts total Pokémon and those with at least one encounter', () => {
    const report = generateCoverageReport(samplePokemon, sampleEncounters);
    expect(report.totalPokemon).toBe(2);
    expect(report.pokemonWithAnyEncounter).toBe(1);
    expect(report.pokemonWithoutEncounter).toEqual(['mew']);
  });

  it('breaks down by game', () => {
    const report = generateCoverageReport(samplePokemon, sampleEncounters);
    const swordCoverage = report.byGame.find((g) => g.gameId === 'sword');
    expect(swordCoverage).toBeDefined();
    expect(swordCoverage?.encounterCount).toBe(1);
  });

  it('returns empty report for empty inputs', () => {
    const report = generateCoverageReport([], []);
    expect(report.totalPokemon).toBe(0);
    expect(report.pokemonWithAnyEncounter).toBe(0);
    expect(report.pokemonWithoutEncounter).toEqual([]);
  });
});
