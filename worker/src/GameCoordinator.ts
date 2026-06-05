import { DurableObject } from 'cloudflare:workers';

// @ts-expect-error — CJS import
import RoomManager from '../../server/game/RoomManager.js';
// @ts-expect-error — CJS import
import { createHandlers } from '../../server/handlers.js';

const STORAGE_KEY = 'room-manager-state';

interface Session {
  socketId: string;
  roomId: string | null;
}

function generateId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

/**
 * Global game coordinator — holds all rooms with durable persistence.
 */
export class GameCoordinator extends DurableObject {
  roomManager: InstanceType<typeof RoomManager>;
  loaded = false;

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    this.roomManager = new RoomManager();

    this.roomManager.setBroadcast({
      emitToRoom: (roomId, event, data) => this._emitToRoom(roomId, event, data),
      emitToPlayer: (socketId, event, data) => this._emitToPlayer(socketId, event, data),
      emitToRoomExcept: (roomId, exceptId, event, data) =>
        this._emitToRoomExcept(roomId, exceptId, event, data),
    });

    this.roomManager.onPersist = () => {
      this.ctx.waitUntil(this._persist());
    };

    this.ctx.blockConcurrencyWhile(async () => {
      await this._load();
    });
  }

  async _load() {
    const data = await this.ctx.storage.get(STORAGE_KEY);
    if (data) {
      this.roomManager.restore(data);
    }
    this.loaded = true;
  }

  async _persist() {
    const snapshot = this.roomManager.snapshot();
    await this.ctx.storage.put(STORAGE_KEY, snapshot);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return Response.json({
        status: 'ok',
        rooms: this.roomManager.rooms.size,
        persisted: this.loaded,
      });
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    const session: Session = { socketId: generateId(), roomId: null };
    server.serializeAttachment(session);
    this.ctx.acceptWebSocket(server);

    server.send(JSON.stringify({ type: 'connected', socketId: session.socketId }));

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const session = ws.deserializeAttachment() as Session;
    if (!session) return;

    let parsed: { type: string; event?: string; data?: unknown; id?: string };
    try {
      parsed = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));
    } catch {
      return;
    }

    if (parsed.type !== 'emit' || !parsed.event) return;

    const handlers = createHandlers(this.roomManager, {
      socketId: session.socketId,
      joinRoom: (roomId: string | null) => {
        session.roomId = roomId;
        ws.serializeAttachment(session);
      },
      clearRoom: () => {
        session.roomId = null;
        ws.serializeAttachment(session);
      },
    });

    const handler = handlers[parsed.event as keyof typeof handlers];
    if (!handler) {
      if (parsed.id) this._ack(ws, parsed.id, { error: 'Unknown event' });
      return;
    }

    const result = await handler((parsed.data || {}) as never);

    // Persist after every state-changing action
    const mutating = [
      'create_room', 'join_room', 'reconnect_room', 'leave_room',
      'start_game', 'play_again', 'chat_message', 'draw_stroke',
      'undo_stroke', 'clear_canvas', 'done_drawing', 'disconnect',
    ];
    if (mutating.includes(parsed.event)) {
      await this._persist();
    }

    if (parsed.id) {
      if (result?.error) this._ack(ws, parsed.id, { error: result.error });
      else this._ack(ws, parsed.id, result ?? { success: true });
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const session = ws.deserializeAttachment() as Session;
    if (!session) return;

    const handlers = createHandlers(this.roomManager, { socketId: session.socketId });
    handlers.disconnect();
    await this._persist();
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  _ack(ws: WebSocket, id: string, data: unknown) {
    ws.send(JSON.stringify({ type: 'ack', id, data }));
  }

  _emitEvent(ws: WebSocket, event: string, data: unknown) {
    try {
      ws.send(JSON.stringify({ type: 'event', event, data }));
    } catch {
      // Socket closed
    }
  }

  _getSession(ws: WebSocket): Session | null {
    return ws.deserializeAttachment() as Session | null;
  }

  _emitToPlayer(socketId: string, event: string, data: unknown) {
    for (const ws of this.ctx.getWebSockets()) {
      const session = this._getSession(ws);
      if (session?.socketId === socketId) {
        this._emitEvent(ws, event, data);
      }
    }
  }

  _emitToRoom(roomId: string, event: string, data: unknown) {
    for (const ws of this.ctx.getWebSockets()) {
      const session = this._getSession(ws);
      if (session?.roomId === roomId) {
        this._emitEvent(ws, event, data);
      }
    }
  }

  _emitToRoomExcept(roomId: string, exceptSocketId: string, event: string, data: unknown) {
    for (const ws of this.ctx.getWebSockets()) {
      const session = this._getSession(ws);
      if (session?.roomId === roomId && session.socketId !== exceptSocketId) {
        this._emitEvent(ws, event, data);
      }
    }
  }
}
