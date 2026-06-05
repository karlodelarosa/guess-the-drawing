/**
 * Snapshot / restore room state for Cloudflare Durable Object storage.
 */

const Player = require('./Player');
const Game = require('./Game');
const Room = require('./Room');

/** @param {import('./Player')} player */
function playerToSnap(player) {
  return {
    id: player.id,
    name: player.name,
    color: player.color,
    score: player.score,
    isSpectator: player.isSpectator,
    isHost: player.isHost,
    hasGuessedCorrectly: player.hasGuessedCorrectly,
    connected: player.connected,
  };
}

/** @param {object} snap */
function playerFromSnap(snap) {
  const p = new Player(snap.id, snap.name, snap.color, snap.isSpectator);
  p.score = snap.score;
  p.isHost = snap.isHost;
  p.hasGuessedCorrectly = snap.hasGuessedCorrectly;
  p.connected = snap.connected;
  return p;
}

/** @param {import('./Game')} game */
function gameToSnap(game) {
  return {
    drawOrder: game.drawOrder,
    currentDrawerIndex: game.currentDrawerIndex,
    currentRound: game.currentRound,
    totalRounds: game.totalRounds,
    phase: game.phase,
    currentWord: game.currentWord,
    currentCategory: game.currentCategory,
    roundStartTime: game.roundStartTime,
    roundEndTime: game.roundEndTime,
    correctGuessers: [...game.correctGuessers],
    activePlayerIds: game.activePlayers.map((p) => p.id),
  };
}

/**
 * @param {object} snap
 * @param {import('./Player')[]} activePlayers
 */
function gameFromSnap(snap, activePlayers) {
  const game = Object.create(Game.prototype);
  game.activePlayers = activePlayers.filter((p) => snap.activePlayerIds.includes(p.id));
  game.drawOrder = snap.drawOrder;
  game.currentDrawerIndex = snap.currentDrawerIndex;
  game.currentRound = snap.currentRound;
  game.totalRounds = snap.totalRounds;
  game.phase = snap.phase;
  game.currentWord = snap.currentWord;
  game.currentCategory = snap.currentCategory;
  game.roundStartTime = snap.roundStartTime;
  game.roundEndTime = snap.roundEndTime;
  game.roundTimer = null;
  game.correctGuessers = new Set(snap.correctGuessers);
  game.onRoundEnd = null;
  game.onGameEnd = null;
  game.onStateChange = null;
  return game;
}

/** @param {import('./Room')} room */
function roomToSnap(room) {
  return {
    id: room.id,
    status: room.status,
    players: [...room.players.entries()].map(([id, p]) => ({ socketId: id, ...playerToSnap(p) })),
    nextGameQueue: room.nextGameQueue,
    usedColors: [...room.usedColors],
    strokes: room.strokes,
    chatHistory: room.chatHistory,
    game: room.game ? gameToSnap(room.game) : null,
  };
}

/** @param {object} snap */
function roomFromSnap(snap) {
  const room = new Room(snap.id);
  room.status = snap.status;
  room.nextGameQueue = snap.nextGameQueue || [];
  room.usedColors = new Set(snap.usedColors || []);
  room.strokes = snap.strokes || [];
  room.chatHistory = snap.chatHistory || [];

  for (const pSnap of snap.players || []) {
    const { socketId, ...rest } = pSnap;
    const player = playerFromSnap({ id: socketId, ...rest });
    // After DO restart no websocket is live — require reconnect
    player.connected = false;
    room.players.set(socketId, player);
  }

  if (snap.game) {
    const activePlayers = [...room.players.values()].filter((p) => !p.isSpectator);
    room.game = gameFromSnap(snap.game, activePlayers);
    room._restoreGameTimers();
  }

  return room;
}

/** @param {import('./RoomManager')} roomManager */
function snapshotRoomManager(roomManager) {
  const rooms = {};
  for (const [id, room] of roomManager.rooms) {
    rooms[id] = roomToSnap(room);
  }
  return { rooms, savedAt: Date.now() };
}

/**
 * @param {import('./RoomManager')} roomManager
 * @param {object|null} data
 */
function restoreRoomManager(roomManager, data) {
  roomManager.rooms.clear();
  roomManager.socketToRoom.clear();
  roomManager.socketToName.clear();

  if (!data?.rooms) return;

  for (const [id, snap] of Object.entries(data.rooms)) {
    const room = roomFromSnap(snap);
    roomManager.rooms.set(id, room);
    roomManager._wireBroadcast(room);
    room._wireGameCallbacks();
  }
}

module.exports = {
  snapshotRoomManager,
  restoreRoomManager,
};
