const path = require('path');
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const RoomManager = require('./game/RoomManager');
const { createHandlers } = require('./handlers');

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);

const roomManager = new RoomManager();

/** socketId -> { ws, roomId } */
const sessions = new Map();

function send(ws, payload) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

function emitEvent(ws, event, data) {
  send(ws, { type: 'event', event, data });
}

roomManager.setBroadcast({
  emitToRoom: (roomId, event, data) => {
    for (const [, session] of sessions) {
      if (session.roomId === roomId) emitEvent(session.ws, event, data);
    }
  },
  emitToPlayer: (socketId, event, data) => {
    const session = sessions.get(socketId);
    if (session) emitEvent(session.ws, event, data);
  },
  emitToRoomExcept: (roomId, exceptId, event, data) => {
    for (const [id, session] of sessions) {
      if (session.roomId === roomId && id !== exceptId) {
        emitEvent(session.ws, event, data);
      }
    }
  },
});

// Serve static client files
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', rooms: roomManager.rooms.size });
});

app.get('/room/:roomId', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

/** Generate a unique socket-style ID. */
function generateId() {
  return require('crypto').randomUUID().replace(/-/g, '').slice(0, 16);
}

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  const socketId = generateId();
  sessions.set(socketId, { ws, roomId: null });

  console.log(`[connect] ${socketId}`);
  send(ws, { type: 'connected', socketId });

  ws.on('message', (raw) => {
    let parsed;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (parsed.type !== 'emit' || !parsed.event) return;

    const session = sessions.get(socketId);
    const handlers = createHandlers(roomManager, {
      socketId,
      joinRoom: (roomId) => {
        if (session) session.roomId = roomId;
      },
    });

    const handler = handlers[parsed.event];
    if (!handler) {
      if (parsed.id) send(ws, { type: 'ack', id: parsed.id, data: { error: 'Unknown event' } });
      return;
    }

    const result = handler(parsed.data || {});

    if (parsed.id) {
      send(ws, {
        type: 'ack',
        id: parsed.id,
        data: result?.error ? { error: result.error } : (result ?? { success: true }),
      });
    }
  });

  ws.on('close', () => {
    console.log(`[disconnect] ${socketId}`);
    const handlers = createHandlers(roomManager, { socketId });
    handlers.disconnect();
    sessions.delete(socketId);
  });
});

server.listen(PORT, () => {
  console.log(`Guess the Drawing server running at http://localhost:${PORT}`);
});
