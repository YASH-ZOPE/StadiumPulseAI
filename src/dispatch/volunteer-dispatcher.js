/**
 * Volunteer dispatcher — dynamic assignment optimizer.
 *
 * Assigns available volunteers to actions based on role match, language
 * capability, proximity (current zone) and incident priority. Updates the
 * state engine with new assignments.
 */
export class VolunteerDispatcher {
  /**
   * @param {import('../stadium-state/state-engine.js').StateEngine} state
   * @param {import('../event-stream/event-bus.js').EventBus} bus
   */
  constructor(state, bus) {
    this._state = state;
    this._bus = bus;
  }

  /**
   * Assign a volunteer from an approved action.
   * @param {object} action — approved action with target (volunteer ID) and detail
   */
  assign(action) {
    const volunteerId = action.target;
    const detail = action.detail || 'General assignment';
    const targetZone = action.zone || null;

    this._state.assignVolunteer(volunteerId, detail, targetZone);

    this._bus.emit('event:new', {
      id: `evt-vol-${Date.now()}`,
      timestamp: new Date().toISOString(),
      source: 'system',
      category: 'operational',
      type: 'volunteer-dispatched',
      zone: targetZone,
      severity: 'info',
      payload: { volunteerId, assignment: detail, zone: targetZone },
      triggeredBy: null,
      cascadeDepth: 0,
    });
  }

  /**
   * Find the best available volunteer for a role + zone + language.
   * @param {string} role
   * @param {string} [preferredZone]
   * @param {string} [language]
   * @returns {object|null}
   */
  findBest(role, preferredZone, language) {
    const candidates = this._state.getAvailableVolunteers(role, language);
    if (candidates.length === 0) {
      return null;
    }
    if (!preferredZone) {
      return candidates[0];
    }
    /* Prefer volunteers already in or near the target zone. */
    const inZone = candidates.find((v) => v.zone === preferredZone);
    return inZone || candidates[0];
  }

  /** Get current roster with assignments. */
  getRoster() {
    return this._state.getVolunteers();
  }
}
