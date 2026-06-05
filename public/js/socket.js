/**
 * WebSocket connection wrapper with promise-based emits.
 * Compatible with Cloudflare Workers and local Node server.
 */

let ws = null;
let socketId = null;
let connected = false;
let reconnectTimer = null;

/** Event listeners registry. */
const listeners = new Map();

/** Pending ack callbacks keyed by message id. */
const pendingAcks = new Map();
let msgCounter = 0;

function getWsUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

export function connect() {
  if (ws && connected) return ws;

  ws = new WebSocket(getWsUrl());

  ws.addEventListener('open', () => {
    connected = true;
    console.log('[socket] connected');
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    // Server sends socketId in first message — don't fire 'connect' until then
  });

  ws.addEventListener('message', (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }

    if (msg.type === 'connected') {
      const wasConnected = !!socketId;
      socketId = msg.socketId;
      fire('connect');
      // Re-join room after unexpected reconnect
      if (wasConnected) fire('reconnected');
      return;
    }

    if (msg.type === 'ack') {
      const pending = pendingAcks.get(msg.id);
      if (pending) {
        pendingAcks.delete(msg.id);
        if (msg.data?.error) pending.reject(new Error(msg.data.error));
        else pending.resolve(msg.data);
      }
      return;
    }

    if (msg.type === 'event') {
      fire(msg.event, msg.data);
    }
  });

  ws.addEventListener('close', () => {
    connected = false;
    socketId = null;
    console.log('[socket] disconnected');
    fire('disconnect');

    // Auto-reconnect after 2s
    reconnectTimer = setTimeout(() => {
      ws = null;
      connect();
    }, 2000);
  });

  ws.addEventListener('error', () => {
    // close handler will fire reconnect
  });

  return ws;
}

function fire(event, data) {
  const handlers = listeners.get(event);
  if (handlers) handlers.forEach((h) => h(data));
}

export function getSocket() {
  return { id: socketId, connected };
}

/**
 * Register an event listener.
 * @param {string} event
 * @param {Function} handler
 */
export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, []);
  listeners.get(event).push(handler);
}

/**
 * Emit with callback wrapped in a Promise.
 * @param {string} event
 * @param {object} data
 * @returns {Promise<any>}
 */
export function emit(event, data = {}) {
  return new Promise((resolve, reject) => {
    if (!ws || !connected) {
      return reject(new Error('Not connected'));
    }

    const id = String(++msgCounter);
    pendingAcks.set(id, { resolve, reject });

    ws.send(JSON.stringify({ type: 'emit', event, data, id }));

    // Timeout after 10s
    setTimeout(() => {
      if (pendingAcks.has(id)) {
        pendingAcks.delete(id);
        reject(new Error('Request timed out'));
      }
    }, 10_000);
  });
}
