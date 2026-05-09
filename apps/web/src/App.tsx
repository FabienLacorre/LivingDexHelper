import { datasetMeta } from '@livingdex/data';

export function App() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold">Living Dex Helper</h1>
        <p className="mt-4 text-slate-600 dark:text-slate-400">
          Bootstrap OK. Dataset version: <code>{datasetMeta.version}</code>
        </p>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          {datasetMeta.pokemonCount} Pokémon · {datasetMeta.encountersCount} encounters
        </p>
      </div>
    </main>
  );
}
