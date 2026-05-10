import { ThemeProvider } from '@/components/layout/ThemeProvider';
import { db } from '@/db/schema';
import { seedCatalogIfNeeded } from '@/db/seed';
import { routes } from '@/routes/routes';
import { useCollection } from '@/store/collection';
import { useOwnedGames } from '@/store/ownedGames';
import { useSettings } from '@/store/settings';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import './index.css';

const router = createBrowserRouter(routes);

function Bootstrap() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await seedCatalogIfNeeded(db, '/dataset.json');
        await Promise.all([
          useSettings.getState().hydrate(),
          useOwnedGames.getState().hydrate(),
          useCollection.getState().hydrate(),
        ]);
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          Erreur de chargement : {error}
        </div>
      </div>
    );
  }
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">Chargement…</div>
      </div>
    );
  }
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found');

createRoot(rootElement).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
