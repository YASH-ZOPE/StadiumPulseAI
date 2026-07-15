/**
 * Accessibility guardian.
 *
 * Continuously checks whether incidents, zone closures or weather conditions
 * have broken wheelchair-friendly routes. When a break is detected, it emits
 * an event and computes alternative accessible paths.
 */
import { findPath } from '../digital-twin/venue-graph.js';
import { loadVenueData } from '../digital-twin/venue-graph.js';

export class AccessibilityGuard {
  /**
   * @param {import('./state-engine.js').StateEngine} state
   * @param {import('../event-stream/event-bus.js').EventBus} bus
   */
  constructor(state, bus) {
    this._state = state;
    this._bus = bus;
    this._venueData = loadVenueData();
    this._lastBrokenSet = new Set();
  }

  /** Run accessibility check against current state. */
  check() {
    const snapshot = this._state.getSnapshot();
    const closedZones = new Set();
    const brokenCorridors = [];

    /* Find closed/restricted zones. */
    for (const [id, zone] of Object.entries(snapshot.zones)) {
      if (zone.status === 'closed' || zone.status === 'emergency') {
        closedZones.add(id);
      }
    }

    /* Check each corridor that involves a closed zone or has accessible=false impact. */
    for (const corridor of this._venueData.corridors) {
      if (!corridor.accessible) {
        continue;
      }
      if (closedZones.has(corridor.from) || closedZones.has(corridor.to)) {
        brokenCorridors.push({
          from: corridor.from,
          to: corridor.to,
          reason: `Zone ${closedZones.has(corridor.from) ? corridor.from : corridor.to} is closed`,
        });
      }
    }

    /* Detect newly broken routes (not already reported). */
    const currentBrokenSet = new Set(brokenCorridors.map((b) => `${b.from}->${b.to}`));
    for (const broken of brokenCorridors) {
      const key = `${broken.from}->${broken.to}`;
      if (!this._lastBrokenSet.has(key)) {
        this._bus.emit('event:new', {
          id: `evt-acc-${Date.now()}`,
          timestamp: new Date().toISOString(),
          source: 'system',
          category: 'accessibility',
          type: 'route-broken',
          zone: broken.from,
          severity: 'warning',
          payload: broken,
          triggeredBy: null,
          cascadeDepth: 1,
        });
      }
    }

    /* Detect restored routes. */
    for (const prev of this._lastBrokenSet) {
      if (!currentBrokenSet.has(prev)) {
        const [from, to] = prev.split('->');
        this._bus.emit('event:new', {
          id: `evt-acc-r-${Date.now()}`,
          timestamp: new Date().toISOString(),
          source: 'system',
          category: 'accessibility',
          type: 'route-restored',
          zone: from,
          severity: 'info',
          payload: { from, to },
          triggeredBy: null,
          cascadeDepth: 1,
        });
      }
    }

    this._lastBrokenSet = currentBrokenSet;

    return {
      brokenRoutes: brokenCorridors,
      closedZones: [...closedZones],
      alternativeRoutes: this._findAlternatives(brokenCorridors),
    };
  }

  /** Find accessible alternatives for each broken route. */
  _findAlternatives(brokenCorridors) {
    const alternatives = [];
    for (const broken of brokenCorridors) {
      const path = findPath(this._venueData, broken.from, broken.to, true);
      if (path && path.length > 2) {
        alternatives.push({
          from: broken.from,
          to: broken.to,
          via: path.slice(1, -1),
          addedMinutes: Math.round((path.length - 2) * 2.5),
        });
      }
    }
    return alternatives;
  }
}
