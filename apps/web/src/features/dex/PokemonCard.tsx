import { cn } from '@/lib/cn';
import { type PokemonStatus, type StatusInputs, computeStatus } from '@/lib/computeStatus';
import type { Pokemon } from '@livingdex/types';
import { useMemo } from 'react';

const STATUS_BORDER: Record<PokemonStatus, string> = {
  owned: 'border-status-owned shadow-status-owned/30',
  available: 'border-status-available',
  'blocked-solo': 'border-status-blocked-solo',
  event: 'border-status-event',
  'version-exclusive': 'border-status-blocked-solo border-dashed',
  unavailable: 'border-status-unavailable opacity-60',
};

export function PokemonCard({
  pokemon,
  inputs,
  onClick,
}: {
  pokemon: Pokemon;
  inputs: Omit<StatusInputs, 'pokemon'>;
  onClick: () => void;
}) {
  const status = useMemo(() => computeStatus({ ...inputs, pokemon }), [inputs, pokemon]);
  const spriteSrc = pokemon.sprites.default ? `/sprites/${pokemon.sprites.default}` : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex aspect-square flex-col items-center justify-center rounded-lg border-2 bg-card p-2 text-center transition-all hover:scale-105 hover:shadow-md',
        STATUS_BORDER[status],
      )}
      title={`${pokemon.names.fr} (#${String(pokemon.nationalDexNumber).padStart(4, '0')}) — ${status}`}
    >
      <div className="text-[0.625rem] text-muted-foreground">
        #{String(pokemon.nationalDexNumber).padStart(4, '0')}
      </div>
      {spriteSrc ? (
        <img
          src={spriteSrc}
          alt={pokemon.names.fr}
          className="h-16 w-16 object-contain"
          loading="lazy"
        />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center text-xs text-muted-foreground">
          ?
        </div>
      )}
      <div className="mt-1 line-clamp-1 text-xs font-medium">{pokemon.names.fr}</div>
    </button>
  );
}
