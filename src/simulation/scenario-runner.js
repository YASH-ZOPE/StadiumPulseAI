/**
 * Scenario runner — the connected 11-step demo.
 *
 * Orchestrates the signature cascading scenario:
 * Gate B crowd rises → queue forecast exceeds 24 min → thunderstorm risk →
 * accessible corridor unavailable → cascade predicts Gate C pressure →
 * Gemini generates coordinated response → operator approves → volunteer
 * assignments update → fan routes change → multilingual alert → timeline
 * records everything.
 *
 * Each step is emitted as an event with configurable delays to make the
 * cascade visible in the UI.
 */
import { createEvent } from '../event-stream/event-schema.js';

export class ScenarioRunner {
  /**
   * @param {import('../event-stream/event-bus.js').EventBus} bus
   * @param {import('../stadium-state/state-engine.js').StateEngine} state
   */
  constructor(bus, state) {
    this._bus = bus;
    this._state = state;
    this._running = false;
    this._stepDelay = 500;
  }

  /** @returns {boolean} */
  get isRunning() {
    return this._running;
  }

  /**
   * Run the full connected demo scenario.
   * @returns {Promise<object>} scenario result with step log
   */
  async runConnectedDemo() {
    if (this._running) {
      return { error: 'Scenario already running' };
    }
    this._running = true;
    const log = [];

    try {
      /* Step 1: Gate B crowd rises to 87% */
      log.push(await this._step(1, 'Gate B crowd surge', () => {
        this._bus.emit('event:new', createEvent({
          source: 'simulation',
          category: 'crowd',
          type: 'density-spike',
          zone: 'gate-b',
          severity: 'critical',
          payload: { density: 0.87, occupancy: 4350 },
        }));
      }));

      /* Step 2: Queue forecast exceeds 24 min */
      log.push(await this._step(2, 'Gate B queue exceeds 24 min', () => {
        this._bus.emit('event:new', createEvent({
          source: 'simulation',
          category: 'queue',
          type: 'wait-time-surge',
          zone: 'gate-b',
          severity: 'warning',
          payload: { queueId: 'q-gate-b', waitMinutes: 24, trend: 'rising' },
        }));
      }));

      /* Step 3: Thunderstorm warning */
      log.push(await this._step(3, 'Thunderstorm warning issued', () => {
        this._bus.emit('event:new', createEvent({
          source: 'simulation',
          category: 'weather',
          type: 'weather-change',
          zone: null,
          severity: 'warning',
          payload: {
            condition: 'thunderstorm',
            severity: 'warning',
            temperature: 28,
            windSpeed: 35,
            forecastChange: 'Thunderstorm expected in 20 minutes',
          },
        }));
      }));

      /* Step 4: East concourse accessible corridor becomes unavailable */
      log.push(await this._step(4, 'East concourse accessible corridor closed', () => {
        this._bus.emit('event:new', createEvent({
          source: 'simulation',
          category: 'operational',
          type: 'zone-status-change',
          zone: 'concourse-east',
          severity: 'warning',
          payload: { status: 'restricted' },
        }));
        this._bus.emit('event:new', createEvent({
          source: 'simulation',
          category: 'accessibility',
          type: 'route-broken',
          zone: 'concourse-east',
          severity: 'warning',
          payload: { from: 'concourse-east', to: 'sensory-room', reason: 'Weather shelter setup blocking corridor' },
        }));
      }));

      /* Step 5: Medical incident at food court */
      log.push(await this._step(5, 'Medical incident reported at Food Court NE', () => {
        this._bus.emit('event:new', createEvent({
          source: 'simulation',
          category: 'incident',
          type: 'incident-report',
          zone: 'food-court-ne',
          severity: 'critical',
          payload: { type: 'medical', detail: 'Fan collapsed — suspected heat-related illness', incidentId: 'inc-demo-1' },
        }));
      }));

      /* Step 6: Gate A crowd also rising (cascade effect) */
      log.push(await this._step(6, 'Gate A crowd rising (displaced from Gate B)', () => {
        this._bus.emit('event:new', createEvent({
          source: 'simulation',
          category: 'crowd',
          type: 'density-rising',
          zone: 'gate-a',
          severity: 'warning',
          payload: { density: 0.72, occupancy: 3240 },
        }));
      }));

      /* Step 7: Transit hub pressure increasing */
      log.push(await this._step(7, 'Transit hub pressure increasing', () => {
        this._bus.emit('event:new', createEvent({
          source: 'simulation',
          category: 'transport',
          type: 'transit-pressure',
          zone: 'transit-hub',
          severity: 'warning',
          payload: { transitLoad: 'high', rideshareWaitMinutes: 18, shuttleStatus: 'delayed' },
        }));
      }));

      /* Step 8: Fan sentiment shifting negative */
      log.push(await this._step(8, 'Fan sentiment trending negative', () => {
        this._bus.emit('event:new', createEvent({
          source: 'simulation',
          category: 'sentiment',
          type: 'sentiment-shift',
          zone: null,
          severity: 'warning',
          payload: {
            overallSentiment: 'negative',
            topIssues: ['Long queues at Gate B', 'Weather concerns', 'Accessibility difficulty'],
            sampleFeedback: [
              { lang: 'en', text: 'Been waiting 25 minutes at Gate B, ridiculous' },
              { lang: 'es', text: 'No puedo encontrar la ruta accesible' },
              { lang: 'fr', text: 'La pluie arrive et il n\'y a pas d\'abri' },
            ],
          },
        }));
      }));

      /* Step 9 */
      log.push(await this._step(9, 'Risk analysis + cascade simulation triggered automatically', () => {}));

      /* Step 10 */
      log.push(await this._step(10, 'AI coordinated response generated — awaiting operator approval', () => {}));

      /* Step 11 */
      log.push(await this._step(11, 'Decision logged to audit timeline — scenario complete', () => {}));

      return {
        status: 'completed',
        stepsExecuted: log.length,
        log,
        message: 'Connected scenario complete. Check the decision panel to approve AI recommendations.',
      };
    } finally {
      this._running = false;
    }
  }

  async _step(number, label, action) {
    await delay(this._stepDelay);
    action();
    const entry = { step: number, total: 11, label, timestamp: new Date().toISOString() };
    this._bus.emit('scenario:step', entry);
    return entry;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
