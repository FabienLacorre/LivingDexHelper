import type { Dataset, DatasetMeta } from '@livingdex/types';
import datasetMetaJson from '../dataset-meta.json';
import datasetJson from '../dataset.json';

export const dataset: Dataset = datasetJson as Dataset;
export const datasetMeta: DatasetMeta = datasetMetaJson as DatasetMeta;
