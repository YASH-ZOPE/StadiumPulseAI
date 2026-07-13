/**
 * Application entry point.
 *
 * Wires the HTTP server, WebSocket upgrade, event pipeline, stadium state
 * engine and simulation together, then starts listening. Handles graceful
 * shutdown on SIGTERM / SIGINT.
 */
import { createHttpLayer } from './http.js';
import env from './environment.js';
import { EventBus } from '../event-stream/event-bus.js';
import { StateEngine } from '../stadium-state/state-engine.js';
import { RiskAnalyzer } from '../stadium-state/risk-analyzer.js';
import { AccessibilityGuard } from '../stadium-state/accessibility-guard.js';
import { QueueForecaster } from '../forecasting/queue-forecaster.js';
import { CascadeSimulator } from '../forecasting/cascade-simulator.js';
import { GeminiOrchestrator } from '../decision-engine/gemini-orchestrator.js';
import { RuleEngine } from '../decision-engine/rule-engine.js';
import { ApprovalGate } from '../decision-engine/approval-gate.js';
import { VolunteerDispatcher } from '../dispatch/volunteer-dispatcher.js';
import { AlertComposer } from '../dispatch/alert-composer.js';
import { FanRerouter } from '../dispatch/fan-rerouter.js';
import { Timeline } from '../audit/timeline.js';
import { ScenarioRunner } from '../simulation/scenario-runner.js';
import { attachWsHandler } from '../transport/ws-handler.js';
import { loadVenueData } from '../digital-twin/venue-graph.js';

/* ── Build the domain graph ─────────────────────── */
const venueData = loadVenueData();
const bus = new EventBus();
const timeline = new Timeline();
const state = new StateEngine(venueData, bus);
const risk = new RiskAnalyzer(state, bus);
const accessibility = new AccessibilityGuard(state, bus);
const queueForecaster = new QueueForecaster(state, bus);
const cascade = new CascadeSimulator(state, bus);
const ruleEngine = new RuleEngine(state);
const gemini = new GeminiOrchestrator(state, ruleEngine);
const approval = new ApprovalGate(bus, timeline);
const volunteers = new VolunteerDispatcher(state, bus);
const alerts = new AlertComposer(gemini);
const rerouter = new FanRerouter(state);
const scenario = new ScenarioRunner(bus, state);

/** Central context object threaded to routes and WS. */
const ctx = {
  bus,
  state,
  risk,
  accessibility,
  queueForecaster,
  cascade,
  gemini,
  ruleEngine,
  approval,
  volunteers,
  alerts,
  rerouter,
  timeline,
  scenario,
  venueData,
};

/* ── Wire event pipeline ────────────────────────── */
bus.on('event:new', (evt) => {
  state.applyEvent(evt);
  timeline.recordEvent(evt);
});

bus.on('state:changed', () => {
  risk.evaluate();
  queueForecaster.update();
  accessibility.check();
});

bus.on('risk:detected', async (riskReport) => {
  const cascadeImpact = cascade.analyze(riskReport);
  const decision = await gemini.orchestrate(riskReport, cascadeImpact);
  approval.propose(decision);
  timeline.recordDecision(decision);
  bus.emit('decision:new', decision);
});

bus.on('decision:approved', (decision) => {
  for (const action of decision.aiRecommendation.actions) {
    if (decision.approval.approvedActions.includes(action.id)) {
      executeAction(action, decision, ctx);
    }
  }
  timeline.recordApproval(decision);
  bus.emit('decision:updated', decision);
});

/** Execute a single approved action. */
function executeAction(action, decision, context) {
  switch (action.type) {
    case 'dispatch-volunteer':
      context.volunteers.assign(action);
      break;
    case 'announce':
      context.alerts.compose(action, context.state.getSnapshot());
      break;
    case 'reroute':
      context.rerouter.updateRoutes(action);
      break;
    case 'close-zone':
    case 'restrict-zone':
    case 'open-zone':
      context.state.setZoneStatus(action.target, action.detail);
      break;
    case 'adjust-transport':
      context.state.updateTransport(action.detail);
      break;
    case 'escalate':
      context.timeline.recordEscalation(action);
      break;
    default:
      break;
  }
}

/* ── Start HTTP + WS ────────────────────────────── */
const { app, wss } = createHttpLayer(ctx);

const server = app.listen(env.port, () => {
  console.log(`[Stadium Pulse AI] listening on :${env.port}  env=${env.nodeEnv}  ai=${env.gemini.enabled ? 'gemini' : 'offline'}`);
});

server.on('upgrade', (req, socket, head) => {
  if (req.url === '/ws/pulse') {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

attachWsHandler(wss, ctx);

/* ── Graceful shutdown ──────────────────────────── */
function shutdown(signal) {
  console.log(`[Stadium Pulse AI] ${signal} received — shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { app, server, ctx };
