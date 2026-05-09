import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
const USER_AGENT =
  'PokemonLivingDex-Scraper/0.1.0 (+https://github.com/FabienLacorre/LivingDexHelper)';

export type PokeApiClientOptions = {
  cacheDir: string;
  noCache?: boolean;
  baseUrl?: string;
  rateLimitMs?: number;
};

export class PokeApiClient {
  private readonly cacheDir: string;
  private readonly noCache: boolean;
  private readonly baseUrl: string;
  private readonly rateLimitMs: number;
  private nextRequestAllowedAt = 0;

  constructor(options: PokeApiClientOptions) {
    this.cacheDir = options.cacheDir;
    this.noCache = options.noCache ?? false;
    this.baseUrl = options.baseUrl ?? POKEAPI_BASE;
    this.rateLimitMs = options.rateLimitMs ?? 100;
    mkdirSync(this.cacheDir, { recursive: true });
  }

  async get<T>(path: string): Promise<T> {
    const cachePath = this.cachePathFor(path);
    if (!this.noCache && existsSync(cachePath)) {
      return JSON.parse(readFileSync(cachePath, 'utf8')) as T;
    }
    const data = await this.fetchWithRetry<T>(path);
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf8');
    return data;
  }

  private cachePathFor(path: string): string {
    const sanitized = path.replace(/^\/+/, '').replace(/\/+$/, '');
    return join(this.cacheDir, `${sanitized}.json`);
  }

  private async fetchWithRetry<T>(path: string, attempt = 1): Promise<T> {
    await this.respectRateLimit();
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });

    if (response.ok) {
      return (await response.json()) as T;
    }

    const isRetriable = response.status >= 500 || response.status === 429;
    if (isRetriable && attempt < 3) {
      const backoffMs = 2 ** attempt * 500;
      await sleep(backoffMs);
      return this.fetchWithRetry<T>(path, attempt + 1);
    }

    throw new Error(`PokéAPI ${response.status} ${response.statusText} for ${path}`);
  }

  private async respectRateLimit(): Promise<void> {
    const now = Date.now();
    if (now < this.nextRequestAllowedAt) {
      await sleep(this.nextRequestAllowedAt - now);
    }
    this.nextRequestAllowedAt = Date.now() + this.rateLimitMs;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
