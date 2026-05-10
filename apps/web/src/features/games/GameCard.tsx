import type { Game } from '@livingdex/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useOwnedGames } from '@/store/ownedGames';

export function GameCard({
  game,
  obtainableCount,
  totalConsidered,
}: {
  game: Game;
  obtainableCount: number;
  totalConsidered: number;
}) {
  const ownedGames = useOwnedGames((s) => s.ownedGames);
  const toggleGame = useOwnedGames((s) => s.toggleGame);
  const toggleDlc = useOwnedGames((s) => s.toggleDlc);

  const owned = ownedGames.find((g) => g.gameId === game.id);
  const isOwned = !!owned;

  return (
    <Card className={isOwned ? 'border-primary' : 'opacity-70'}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-3 text-base">
          <Checkbox
            id={`g-${game.id}`}
            checked={isOwned}
            onCheckedChange={() => void toggleGame(game.id)}
          />
          <label htmlFor={`g-${game.id}`} className="cursor-pointer">
            {game.names.fr}
          </label>
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          Gen {game.generation} · {game.homeTransfer === 'unsupported' ? '⚠ pas vers HOME' : '→ HOME OK'}
        </span>
      </CardHeader>
      <CardContent>
        {game.dlcs.length > 0 && isOwned && (
          <div className="mb-3 ml-7 space-y-1">
            {game.dlcs.map((dlc) => (
              <div key={dlc.id} className="flex items-center gap-2">
                <Checkbox
                  id={`d-${game.id}-${dlc.id}`}
                  checked={owned?.ownedDlcs.includes(dlc.id) ?? false}
                  onCheckedChange={() => void toggleDlc(game.id, dlc.id)}
                />
                <label htmlFor={`d-${game.id}-${dlc.id}`} className="cursor-pointer text-sm">
                  {dlc.names.fr}
                </label>
              </div>
            ))}
          </div>
        )}
        {isOwned && (
          <div className="text-sm text-muted-foreground">
            {obtainableCount} / {totalConsidered} attrapables avec ta config actuelle
          </div>
        )}
      </CardContent>
    </Card>
  );
}
