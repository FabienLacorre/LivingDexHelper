import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export type SpriteDownload = {
  url: string;
  destPath: string;
};

export type DownloadOptions = {
  concurrency?: number;
};

export async function downloadSprites(
  downloads: SpriteDownload[],
  options: DownloadOptions = {},
): Promise<void> {
  const concurrency = options.concurrency ?? 20;
  const queue = [...downloads];
  const workers: Promise<void>[] = [];

  for (let i = 0; i < concurrency; i++) {
    workers.push(worker(queue));
  }
  await Promise.all(workers);
}

async function worker(queue: SpriteDownload[]): Promise<void> {
  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) return;
    if (existsSync(next.destPath)) continue;
    await downloadOne(next);
  }
}

async function downloadOne(download: SpriteDownload): Promise<void> {
  const response = await fetch(download.url);
  if (!response.ok) {
    throw new Error(
      `Sprite download failed: ${response.status} ${response.statusText} (${download.url})`,
    );
  }
  const arrayBuffer = await response.arrayBuffer();
  mkdirSync(dirname(download.destPath), { recursive: true });
  writeFileSync(download.destPath, Buffer.from(arrayBuffer));
}
