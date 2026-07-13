/**
 * Risk analyzer — threshold detection and risk level assessment.
 *
 * Continuously evaluates the stadium state against configurable thresholds.
 * When a risk condition is detected, it emits a structured risk report to the
 * event bus so the decision engine can generate a coordinated response.
 */
export class RiskAnalyzer {
  /**
   * @param {import('./state-engine.js').StateEngine} state
   * @param {import('../event-stream/event-bus.js').EventBus} bus
   */
  constructor(state, bus) {
    this._state = state;
    this._bus = bus;
    /** Track emitted risks to avoid duplicate alerts within a window. */
    this._recentRisks = new Map();
    this._cooldownMs = 30_000;
  }

  /** Evaluate current state for risk conditions. */
  evaluate() {
    const risks = [];

    /* ── Crowd density risks ───────────────────── */
    const hotspots = this._state.getHotspots();
    for (const zone of hotspots) {
      if (zone.densityBand === 'critical') {
        risks.push({
          type: 'crowd-critical',
          zone: zone.id,
          severity: 'critical',
          detail: `${zone.label} at ${Math.round(zone.density * 100)}% capacity`,
          metric: zone.density,
        });
      } else if (zone.densityBand === 'high') {
        risks.push({
          type: 'crowd-high',
          zone: zone.id,
          severity: 'warning',
          detail: `${zone.label} at ${Math.round(zone.density * 100)}% capacity`,
          metric: zone.density,
        });
      }
    }

    /* ── Queue threshold risks ─────────────────── */
    const queues = this._state.getQueues();
    for (const q of queues) {
      if (q.currentWaitMinutes >= 20) {
        risks.push({
          type: 'queue-excessive',
          zone: q.zone,
          severity: q.currentWaitMinutes >= 30 ? 'critical' : 'warning',
          detail: `${q.label} queue at ${q.currentWaitMinutes} min (trend: ${q.trend})`,
          metric: q.currentWaitMinutes,
        });
      }
    }

    /* ── Weather risks ─────────────────────────── */
    const weather = this._state.getWeather();
    if (weather.severity === 'warning' || weather.severity === 'severe') {
      risks.push({
        type: 'weather-threat',
        zone: null,
        severity: weather.severity === 'severe' ? 'critical' : 'warning',
        detail: `${weather.condition} — ${weather.forecastChange || 'conditions deteriorating'}`,
        metric: null,
      });
    }

    /* ── Accessibility risks ───────────────────── */
    const access = this._state.getSnapshot().accessibility;
    if (access.brokenRoutes.length > 0) {
      risks.push({
        type: 'accessibility-disruption',
        zone: access.brokenRoutes[0]?.from || null,
        severity: 'warning',
        detail: `${access.brokenRoutes.length} accessible route(s) currently broken`,
        metric: access.brokenRoutes.length,
      });
    }

    /* ── Open incident count ───────────────────── */
    const openIncidents = this._state.getOpenIncidents();
    if (openIncidents.filter((i) => i.severity === 'critical').length >= 2) {
      risks.push({
        type: 'multi-incident',
        zone: null,
        severity: 'critical',
        detail: `${openIncidents.length} open incidents (${openIncidents.filter((i) => i.severity === 'critical').length} critical)`,
        metric: openIncidents.length,
      });
    }

    /* ── Emit de-duplicated risks ──────────────── */
    const now = Date.now();
    for (const risk of risks) {
      const key = `${risk.type}:${risk.zone}`;
      const last = this._recentRisks.get(key);
      if (last && now - last < this._cooldownMs) {
        continue;
      }
      this._recentRisks.set(key, now);
      this._bus.emit('risk:detected', {
        ...risk,
        timestamp: new Date().toISOString(),
        stateSnapshot: this._state.getSnapshot(),
      });
    }

    /* ── Prune old cooldowns ───────────────────── */
    for (const [key, ts] of this._recentRisks) {
      if (now - ts > this._cooldownMs * 3) {
        this._recentRisks.delete(key);
      }
    }

    return risks;
  }

  /** Reset cooldowns (for tests). */
  resetCooldowns() {
    this._recentRisks.clear();
  }
}
