import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BulbapediaClient } from '../src/sources/bulbapedia/client.ts';

let cacheDir: string;
const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

beforeEach(() => {
  cacheDir = mkdtempSync(join(tmpdir(), 'bulba-cache-'));
  fetchMock.mockReset();
});

afterEach(() => {
  rmSync(cacheDir, { recursive: true, force: true });
});

describe('BulbapediaClient', () => {
  it('fetches wikitext via MediaWiki API', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ parse: { wikitext: { '*': '== Test ==\nhello' } } }),
    } as Response);

    const client = new BulbapediaClient({ cacheDir });
    const result = await client.getWikitext('Pikachu_(Pokémon)');

    expect(result).toBe('== Test ==\nhello');
    expect(fetchMock).toHaveBeenCalledOnce();
    const url = (fetchMock.mock.calls[0]?.[0] as string) ?? '';
    expect(url).toContain('action=parse');
    expect(url).toContain('page=Pikachu_%28Pok%C3%A9mon%29');
    expect(url).toContain('prop=wikitext');
    expect(url).toContain('format=json');
  });

  it('caches wikitext to disk and reads from cache on second call', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ parse: { wikitext: { '*': 'cached content' } } }),
    } as Response);

    const client = new BulbapediaClient({ cacheDir });
    await client.getWikitext('Mewtwo_(Pokémon)');
    fetchMock.mockClear();

    const result = await client.getWikitext('Mewtwo_(Pokémon)');
    expect(result).toBe('cached content');
    expect(fetchMock).not.toHaveBeenCalled();

    const cachePath = join(cacheDir, 'Mewtwo_(Pokémon).wikitext');
    expect(existsSync(cachePath)).toBe(true);
    expect(readFileSync(cachePath, 'utf8')).toBe('cached content');
  });

  it('sends a custom User-Agent header', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ parse: { wikitext: { '*': 'x' } } }),
    } as Response);

    const client = new BulbapediaClient({ cacheDir });
    await client.getWikitext('Pikachu_(Pokémon)');
    const headers = (fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.headers as
      | Record<string, string>
      | undefined;
    expect(headers?.['User-Agent']).toContain('PokemonLivingDex');
  });

  it('throws on missing parse.wikitext in response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ error: { code: 'missingtitle' } }),
    } as Response);

    const client = new BulbapediaClient({ cacheDir });
    await expect(client.getWikitext('Nonexistent_(Pokémon)')).rejects.toThrow();
  });

  it('respects 1 req/s rate limit between calls', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ parse: { wikitext: { '*': 'x' } } }),
    } as Response);

    const client = new BulbapediaClient({ cacheDir, rateLimitMs: 100 });
    const start = Date.now();
    await client.getWikitext('A_(Pokémon)');
    await client.getWikitext('B_(Pokémon)');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(100);
  });
});
