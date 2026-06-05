/**
 * WebSocket connection wrapper with promise-based emits.
 */

let ws = null;
let socketId = null;
let connected = false;
let reconnectTimer = null;
let readyResolvers = [];
let beforeReadyHook = null;

const listeners = new Map();
const pendingAcks = new Map();
let msgCounter = 0;

function getWsUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

/** Hook runs after server assigns socketId, before any emit resolves. */
export function setBeforeReadyHook(fn) {
  beforeReadyHook = fn;
}

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

/** Send a request on the raw WebSocket (used during reconnect before ready). */
export function request(event, data = {}) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return reject(new Error('Not connected'));
    }
    const id = String(++msgCounter);
    pendingAcks.set(id, { resolve, reject });
    ws.send(JSON.stringify({ type: 'emit', event, data, id }));
    setTimeout(() => {
      if (pendingAcks.has(id)) {
        pendingAcks.delete(id);
        reject(new Error('Request timed out'));
      }
    }, 10_000);
  });
}

export function connect() {
  if (ws && connected) return ws;
  if (ws && ws.readyState === WebSocket.CONNECTING) return ws;

  ws = new WebSocket(getWsUrl());

  ws.addEventListener('open', () => {
    connected = true;
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
      handleConnected(msg.socketId);
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
    fire('disconnect');

    reconnectTimer = setTimeout(() => {
      ws = null;
      connect();
    }, 1500);
  });

  return ws;
}

async function handleConnected(newSocketId) {
  const prevId = socketId;
  socketId = newSocketId;

  if (beforeReadyHook) {
    try {
      await beforeReadyHook({ prevId, socketId: newSocketId, isReconnect: !!prevId });
    } catch (err) {
      console.error('[socket] beforeReady failed', err);
    }
  }

  fire('connect');
  notifyReady();
  if (prevId) fire('reconnected');
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
  return whenReady().then(() => request(event, data));
}
