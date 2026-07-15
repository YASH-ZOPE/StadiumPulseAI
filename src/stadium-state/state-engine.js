/**
 * Stadium state engine — the living state tree.
 *
 * Maintains the mutable, in-memory representation of the entire stadium at
 * this instant: zone occupancy, queue estimates, weather, incidents, volunteer
 * assignments, transport status and accessibility constraints. Every event
 * flowing through the bus is applied here as a state mutation, and a diff is
 * emitted so downstream consumers (WebSocket, risk analyzer, forecaster) react.
 */
export class StateEngine {
  /**
   * @param {object} venueData — loaded venue topology
   * @param {import('../event-stream/event-bus.js').EventBus} bus
   */
  constructor(venueData, bus) {
    this._bus = bus;
    this._venue = venueData.venue;

    /* ── Zones ──────────────────────────────────── */
    this._zones = new Map();
    for (const z of venueData.zones) {
      this._zones.set(z.id, {
        ...z,
        status: 'open',
        currentOccupancy: 0,
        density: 0,
        densityBand: 'low',
        incidents: [],
      });
    }

    /* ── Queues ─────────────────────────────────── */
    this._queues = new Map();
    for (const q of venueData.queuePoints) {
      this._queues.set(q.id, {
        ...q,
        currentWaitMinutes: 0,
        forecastWaitMinutes: 0,
        trend: 'stable',
      });
    }

    /* ── Volunteers ─────────────────────────────── */
    this._volunteers = venueData.volunteers.map((v) => ({
      ...v,
      status: 'available',
      currentAssignment: null,
    }));

    /* ── Weather ────────────────────────────────── */
    this._weather = {
      condition: 'clear',
      severity: 'none',
      temperature: 24,
      windSpeed: 8,
      forecastChange: null,
      operationalImpact: [],
    };

    /* ── Transport ──────────────────────────────── */
    this._transport = {
      transitLoad: 'low',
      rideshareWaitMinutes: 5,
      shuttleStatus: 'running',
      parkingAvailability: 85,
    };

    /* ── Accessibility ──────────────────────────── */
    this._accessibility = {
      brokenRoutes: [],
      alternativeRoutes: [],
      sensoryRoomStatus: 'available',
      wheelchairAssistAvailable: 4,
    };

    /* ── Sustainability ─────────────────────────── */
    this._sustainability = {
      wasteDivertedPercent: 88,
      energyEfficiencyKW: 420,
      waterRefillsCount: 14200,
      co2SavedKg: 3850,
      recyclingStatus: 'optimal',
    };

    /* ── Match phase ────────────────────────────── */
    this._matchPhase = venueData.match?.phase || 'pre-match';

    /* ── Incidents ──────────────────────────────── */
    this._incidents = new Map();

    /* ── Pending decisions ──────────────────────── */
    this._pendingDecisions = [];
  }

  /* ─── Event application ───────────────────────── */

  /**
   * Apply a validated stadium event to mutate state.
   * @param {object} evt — validated StadiumEvent
   */
  applyEvent(evt) {
    switch (evt.category) {
      case 'crowd':
        this._applyCrowdEvent(evt);
        break;
      case 'queue':
        this._applyQueueEvent(evt);
        break;
      case 'weather':
        this._applyWeatherEvent(evt);
        break;
      case 'incident':
        this._applyIncidentEvent(evt);
        break;
      case 'accessibility':
        this._applyAccessibilityEvent(evt);
        break;
      case 'transport':
        this._applyTransportEvent(evt);
        break;
      case 'operational':
        this._applyOperationalEvent(evt);
        break;
      default:
        break;
    }
    this._bus.emit('state:changed', { eventId: evt.id, category: evt.category });
  }

  _applyCrowdEvent(evt) {
    const zone = this._zones.get(evt.zone);
    if (!zone) {
      return;
    }
    if (evt.payload.occupancy !== undefined) {
      zone.currentOccupancy = Math.max(0, Math.min(evt.payload.occupancy, zone.capacity));
      zone.density = zone.currentOccupancy / zone.capacity;
      zone.densityBand = densityBand(zone.density);
    }
    if (evt.payload.density !== undefined) {
      zone.density = Math.max(0, Math.min(evt.payload.density, 1));
      zone.currentOccupancy = Math.round(zone.density * zone.capacity);
      zone.densityBand = densityBand(zone.density);
    }
  }

  _applyQueueEvent(evt) {
    const q = this._queues.get(evt.payload?.queueId);
    if (!q) {
      return;
    }
    if (evt.payload.waitMinutes !== undefined) {
      q.currentWaitMinutes = evt.payload.waitMinutes;
    }
    if (evt.payload.trend) {
      q.trend = evt.payload.trend;
    }
  }

  _applyWeatherEvent(evt) {
    Object.assign(this._weather, evt.payload);
  }

  _applyIncidentEvent(evt) {
    if (evt.type === 'incident-report') {
      const id = evt.payload.incidentId || evt.id;
      this._incidents.set(id, {
        id,
        type: evt.payload.type || 'unknown',
        severity: evt.severity,
        zone: evt.zone,
        reportedAt: evt.timestamp,
        status: 'open',
        assignedTeam: null,
        detail: evt.payload.detail || '',
      });
      const zone = this._zones.get(evt.zone);
      if (zone) {
        zone.incidents.push(id);
      }
    }
    if (evt.type === 'incident-resolved') {
      const inc = this._incidents.get(evt.payload.incidentId);
      if (inc) {
        inc.status = 'resolved';
      }
    }
  }

  _applyAccessibilityEvent(evt) {
    if (evt.type === 'route-broken') {
      this._accessibility.brokenRoutes.push({
        from: evt.payload.from,
        to: evt.payload.to,
        reason: evt.payload.reason || 'obstruction',
      });
    }
    if (evt.type === 'route-restored') {
      this._accessibility.brokenRoutes = this._accessibility.brokenRoutes.filter(
        (r) => !(r.from === evt.payload.from && r.to === evt.payload.to),
      );
    }
  }

  _applyTransportEvent(evt) {
    Object.assign(this._transport, evt.payload);
  }

  _applyOperationalEvent(evt) {
    if (evt.type === 'zone-status-change') {
      this.setZoneStatus(evt.zone, evt.payload.status);
    }
    if (evt.type === 'match-phase-change') {
      this._matchPhase = evt.payload.phase;
    }
  }

  /* ─── State mutations ─────────────────────────── */

  setZoneStatus(zoneId, status) {
    const zone = this._zones.get(zoneId);
    if (zone) {
      zone.status = status;
    }
  }

  updateTransport(updates) {
    Object.assign(this._transport, updates);
  }

  assignVolunteer(volunteerId, assignment, zone) {
    const vol = this._volunteers.find((v) => v.id === volunteerId);
    if (vol) {
      vol.status = 'assigned';
      vol.currentAssignment = assignment;
      vol.zone = zone || vol.zone;
    }
  }

  /* ─── Snapshot ────────────────────────────────── */

  /** Return a frozen copy of the full state tree. */
  getSnapshot() {
    return {
      venue: { ...this._venue },
      matchPhase: this._matchPhase,
      timestamp: new Date().toISOString(),
      zones: Object.fromEntries([...this._zones.entries()].map(([k, v]) => [k, { ...v }])),
      queues: Object.fromEntries([...this._queues.entries()].map(([k, v]) => [k, { ...v }])),
      weather: { ...this._weather },
      transport: { ...this._transport },
      accessibility: {
        ...this._accessibility,
        brokenRoutes: [...this._accessibility.brokenRoutes],
        alternativeRoutes: [...this._accessibility.alternativeRoutes],
      },
      sustainability: { ...this._sustainability },
      volunteers: this._volunteers.map((v) => ({ ...v })),
      incidents: Object.fromEntries([...this._incidents.entries()].map(([k, v]) => [k, { ...v }])),
      pendingDecisions: [...this._pendingDecisions],
    };
  }

  /** Get a single zone. */
  getZone(zoneId) {
    const z = this._zones.get(zoneId);
    return z ? { ...z } : null;
  }

  /** Get all zones as array. */
  getZones() {
    return [...this._zones.values()].map((z) => ({ ...z }));
  }

  /** Get all queues as array. */
  getQueues() {
    return [...this._queues.values()].map((q) => ({ ...q }));
  }

  /** Get volunteers. */
  getVolunteers() {
    return this._volunteers.map((v) => ({ ...v }));
  }

  /** Get available volunteers optionally filtered. */
  getAvailableVolunteers(role, language) {
    return this._volunteers.filter((v) => {
      if (v.status !== 'available') {
        return false;
      }
      if (role && v.role !== role) {
        return false;
      }
      if (language && !v.languages.includes(language)) {
        return false;
      }
      return true;
    });
  }

  /** Get weather. */
  getWeather() {
    return { ...this._weather };
  }

  /** Get transport. */
  getTransport() {
    return { ...this._transport };
  }

  /** Get sustainability. */
  getSustainability() {
    return { ...this._sustainability };
  }

  /** Get incidents. */
  getIncidents() {
    return [...this._incidents.values()].map((i) => ({ ...i }));
  }

  /** Get open incidents. */
  getOpenIncidents() {
    return this.getIncidents().filter((i) => i.status !== 'resolved');
  }

  /** Get zones with critical or high density. */
  getHotspots() {
    return this.getZones().filter((z) => z.densityBand === 'critical' || z.densityBand === 'high');
  }

  /** Add a pending decision ID. */
  addPendingDecision(decisionId) {
    this._pendingDecisions.push(decisionId);
  }

  /** Remove a pending decision ID. */
  removePendingDecision(decisionId) {
    this._pendingDecisions = this._pendingDecisions.filter((d) => d !== decisionId);
  }
}

/** Map density ratio to band label. */
function densityBand(ratio) {
  if (ratio >= 0.85) {
    return 'critical';
  }
  if (ratio >= 0.7) {
    return 'high';
  }
  if (ratio >= 0.4) {
    return 'moderate';
  }
  return 'low';
}
