import type { EvolutionCondition, EvolutionLink, EvolutionMethod } from '@livingdex/types';
import type { PokeApiClient } from './client.ts';

type ChainLink = {
  species: { name: string };
  evolves_to: ChainLink[];
  evolution_details?: Array<{
    min_level?: number | null;
    item?: { name: string } | null;
    held_item?: { name: string } | null;
    trigger?: { name: string };
    min_happiness?: number | null;
    location?: { name: string } | null;
    time_of_day?: string | null;
    known_move?: { name: string } | null;
    trade_species?: { name: string } | null;
  }>;
};

type EvolutionChain = { id: number; chain: ChainLink };

export async function fetchEvolutionLinks(
  client: PokeApiClient,
  chainId: number,
): Promise<EvolutionLink[]> {
  const chain = await client.get<EvolutionChain>(`/evolution-chain/${chainId}`);
  const links: EvolutionLink[] = [];
  walk(chain.chain, links);
  return links;
}

function walk(node: ChainLink, out: EvolutionLink[]): void {
  for (const child of node.evolves_to) {
    for (const detail of child.evolution_details ?? []) {
      const trigger = detail.trigger?.name ?? 'level-up';
      const conditions: EvolutionCondition[] = [];
      let method: EvolutionMethod = 'other';

      if (detail.min_level != null) conditions.push({ type: 'minLevel', value: detail.min_level });
      if (detail.item) {
        method = 'item';
        conditions.push({ type: 'item', value: detail.item.name });
      }
      if (detail.held_item) conditions.push({ type: 'tradeItem', value: detail.held_item.name });
      if (detail.min_happiness != null) {
        method = 'friendship';
        conditions.push({ type: 'friendship', value: detail.min_happiness });
      }
      if (detail.location) {
        method = 'location';
        conditions.push({ type: 'location', value: detail.location.name });
      }
      if (detail.time_of_day) conditions.push({ type: 'timeOfDay', value: detail.time_of_day });
      if (detail.known_move) {
        method = 'move';
        conditions.push({ type: 'move', value: detail.known_move.name });
      }
      if (detail.trade_species)
        conditions.push({ type: 'tradeWith', value: detail.trade_species.name });

      if (trigger === 'trade') method = 'trade';
      else if (trigger === 'level-up' && method === 'other' && detail.min_level != null) {
        method = 'level';
      }

      const link: EvolutionLink = {
        fromId: node.species.name,
        toId: child.species.name,
        method,
        conditions,
        ...(method === 'trade' ? { soloAlternative: 'linking-cord' as const } : {}),
      };
      out.push(link);
    }
    walk(child, out);
  }
}
