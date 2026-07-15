/**
 * Cascade impact simulator.
 *
 * Models how a disruption in one zone propagates through the venue dependency
 * graph. For example, closing Gate B increases pressure on nearby Gate A and
 * Gate C, which may trigger queue threshold breaches and accessibility breaks.
 *
 * The simulation is deterministic — same input always produces the same
 * cascade — making it auditable and testable.
 */
import { loadVenueData } from '../digital-twin/venue-graph.js';

export class CascadeSimulator {
  /**
   * @param {import('../stadium-state/state-engine.js').StateEngine} state
   * @param {import('../event-stream/event-bus.js').EventBus} bus
   */
  constructor(state, bus) {
    this._state = state;
    this._bus = bus;
    this._venueData = loadVenueData();
  }

  /**
   * Analyse the cascade impact of a risk event or zone closure.
   * @param {any} riskReport — from RiskAnalyzer
   * @returns {any} cascade impact report
   */
  analyze(riskReport) {
    const snapshot = this._state.getSnapshot();
    const affectedZone = riskReport.zone;
    const effects = [];

    if (!affectedZone) {
      return this._analyzeGlobalRisk(riskReport, snapshot);
    }

    /* Find connected zones. */
    const edges = this._venueData.adjacency.get(affectedZone) || [];
    const connectedZones = edges.map((e) => e.to);

    /* Model density redistribution: if one zone is overloaded or closed,
       its crowd redistributes to connected zones proportionally. */
    const sourceZone = snapshot.zones[affectedZone];
    if (!sourceZone) {
      return { effects, riskLevel: 'low', summary: 'Unknown zone' };
    }

    const displacedOccupancy =
      sourceZone.status === 'closed'
        ? sourceZone.currentOccupancy
        : Math.round(sourceZone.currentOccupancy * 0.3);

    const openNeighbours = connectedZones
      .map((id) => snapshot.zones[id])
      .filter((z) => z && z.status === 'open');

    const perNeighbour =
      openNeighbours.length > 0 ? Math.round(displacedOccupancy / openNeighbours.length) : 0;

    for (const neighbour of openNeighbours) {
      const newOccupancy = neighbour.currentOccupancy + perNeighbour;
      const newDensity = newOccupancy / neighbour.capacity;
      const newBand =
        newDensity >= 0.85
          ? 'critical'
          : newDensity >= 0.7
            ? 'high'
            : newDensity >= 0.4
              ? 'moderate'
              : 'low';

      effects.push({
        zone: neighbour.id,
        label: neighbour.label,
        currentDensity: Math.round(neighbour.density * 100),
        projectedDensity: Math.round(newDensity * 100),
        currentBand: neighbour.densityBand,
        projectedBand: newBand,
        additionalPeople: perNeighbour,
        wouldBreachThreshold: newBand === 'critical' && neighbour.densityBand !== 'critical',
      });
    }

    /* Check accessibility impact. */
    const accessibilityImpact = [];
    for (const edge of edges) {
      if (
        edge.accessible &&
        (sourceZone.status === 'closed' || sourceZone.status === 'emergency')
      ) {
        accessibilityImpact.push({
          corridor: edge.label,
          from: edge.from || affectedZone,
          to: edge.to,
          impact: 'Accessible route through this zone will be blocked',
        });
      }
    }

    /* Check queue impact. */
    const queueImpact = [];
    const queues = Object.values(snapshot.queues);
    for (const q of queues) {
      const connected = connectedZones.includes(q.zone);
      if (connected) {
        const additionalWait = Math.round(perNeighbour / Math.max(q.throughputPerMin, 1));
        queueImpact.push({
          queue: q.label,
          currentWait: q.currentWaitMinutes,
          projectedAdditionalWait: additionalWait,
          projectedTotalWait: q.currentWaitMinutes + additionalWait,
        });
      }
    }

    const criticalEffects = effects.filter((e) => e.wouldBreachThreshold);
    const riskLevel =
      criticalEffects.length >= 2
        ? 'critical'
        : criticalEffects.length === 1
          ? 'high'
          : effects.length > 0
            ? 'elevated'
            : 'low';

    return {
      sourceZone: affectedZone,
      sourceLabel: sourceZone.label,
      trigger: riskReport.detail,
      effects,
      accessibilityImpact,
      queueImpact,
      riskLevel,
      summary: `Closing/restricting ${sourceZone.label} would redistribute ~${displacedOccupancy} people across ${openNeighbours.length} connected zone(s). ${criticalEffects.length} zone(s) would reach critical density.`,
    };
  }

  /** Handle global risks (weather, multi-incident) that affect all zones. */
  _analyzeGlobalRisk(riskReport, snapshot) {
    const zones = Object.values(snapshot.zones);
    const highDensityZones = zones.filter(
      (z) => z.densityBand === 'high' || z.densityBand === 'critical',
    );

    return {
      sourceZone: null,
      trigger: riskReport.detail,
      effects: highDensityZones.map((z) => ({
        zone: z.id,
        label: z.label,
        currentDensity: Math.round(z.density * 100),
        projectedDensity: Math.round(z.density * 100),
        currentBand: z.densityBand,
        projectedBand: z.densityBand,
        additionalPeople: 0,
        wouldBreachThreshold: false,
      })),
      accessibilityImpact: [],
      queueImpact: [],
      riskLevel: riskReport.severity === 'critical' ? 'high' : 'elevated',
      summary: `Global ${riskReport.type} risk affecting ${highDensityZones.length} high-density zone(s).`,
    };
  }

  /** Simulate cascade for a specific zone closure (for UI preview). */
  previewCascade(zoneId) {
    return this.analyze({
      type: 'zone-closure-preview',
      zone: zoneId,
      severity: 'warning',
      detail: `Preview: what happens if ${zoneId} is closed`,
    });
  }
}
