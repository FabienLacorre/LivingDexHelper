import { serve } from '@hono/node-server';
import { SCRAPER_VERSION } from '@livingdex/scrapers';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

app.use(
  '/api/*',
  cors({
    origin: ['http://localhost:5173'],
    allowMethods: ['GET', 'POST'],
  }),
);

app.get('/api/health', (c) =>
  c.json({
    ok: true,
    service: 'livingdex-scraper-api',
    scraperVersion: SCRAPER_VERSION,
    timestamp: new Date().toISOString(),
  }),
);

const port = Number.parseInt(process.env.PORT ?? '3001', 10);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`scraper-api listening on http://localhost:${info.port}`);
});
