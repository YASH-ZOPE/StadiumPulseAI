/**
 * Event schema definitions and validation.
 *
 * Every event flowing through the bus is validated here before it mutates
 * stadium state. This is the single source of truth for event shapes.
 */
import { randomUUID } from 'node:crypto';

/** All recognised event categories. */
export const CATEGORIES = [
  'crowd',
  'queue',
  'weather',
  'incident',
  'accessibility',
  'sentiment',
  'transport',
  'operational',
];

/** Severity levels. */
export const SEVERITIES = ['info', 'warning', 'critical'];

/** Event sources. */
export const SOURCES = ['sensor', 'weather', 'operator', 'system', 'fan-feedback', 'simulation'];

/**
 * Create a well-formed stadium event.
 * @param {object} raw
 * @returns {object} validated event
 */
export function createEvent(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new EventValidationError('Event must be an object');
  }
  if (!raw.category || !CATEGORIES.includes(raw.category)) {
    throw new EventValidationError(`category must be one of: ${CATEGORIES.join(', ')}`);
  }
  if (!raw.type || typeof raw.type !== 'string') {
    throw new EventValidationError('type is required');
  }

  return {
    id: `evt-${randomUUID().slice(0, 8)}`,
    timestamp: new Date().toISOString(),
    source: SOURCES.includes(raw.source) ? raw.source : 'system',
    category: raw.category,
    type: raw.type,
    zone: raw.zone || null,
    severity: SEVERITIES.includes(raw.severity) ? raw.severity : 'info',
    payload: raw.payload || {},
    triggeredBy: raw.triggeredBy || null,
    cascadeDepth: typeof raw.cascadeDepth === 'number' ? raw.cascadeDepth : 0,
  };
}

/** Validation error with 400 status. */
export class EventValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EventValidationError';
    this.status = 400;
    this.code = 'invalid_event';
  }
}
