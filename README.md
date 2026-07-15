# Stadium Pulse AI 🏟️⚡

> Real-time stadium digital twin and event-driven GenAI decision engine for FIFA World Cup 2026.

**Stadium Pulse AI** transforms stadium operations from reactive to predictive. Instead of isolated forms, it maintains a living **digital twin** of the venue — zones, gates, crowd density, queues, incidents, weather, accessibility constraints, transport pressure, and volunteer assignments — all connected through an **event-driven pipeline** that detects risks, predicts cascading impacts, and generates coordinated AI response plans via **Google Gemini 2.0 Flash**.

---

## 🎯 Problem Statement Alignment Matrix

> **Challenge**: Build a GenAI-enabled solution that enhances stadium operations and the overall tournament experience for fans, organizers, volunteers, or venue staff during FIFA World Cup 2026.

| FIFA Requirement Vertical         | Target Audience            | Source Code Implementation                                                                 | REST / WS Endpoint                | GenAI Capability                           |
| :-------------------------------- | :------------------------- | :----------------------------------------------------------------------------------------- | :-------------------------------- | :----------------------------------------- |
| **1. Navigation & Wayfinding**    | Fans & Guest Services      | [`src/digital-twin/venue-graph.js`](src/digital-twin/venue-graph.js)                       | `POST /api/assist`                | Grounded step-free wayfinding              |
| **2. Crowd Management**           | Security & Organizers      | [`src/stadium-state/risk-analyzer.js`](src/stadium-state/risk-analyzer.js)                 | `GET /api/state/snapshot`         | Density threshold risk detection           |
| **3. Accessibility Guardian**     | Wheelchair & Sensory Users | [`src/stadium-state/accessibility-guard.js`](src/stadium-state/accessibility-guard.js)     | `GET /api/state/snapshot`         | Corridor breach & sensory status           |
| **4. Intelligent Transportation** | Transit Operations         | [`src/stadium-state/state-engine.js`](src/stadium-state/state-engine.js)                   | `GET /api/state/snapshot`         | Parking & shuttle pressure tracking        |
| **5. Sustainability Tracker**     | Eco-Operations Staff       | [`src/stadium-state/state-engine.js`](src/stadium-state/state-engine.js)                   | `GET /api/state/snapshot`         | Waste, refills, clean power & CO₂          |
| **6. Multilingual Assistance**    | Global Fans (5 Languages)  | [`src/decision-engine/gemini-orchestrator.js`](src/decision-engine/gemini-orchestrator.js) | `POST /api/assist`                | Gemini 2.0 Flash Q&A in EN, ES, FR, PT, AR |
| **7. Operational Intelligence**   | Venue Operations Command   | [`src/transport/ws-handler.js`](src/transport/ws-handler.js)                               | `/ws/pulse`                       | Real-time WebSocket pub/sub stream         |
| **8. Real-Time Decision Support** | Incident Commanders        | [`src/decision-engine/approval-gate.js`](src/decision-engine/approval-gate.js)             | `POST /api/decisions/:id/approve` | Coordinated multi-team response plans      |

---

## 🏛️ Command Center Dashboard Breakdown

### 1. 🗺️ Digital Twin & Cascade Simulator (Left Panel)

- **Interactive Stadium Map**: Live SVG graph of MetLife Stadium (18 operational zones + corridors).
- **Dynamic Color Coding**: Nodes resize and change state in real-time based on density:
  - 🟢 **Low** (<40% capacity) | 🟡 **Moderate** (40-70%) | 🟠 **High** (70-85%) | 🔴 **Critical** (>85%)
- **Cascade Impact Simulator**: Click any zone to preview how closing or restricting it will redistribute crowds across connected zones and affect wheelchair pathways.

### 2. ⚡ Live Operations (Middle Panel)

- **Active Risk Cards**: Real-time cards flagging critical crowding, excessive queues, weather threats, and accessibility route breaks.
- **Queue Forecast Engine**: Arrival-rate predictive model forecasting wait times over a 15-minute lookahead window across 9 gate and concession queue points.
- **WebSocket Event Stream**: Real-time event log streaming all sensor and operator signals via `/ws/pulse`.

### 3. 🤖 AI Decision Center & Fan Assistant (Right Panel & Floating Drawer)

- **AI Incident Commander**: Gemini generates coordinated response plans across security, volunteers, accessibility, announcements, and transit.
- **Human-in-the-Loop Approval Gate**: Operators can approve all, approve a subset, or reject recommendations before execution.
- **Volunteer Dispatch Board**: Dynamic roster auto-matching volunteer roles, language skills, and location to approved actions.
- **Audit Timeline**: Immutable chronological log of events, AI recommendations, operator approvals, and action outcomes.
- **🤖 AI Fan Assistant Chatbot**: Floating conversational assistant (`POST /api/assist`) providing grounded, localized guidance in English, Español, Français, and Português based on real-time stadium context.

---

## 🎬 ▶ Run Demo (11-Step Connected Scenario)

Clicking **▶ Run Demo** in the Digital Twin panel executes a real-time cascading matchday scenario:

1. **Step 1 — Gate B Surge**: Crowd density at Gate B rises to 87% (Critical).
2. **Step 2 — Queue Threshold**: Gate B wait time forecast crosses 24 minutes.
3. **Step 3 — Severe Weather**: Thunderstorm warning issued for MetLife Stadium.
4. **Step 4 — Accessibility Disruption**: East Concourse accessible corridor blocked.
5. **Step 5 — Medical Emergency**: Fan collapse reported at Food Court NE.
6. **Step 6 — Crowd Displacement**: Gate A density spikes due to spillover from Gate B.
7. **Step 7 — Transit Pressure**: Transit Hub load becomes High with 18 min rideshare wait.
8. **Step 8 — Sentiment Shift**: Fan feedback trends negative regarding queues and weather.
9. **Step 9 — Risk Analysis**: RiskAnalyzer detects multi-system risks & computes cascade impact.
10. **Step 10 — Gemini Orchestration**: **Google Gemini 2.0 Flash** generates a coordinated response plan.
11. **Step 11 — Audit Logged**: Plan is submitted for operator approval and logged to the timeline.

---

## 🏗️ Technical Architecture

```
Event Sources (Sensors/Weather/Staff)
       │
       ▼
┌───────────────────────────────────────────────────────────┐
│                    EventBus (Pub/Sub)                     │
└──────┬──────────────────────┬──────────────────────┬──────┘
       │                      │                      │
       ▼                      ▼                      ▼
┌──────────────┐      ┌──────────────┐      ┌─────────────────┐
│ StateEngine  │      │ RiskAnalyzer │      │ QueueForecaster │
│ (Living Tree)│      │ (Thresholds) │      │ (Arrival Rate)  │
└──────┬───────┘      └──────┬───────┘      └─────────────────┘
       │                     │
       ├─────────────────────┘
       ▼
┌───────────────────────────────────────────────────────────┐
│        CascadeSimulator (Zone Graph Redistribution)       │
└────────────────────────────┬──────────────────────────────┘
                             │
                             ▼
┌───────────────────────────────────────────────────────────┐
│    GeminiOrchestrator (Google Gemini 2.0 Flash / Rules)   │
└────────────────────────────┬──────────────────────────────┘
                             │ Coordinated Plan
                             ▼
┌───────────────────────────────────────────────────────────┐
│          ApprovalGate (Human Operator State Machine)      │
└────────────────────────────┬──────────────────────────────┘
                             │ Approved Actions
       ┌─────────────────────┼─────────────────────┐
       ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ Volunteer    │      │ Alert        │      │ Fan Rerouter │
│ Dispatcher   │      │ Composer     │      │ (Pathfinder) │
└──────────────┘      └──────────────┘      └──────────────┘
       │                     │                     │
       └─────────────────────┼─────────────────────┘
                             ▼
┌───────────────────────────────────────────────────────────┐
│                 Audit Timeline (Replay Log)               │
└────────────────────────────┬──────────────────────────────┘
                             │ WebSocket Push
                             ▼
┌───────────────────────────────────────────────────────────┐
│ Frontend Command Center (Reactive Vanilla JS & WebSockets)│
└───────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start Guide

### Prerequisites

- Node.js ≥ 20
- npm

### Installation & Setup

```bash
# 1. Clone repository
git clone <your-repo-url>
cd stadium-pulse-ai

# 2. Install dependencies
npm install

# 3. Configure Environment
cp .env.example .env
```

Edit `.env` and set your Google Gemini API Key:

```env
GEMINI_API_KEY=AIzaSy...your-gemini-key...
GEMINI_MODEL=gemini-2.0-flash
```

### Run Server

```bash
# Start server
npm start

# Open command center in browser
# → http://localhost:3000
```

> **Note**: If `GEMINI_API_KEY` is not provided, the application runs fully offline using a deterministic `RuleEngine` fallback.

---

## 🧪 Testing & Code Quality

The codebase includes **79 native tests** covering all domain modules, schemas, pathfinding, and risk detectors.

```bash
# Run test suite (100% offline, zero external dependencies)
npm test

# Linting
npm run lint

# Formatting check
npm run format:check
```

---

## 🔐 Security & Reliability Controls

- **HTTP Security**: Helmet Security Headers (CSP, HSTS, X-Frame-Options).
- **Rate Limiting**: Two-tier rate limiters (`100 req/min` general, `20 req/min` AI endpoint).
- **Prompt Injection Defense**: Sanitizer strips control characters, length-caps queries, and neutralizes override phrases.
- **Content-Type Guard**: Mandatory `application/json` check on all state-mutating requests (HTTP 415).
- **Grounded AI Guard**: Pre-computes facts deterministically before feeding to Gemini to prevent hallucinated venue information.

---

## 📡 REST & WebSocket API Reference

### WebSocket API

- **Endpoint**: `WS /ws/pulse`
- **Events Streamed**: `state:snapshot`, `state:diff`, `event:new`, `decision:new`, `decision:updated`, `decision:approved`, `scenario:step`.

### REST API Endpoints

| Method | Endpoint                     | Description                                                |
| ------ | ---------------------------- | ---------------------------------------------------------- |
| `GET`  | `/api/health`                | Service health & AI provider status (`gemini` / `offline`) |
| `GET`  | `/api/metrics`               | AI call metrics & audit stats                              |
| `GET`  | `/api/state/snapshot`        | Complete stadium state tree                                |
| `GET`  | `/api/state/zones/:zoneId`   | Details for a specific zone                                |
| `GET`  | `/api/venue/map`             | Zone topology & corridor connectivity                      |
| `GET`  | `/api/forecast/queues`       | Live queue predictions for all 9 points                    |
| `GET`  | `/api/cascade/:zoneId`       | Preview cascade simulation for a zone                      |
| `GET`  | `/api/volunteers`            | Active volunteer roster & assignments                      |
| `GET`  | `/api/audit/timeline`        | Ordered audit trail log                                    |
| `GET`  | `/api/decisions/pending`     | List pending AI recommendations                            |
| `POST` | `/api/commands/approve`      | Approve AI decision actions                                |
| `POST` | `/api/commands/reject`       | Reject AI decision recommendation                          |
| `POST` | `/api/commands/inject-event` | Inject custom telemetry event                              |
| `POST` | `/api/simulation/scenario`   | Execute 11-step connected demo                             |
| `POST` | `/api/assist`                | AI Fan Assistant grounded Q&A chatbot                      |

---

## 📄 License

MIT
