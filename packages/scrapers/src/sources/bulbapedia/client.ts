import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const BULBAPEDIA_BASE = 'https://bulbapedia.bulbagarden.net/w/api.php';
const USER_AGENT =
  'PokemonLivingDex-Scraper/0.3.0 (+https://github.com/FabienLacorre/LivingDexHelper)';

export type BulbapediaClientOptions = {
  cacheDir: string;
  noCache?: boolean;
  baseUrl?: string;
  rateLimitMs?: number;
};

type ParseApiResponse = {
  parse?: { wikitext?: { '*': string } };
  error?: { code: string; info?: string };
};

export class BulbapediaClient {
  private readonly cacheDir: string;
  private readonly noCache: boolean;
  private readonly baseUrl: string;
  private readonly rateLimitMs: number;
  private nextRequestAllowedAt = 0;

  constructor(options: BulbapediaClientOptions) {
    this.cacheDir = options.cacheDir;
    this.noCache = options.noCache ?? false;
    this.baseUrl = options.baseUrl ?? BULBAPEDIA_BASE;
    this.rateLimitMs = options.rateLimitMs ?? 1000;
    mkdirSync(this.cacheDir, { recursive: true });
  }

  async getWikitext(pageTitle: string): Promise<string> {
    const cachePath = this.cachePathFor(pageTitle);
    if (!this.noCache && existsSync(cachePath)) {
      return readFileSync(cachePath, 'utf8');
    }

    await this.respectRateLimit();
    const url = new URL(this.baseUrl);
    url.searchParams.set('action', 'parse');
    url.searchParams.set('page', pageTitle);
    url.searchParams.set('prop', 'wikitext');
    url.searchParams.set('format', 'json');
    url.searchParams.set('redirects', '1');

    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Bulbapedia ${response.status} ${response.statusText} for ${pageTitle}`);
    }

    const data = (await response.json()) as ParseApiResponse;
    if (data.error || !data.parse?.wikitext?.['*']) {
      throw new Error(
        `Bulbapedia error for ${pageTitle}: ${data.error?.code ?? 'no wikitext returned'}`,
      );
    }

    const wikitext = data.parse.wikitext['*'];
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, wikitext, 'utf8');
    return wikitext;
  }

  private cachePathFor(pageTitle: string): string {
    return join(this.cacheDir, `${pageTitle}.wikitext`);
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
