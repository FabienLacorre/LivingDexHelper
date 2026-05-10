import { SCRAPER_VERSION } from '@livingdex/scrapers';
import { Hono } from 'hono';

export const healthRouter = new Hono();

healthRouter.get('/health', (c) =>
  c.json({
    ok: true,
    service: 'livingdex-scraper-api',
    scraperVersion: SCRAPER_VERSION,
    timestamp: new Date().toISOString(),
  }),
);
