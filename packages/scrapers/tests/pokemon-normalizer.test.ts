import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { classifyForm, normalizePokemon } from '../src/normalizers/pokemon.ts';

const FIXTURES = join(import.meta.dirname, 'fixtures');
const speciesPikachu = JSON.parse(
  readFileSync(join(FIXTURES, 'pokeapi-species-pikachu.json'), 'utf8'),
);
const pokemonPikachu = JSON.parse(
  readFileSync(join(FIXTURES, 'pokeapi-pokemon-pikachu.json'), 'utf8'),
);
const pokemonRaichuAlola = JSON.parse(
  readFileSync(join(FIXTURES, 'pokeapi-pokemon-raichu-alola.json'), 'utf8'),
);
const pokemonCharizardGmax = JSON.parse(
  readFileSync(join(FIXTURES, 'pokeapi-pokemon-charizard-gmax.json'), 'utf8'),
);

describe('classifyForm', () => {
  it('default form when slug == speciesSlug', () => {
    expect(classifyForm('pikachu', 'pikachu')).toBe('default');
  });
  it('regional for -alola / -galar / -hisui / -paldea suffixes', () => {
    expect(classifyForm('raichu-alola', 'raichu')).toBe('regional');
    expect(classifyForm('ponyta-galar', 'ponyta')).toBe('regional');
    expect(classifyForm('typhlosion-hisui', 'typhlosion')).toBe('regional');
    expect(classifyForm('tauros-paldea-combat', 'tauros')).toBe('regional');
  });
  it('gigamax for -gmax suffix', () => {
    expect(classifyForm('charizard-gmax', 'charizard')).toBe('gigamax');
  });
  it('alt for known alt-form prefixes', () => {
    expect(classifyForm('deoxys-attack', 'deoxys')).toBe('alt');
    expect(classifyForm('kyurem-black', 'kyurem')).toBe('alt');
    expect(classifyForm('necrozma-ultra', 'necrozma')).toBe('alt');
    expect(classifyForm('calyrex-ice', 'calyrex')).toBe('alt');
    expect(classifyForm('ogerpon-wellspring-mask', 'ogerpon')).toBe('alt');
  });
  it('cosmetic for -mega / -primal / -totem (will be filtered out by isExcluded)', () => {
    expect(classifyForm('mewtwo-mega-x', 'mewtwo')).toBe('cosmetic');
    expect(classifyForm('rayquaza-mega', 'rayquaza')).toBe('cosmetic');
  });
});

describe('normalizePokemon', () => {
  it('produces a default Pokemon entry from species + default variety', () => {
    const result = normalizePokemon(speciesPikachu, pokemonPikachu);
    expect(result).toMatchObject({
      id: 'pikachu',
      nationalDexNumber: 25,
      speciesSlug: 'pikachu',
      formId: null,
      formCategory: 'default',
      types: ['electric'],
      generation: 1,
    });
    expect(result?.names.en).toBe('Pikachu');
    expect(result?.names.fr).toBe('Pikachu');
    expect(result?.sprites.default).toMatch(/\.png$/);
  });

  it('produces a regional Pokemon entry for raichu-alola', () => {
    const result = normalizePokemon(speciesPikachu, pokemonRaichuAlola, {
      forceSpeciesSlug: 'raichu',
    });
    expect(result).toMatchObject({
      id: 'raichu-alola',
      formId: 'alola',
      formCategory: 'regional',
    });
  });

  it('returns null for excluded forms (mega, totem)', () => {
    const totem = { ...pokemonPikachu, name: 'pikachu-totem' };
    const result = normalizePokemon(speciesPikachu, totem);
    expect(result).toBeNull();
  });

  it('produces a gigamax Pokemon entry', () => {
    const speciesCharizard = {
      ...speciesPikachu,
      id: 6,
      name: 'charizard',
      names: [
        { language: { name: 'en' }, name: 'Charizard' },
        { language: { name: 'fr' }, name: 'Dracaufeu' },
      ],
      generation: { name: 'generation-i' },
    };
    const result = normalizePokemon(speciesCharizard, pokemonCharizardGmax);
    expect(result?.formCategory).toBe('gigamax');
    expect(result?.formId).toBe('gmax');
  });
});
