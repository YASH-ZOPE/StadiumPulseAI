# Architecture

## Core Design: Event-Driven Decision Pipeline

Stadium Pulse AI is built around a **continuously changing state tree** connected by an **in-memory event bus**. This is fundamentally different from a traditional request-response API.

### Pipeline Flow

```
Event Sources → EventBus → StateEngine → RiskAnalyzer → CascadeSimulator
     ↓                                                        ↓
WebSocket ← ActionDispatch ← ApprovalGate ← GeminiOrchestrator/RuleEngine
     ↓                           ↓
  Frontend              AuditTimeline
```

### Domain Modules

| Module             | Responsibility                                                                   |
| ------------------ | -------------------------------------------------------------------------------- |
| `event-stream/`    | EventBus (pub/sub), event schema validation                                      |
| `stadium-state/`   | Mutable state tree, risk threshold detection, accessibility route checking       |
| `forecasting/`     | Queue time prediction (arrival-rate model), cascade impact propagation           |
| `decision-engine/` | Gemini API orchestration, deterministic rule fallback, human approval gate       |
| `dispatch/`        | Volunteer assignment optimization, multilingual alert composition, fan rerouting |
| `digital-twin/`    | Venue graph (zones + corridors), BFS pathfinding                                 |
| `audit/`           | Immutable event/decision timeline                                                |
| `simulation/`      | Connected demo scenario runner                                                   |
| `transport/`       | REST routes, WebSocket handler                                                   |
| `security/`        | Rate limiting, input sanitization, security headers                              |

### AI Integration

Google Gemini receives the **full stadium situation context** (risk report + cascade impact + state snapshot) and produces a **single coordinated response plan**. The deterministic Rule Engine always produces a valid plan as fallback.

### State Model

The `StadiumState` is a living object containing:

- Zone occupancy and density bands (18 zones)
- Queue wait times and forecasts (9 queue points)
- Weather conditions and operational impact
- Active incidents and their status
- Volunteer assignments and availability
- Accessibility route integrity
- Transport pressure and status
- Match phase
- Pending AI decisions
