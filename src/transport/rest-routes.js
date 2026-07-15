/**
 * REST API routes.
 *
 * Mounts all HTTP endpoints for state queries, commands, forecasts, audit
 * and simulation. Each route delegates to the relevant domain module from
 * the injected context object.
 */
import { Router } from 'express';
import { createEvent } from '../event-stream/event-schema.js';
import { aiMetrics } from '../decision-engine/gemini-orchestrator.js';

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Mount all routes on the Express app.
 * @param {import('express').Express} app
 * @param {any} ctx — domain context
 */
export function mountRoutes(app, ctx) {
  const api = Router();

  /* ── Health ────────────────────────────────────── */
  api.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'Stadium Pulse AI',
      timestamp: new Date().toISOString(),
      ai: ctx.gemini ? (process.env.GEMINI_API_KEY ? 'gemini' : 'offline') : 'offline',
    });
  });

  /* ── Metrics ───────────────────────────────────── */
  api.get('/metrics', (_req, res) => {
    res.json({ ai: aiMetrics, timeline: ctx.timeline?.getStats() || {} });
  });

  /* ── State snapshot ────────────────────────────── */
  api.get('/state/snapshot', (_req, res) => {
    res.json(ctx.state.getSnapshot());
  });

  /* ── Single zone ───────────────────────────────── */
  api.get('/state/zones/:zoneId', (req, res) => {
    const zone = ctx.state.getZone(req.params.zoneId);
    if (!zone) {
      return res.status(404).json({ error: 'Zone not found', code: 'not_found' });
    }
    res.json(zone);
  });

  /* ── Venue map (zone graph for digital twin) ──── */
  api.get('/venue/map', (_req, res) => {
    const { zones, corridors, venue } = ctx.venueData;
    res.json({ venue, zones, corridors });
  });

  /* ── Queue forecasts ───────────────────────────── */
  api.get('/forecast/queues', (_req, res) => {
    res.json({ forecasts: ctx.queueForecaster.getForecasts() });
  });

  api.get('/forecast/queues/:queueId', (req, res) => {
    const forecast = ctx.queueForecaster.getForecast(req.params.queueId);
    if (!forecast) {
      return res.status(404).json({ error: 'Queue not found', code: 'not_found' });
    }
    res.json(forecast);
  });

  /* ── Cascade impact preview ────────────────────── */
  api.get('/cascade/:zoneId', (req, res) => {
    const impact = ctx.cascade.previewCascade(req.params.zoneId);
    res.json(impact);
  });

  /* ── Volunteers ────────────────────────────────── */
  api.get('/volunteers', (_req, res) => {
    res.json({ volunteers: ctx.volunteers.getRoster() });
  });

  /* ── Audit timeline ────────────────────────────── */
  api.get('/audit/timeline', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    res.json({ timeline: ctx.timeline.getTimeline(limit) });
  });

  api.get('/audit/decisions/:id', (req, res) => {
    const entry = ctx.timeline.getEntry(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Decision not found', code: 'not_found' });
    }
    res.json(entry);
  });

  /* ── Commands: approve / reject ────────────────── */
  api.post(
    '/commands/approve',
    ctx.requireJson || ((_r, _s, n) => n()),
    wrap(async (req, res) => {
      const { decisionId, approvedActions } = req.body;
      if (!decisionId) {
        return res.status(400).json({ error: 'decisionId required', code: 'validation_error' });
      }
      const result = ctx.approval.approve(decisionId, approvedActions);
      if (!result) {
        return res
          .status(404)
          .json({ error: 'Decision not found or already processed', code: 'not_found' });
      }
      res.json(result);
    }),
  );

  api.post(
    '/commands/reject',
    ctx.requireJson || ((_r, _s, n) => n()),
    wrap(async (req, res) => {
      const { decisionId, reason } = req.body;
      if (!decisionId) {
        return res.status(400).json({ error: 'decisionId required', code: 'validation_error' });
      }
      const result = ctx.approval.reject(decisionId, reason);
      if (!result) {
        return res
          .status(404)
          .json({ error: 'Decision not found or already processed', code: 'not_found' });
      }
      res.json(result);
    }),
  );

  /* ── Commands: inject event ────────────────────── */
  api.post(
    '/commands/inject-event',
    ctx.requireJson || ((_r, _s, n) => n()),
    wrap(async (req, res) => {
      const evt = createEvent(req.body);
      ctx.bus.emit('event:new', evt);
      res.status(201).json(evt);
    }),
  );

  /* ── Simulation: run connected scenario ────────── */
  api.post(
    '/simulation/scenario',
    wrap(async (_req, res) => {
      const result = await ctx.scenario.runConnectedDemo();
      res.json(result);
    }),
  );

  /* ── Pending decisions ─────────────────────────── */
  api.get('/decisions/pending', (_req, res) => {
    res.json({ pending: ctx.approval.getPending() });
  });

  /* ── AI Fan Assistant Chatbot ──────────────────── */
  api.post(
    '/assist',
    wrap(async (req, res) => {
      const { question, currentZone, destination, language, accessibilityNeeds } = req.body || {};
      const result = await ctx.gemini.answerFanQuestion({
        question,
        currentZone,
        destination,
        language,
        accessibilityNeeds,
      });
      res.json(result);
    }),
  );

  app.use('/api', api);
}
