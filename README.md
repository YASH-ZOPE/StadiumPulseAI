# Stadium Pulse AI 🏟️⚡

> **Real-time stadium digital twin and event-driven GenAI decision engine for FIFA World Cup 2026.**

**Stadium Pulse AI** transforms stadium operations from reactive to predictive. Instead of isolated forms, it maintains a living **digital twin** of MetLife Stadium — zones, gates, crowd density, queues, incidents, weather, accessibility constraints, transport pressure, sustainability metrics, and volunteer assignments — all connected through an **event-driven pipeline** that detects risks, predicts cascading impacts, and generates coordinated AI response plans via **Google Gemini 2.0 Flash**.

Modelled venue: **MetLife Stadium** (Host venue of the FIFA World Cup 2026 Final). Supported languages: **English, Spanish, French, Portuguese, and Arabic** (the 5 official tournament languages).

> **🌐 Live Production Deployment (Render):** [https://stadiumpulseai.onrender.com/](https://stadiumpulseai.onrender.com/)
> — deployed directly from source using the included `Dockerfile` and `render.yaml`.

---

## 1. Chosen vertical & persona

- **Personas:** Fans, Venue Organizers, Volunteers, Accessibility Support, Security & Emergency Staff.
- **Vertical:** Navigation + Accessibility + Crowd Management + Multilingual Assistance + Sustainability + Operational Intelligence + Real-Time Decision Support.
- **Product:** _Stadium Pulse AI_ — an integrated command center & fan assistant powered by a living event-driven digital twin.

---

## 🎯 Problem Statement Alignment Matrix

> **Challenge Statement**: Build a GenAI-enabled solution that enhances stadium operations and the overall tournament experience for fans, organizers, volunteers, or venue staff during FIFA World Cup 2026.

| FIFA Requirement Vertical         | Target Audience            | Source Code Implementation                                                                 | REST / WS Endpoint                | GenAI Capability                                   |
| :-------------------------------- | :------------------------- | :----------------------------------------------------------------------------------------- | :-------------------------------- | :------------------------------------------------- |
| **1. Navigation & Wayfinding**    | Fans & Guest Services      | [`src/digital-twin/venue-graph.js`](src/digital-twin/venue-graph.js)                       | `POST /api/assist`                | Grounded step-free wayfinding & BFS routes         |
| **2. Crowd Management**           | Security & Organizers      | [`src/stadium-state/risk-analyzer.js`](src/stadium-state/risk-analyzer.js)                 | `GET /api/state/snapshot`         | Density threshold risk detection & capacity alerts |
| **3. Accessibility Guardian**     | Wheelchair & Sensory Users | [`src/stadium-state/accessibility-guard.js`](src/stadium-state/accessibility-guard.js)     | `GET /api/state/snapshot`         | Corridor breach detection & sensory room status    |
| **4. Intelligent Transportation** | Transit Operations         | [`src/stadium-state/state-engine.js`](src/stadium-state/state-engine.js)                   | `GET /api/state/snapshot`         | Parking & shuttle pressure tracking                |
| **5. Sustainability Tracker**     | Eco-Operations Staff       | [`src/stadium-state/state-engine.js`](src/stadium-state/state-engine.js)                   | `GET /api/state/snapshot`         | Waste diverted %, refills, clean power kW & CO₂    |
| **6. Multilingual Assistance**    | Global Fans (5 Languages)  | [`src/decision-engine/gemini-orchestrator.js`](src/decision-engine/gemini-orchestrator.js) | `POST /api/assist`                | Gemini 2.0 Flash Q&A in EN, ES, FR, PT, AR         |
| **7. Operational Intelligence**   | Venue Operations Command   | [`src/transport/ws-handler.js`](src/transport/ws-handler.js)                               | `/ws/pulse`                       | Real-time WebSocket pub/sub telemetry stream       |
| **8. Real-Time Decision Support** | Incident Commanders        | [`src/decision-engine/approval-gate.js`](src/decision-engine/approval-gate.js)             | `POST /api/decisions/:id/approve` | Coordinated multi-team response plans & human gate |

---

## 2. Approach & logic — rules before LLM

The core architectural principle of **Stadium Pulse AI** is **deterministic decisions first, language model last**:

```
Telemetry / Events ─▶ Rule Engine / Risk Analyzer ─▶ Resolved Facts ─▶ Gemini 2.0 Flash ─▶ Operator Approval ─▶ Action Execution
                      • Pick step-free route      • Crowd density    • Phrasing & Plans    • Human-in-loop gate  • Rerouting & Dispatch
                      • Queue forecaster          • Corridor breach
                      • Cascade simulator         • Environmental
```

1. **Deterministic Processing (`StateEngine`, `RiskAnalyzer`, `VenueGraph`)**: Calculates routes, queue wait forecasts, accessibility corridor breaks, and density bands in code _before_ invoking any AI model.
2. **Grounded AI Generation (`GeminiOrchestrator`)**: Supplies **Google Gemini 2.0 Flash** with strictly bounded, pre-computed venue state facts. Gemini is restricted from inventing non-existent gates or routes.
3. **Deterministic Fallback (`RuleEngine`)**: If `GEMINI_API_KEY` is missing, unconfigured, or rate-limited, the system transparently falls back to local rules with `usedLlm: false` — **100% offline availability with 0 crashes**.

---

## 3. How it works — setup & run

### Requirements

- Node.js ≥ 20.0.0 or 22.0.0 ESM
- npm

### Installation & Run

```bash
# 1. Clone repository
git clone https://github.com/YASH-ZOPE/StadiumPulseAI.git
cd stadium-pulse-ai

# 2. Install dependencies
npm install

# 3. Configure Environment Variables
cp .env.example .env
```

Edit `.env` to supply your Google Gemini key:

```env
GEMINI_API_KEY=AIzaSy...your-gemini-key...
GEMINI_MODEL=gemini-2.0-flash
```

```bash
# 4. Start Server
npm start
```

Open your browser at **`http://localhost:3000`**.

---

## 4. Assumptions & Fixture Specifications

- Venue topology, corridor networks, and capacities represent MetLife Stadium fixture data ([`venue-data/metlife-stadium.json`](venue-data/metlife-stadium.json)).
- Dynamic crowd surges and scenario ticks stream in real-time over WebSockets (`/ws/pulse`).
- All 5 official FIFA World Cup 2026 languages (English, Spanish, French, Portuguese, Arabic) are fully supported both online via Gemini and offline via local templates.

---

## 5. Quality attributes

### 🔐 Security

- **No Hardcoded Secrets**: Secrets read strictly from `process.env.GEMINI_API_KEY`. Missing keys gracefully fall back to `RuleEngine`.
- **Strict Payload & Input Sanitization**: Input sanitizer strips control characters, caps query lengths, and neutralizes override phrases (`sanitizeInput`).
- **Prompt Injection Defense**: User input is wrapped in isolated data blocks; decision facts are computed _prior_ to LLM phrasing.
- **HTTP Security Headers & Rate Limiting**: Helmet CSP, HSTS, no-sniff headers, and token-bucket rate limiters (`100 req/min` general, `20 req/min` AI endpoint).

### ⚡ Efficiency

- **Decoupled Event Bus Pub/Sub**: High-performance in-memory event stream processing.
- **WebSocket Streaming**: State diffs push via `/ws/pulse` without continuous HTTP polling overhead.
- **Lightweight Repository Footprint**: Git pack size **92.42 KB** (well under the 10 MB limit).

### ♿ Accessibility — WCAG 2.1 AA

- **Semantic HTML5 Architecture**: Semantic landmarks (`header`, `main`, `section`, `footer`), single `<h1>`, logical heading hierarchy.
- **Screen Reader & Live Regions**: Dynamic updates utilize `aria-live="polite"` and explicitly connected `<label>` controls.
- **High Contrast & Multi-cue Indicators**: Density bands use text, shape icons (`●●○`), and high-contrast color palettes.
- **Automated Audit**: **axe-core 4.10.2** WCAG 2.0/2.1 A + AA scan of the live page reported **0 violations / 21 checks passed**.

### 🧪 Testing & CI Automation

- **79 Native Tests Passing (100% Pass Rate)** with 0 external mock frameworks.
- **Dual CI Pipelines**: GitHub Actions multi-node matrix test gate ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) + GitHub CodeQL Static Analysis Security Scanner ([`.github/workflows/codeql.yml`](.github/workflows/codeql.yml)).

```bash
npm test             # Runs full domain test suite (79 tests)
npm run lint         # ESLint flat config (0 errors, 0 warnings)
npm run typecheck    # TypeScript contract verification (tsc --noEmit)
npm run format:check # Prettier code style enforcement
npm run check        # Runs lint + format:check + typecheck + test in sequence
```

---

## 6. Architecture & Code Map

```
                     ┌─────────────────────────────────────────┐
 Browser UI ────────▶│ Express HTTP & WebSockets (ws-handler)  │
 index.html / JS     │ • Security headers & rate limiter       │
                     └────────────────────┬────────────────────┘
                                          │ Events / Requests
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │ EventBus (Pub/Sub) & StateEngine        │
                     │ • Living state tree (zones/queues/a11y) │
                     │ • Sustainability metrics & incidents    │
                     └────────────────────┬────────────────────┘
                                          │ Risk Signals
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │ RiskAnalyzer & CascadeSimulator         │
                     │ • Threshold detection & graph spillover │
                     └────────────────────┬────────────────────┘
                                          │ Resolved Facts
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │ GeminiOrchestrator (Google Gemini 2.0)  │
                     │ • Phrasing & multi-team action plans    │
                     │ • Grounded facts & RuleEngine fallback  │
                     └────────────────────┬────────────────────┘
                                          │ Action Recommendations
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │ ApprovalGate (Human Operator Control)   │
                     │ • Approve / reject state machine        │
                     └─────────────────────────────────────────┘
```

```
stadium-pulse-ai/
├── src/
│   ├── audit/              # Immutable chronological audit timeline
│   ├── core/               # Bootstrap, environment loader, HTTP server
│   ├── decision-engine/    # GeminiOrchestrator, RuleEngine, ApprovalGate
│   ├── digital-twin/       # VenueGraph (BFS shortest & step-free pathfinding)
│   ├── dispatch/           # VolunteerDispatcher, AlertComposer, FanRerouter
│   ├── event-stream/       # EventBus, EventSchema validation
│   ├── forecasting/        # QueueForecaster, CascadeSimulator
│   ├── security/           # RateLimiter, Helmet Headers
│   ├── simulation/         # 11-Step scenario runner
│   ├── stadium-state/      # StateEngine, RiskAnalyzer, AccessibilityGuard
│   ├── transport/          # REST routes & WebSocket handler (/ws/pulse)
│   └── types/              # TypeScript AST type contracts (stadium-pulse.d.ts)
├── public/                 # Command center 3-column UI & interactive SVG twin
├── venue-data/             # MetLife Stadium topology & fixture definitions
├── test/                   # Native domain unit & integration tests (79 tests)
├── docs/                   # Architecture diagrams & deployment guides
├── .github/workflows/      # ci.yml & codeql.yml GitHub Actions workflows
├── Dockerfile              # Multi-stage production container image
├── render.yaml             # Render deployment specification
├── tsconfig.json           # TypeScript configuration
├── package.json            # Scripts & dependencies
└── README.md               # Documentation & problem alignment matrix
```

---

## 📄 License

MIT License — Copyright (c) 2026 Yash Zope.
