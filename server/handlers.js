/**
 * Shared game event handlers used by Socket.IO (local) and WebSocket (Cloudflare).
 */

/**
 * @param {import('./game/RoomManager')} roomManager
 * @param {object} ctx
 * @param {string} ctx.socketId
 * @param {(roomId: string) => void} [ctx.joinRoom]
 */
function createHandlers(roomManager, ctx) {
  const { socketId, joinRoom } = ctx;

  return {
    create_room({ playerName }) {
      const result = roomManager.createAndJoin(socketId, playerName);
      if (result.error) return result;
      joinRoom?.(result.room.id);
      return result;
    },

    join_room({ roomId, playerName }) {
      const result = roomManager.joinRoom(socketId, roomId, playerName);
      if (result.error) return result;
      joinRoom?.(result.room.id);
      return result;
    },

    reconnect_room({ roomId, playerName }) {
      const result = roomManager.reconnect(socketId, roomId, playerName);
      if (result.error) return result;
      joinRoom?.(result.room.id);
      return result;
    },

    start_game() {
      const room = roomManager.getRoomForSocket(socketId);
      if (!room) return { error: 'Not in a room.' };

      const result = room.startGame(socketId);
      if (result.error) return result;

      room.addSystemMessage('Game started! Type your guess in the chat box and press Send.');
      roomManager.broadcastRoomState(room);
      roomManager.broadcast?.emitToRoom(room.id, 'round_start', room.game.toJSON(null));
      return { success: true };
    },

    play_again() {
      const room = roomManager.getRoomForSocket(socketId);
      if (!room) return { error: 'Not in a room.' };

      const result = room.playAgain(socketId);
      if (result.error) return result;

      room.addSystemMessage('New game! Waiting for host to start...');
      roomManager.broadcastRoomState(room);
      return { success: true };
    },

    chat_message({ message }) {
      const room = roomManager.getRoomForSocket(socketId);
      if (!room) return null;

      const player = room.players.get(socketId);
      if (!player) return null;

      const result = room.addChatMessage(socketId, message);
      if (!result) return null;

      const { entry, guessResult } = result;

      if (guessResult?.correct) {
        roomManager.broadcast?.emitToRoom(room.id, 'correct_guess', {
          playerName: guessResult.playerName,
          playerColor: guessResult.playerColor,
          points: guessResult.points,
        });
        roomManager.broadcast?.emitToRoom(room.id, 'chat_message', entry);
        roomManager.broadcastRoomState(room);
      } else {
        roomManager.broadcast?.emitToRoom(room.id, 'chat_message', entry);
      }

      return { success: true };
    },

    typing({ isTyping }) {
      const room = roomManager.getRoomForSocket(socketId);
      if (!room) return null;
      const player = room.players.get(socketId);
      if (!player) return null;
      player.isTyping = isTyping;
      roomManager.broadcast?.emitToRoomExcept(room.id, socketId, 'player_typing', {
        playerId: socketId,
        playerName: player.name,
        isTyping,
      });
      return null;
    },

    draw_stroke(stroke) {
      const room = roomManager.getRoomForSocket(socketId);
      if (!room?.game) return null;
      if (room.game.getCurrentDrawerId() !== socketId) return null;
      if (room.game.phase !== 'drawing') return null;

      stroke.playerId = socketId;
      room.addStroke(stroke);
      roomManager.broadcast?.emitToRoomExcept(room.id, socketId, 'draw_stroke', stroke);
      return null;
    },

    undo_stroke() {
      const room = roomManager.getRoomForSocket(socketId);
      if (!room) return { error: 'Not in a room.' };

      const removed = room.undoLastStroke(socketId);
      if (!removed) return { error: 'Nothing to undo.' };

      roomManager.broadcast?.emitToRoom(room.id, 'undo_stroke', { strokeId: removed.id });
      return { success: true };
    },

    clear_canvas() {
      const room = roomManager.getRoomForSocket(socketId);
      if (!room) return { error: 'Not in a room.' };

      const cleared = room.clearCanvas(socketId);
      if (!cleared) return { error: 'Not allowed.' };

      roomManager.broadcast?.emitToRoom(room.id, 'clear_canvas');
      return { success: true };
    },

    done_drawing() {
      const room = roomManager.getRoomForSocket(socketId);
      if (!room) return { error: 'Not in a room.' };

      const result = room.finishDrawing(socketId);
      if (result.error) return result;

      const player = room.players.get(socketId);
      const entry = room.addSystemMessage(
        `${player?.name || 'Drawer'} finished drawing — revealing the answer!`
      );
      roomManager.broadcast?.emitToRoom(room.id, 'chat_message', entry);
      roomManager.broadcastRoomState(room);
      return { success: true };
    },

    leave_room() {
      roomManager.leaveRoom(socketId);
      return { success: true };
    },

    disconnect() {
      roomManager.handleDisconnect(socketId);
      return null;
    },
  };
}

module.exports = { createHandlers };
