export type PokemonType =
  | 'normal'
  | 'fire'
  | 'water'
  | 'grass'
  | 'electric'
  | 'ice'
  | 'fighting'
  | 'poison'
  | 'ground'
  | 'flying'
  | 'psychic'
  | 'bug'
  | 'rock'
  | 'ghost'
  | 'dragon'
  | 'dark'
  | 'steel'
  | 'fairy';

export type FormCategory = 'default' | 'regional' | 'gigamax' | 'alt' | 'gender' | 'cosmetic';

export type LocalizedNames = {
  en: string;
  fr: string;
};

export type PokemonSprites = {
  default: string;
  shiny: string;
  artwork: string;
  icon: string;
};

export type EvolutionMethod =
  | 'level'
  | 'item'
  | 'trade'
  | 'friendship'
  | 'location'
  | 'move'
  | 'other';

export type EvolutionConditionType =
  | 'minLevel'
  | 'item'
  | 'tradeWith'
  | 'tradeItem'
  | 'friendship'
  | 'location'
  | 'timeOfDay'
  | 'move'
  | 'special';

export type EvolutionCondition = {
  type: EvolutionConditionType;
  value: string | number;
};

export type EvolutionLink = {
  fromId: string;
  toId: string;
  method: EvolutionMethod;
  conditions: EvolutionCondition[];
  soloAlternative?: 'linking-cord' | 'item' | null;
};

export type Pokemon = {
  id: string;
  nationalDexNumber: number;
  speciesSlug: string;
  formId: string | null;
  formCategory: FormCategory;
  names: LocalizedNames;
  types: PokemonType[];
  generation: number;
  sprites: PokemonSprites;
  evolutions: EvolutionLink[];
};
