import { createEvent } from '../event-stream/event-schema.js';

/**
 * WebSocket handler — real-time state push.
 *
 * Streams state diffs, new events, decisions and queue forecasts to connected
 * operations consoles. Also accepts commands (approve/reject/inject) over WS.
 */
export function attachWsHandler(wss, ctx) {
  wss.on('connection', (ws) => {
    /* Send initial full state snapshot. */
    send(ws, 'state:snapshot', ctx.state.getSnapshot());

    /* Subscribe to bus topics and forward to this client. */
    const unsubs = [];

    unsubs.push(ctx.bus.on('state:changed', (diff) => {
      send(ws, 'state:diff', { ...diff, snapshot: ctx.state.getSnapshot() });
    }));

    unsubs.push(ctx.bus.on('event:new', (evt) => {
      send(ws, 'event:new', evt);
    }));

    unsubs.push(ctx.bus.on('decision:new', (dec) => {
      send(ws, 'decision:new', dec);
    }));

    unsubs.push(ctx.bus.on('decision:updated', (dec) => {
      send(ws, 'decision:updated', dec);
    }));

    unsubs.push(ctx.bus.on('decision:approved', (dec) => {
      send(ws, 'decision:approved', dec);
    }));

    unsubs.push(ctx.bus.on('scenario:step', (stepData) => {
      send(ws, 'scenario:step', stepData);
    }));

    /* Handle incoming commands from UI. */
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        handleWsCommand(msg, ctx);
      } catch {
        /* Ignore malformed WS payloads */
      }
    });

    ws.on('close', () => {
      for (const unsub of unsubs) {
        unsub();
      }
    });
  });
}

function handleWsCommand(msg, ctx) {
  switch (msg.type) {
    case 'command:approve':
      ctx.approval.approve(msg.decisionId, msg.approvedActions);
      break;
    case 'command:reject':
      ctx.approval.reject(msg.decisionId, msg.reason);
      break;
    case 'command:inject': {
      const evt = createEvent(msg.event);
      ctx.bus.emit('event:new', evt);
      break;
    }
    default:
      break;
  }
}

function send(ws, type, payload) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type, payload, timestamp: new Date().toISOString() }));
  }
}
