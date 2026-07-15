/* eslint-disable no-control-regex */
/**
 * Security — rate limiters and input guards.
 */
import rateLimit from 'express-rate-limit';
import env from '../core/environment.js';

/** Build the two-tier rate limiters. */
export function createRateLimiters() {
  const general = rateLimit({
    windowMs: env.rateLimit.windowMs,
    max: env.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests', code: 'rate_limited' },
  });

  const ai = rateLimit({
    windowMs: env.rateLimit.windowMs,
    max: env.rateLimit.aiMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'AI rate limit exceeded', code: 'ai_rate_limited' },
  });

  return { general, ai };
}

/** Middleware: require JSON content-type on POST/PUT/PATCH. */
export function requireJson(req, res, next) {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const ct = req.headers['content-type'] || '';
    if (!ct.includes('application/json')) {
      return res.status(415).json({ error: 'Content-Type must be application/json', code: 'unsupported_media_type' });
    }
  }
  next();
}

/** Sanitise free-text input to prevent prompt injection. */
export function sanitizeInput(text, maxLen = 500) {
  if (typeof text !== 'string') {
    return '';
  }
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/ignore\s+(previous|above|all)\s+(instructions?|prompts?)/gi, '[filtered]')
    .replace(/you\s+are\s+now/gi, '[filtered]')
    .trim()
    .slice(0, maxLen);
}
