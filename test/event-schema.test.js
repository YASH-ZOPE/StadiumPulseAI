/**
 * Event schema unit tests.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEvent,
  EventValidationError,
  CATEGORIES,
  SEVERITIES,
} from '../src/event-stream/event-schema.js';

describe('createEvent', () => {
  it('should create a valid event with all required fields', () => {
    const evt = createEvent({
      category: 'crowd',
      type: 'density-spike',
      zone: 'gate-a',
      severity: 'warning',
      payload: { density: 0.87 },
    });
    assert.ok(evt.id.startsWith('evt-'));
    assert.equal(evt.category, 'crowd');
    assert.equal(evt.type, 'density-spike');
    assert.equal(evt.zone, 'gate-a');
    assert.equal(evt.severity, 'warning');
    assert.deepEqual(evt.payload, { density: 0.87 });
    assert.equal(evt.cascadeDepth, 0);
  });

  it('should default optional fields', () => {
    const evt = createEvent({ category: 'weather', type: 'change' });
    assert.equal(evt.zone, null);
    assert.equal(evt.severity, 'info');
    assert.equal(evt.source, 'system');
    assert.deepEqual(evt.payload, {});
  });

  it('should reject missing category', () => {
    assert.throws(() => createEvent({ type: 'test' }), EventValidationError);
  });

  it('should reject invalid category', () => {
    assert.throws(() => createEvent({ category: 'invalid', type: 'test' }), EventValidationError);
  });

  it('should reject missing type', () => {
    assert.throws(() => createEvent({ category: 'crowd' }), EventValidationError);
  });

  it('should reject non-object input', () => {
    assert.throws(() => createEvent(null), EventValidationError);
    assert.throws(() => createEvent('string'), EventValidationError);
  });

  it('should accept all valid categories', () => {
    for (const cat of CATEGORIES) {
      const evt = createEvent({ category: cat, type: 'test' });
      assert.equal(evt.category, cat);
    }
  });

  it('should accept all valid severities', () => {
    for (const sev of SEVERITIES) {
      const evt = createEvent({ category: 'crowd', type: 'test', severity: sev });
      assert.equal(evt.severity, sev);
    }
  });

  it('should preserve triggeredBy and cascadeDepth', () => {
    const evt = createEvent({
      category: 'crowd',
      type: 'cascade',
      triggeredBy: 'evt-123',
      cascadeDepth: 2,
    });
    assert.equal(evt.triggeredBy, 'evt-123');
    assert.equal(evt.cascadeDepth, 2);
  });
});
