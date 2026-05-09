import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Dataset } from '@livingdex/types';
import { validateDataset } from './validator.ts';

export type WriteOptions = {
  outDir: string;
};

export async function writeDataset(dataset: Dataset, options: WriteOptions): Promise<void> {
  validateDataset(dataset);
  mkdirSync(options.outDir, { recursive: true });
  writeFileSync(join(options.outDir, 'dataset.json'), JSON.stringify(dataset, null, 2), 'utf8');
  writeFileSync(
    join(options.outDir, 'dataset-meta.json'),
    JSON.stringify(dataset.meta, null, 2),
    'utf8',
  );
}
