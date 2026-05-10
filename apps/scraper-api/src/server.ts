import { serve } from '@hono/node-server';
import { createApp } from './app.ts';

const app = createApp();
const port = Number.parseInt(process.env.PORT ?? '3001', 10);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`scraper-api listening on http://localhost:${info.port}`);
});
