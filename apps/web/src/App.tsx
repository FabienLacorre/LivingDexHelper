import { datasetMeta } from '@livingdex/data';

function formatVersion(iso: string): string {
  if (iso === '1970-01-01T00:00:00.000Z') return 'no dataset yet';
  return new Date(iso).toLocaleString('fr-FR');
}

export function App() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold">Living Dex Helper</h1>
        <p className="mt-4 text-slate-600 dark:text-slate-400">
          Dataset version: <code className="text-sm">{formatVersion(datasetMeta.version)}</code>
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Pokémon" value={datasetMeta.pokemonCount.toLocaleString('fr-FR')} />
          <Stat label="Encounters" value={datasetMeta.encountersCount.toLocaleString('fr-FR')} />
          <Stat label="Generations" value={datasetMeta.generations.length} />
          <Stat label="Schema" value={`v${datasetMeta.schemaVersion}`} />
        </div>
        <p className="mt-6 text-xs text-slate-500 dark:text-slate-500">
          Sources:{' '}
          {datasetMeta.scrapedFrom.length === 0 ? 'none' : datasetMeta.scrapedFrom.join(', ')}
        </p>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-800">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </div>
    </div>
  );
}
