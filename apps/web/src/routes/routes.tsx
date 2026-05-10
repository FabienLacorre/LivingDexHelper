import { Navigate, Outlet, type RouteObject } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { BottomNav } from '@/components/layout/BottomNav';
import { Onboarding } from '@/features/onboarding/Onboarding';
import { DexScreen } from '@/features/dex/DexScreen';
import { GamesScreen } from '@/features/games/GamesScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { useOwnedGames } from '@/store/ownedGames';

function ProtectedShell() {
  const ownedGames = useOwnedGames((s) => s.ownedGames);
  const hydrated = useOwnedGames((s) => s.hydrated);
  if (!hydrated) return null;
  if (ownedGames.length === 0) return <Navigate to="/onboarding" replace />;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

export const routes: RouteObject[] = [
  { path: '/onboarding', element: <Onboarding /> },
  {
    path: '/',
    element: <ProtectedShell />,
    children: [
      { index: true, element: <Navigate to="/dex" replace /> },
      { path: 'dex', element: <DexScreen /> },
      { path: 'jeux', element: <GamesScreen /> },
      { path: 'reglages', element: <SettingsScreen /> },
    ],
  },
];
