/**
 * StateEngine unit tests.
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { StateEngine } from '../src/stadium-state/state-engine.js';
import { EventBus } from '../src/event-stream/event-bus.js';
import { loadVenueData } from '../src/digital-twin/venue-graph.js';

describe('StateEngine', () => {
  let state;
  let bus;

  beforeEach(() => {
    bus = new EventBus();
    const venueData = loadVenueData();
    state = new StateEngine(venueData, bus);
  });

  it('should initialize with all venue zones', () => {
    const zones = state.getZones();
    assert.ok(zones.length > 0);
    assert.ok(zones.every(z => z.status === 'open'));
    assert.ok(zones.every(z => z.density === 0));
  });

  it('should initialize with all queue points', () => {
    const queues = state.getQueues();
    assert.ok(queues.length > 0);
    assert.ok(queues.every(q => q.currentWaitMinutes === 0));
  });

  it('should initialize with volunteers', () => {
    const vols = state.getVolunteers();
    assert.ok(vols.length > 0);
    assert.ok(vols.every(v => v.status === 'available'));
  });

  it('should apply crowd events via density', () => {
    state.applyEvent({ category: 'crowd', zone: 'gate-b', payload: { density: 0.75 } });
    const zone = state.getZone('gate-b');
    assert.equal(zone.density, 0.75);
    assert.equal(zone.densityBand, 'high');
  });

  it('should apply crowd events via occupancy', () => {
    state.applyEvent({ category: 'crowd', zone: 'gate-a', payload: { occupancy: 3600 } });
    const zone = state.getZone('gate-a');
    assert.equal(zone.currentOccupancy, 3600);
    assert.ok(zone.density > 0);
  });

  it('should clamp density between 0 and 1', () => {
    state.applyEvent({ category: 'crowd', zone: 'gate-a', payload: { density: 1.5 } });
    assert.equal(state.getZone('gate-a').density, 1);
    state.applyEvent({ category: 'crowd', zone: 'gate-a', payload: { density: -0.5 } });
    assert.equal(state.getZone('gate-a').density, 0);
  });

  it('should classify density bands correctly', () => {
    state.applyEvent({ category: 'crowd', zone: 'gate-a', payload: { density: 0.3 } });
    assert.equal(state.getZone('gate-a').densityBand, 'low');

    state.applyEvent({ category: 'crowd', zone: 'gate-a', payload: { density: 0.5 } });
    assert.equal(state.getZone('gate-a').densityBand, 'moderate');

    state.applyEvent({ category: 'crowd', zone: 'gate-a', payload: { density: 0.75 } });
    assert.equal(state.getZone('gate-a').densityBand, 'high');

    state.applyEvent({ category: 'crowd', zone: 'gate-a', payload: { density: 0.9 } });
    assert.equal(state.getZone('gate-a').densityBand, 'critical');
  });

  it('should apply weather events', () => {
    state.applyEvent({ category: 'weather', payload: { condition: 'thunderstorm', severity: 'warning' } });
    const w = state.getWeather();
    assert.equal(w.condition, 'thunderstorm');
    assert.equal(w.severity, 'warning');
  });

  it('should apply incident events', () => {
    state.applyEvent({ category: 'incident', type: 'incident-report', zone: 'gate-b', severity: 'critical', payload: { type: 'medical', detail: 'Test', incidentId: 'inc-1' }, id: 'evt-1', timestamp: new Date().toISOString() });
    const incidents = state.getOpenIncidents();
    assert.equal(incidents.length, 1);
    assert.equal(incidents[0].type, 'medical');
  });

  it('should resolve incidents', () => {
    state.applyEvent({ category: 'incident', type: 'incident-report', zone: 'gate-b', severity: 'critical', payload: { incidentId: 'inc-2' }, id: 'evt-2', timestamp: new Date().toISOString() });
    state.applyEvent({ category: 'incident', type: 'incident-resolved', payload: { incidentId: 'inc-2' } });
    assert.equal(state.getOpenIncidents().length, 0);
  });

  it('should update transport state', () => {
    state.applyEvent({ category: 'transport', payload: { transitLoad: 'high', shuttleStatus: 'delayed' } });
    const t = state.getTransport();
    assert.equal(t.transitLoad, 'high');
    assert.equal(t.shuttleStatus, 'delayed');
  });

  it('should track accessibility broken routes', () => {
    state.applyEvent({ category: 'accessibility', type: 'route-broken', payload: { from: 'a', to: 'b', reason: 'test' } });
    const snap = state.getSnapshot();
    assert.equal(snap.accessibility.brokenRoutes.length, 1);
  });

  it('should restore accessibility routes', () => {
    state.applyEvent({ category: 'accessibility', type: 'route-broken', payload: { from: 'a', to: 'b' } });
    state.applyEvent({ category: 'accessibility', type: 'route-restored', payload: { from: 'a', to: 'b' } });
    assert.equal(state.getSnapshot().accessibility.brokenRoutes.length, 0);
  });

  it('should set zone status', () => {
    state.setZoneStatus('gate-a', 'closed');
    assert.equal(state.getZone('gate-a').status, 'closed');
  });

  it('should assign volunteers', () => {
    const vols = state.getVolunteers();
    const first = vols[0];
    state.assignVolunteer(first.id, 'Crowd management', 'gate-b');
    const updated = state.getVolunteers().find(v => v.id === first.id);
    assert.equal(updated.status, 'assigned');
    assert.equal(updated.currentAssignment, 'Crowd management');
    assert.equal(updated.zone, 'gate-b');
  });

  it('should filter available volunteers by role', () => {
    const stewards = state.getAvailableVolunteers('steward');
    assert.ok(stewards.every(v => v.role === 'steward'));
  });

  it('should return hotspots', () => {
    state.applyEvent({ category: 'crowd', zone: 'gate-b', payload: { density: 0.9 } });
    const hotspots = state.getHotspots();
    assert.ok(hotspots.length >= 1);
    assert.ok(hotspots.some(z => z.id === 'gate-b'));
  });

  it('should emit state:changed on event application', () => {
    let emitted = false;
    bus.on('state:changed', () => { emitted = true; });
    state.applyEvent({ category: 'crowd', zone: 'gate-a', payload: { density: 0.5 } });
    assert.ok(emitted);
  });

  it('should produce a complete snapshot', () => {
    const snap = state.getSnapshot();
    assert.ok(snap.venue);
    assert.ok(snap.zones);
    assert.ok(snap.queues);
    assert.ok(snap.weather);
    assert.ok(snap.transport);
    assert.ok(snap.accessibility);
    assert.ok(Array.isArray(snap.volunteers));
    assert.ok(snap.timestamp);
  });
});
