import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { db } from '@/db/schema';
import { useOwnedGames } from '@/store/ownedGames';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function Onboarding() {
  const navigate = useNavigate();
  const games = useLiveQuery(() => db.catalog_games.orderBy('generation').toArray(), []);
  const ownedGames = useOwnedGames((s) => s.ownedGames);
  const toggleGame = useOwnedGames((s) => s.toggleGame);
  const toggleDlc = useOwnedGames((s) => s.toggleDlc);
  const [step] = useState<'select'>('select');

  useEffect(() => {
    if (ownedGames.length > 0 && step === 'select') {
      // ownedGames already populated — likely returning user; allow continue
    }
  }, [ownedGames, step]);

  if (!games) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Chargement…
      </div>
    );
  }

  const isOwned = (gameId: string) => ownedGames.some((g) => g.gameId === gameId);
  const hasDlc = (gameId: string, dlcId: string) =>
    ownedGames.find((g) => g.gameId === gameId)?.ownedDlcs.includes(dlcId) ?? false;

  return (
    <div className="container mx-auto max-w-2xl p-6">
      <h1 className="mb-2 text-2xl font-bold">Bienvenue dans Living Dex Helper</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Sélectionne les jeux que tu possèdes pour commencer ton living dex.
      </p>

      <div className="space-y-3">
        {games.map((game) => (
          <Card key={game.id} className={isOwned(game.id) ? 'border-primary' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="flex items-center gap-3 text-base">
                <Checkbox
                  id={`game-${game.id}`}
                  checked={isOwned(game.id)}
                  onCheckedChange={() => void toggleGame(game.id)}
                />
                <label htmlFor={`game-${game.id}`} className="cursor-pointer">
                  {game.names.fr}
                </label>
              </CardTitle>
              <span className="text-xs text-muted-foreground">Gen {game.generation}</span>
            </CardHeader>
            {game.dlcs.length > 0 && isOwned(game.id) && (
              <CardContent className="pt-0">
                <div className="ml-7 space-y-2">
                  {game.dlcs.map((dlc) => (
                    <div key={dlc.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`dlc-${game.id}-${dlc.id}`}
                        checked={hasDlc(game.id, dlc.id)}
                        onCheckedChange={() => void toggleDlc(game.id, dlc.id)}
                      />
                      <label
                        htmlFor={`dlc-${game.id}-${dlc.id}`}
                        className="cursor-pointer text-sm"
                      >
                        {dlc.names.fr}
                      </label>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <div className="mt-8 flex justify-end">
        <Button
          onClick={() => navigate('/dex')}
          disabled={ownedGames.length === 0}
          size="lg"
          className="gap-2"
        >
          <Check className="h-4 w-4" />
          Continuer ({ownedGames.length} jeu{ownedGames.length !== 1 ? 'x' : ''})
        </Button>
      </div>
    </div>
  );
}
