/**
 * Fan rerouter — accessibility-aware path updates.
 *
 * When zones close or accessible routes break, this module computes new
 * fan-facing directions that respect wheelchair and step-free constraints.
 */
import { findPath, loadVenueData } from '../digital-twin/venue-graph.js';

export class FanRerouter {
  /** @param {import('../stadium-state/state-engine.js').StateEngine} state */
  constructor(state) {
    this._state = state;
    this._venueData = loadVenueData();
    this._activeReroutes = [];
  }

  /**
   * Update fan routing based on an approved reroute action.
   * @param {object} action
   */
  updateRoutes(action) {
    const snapshot = this._state.getSnapshot();

    /* Find closed zones to avoid. */
    const closedZones = new Set();
    for (const [id, zone] of Object.entries(snapshot.zones)) {
      if (zone.status === 'closed' || zone.status === 'emergency') {
        closedZones.add(id);
      }
    }

    const reroute = {
      id: `reroute-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: action.detail,
      target: action.target,
      closedZones: [...closedZones],
      alternativePaths: this._computeAlternatives(closedZones),
    };

    this._activeReroutes.push(reroute);
    if (this._activeReroutes.length > 20) {
      this._activeReroutes.shift();
    }

    return reroute;
  }

  /** Compute alternative paths avoiding closed zones. */
  _computeAlternatives(closedZones) {
    const gates = this._venueData.zones.filter((z) => z.type === 'gate');
    const seating = this._venueData.zones.filter((z) => z.type === 'seating');
    const alternatives = [];

    for (const gate of gates) {
      if (closedZones.has(gate.id)) {
        continue;
      }
      for (const seat of seating) {
        const path = findPath(this._venueData, gate.id, seat.id, true);
        if (path) {
          const isViable = !path.some((z) => closedZones.has(z));
          if (isViable) {
            alternatives.push({
              from: gate.id,
              to: seat.id,
              via: path,
              accessible: true,
              estimatedMinutes: path.length * 2,
            });
            break;
          }
        }
      }
    }

    return alternatives;
  }

  /** Get currently active reroutes. */
  getActiveReroutes() {
    return [...this._activeReroutes];
  }
}
