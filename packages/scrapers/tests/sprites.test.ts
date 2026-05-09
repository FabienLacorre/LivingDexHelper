import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadSprites } from '../src/sources/pokeapi/sprites.ts';

let outDir: string;
const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

beforeEach(() => {
  outDir = mkdtempSync(join(tmpdir(), 'sprites-'));
  fetchMock.mockReset();
});

afterEach(() => {
  rmSync(outDir, { recursive: true, force: true });
});

describe('downloadSprites', () => {
  it('downloads multiple sprites in parallel', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    } as unknown as Response);

    const downloads = [
      { url: 'https://example.com/a.png', destPath: join(outDir, 'a.png') },
      { url: 'https://example.com/b.png', destPath: join(outDir, 'b.png') },
      { url: 'https://example.com/c.png', destPath: join(outDir, 'c.png') },
    ];

    await downloadSprites(downloads, { concurrency: 2 });

    expect(existsSync(join(outDir, 'a.png'))).toBe(true);
    expect(existsSync(join(outDir, 'b.png'))).toBe(true);
    expect(existsSync(join(outDir, 'c.png'))).toBe(true);
    expect(readFileSync(join(outDir, 'a.png'))).toEqual(Buffer.from([1, 2, 3, 4]));
  });

  it('skips downloads when destination already exists', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1]).buffer,
    } as unknown as Response);

    const downloads = [{ url: 'https://example.com/a.png', destPath: join(outDir, 'a.png') }];
    await downloadSprites(downloads);
    fetchMock.mockClear();

    await downloadSprites(downloads);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws on network error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    } as Response);

    await expect(
      downloadSprites([{ url: 'https://example.com/x.png', destPath: join(outDir, 'x.png') }]),
    ).rejects.toThrow();
  });
});
