/**
 * Centralised, validated runtime configuration.
 *
 * Every environment variable is read, coerced and frozen here so the rest of
 * the codebase never touches `process.env` directly. This keeps configuration
 * predictable, testable and free from hard-coded secrets.
 */
import 'dotenv/config';

/** @param {string|undefined} v @param {number} fallback */
function toInt(v, fallback) {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const env = Object.freeze({
  port: toInt(process.env.PORT, 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  gemini: Object.freeze({
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    maxTokens: toInt(process.env.AI_MAX_TOKENS, 1024),
    timeoutMs: toInt(process.env.AI_TIMEOUT_MS, 15_000),
    cacheTtlMs: toInt(process.env.AI_CACHE_TTL_MS, 5 * 60_000),
    cacheMax: toInt(process.env.AI_CACHE_MAX, 300),
    get enabled() {
      return this.apiKey.length > 0;
    },
  }),

  rateLimit: Object.freeze({
    windowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    max: toInt(process.env.RATE_LIMIT_MAX, 100),
    aiMax: toInt(process.env.AI_RATE_LIMIT_MAX, 20),
  }),

  simulation: Object.freeze({
    tickMs: toInt(process.env.SIMULATION_TICK_MS, 2000),
    speed: process.env.SIMULATION_SCENARIO_SPEED || 'fast',
  }),
});

export default env;
