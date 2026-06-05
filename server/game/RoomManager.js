const Room = require('./Room');

/**
 * Manages all active game rooms and socket event routing.
 */
class RoomManager {
  constructor() {
    /** @type {Map<string, Room>} */
    this.rooms = new Map();
    /** @type {Map<string, string>} socketId -> roomId */
    this.socketToRoom = new Map();
    /** @type {Map<string, string>} socketId -> playerName (for reconnect) */
    this.socketToName = new Map();
    /** @type {import('./Broadcast').BroadcastAPI|null} */
    this.broadcast = null;
  }

  /** Attach broadcast transport (Socket.IO or WebSocket). */
  setBroadcast(broadcast) {
    this.broadcast = broadcast;
  }

  /** @deprecated Use setBroadcast */
  setIO(io) {
    this.setBroadcast({
      emitToRoom: (roomId, event, data) => io.to(roomId).emit(event, data),
      emitToPlayer: (socketId, event, data) => io.to(socketId).emit(event, data),
      emitToRoomExcept: (roomId, exceptId, event, data) => io.to(roomId).except(exceptId).emit(event, data),
    });
  }

  /**
   * Create a new room.
   * @returns {Room}
   */
  createRoom() {
    const room = new Room();
    this.rooms.set(room.id, room);
    this._wireBroadcast(room);
    return room;
  }

  /**
   * Find a room by ID.
   * @param {string} roomId
   * @returns {Room|null}
   */
  getRoom(roomId) {
    return this.rooms.get(roomId.toUpperCase()) || null;
  }

  /** Wire room broadcast callbacks to Socket.IO. */
  _wireBroadcast(room) {
    room._broadcastEvent = (event, data) => {
      this.broadcast?.emitToRoom(room.id, event, data);
    };
    room._broadcastRoomState = () => this._broadcastRoomState(room);
  }

  /**
   * Get the room a socket is in.
   * @param {string} socketId
   * @returns {Room|null}
   */
  getRoomForSocket(socketId) {
    const roomId = this.socketToRoom.get(socketId);
    return roomId ? this.rooms.get(roomId) : null;
  }

  /**
   * Join a room.
   * @param {string} socketId
   * @param {string} roomId
   * @param {string} playerName
   */
  joinRoom(socketId, roomId, playerName) {
    const room = this.getRoom(roomId);
    if (!room) return { error: 'Room not found.' };

    const connectedCount = room.getConnectedPlayers().length;
    if (connectedCount >= room.toJSON(null).maxPlayers) {
      return { error: 'Room is full.' };
    }

    if (!playerName || playerName.trim().length < 1) {
      return { error: 'Please enter a name.' };
    }
    if (playerName.trim().length > 20) {
      return { error: 'Name must be 20 characters or less.' };
    }

    // Check duplicate names among connected players
    const nameTaken = room.getConnectedPlayers().some(
      (p) => p.name.toLowerCase() === playerName.trim().toLowerCase()
    );
    if (nameTaken) return { error: 'That name is already taken.' };

    const player = room.addPlayer(socketId, playerName);
    this.socketToRoom.set(socketId, room.id);
    this.socketToName.set(socketId, playerName.trim());

    const systemMsg = room.addSystemMessage(`${player.name} joined the room.`);
    this.broadcast?.emitToRoom(room.id, 'chat_message', systemMsg);
    this._broadcastRoomState(room);

    return { success: true, room: room.toJSON(socketId), player: player.toJSON() };
  }

  /**
   * Create and join a new room.
   * @param {string} socketId
   * @param {string} playerName
   */
  createAndJoin(socketId, playerName) {
    const room = this.createRoom();
    return this.joinRoom(socketId, room.id, playerName);
  }

  /**
   * Leave a room and clean up if empty.
   * @param {string} socketId
   */
  leaveRoom(socketId) {
    const room = this.getRoomForSocket(socketId);
    if (!room) return;

    const player = room.players.get(socketId);
    if (player) {
      const systemMsg = room.addSystemMessage(`${player.name} left the room.`);
      this.broadcast?.emitToRoom(room.id, 'chat_message', systemMsg);
    }

    const isEmpty = room.removePlayer(socketId);
    this.socketToRoom.delete(socketId);
    this.socketToName.delete(socketId);

    if (isEmpty) {
      if (room.game) room.game.destroy();
      this.rooms.delete(room.id);
    } else {
      this._broadcastRoomState(room);
    }
  }

  /**
   * Handle player disconnect (keep in room for reconnect).
   * @param {string} socketId
   */
  handleDisconnect(socketId) {
    const room = this.getRoomForSocket(socketId);
    if (!room) return;

    const player = room.players.get(socketId);
    if (player) {
      player.connected = false;
      const systemMsg = room.addSystemMessage(`${player.name} disconnected.`);
      this.broadcast?.emitToRoom(room.id, 'chat_message', systemMsg);
      this._broadcastRoomState(room);
    }
  }

  /**
   * Attempt to reconnect a player.
   * @param {string} newSocketId
   * @param {string} roomId
   * @param {string} playerName
   */
  reconnect(newSocketId, roomId, playerName) {
    const room = this.getRoom(roomId);
    if (!room) return { error: 'Room not found.' };

    // Find disconnected player with matching name
    const disconnected = [...room.players.values()].find(
      (p) => !p.connected && p.name.toLowerCase() === playerName.trim().toLowerCase()
    );

    if (!disconnected) {
      // Fall back to normal join
      return this.joinRoom(newSocketId, roomId, playerName);
    }

    const oldId = disconnected.id;
    const player = room.reconnectPlayer(oldId, newSocketId);
    this.socketToRoom.delete(oldId);
    this.socketToRoom.set(newSocketId, room.id);
    this.socketToName.set(newSocketId, playerName.trim());

    const systemMsg = room.addSystemMessage(`${player.name} reconnected.`);
    this.broadcast?.emitToRoom(room.id, 'chat_message', systemMsg);
    this._broadcastRoomState(room);

    return {
      success: true,
      reconnected: true,
      room: room.toJSON(newSocketId),
      player: player.toJSON(),
    };
  }

  /** Broadcast full room state to all players (personalized word visibility). */
  _broadcastRoomState(room) {
    for (const [socketId] of room.players) {
      const player = room.players.get(socketId);
      if (player && player.connected) {
        this.broadcast?.emitToPlayer(socketId, 'room_state', room.toJSON(socketId));
      }
    }
  }

  /** Broadcast room state to all in the room (same payload). */
  broadcastRoomState(room) {
    this._broadcastRoomState(room);
  }
}

module.exports = RoomManager;
