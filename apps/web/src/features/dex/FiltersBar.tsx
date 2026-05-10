import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import type { DexFilters } from '@/lib/filters';

const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function FiltersBar({
  filters,
  onChange,
}: {
  filters: DexFilters;
  onChange: (next: DexFilters) => void;
}) {
  const toggleGen = (gen: number) => {
    const next = new Set(filters.generations);
    if (next.has(gen)) next.delete(gen);
    else next.add(gen);
    onChange({ ...filters, generations: next });
  };

  const clearAll = () => onChange({ search: '', statuses: new Set(), generations: new Set(), types: new Set() });

  const hasFilters = filters.search.length > 0 || filters.generations.size > 0;

  return (
    <div className="sticky top-0 z-10 -mx-4 mb-4 flex flex-col gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher (nom, n°, slug)…"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="pl-8"
        />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-xs text-muted-foreground">Gen :</span>
        {GENERATIONS.map((g) => (
          <button
            key={g}
            onClick={() => toggleGen(g)}
            className={cn(
              'rounded-md border px-2 py-0.5 text-xs transition-colors',
              filters.generations.has(g)
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background hover:bg-accent',
            )}
          >
            {g}
          </button>
        ))}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="ml-auto h-7 gap-1 text-xs">
            <X className="h-3 w-3" />
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
