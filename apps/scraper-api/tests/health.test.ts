import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';

describe('/api/health', () => {
  it('returns ok JSON with scraperVersion', async () => {
    const app = createApp();
    const response = await app.fetch(new Request('http://localhost/api/health'));
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.service).toBe('livingdex-scraper-api');
    expect(typeof body.scraperVersion).toBe('string');
    expect(typeof body.timestamp).toBe('string');
  });
});
