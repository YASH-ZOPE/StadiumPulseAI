/**
 * Express application + WebSocket server factory.
 *
 * Assembles the HTTP stack (security headers, CORS, compression, rate limiting,
 * body parsing, static files) and the WebSocket upgrade path. Exported as a
 * factory so tests can create isolated instances.
 */
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WebSocketServer } from 'ws';

import env from './environment.js';
import { createRateLimiters, requireJson } from '../security/rate-limiter.js';
import { headerSecurity } from '../security/headers.js';
import { mountRoutes } from '../transport/rest-routes.js';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');

/**
 * Build and return `{ app, wss }`.
 * @param {object} [deps] — injectable dependencies for testing.
 */
export function createHttpLayer(deps = {}) {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  /* ── Security ────────────────────────────────── */
  app.use(headerSecurity());
  app.use(cors({ origin: true, maxAge: 86400 }));
  app.use(compression());

  /* ── Body parsing ────────────────────────────── */
  app.use(express.json({ limit: '16kb' }));

  /* ── Rate limiting ───────────────────────────── */
  const { general, ai } = createRateLimiters();
  app.use('/api', general);

  /* ── API routes ──────────────────────────────── */
  mountRoutes(app, { aiLimiter: ai, requireJson, ...deps });

  /* ── Static files ────────────────────────────── */
  app.use(express.static(publicDir, { maxAge: env.isProduction ? '1d' : 0 }));

  /* ── Fallback for SPA (GET non-API requests) ─── */
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
      return res.sendFile(join(publicDir, 'index.html'));
    }
    next();
  });

  /* ── 404 handler for unhandled API routes ────── */
  app.use('/api', (req, res) => {
    res
      .status(404)
      .json({ error: `API endpoint ${req.method} ${req.path} not found`, code: 'not_found' });
  });

  /* ── Error handler ───────────────────────────── */
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = status < 500 ? err.message : 'Internal server error';
    if (status >= 500 && !env.isTest) {
      console.error('[ERROR]', err);
    }
    res.status(status).json({ error: message, code: err.code || 'server_error' });
  });

  /* ── WebSocket ───────────────────────────────── */
  const wss = new WebSocketServer({ noServer: true });

  return { app, wss };
}
