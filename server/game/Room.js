const Player = require('./Player');
const Game = require('./Game');
const {
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  PLAYER_COLORS,
} = require('../constants');

/** Generate a short alphanumeric room ID. */
function generateRoomId(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < length; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/**
 * A game room holding players, chat, and optional active game.
 */
class Room {
  /**
   * @param {string} [id]
   */
  constructor(id) {
    this.id = id || generateRoomId();
    /** @type {Map<string, Player>} */
    this.players = new Map();
    /** @type {import('./Game')|null} */
    this.game = null;
    this.status = 'lobby'; // lobby | playing | finished
    /** Players queued for the next game (spectators who joined mid-game). */
    this.nextGameQueue = [];
    this.usedColors = new Set();
    /** Drawing strokes for current round canvas sync. */
    this.strokes = [];
    this.chatHistory = [];
    this.maxChatHistory = 100;
  }

  /** Pick an unused player color. */
  _assignColor() {
    const available = PLAYER_COLORS.filter((c) => !this.usedColors.has(c));
    const color = available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
    this.usedColors.add(color);
    return color;
  }

  /** Release a color when player leaves. */
  _releaseColor(color) {
    this.usedColors.delete(color);
  }

  /**
   * Add a player to the room.
   * @param {string} socketId
   * @param {string} name
   * @returns {Player}
   */
  addPlayer(socketId, name) {
    const isSpectator = this.status === 'playing';
    const color = this._assignColor();
    const player = new Player(socketId, name.trim(), color, isSpectator);

    // First connected player becomes host
    const connectedPlayers = [...this.players.values()].filter((p) => p.connected);
    if (connectedPlayers.length === 0) {
      player.isHost = true;
    }

    this.players.set(socketId, player);

    if (isSpectator) {
      this.nextGameQueue.push(socketId);
    }

    return player;
  }

  /**
   * Remove a player from the room.
   * @param {string} socketId
   * @returns {boolean} true if room is now empty
   */
  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (!player) return this.players.size === 0;

    this._releaseColor(player.color);
    this.players.delete(socketId);

    // Remove from next game queue
    this.nextGameQueue = this.nextGameQueue.filter((id) => id !== socketId);

    // Transfer host if needed
    if (player.isHost) {
      const nextHost = [...this.players.values()].find((p) => p.connected && !p.isSpectator)
        || [...this.players.values()].find((p) => p.connected);
      if (nextHost) nextHost.isHost = true;
    }

    return this.players.size === 0;
  }

  /**
   * Reconnect a player with a new socket ID.
   * @param {string} oldId
   * @param {string} newId
   * @returns {Player|null}
   */
  reconnectPlayer(oldId, newId) {
    const player = this.players.get(oldId);
    if (!player) return null;

    player.id = newId;
    player.connected = true;
    this.players.delete(oldId);
    this.players.set(newId, player);

    // Update references in game draw order and queue
    if (this.game) {
      const idx = this.game.drawOrder.indexOf(oldId);
      if (idx !== -1) this.game.drawOrder[idx] = newId;
    }
    this.nextGameQueue = this.nextGameQueue.map((id) => (id === oldId ? newId : id));

    return player;
  }

  /** Mark player as disconnected (for reconnect handling). */
  disconnectPlayer(socketId) {
    const player = this.players.get(socketId);
    if (player) player.connected = false;
  }

  /** Get non-spectator, connected players. */
  getActivePlayers() {
    return [...this.players.values()].filter((p) => !p.isSpectator && p.connected);
  }

  /** Get all connected players. */
  getConnectedPlayers() {
    return [...this.players.values()].filter((p) => p.connected);
  }

  /** Check if room can start a game. */
  canStart() {
    return this.status === 'lobby' && this.getActivePlayers().length >= MIN_PLAYERS_TO_START;
  }

  /** Host starts the game. */
  startGame(hostId) {
    const host = this.players.get(hostId);
    if (!host || !host.isHost) return { error: 'Only the host can start the game.' };
    if (!this.canStart()) return { error: `Need at least ${MIN_PLAYERS_TO_START} players to start.` };

    const activePlayers = this.getActivePlayers();
    this.game = new Game(activePlayers);
    this.status = 'playing';
    this.strokes = [];

    this.game.onRoundEnd = (data) => {
      this._broadcastEvent('round_end', data);
      if (this._broadcastRoomState) this._broadcastRoomState();
    };
    this.game.onGameEnd = (data) => {
      this.status = 'finished';
      this._broadcastEvent('game_end', data);
      if (this._broadcastRoomState) this._broadcastRoomState();
    };
    this.game.onStateChange = (event) => {
      if (event === 'round_start') {
        this.clearStrokes();
        this._broadcastEvent('clear_canvas');
      }
      this._broadcastEvent(event, this.game.toJSON(null));
      if (this._broadcastRoomState) this._broadcastRoomState();
    };

    this.game.start();
    return { success: true };
  }

  /** Play again — reset for a new game. */
  playAgain(hostId) {
    const host = this.players.get(hostId);
    if (!host || !host.isHost) return { error: 'Only the host can restart.' };

    // Promote spectators from queue to active players
    for (const queuedId of this.nextGameQueue) {
      const p = this.players.get(queuedId);
      if (p && p.connected) {
        p.isSpectator = false;
        p.score = 0;
      }
    }
    this.nextGameQueue = [];

    // Reset scores for all active players
    for (const player of this.getActivePlayers()) {
      player.score = 0;
      player.hasGuessedCorrectly = false;
    }

    if (this.game) this.game.destroy();
    this.game = null;
    this.status = 'lobby';
    this.strokes = [];

    return { success: true };
  }

  /** Placeholder for socket broadcast — set by RoomManager. */
  _broadcastEvent() {}

  /**
   * Add a chat message.
   * @param {string} playerId
   * @param {string} message
   */
  addChatMessage(playerId, message) {
    const player = this.players.get(playerId);
    if (!player) return null;

    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      playerId,
      playerName: player.name,
      playerColor: player.color,
      message: message.trim(),
      timestamp: Date.now(),
      isSystem: false,
      isCorrect: false,
    };

    // Check guess if game is active and sender is not drawer
    let guessResult = null;
    if (this.game && this.game.phase === 'drawing' && playerId !== this.game.getCurrentDrawerId()) {
      guessResult = this.game.checkGuess(playerId, message);
      if (guessResult.correct) {
        entry.isCorrect = true;
        entry.message = 'guessed the word!';
        entry.isSystem = true;
      }
    }

    this.chatHistory.push(entry);
    if (this.chatHistory.length > this.maxChatHistory) {
      this.chatHistory.shift();
    }

    return { entry, guessResult };
  }

  /** Add a system message to chat. */
  addSystemMessage(text) {
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      playerId: null,
      playerName: 'System',
      playerColor: '#888',
      message: text,
      timestamp: Date.now(),
      isSystem: true,
      isCorrect: false,
    };
    this.chatHistory.push(entry);
    return entry;
  }

  /** Add a drawing stroke. */
  addStroke(stroke) {
    this.strokes.push(stroke);
  }

  /** Undo the last stroke by the current drawer. */
  undoLastStroke(drawerId) {
    if (!this.game || this.game.getCurrentDrawerId() !== drawerId) return null;
    for (let i = this.strokes.length - 1; i >= 0; i--) {
      if (this.strokes[i].playerId === drawerId) {
        const removed = this.strokes.splice(i, 1)[0];
        return removed;
      }
    }
    return null;
  }

  /** Clear all strokes. */
  clearCanvas(drawerId) {
    if (!this.game || this.game.getCurrentDrawerId() !== drawerId) return false;
    this.strokes = [];
    return true;
  }

  /** Clear strokes between rounds. */
  clearStrokes() {
    this.strokes = [];
  }

  /** Serialize room state for a specific player. */
  toJSON(forPlayerId) {
    return {
      id: this.id,
      status: this.status,
      players: [...this.players.values()].map((p) => p.toJSON()),
      game: this.game ? this.game.toJSON(forPlayerId) : null,
      strokes: this.strokes,
      chatHistory: this.chatHistory,
      nextGameQueue: this.nextGameQueue,
      maxPlayers: MAX_PLAYERS,
    };
  }
}

module.exports = Room;
