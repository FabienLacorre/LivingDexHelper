import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PokeApiClient } from '../src/sources/pokeapi/client.ts';

let cacheDir: string;
const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

beforeEach(() => {
  cacheDir = mkdtempSync(join(tmpdir(), 'pokeapi-cache-'));
  fetchMock.mockReset();
});

afterEach(() => {
  rmSync(cacheDir, { recursive: true, force: true });
});

describe('PokeApiClient', () => {
  it('fetches from network on cache miss and writes cache', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 25, name: 'pikachu' }),
    } as Response);

    const client = new PokeApiClient({ cacheDir });
    const result = await client.get('/pokemon/25');

    expect(result).toEqual({ id: 25, name: 'pikachu' });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/pokemon/25'),
      expect.anything(),
    );

    const cachePath = join(cacheDir, 'pokemon', '25.json');
    expect(existsSync(cachePath)).toBe(true);
    expect(JSON.parse(readFileSync(cachePath, 'utf8'))).toEqual({ id: 25, name: 'pikachu' });
  });

  it('reads from cache on second call without network', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 25, name: 'pikachu' }),
    } as Response);

    const client = new PokeApiClient({ cacheDir });
    await client.get('/pokemon/25');
    fetchMock.mockClear();

    const result = await client.get('/pokemon/25');
    expect(result).toEqual({ id: 25, name: 'pikachu' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('respects noCache option and re-fetches', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 25, name: 'pikachu' }),
    } as Response);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 25, name: 'pikachu-updated' }),
    } as Response);

    const client = new PokeApiClient({ cacheDir, noCache: true });
    await client.get('/pokemon/25');
    const result = await client.get('/pokemon/25');

    expect(result).toEqual({ id: 25, name: 'pikachu-updated' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws on 4xx without retry', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({}),
    } as Response);

    const client = new PokeApiClient({ cacheDir });
    await expect(client.get('/pokemon/9999')).rejects.toThrow(/404/);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
