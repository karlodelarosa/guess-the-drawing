/**
 * WebSocket connection wrapper with promise-based emits.
 * Compatible with Cloudflare Workers and local Node server.
 */

let ws = null;
let socketId = null;
let connected = false;
let reconnectTimer = null;
let readyResolvers = [];

/** Event listeners registry. */
const listeners = new Map();

/** Pending ack callbacks keyed by message id. */
const pendingAcks = new Map();
let msgCounter = 0;

function getWsUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

/** Resolve when the socket is open and has a server-assigned ID. */
export function whenReady() {
  if (connected && socketId) return Promise.resolve();
  return new Promise((resolve) => {
    readyResolvers.push(resolve);
  });
}

function notifyReady() {
  if (!connected || !socketId) return;
  const resolvers = readyResolvers;
  readyResolvers = [];
  resolvers.forEach((r) => r());
}

export function connect() {
  if (ws && connected) return ws;

  // Avoid duplicate connections while reconnecting
  if (ws && ws.readyState === WebSocket.CONNECTING) return ws;

  ws = new WebSocket(getWsUrl());

  ws.addEventListener('open', () => {
    connected = true;
    console.log('[socket] open');
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
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
      console.log('[socket] ready', socketId);
      fire('connect');
      notifyReady();
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
  return { id: socketId, connected: connected && !!socketId };
}

export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, []);
  listeners.get(event).push(handler);
}

export function emit(event, data = {}) {
  return whenReady().then(() => new Promise((resolve, reject) => {
    const id = String(++msgCounter);
    pendingAcks.set(id, { resolve, reject });
    ws.send(JSON.stringify({ type: 'emit', event, data, id }));

    setTimeout(() => {
      if (pendingAcks.has(id)) {
        pendingAcks.delete(id);
        reject(new Error('Request timed out'));
      }
    }, 10_000);
  }));
}
