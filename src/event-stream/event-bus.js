/**
 * In-memory publish / subscribe event bus.
 *
 * All stadium events, state changes, risk detections and decisions flow through
 * this bus. It decouples producers from consumers so each domain module only
 * needs to know about events, not about other modules.
 */
export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
    /** @type {Array<{topic: string, payload: any, ts: string}>} */
    this._history = [];
    this._historyMax = 500;
  }

  /**
   * Subscribe to a topic.
   * @param {string} topic
   * @param {Function} handler
   */
  on(topic, handler) {
    if (!this._listeners.has(topic)) {
      this._listeners.set(topic, new Set());
    }
    this._listeners.get(topic).add(handler);
    return () => this.off(topic, handler);
  }

  /**
   * Unsubscribe from a topic.
   * @param {string} topic
   * @param {Function} handler
   */
  off(topic, handler) {
    this._listeners.get(topic)?.delete(handler);
  }

  /**
   * Emit an event to all subscribers of the given topic.
   * @param {string} topic
   * @param {*} payload
   */
  emit(topic, payload) {
    const ts = new Date().toISOString();
    if (this._history.length >= this._historyMax) {
      this._history.shift();
    }
    this._history.push({ topic, payload, ts });

    const handlers = this._listeners.get(topic);
    if (handlers) {
      for (const fn of handlers) {
        try {
          fn(payload);
        } catch (err) {
          console.error(`[EventBus] handler error on "${topic}":`, err.message);
        }
      }
    }
  }

  /** Get recent event history (newest first). */
  recentHistory(limit = 50) {
    return this._history.slice(-limit).reverse();
  }

  /** Number of registered topics. */
  get topicCount() {
    return this._listeners.size;
  }

  /** Remove all listeners (for tests). */
  reset() {
    this._listeners.clear();
    this._history = [];
  }
}
