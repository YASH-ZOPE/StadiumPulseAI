/**
 * EventBus unit tests.
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../src/event-stream/event-bus.js';

describe('EventBus', () => {
  let bus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('should deliver events to subscribers', () => {
    let received = null;
    bus.on('test', (payload) => { received = payload; });
    bus.emit('test', { value: 42 });
    assert.deepEqual(received, { value: 42 });
  });

  it('should support multiple subscribers on the same topic', () => {
    let count = 0;
    bus.on('multi', () => { count++; });
    bus.on('multi', () => { count++; });
    bus.emit('multi', {});
    assert.equal(count, 2);
  });

  it('should not deliver events to unsubscribed handlers', () => {
    let called = false;
    const handler = () => { called = true; };
    bus.on('unsub', handler);
    bus.off('unsub', handler);
    bus.emit('unsub', {});
    assert.equal(called, false);
  });

  it('should return an unsubscribe function from on()', () => {
    let called = false;
    const unsub = bus.on('auto-unsub', () => { called = true; });
    unsub();
    bus.emit('auto-unsub', {});
    assert.equal(called, false);
  });

  it('should track event history', () => {
    bus.emit('a', { v: 1 });
    bus.emit('b', { v: 2 });
    const history = bus.recentHistory(10);
    assert.equal(history.length, 2);
    assert.equal(history[0].topic, 'b'); // newest first
  });

  it('should limit history size', () => {
    bus._historyMax = 3;
    for (let i = 0; i < 5; i++) {
      bus.emit('x', { i });
    }
    assert.equal(bus.recentHistory(10).length, 3);
  });

  it('should isolate handler errors', () => {
    bus.on('error-test', () => { throw new Error('boom'); });
    let received = false;
    bus.on('error-test', () => { received = true; });
    bus.emit('error-test', {});
    assert.equal(received, true); // second handler still runs
  });

  it('should report topic count', () => {
    bus.on('a', () => {});
    bus.on('b', () => {});
    assert.equal(bus.topicCount, 2);
  });

  it('should reset all state', () => {
    bus.on('x', () => {});
    bus.emit('x', {});
    bus.reset();
    assert.equal(bus.topicCount, 0);
    assert.equal(bus.recentHistory().length, 0);
  });
});
