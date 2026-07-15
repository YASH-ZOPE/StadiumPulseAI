/**
 * Stadium Pulse AI — Command Center Frontend
 *
 * WebSocket-driven reactive UI that renders the live stadium state, event
 * feed, risk cards, queue forecasts, AI decision drawer, volunteer board
 * and audit timeline. Zero framework dependencies — vanilla JS.
 */
(function () {
  'use strict';

  /* ── State ───────────────────────────────────── */
  let ws = null;
  let stadiumState = null;
  let events = [];
  let decisions = [];
  let timelineEntries = [];
  const MAX_EVENTS = 80;

  /* ── DOM refs ────────────────────────────────── */
  const $ = (sel) => document.querySelector(sel);
  const mapSvg = $('#map-svg');
  const eventFeed = $('#event-feed');
  const riskCards = $('#risk-cards');
  const queueBars = $('#queue-bars');
  const decisionDrawer = $('#decision-drawer');
  const volunteerBoard = $('#volunteer-board');
  const auditTimeline = $('#audit-timeline');
  const eventCount = $('#event-count');
  const aiModeBadge = $('#ai-mode-badge');
  const matchPhase = $('#match-phase');
  const weatherBadge = $('#weather-badge');
  const runScenarioBtn = $('#run-scenario-btn');
  const scenarioOverlay = $('#scenario-overlay');
  const scenarioSteps = $('#scenario-steps');
  const scenarioClose = $('#scenario-close');
  const themeToggle = $('#theme-toggle');

  /* ── Theme toggle ────────────────────────────── */
  themeToggle.addEventListener('click', () => {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    themeToggle.textContent = next === 'dark' ? '🌙' : '☀️';
  });

  /* ── WebSocket connection ────────────────────── */
  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws/pulse`);

    ws.addEventListener('open', () => {
      console.log('[WS] Connected');
    });

    ws.addEventListener('message', (e) => {
      try {
        const msg = JSON.parse(e.data);
        handleMessage(msg);
      } catch (err) {
        console.error('[WS] Parse error:', err);
      }
    });

    ws.addEventListener('close', () => {
      console.log('[WS] Disconnected — reconnecting in 3s');
      setTimeout(connect, 3000);
    });

    ws.addEventListener('error', () => {
      ws.close();
    });
  }

  function handleMessage(msg) {
    switch (msg.type) {
      case 'state:snapshot':
        stadiumState = msg.payload;
        renderAll();
        break;
      case 'state:diff':
        stadiumState = msg.payload.snapshot || stadiumState;
        renderMap();
        renderTopBar();
        break;
      case 'event:new':
        addEvent(msg.payload);
        break;
      case 'decision:new':
        decisions.push(msg.payload);
        renderDecisions();
        break;
      case 'decision:updated':
      case 'decision:approved':
        updateDecision(msg.payload);
        break;
      case 'scenario:step':
        onScenarioStep(msg.payload);
        break;
      default:
        break;
    }
  }

  /* ── Full render ─────────────────────────────── */
  function renderAll() {
    if (!stadiumState) return;
    renderTopBar();
    renderMap();
    renderQueues();
    renderVolunteers();
    fetchTimeline();
  }

  /* ── Top bar ─────────────────────────────────── */
  function renderTopBar() {
    if (!stadiumState) return;
    const v = stadiumState.venue;
    if (v) $('#venue-name').textContent = v.name || 'Stadium';
    matchPhase.textContent = (stadiumState.matchPhase || 'pre-match').toUpperCase();

    const w = stadiumState.weather || {};
    const wIcon = { clear: '☀️', rain: '🌧️', thunderstorm: '⛈️', 'extreme-heat': '🔥', wind: '💨' };
    weatherBadge.textContent = `${wIcon[w.condition] || '☀️'} ${capitalize(w.condition || 'Clear')}`;
    if (w.severity === 'warning' || w.severity === 'severe') {
      weatherBadge.style.color = 'var(--warning)';
    } else {
      weatherBadge.style.color = '';
    }
  }

  /* ── Stadium Map ─────────────────────────────── */
  function renderMap() {
    if (!stadiumState?.zones) return;
    // Clear existing zone nodes
    mapSvg.querySelectorAll('.zone-node, .zone-label, .corridor-line').forEach((el) => el.remove());

    const zones = stadiumState.zones;

    // Draw corridors first (behind zones)
    fetch('/api/venue/map')
      .then((r) => r.json())
      .then((data) => {
        if (!data.corridors) return;
        for (const c of data.corridors) {
          const fromZ = data.zones.find((z) => z.id === c.from);
          const toZ = data.zones.find((z) => z.id === c.to);
          if (!fromZ || !toZ) continue;
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', fromZ.x);
          line.setAttribute('y1', fromZ.y);
          line.setAttribute('x2', toZ.x);
          line.setAttribute('y2', toZ.y);
          line.setAttribute('stroke', c.accessible ? 'var(--border)' : 'var(--danger)');
          line.setAttribute('stroke-width', '0.3');
          line.setAttribute('opacity', '0.4');
          line.setAttribute('class', 'corridor-line');
          if (!c.accessible) line.setAttribute('stroke-dasharray', '1,1');
          mapSvg.insertBefore(line, mapSvg.firstChild?.nextSibling);
        }
      })
      .catch(() => {});

    // Draw zones
    for (const [id, zone] of Object.entries(zones)) {
      const color = densityColor(zone.densityBand);
      const statusOpacity = zone.status === 'closed' ? 0.3 : zone.status === 'restricted' ? 0.6 : 1;
      const radius = zoneRadius(zone.type);

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', zone.x || 50);
      circle.setAttribute('cy', zone.y || 50);
      circle.setAttribute('r', radius);
      circle.setAttribute('fill', color);
      circle.setAttribute('opacity', statusOpacity);
      circle.setAttribute('class', 'zone-node');
      circle.setAttribute('tabindex', '0');
      circle.setAttribute('role', 'button');
      circle.setAttribute(
        'aria-label',
        `${zone.label}: ${zone.densityBand} density, ${Math.round(zone.density * 100)}% capacity`,
      );
      circle.addEventListener('click', () => showZoneDetail(id));
      mapSvg.appendChild(circle);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', zone.x || 50);
      label.setAttribute('y', (zone.y || 50) + radius + 3.5);
      label.setAttribute('class', 'zone-label');
      label.textContent = shortLabel(zone.label);
      mapSvg.appendChild(label);
    }
  }

  function densityColor(band) {
    const colors = {
      low: 'var(--density-low)',
      moderate: 'var(--density-moderate)',
      high: 'var(--density-high)',
      critical: 'var(--density-critical)',
    };
    return colors[band] || colors.low;
  }

  function zoneRadius(type) {
    const sizes = {
      gate: 3.5,
      concourse: 4,
      seating: 5,
      food: 2.5,
      restroom: 2,
      medical: 2,
      transit: 3.5,
      services: 2.5,
    };
    return sizes[type] || 3;
  }

  function shortLabel(label) {
    return label
      .replace('Concourse', 'Conc.')
      .replace('Restrooms', 'WC')
      .replace('Food Court', 'Food')
      .replace('Guest Services', 'Services');
  }

  function showZoneDetail(zoneId) {
    fetch(`/api/cascade/${zoneId}`)
      .then((r) => r.json())
      .then((data) => {
        let detail = `🏟️ Cascade Impact: ${data.sourceLabel || zoneId}\n\n`;
        detail += `${data.summary}\n\n`;
        if (data.effects?.length) {
          detail += 'Affected zones:\n';
          for (const e of data.effects) {
            detail += `  • ${e.label}: ${e.currentDensity}% → ${e.projectedDensity}% ${e.wouldBreachThreshold ? '⚠️ BREACH' : ''}\n`;
          }
        }
        if (data.accessibilityImpact?.length) {
          detail += '\nAccessibility impact:\n';
          for (const a of data.accessibilityImpact) {
            detail += `  • ${a.corridor}: ${a.impact}\n`;
          }
        }
        alert(detail);
      })
      .catch(() => {});
  }

  /* ── Queue Forecasts ─────────────────────────── */
  function renderQueues() {
    fetch('/api/forecast/queues')
      .then((r) => r.json())
      .then((data) => {
        if (!data.forecasts) return;
        queueBars.innerHTML = '';
        for (const q of data.forecasts) {
          const pct = Math.min((q.forecastWaitMinutes / 40) * 100, 100);
          const color =
            q.forecastWaitMinutes >= 25
              ? 'var(--danger)'
              : q.forecastWaitMinutes >= 15
                ? 'var(--warning)'
                : 'var(--success)';
          queueBars.innerHTML += `
            <div class="queue-row">
              <span class="queue-row__label" title="${q.label}">${q.label}</span>
              <div class="queue-row__bar">
                <div class="queue-row__fill" style="width:${pct}%;background:${color}"></div>
              </div>
              <span class="queue-row__value">${q.forecastWaitMinutes} min</span>
            </div>`;
        }
      })
      .catch(() => {});
  }

  /* ── Events ──────────────────────────────────── */
  function addEvent(evt) {
    events.unshift(evt);
    if (events.length > MAX_EVENTS) events.pop();
    renderEvents();
    eventCount.textContent = `${events.length} events`;

    // Update risk cards from event severity
    if (evt.severity === 'warning' || evt.severity === 'critical') {
      addRiskCard(evt);
    }

    // Refresh queues on queue/crowd events
    if (evt.category === 'queue' || evt.category === 'crowd') {
      renderQueues();
    }

    // Refresh volunteers on operational events
    if (evt.category === 'operational') {
      renderVolunteers();
    }
  }

  function renderEvents() {
    if (events.length === 0) {
      eventFeed.innerHTML = '<div class="event-feed__empty">Waiting for events…</div>';
      return;
    }
    eventFeed.innerHTML = events
      .slice(0, 30)
      .map(
        (evt) => `
      <div class="event-item">
        <div class="event-item__dot event-item__dot--${evt.severity}"></div>
        <div class="event-item__body">
          <div class="event-item__text">${escHtml(formatEventText(evt))}</div>
          <div class="event-item__meta">${evt.category} · ${evt.zone || 'global'} · ${timeAgo(evt.timestamp)}</div>
        </div>
      </div>
    `,
      )
      .join('');
  }

  function formatEventText(evt) {
    const detail = evt.payload?.detail || evt.payload?.reason || '';
    return `[${evt.type}] ${detail || evt.type}`.slice(0, 120);
  }

  /* ── Risk Cards ──────────────────────────────── */
  function addRiskCard(evt) {
    const placeholder = riskCards.querySelector('.risk-card--placeholder');
    if (placeholder) placeholder.remove();

    const severity = evt.severity === 'critical' ? 'critical' : 'warning';
    const icon = severity === 'critical' ? '🔴' : '🟡';
    const card = document.createElement('div');
    card.className = `risk-card risk-card--${severity}`;
    card.innerHTML = `
      <div class="risk-card__header">
        <span class="risk-card__icon">${icon}</span>
        <span class="risk-card__type">${evt.category}</span>
      </div>
      <div class="risk-card__text">${escHtml(formatEventText(evt))}</div>
      <div class="risk-card__zone">${evt.zone || 'global'} · ${timeAgo(evt.timestamp)}</div>
    `;
    riskCards.prepend(card);

    // Keep max 6 risk cards
    while (riskCards.children.length > 6) {
      riskCards.lastChild.remove();
    }
  }

  /* ── Decisions ───────────────────────────────── */
  function renderDecisions() {
    const pending = decisions.filter((d) => d.approval?.status === 'pending');
    if (pending.length === 0) {
      decisionDrawer.innerHTML = `
        <div class="decision-drawer__empty">
          <span class="decision-drawer__icon">🤖</span>
          <p>No pending decisions.</p>
        </div>`;
      return;
    }

    decisionDrawer.innerHTML = pending
      .map(
        (d) => `
      <div class="decision-card" data-decision-id="${d.id}">
        <div class="decision-card__header">
          <span class="decision-card__source">${d.aiRecommendation.source === 'gemini' ? '✨ Gemini' : '⚙️ Rules'}</span>
          <span class="decision-card__confidence">${Math.round((d.aiRecommendation.confidence || 0) * 100)}% confidence</span>
        </div>
        <div class="decision-card__reasoning">${escHtml(d.aiRecommendation.reasoning || '')}</div>
        <ul class="action-list">
          ${d.aiRecommendation.actions
            .map(
              (a) => `
            <li class="action-item">
              <input type="checkbox" class="action-item__check" data-action-id="${a.id}" checked aria-label="Include action: ${escHtml(a.detail)}">
              <span class="action-item__priority">P${a.priority}</span>
              <span class="action-item__text">${escHtml(a.detail || a.type)}</span>
            </li>
          `,
            )
            .join('')}
        </ul>
        <div class="decision-card__actions">
          <button class="btn btn--danger btn--sm" onclick="rejectDecision('${d.id}')">Reject</button>
          <button class="btn btn--success btn--sm" onclick="approveDecision('${d.id}')">✓ Approve</button>
        </div>
      </div>
    `,
      )
      .join('');
  }

  window.approveDecision = function (decisionId) {
    const card = document.querySelector(`[data-decision-id="${decisionId}"]`);
    const checks = card?.querySelectorAll('.action-item__check:checked') || [];
    const approvedActions = [...checks].map((c) => parseInt(c.dataset.actionId));

    fetch('/api/commands/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decisionId, approvedActions }),
    })
      .then((r) => r.json())
      .then((d) => updateDecision(d))
      .catch((err) => console.error('Approve failed:', err));
  };

  window.rejectDecision = function (decisionId) {
    fetch('/api/commands/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decisionId, reason: 'Operator rejected' }),
    })
      .then((r) => r.json())
      .then((d) => updateDecision(d))
      .catch((err) => console.error('Reject failed:', err));
  };

  function updateDecision(updated) {
    const idx = decisions.findIndex((d) => d.id === updated.id);
    if (idx >= 0) decisions[idx] = updated;
    renderDecisions();
    renderVolunteers();
    fetchTimeline();
  }

  /* ── Volunteers ──────────────────────────────── */
  function renderVolunteers() {
    fetch('/api/volunteers')
      .then((r) => r.json())
      .then((data) => {
        if (!data.volunteers) return;
        volunteerBoard.innerHTML = data.volunteers
          .map(
            (v) => `
          <div class="volunteer-item">
            <div class="volunteer-item__avatar">${v.name.charAt(0)}</div>
            <div class="volunteer-item__info">
              <div class="volunteer-item__name">${escHtml(v.name)}</div>
              <div class="volunteer-item__role">${v.role} · ${v.languages.join(', ')} · ${v.zone}</div>
            </div>
            <span class="volunteer-item__status volunteer-item__status--${v.status}">${v.status}</span>
          </div>
        `,
          )
          .join('');
      })
      .catch(() => {});
  }

  /* ── Audit Timeline ──────────────────────────── */
  function fetchTimeline() {
    fetch('/api/audit/timeline?limit=30')
      .then((r) => r.json())
      .then((data) => {
        timelineEntries = data.timeline || [];
        renderTimeline();
      })
      .catch(() => {});
  }

  function renderTimeline() {
    if (timelineEntries.length === 0) {
      auditTimeline.innerHTML = '<div class="event-feed__empty">No timeline entries yet.</div>';
      return;
    }
    auditTimeline.innerHTML = timelineEntries
      .slice(0, 20)
      .map((e) => {
        const markerClass =
          e.entryType === 'decision'
            ? 'decision'
            : e.entryType === 'approval'
              ? 'approval'
              : e.severity === 'critical'
                ? 'critical'
                : '';
        return `
        <div class="timeline-item">
          <div class="timeline-item__marker timeline-item__marker--${markerClass}"></div>
          <div class="timeline-item__body">
            <div class="timeline-item__summary">${escHtml(e.summary || '')}</div>
            <div class="timeline-item__time">${timeAgo(e.timestamp)}</div>
          </div>
        </div>`;
      })
      .join('');
  }

  function onScenarioStep(stepData) {
    const idx = stepData.step - 1;
    const stepEl = document.getElementById(`scenario-step-${idx}`);
    if (stepEl) {
      stepEl.className = 'scenario-step scenario-step--done';
    }
    const nextEl = document.getElementById(`scenario-step-${idx + 1}`);
    if (nextEl) {
      nextEl.className = 'scenario-step scenario-step--running';
    }
    if (stepData.step >= stepData.total) {
      scenarioClose.hidden = false;
      runScenarioBtn.disabled = false;
    }
  }

  /* ── Scenario Runner ─────────────────────────── */
  runScenarioBtn.addEventListener('click', () => {
    runScenarioBtn.disabled = true;
    scenarioOverlay.hidden = false;
    scenarioSteps.innerHTML = '';
    scenarioClose.hidden = false;

    const stepLabels = [
      'Gate B crowd rises to 87%',
      'Gate B queue exceeds 24 min',
      'Thunderstorm warning issued',
      'East concourse accessible corridor closed',
      'Medical incident at Food Court NE',
      'Gate A crowd rising (cascade)',
      'Transit hub pressure increasing',
      'Fan sentiment trending negative',
      'Risk analysis triggered',
      'AI coordinated response generated',
      'Decision logged to timeline',
    ];

    for (let i = 0; i < stepLabels.length; i++) {
      const step = document.createElement('div');
      step.className = 'scenario-step scenario-step--pending';
      step.id = `scenario-step-${i}`;
      step.innerHTML = `<span class="scenario-step__num">${i + 1}</span><span class="scenario-step__label">${stepLabels[i]}</span>`;
      scenarioSteps.appendChild(step);
    }

    const firstStep = document.getElementById('scenario-step-0');
    if (firstStep) firstStep.className = 'scenario-step scenario-step--running';

    fetch('/api/simulation/scenario', { method: 'POST' }).catch(() => {
      runScenarioBtn.disabled = false;
      scenarioClose.hidden = false;
    });
  });

  scenarioClose.addEventListener('click', () => {
    scenarioOverlay.hidden = true;
  });

  /* ── Helpers ─────────────────────────────────── */
  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }

  function timeAgo(ts) {
    if (!ts) return '';
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60000) return `${Math.round(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
    return new Date(ts).toLocaleTimeString();
  }

  /* ── AI Fan Assistant Chatbot ───────────────── */
  const chatSend = $('#chat-send');
  const chatResponse = $('#chatbot-response');

  if (chatSend) {
    chatSend.addEventListener('click', () => {
      const currentZone = $('#chat-from').value;
      const destination = $('#chat-to').value;
      const language = $('#chat-lang').value;
      const question = $('#chat-question').value;
      const accessibilityNeeds = [];
      if ($('#chat-acc-wheelchair').checked) accessibilityNeeds.push('wheelchair');
      if ($('#chat-acc-visual').checked) accessibilityNeeds.push('visual');
      if ($('#chat-acc-hearing').checked) accessibilityNeeds.push('hearing');

      chatSend.disabled = true;
      chatResponse.hidden = false;
      chatResponse.innerHTML = '<span style="color:var(--text-muted)">Thinking…</span>';

      fetch('/api/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, currentZone, destination, language, accessibilityNeeds }),
      })
        .then(async (r) => {
          if (!r.ok) {
            const errData = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
            throw new Error(errData.error || `HTTP ${r.status}`);
          }
          return r.json();
        })
        .then((data) => {
          chatSend.disabled = false;
          const facts = data.groundedFacts || {};
          chatResponse.innerHTML = `
            <div style="font-weight:600;margin-bottom:6px;color:var(--accent)">
              ${data.usedLlm ? '✨ Gemini AI Response' : '⚙️ Grounded Rule Response'} (${data.language.toUpperCase()})
            </div>
            <div>${escHtml(data.answer)}</div>
            <div style="font-size:0.68rem;color:var(--text-muted);margin-top:8px;border-top:1px solid var(--border);padding-top:6px">
              Grounded Facts: ${facts.from} → ${facts.to} | Crowd: ${facts.crowdLevel} | Mode: ${facts.stepFreeRequired ? 'Step-Free' : 'Standard'}
            </div>`;
        })
        .catch((err) => {
          chatSend.disabled = false;
          chatResponse.innerHTML = `<span style="color:var(--danger)">Error: ${escHtml(err.message || 'Failed to get assistance')}</span>`;
        });
    });
  }

  /* ── Init ────────────────────────────────────── */
  fetch('/api/health')
    .then((r) => r.json())
    .then((data) => {
      if (data.ai === 'gemini') {
        aiModeBadge.textContent = 'GEMINI';
        aiModeBadge.classList.add('active');
      } else {
        aiModeBadge.textContent = 'OFFLINE';
      }
    })
    .catch(() => {});

  connect();
  setInterval(renderQueues, 10000);
  setInterval(fetchTimeline, 15000);
})();
