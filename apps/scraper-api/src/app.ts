import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { healthRouter } from './routes/health.ts';

export function createApp(): Hono {
  const app = new Hono();
  app.use(
    '/api/*',
    cors({
      origin: ['http://localhost:5173'],
      allowMethods: ['GET', 'POST'],
    }),
  );
  app.route('/api', healthRouter);
  return app;
}
