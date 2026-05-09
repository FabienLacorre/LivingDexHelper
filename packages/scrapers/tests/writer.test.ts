import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Dataset } from '@livingdex/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeDataset } from '../src/output/writer.ts';

let outDir: string;

beforeEach(() => {
  outDir = mkdtempSync(join(tmpdir(), 'dataset-out-'));
});

afterEach(() => {
  rmSync(outDir, { recursive: true, force: true });
});

describe('writeDataset', () => {
  const dataset: Dataset = {
    meta: {
      version: '2026-05-09T14:30:00.000Z',
      schemaVersion: 1,
      scrapedFrom: ['pokeapi'],
      generations: [1],
      pokemonCount: 1,
      encountersCount: 0,
    },
    pokemon: [
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
    ],
    games: [],
    encounters: [],
  };

  it('writes dataset.json and dataset-meta.json', async () => {
    await writeDataset(dataset, { outDir });
    expect(existsSync(join(outDir, 'dataset.json'))).toBe(true);
    expect(existsSync(join(outDir, 'dataset-meta.json'))).toBe(true);

    const written = JSON.parse(readFileSync(join(outDir, 'dataset.json'), 'utf8'));
    expect(written.meta.pokemonCount).toBe(1);
    expect(written.pokemon).toHaveLength(1);

    const meta = JSON.parse(readFileSync(join(outDir, 'dataset-meta.json'), 'utf8'));
    expect(meta).toEqual(dataset.meta);
  });

  it('throws when dataset fails Zod validation', async () => {
    const broken = { ...dataset, pokemon: [{ ...dataset.pokemon[0], types: ['lightning'] }] };
    await expect(writeDataset(broken as unknown as Dataset, { outDir })).rejects.toThrow();
  });
});
