/**
 * Main application entry — wires screens, socket events, and game flow.
 */

import * as socket from './socket.js';
import * as lobby from './screens/lobby.js';
import * as waiting from './screens/waiting.js';
import * as gameScreen from './screens/game.js';
import * as results from './screens/results.js';
import * as chat from './ui/chat.js';
import * as canvas from './drawing/canvas.js';
import { showToast } from './ui/toast.js';
import { saveSession, getSession, clearSession } from './utils/storage.js';
import { setRoomInUrl } from './utils/config.js';
import { playCorrectGuess, playRoundStart, playRoundEnd } from './utils/sounds.js';

// ---- Application state ----
let roomState = null;
let myPlayer = null;
let myId = null;
let currentScreen = 'lobby';

// ---- Screen management ----
function showScreen(name) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
  const screenMap = {
    lobby: 'lobby-screen',
    waiting: 'waiting-screen',
    game: 'game-screen',
  };
  document.getElementById(screenMap[name]).classList.add('active');
  currentScreen = name;
}

// ---- Initialize everything ----
function init() {
  socket.connect();

  // Canvas
  canvas.init({
    onStroke: (stroke) => socket.emit('draw_stroke', stroke).catch(() => {}),
    onUndo: () => socket.emit('undo_stroke').catch((err) => showToast(err.message, 'warning')),
    onClear: () => socket.emit('clear_canvas').catch((err) => showToast(err.message, 'warning')),
  });

  // Lobby
  lobby.init(handleJoined);

  // Waiting room
  waiting.init({
    onStart: handleStartGame,
    onLeave: handleLeave,
  });

  // Results modal
  results.init({
    onPlayAgain: handlePlayAgain,
    onBackLobby: handleBackToLobby,
  });

  // Chat
  chat.onSubmit((message) => {
    socket.emit('chat_message', { message }).catch(() => {});
  });
  chat.onTyping((isTyping) => {
    socket.emit('typing', { isTyping }).catch(() => {});
  });

  // Leave game button
  document.getElementById('btn-leave-game').addEventListener('click', handleLeave);

  // Done drawing button
  document.getElementById('btn-done-drawing').addEventListener('click', async () => {
    try {
      await socket.emit('done_drawing');
      showToast('Round ended — revealing answer...', 'info');
    } catch (err) {
      showToast(err.message, 'warning');
    }
  });

  // Socket events
  registerSocketEvents();

  // Attempt reconnect if session exists (wait for socket first)
  attemptReconnect();
}

/** Clear room from URL when leaving. */
function clearRoomFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('room');
  history.replaceState(null, '', url.pathname + url.search);
}

/** Handle successful room join. */
function handleJoined(result) {
  roomState = result.room;
  myPlayer = result.player;
  myId = result.player?.id || socket.getSocket().id;
  saveSession(myPlayer.name, roomState.id);
  setRoomInUrl(roomState.id);

  if (roomState.status === 'playing' || roomState.status === 'finished') {
    enterGame();
  } else {
    showScreen('waiting');
    waiting.show(roomState, myPlayer);
  }
}

/** Enter the game screen from any state. */
function enterGame() {
  showScreen('game');
  chat.loadHistory(roomState.chatHistory);
  canvas.loadStrokes(roomState.strokes);
  updateGameUI();

  if (roomState.status === 'finished' && roomState.game?.phase === 'finished') {
    // Don't re-show results on reconnect unless we have rankings
  }
}

/** Update game UI from current room state. */
function updateGameUI() {
  if (!roomState || !myPlayer) return;
  const uiState = gameScreen.update(roomState, myPlayer, myId);

  chat.configureInput({
    placeholder: uiState.isDrawer
      ? 'You are drawing — others guess in chat'
      : uiState.isSpectator
        ? 'Spectating — guesses count next game'
        : uiState.hasGuessed
          ? 'You guessed correctly!'
          : 'Type your guess here...',
    disabled: uiState.isDrawer || uiState.isSpectator || uiState.phase !== 'drawing' || uiState.hasGuessed,
    hasGuessed: uiState.hasGuessed,
  });
}

/** Host starts the game. */
async function handleStartGame() {
  try {
    await socket.emit('start_game');
    enterGame();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

/** Play again after game ends. */
async function handlePlayAgain() {
  try {
    await socket.emit('play_again');
    results.hide();
    showScreen('waiting');
    waiting.update(roomState, myPlayer);
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

/** Leave room and return to lobby. */
function handleLeave() {
  socket.emit('leave_room').catch(() => {});
  clearSession();
  clearRoomFromUrl();
  roomState = null;
  myPlayer = null;
  results.hide();
  showScreen('lobby');
}

function handleBackToLobby() {
  handleLeave();
}

/** Register all server → client socket events. */
function registerSocketEvents() {
  socket.on('room_state', (state) => {
    roomState = state;
    myPlayer = state.players.find((p) => p.id === myId)
      || state.players.find((p) => p.name === myPlayer?.name)
      || myPlayer;
    if (myPlayer) myId = myPlayer.id;

    if (state.status === 'lobby') {
      results.hide();
      showScreen('waiting');
      waiting.update(state, myPlayer);
    } else if (state.status === 'playing') {
      if (currentScreen !== 'game') enterGame();
      else updateGameUI();
    } else if (currentScreen === 'waiting') {
      waiting.update(state, myPlayer);
    } else if (currentScreen === 'game') {
      updateGameUI();
    }
  });

  socket.on('chat_message', (entry) => {
    chat.addMessage(entry);
  });

  socket.on('player_typing', ({ playerId, playerName, isTyping }) => {
    chat.setTyping(playerId, playerName, isTyping);
  });

  socket.on('correct_guess', ({ playerName, playerColor, points }) => {
    showToast(`${playerName} guessed correctly! (+${points} pts)`, 'success');
    playCorrectGuess();
  });

  socket.on('round_start', (gameState) => {
    playRoundStart();
    gameScreen.handleRoundStart();
    if (roomState) {
      roomState.game = gameState;
      updateGameUI();
    }
    showToast('New round started!', 'info');
  });

  socket.on('round_end', (data) => {
    playRoundEnd();
    gameScreen.handleRoundEnd(data);
    showToast(`The word was: ${data.word}`, 'info', 4000);
  });

  socket.on('game_end', (data) => {
    gameScreen.handleGameEnd();
    results.show(data, myPlayer?.isHost);
  });

  // Drawing sync
  socket.on('draw_stroke', (stroke) => {
    canvas.addStroke(stroke);
  });

  socket.on('undo_stroke', ({ strokeId }) => {
    canvas.removeStroke(strokeId);
  });

  socket.on('clear_canvas', () => {
    canvas.clear();
  });

  // Reconnect on socket disconnect/reconnect (mid-game only)
  const tryReconnect = async () => {
    if (!roomState) return;
    const session = getSession();
    if (!session.roomId || !session.playerName) return;
    try {
      await socket.whenReady();
      const result = await socket.emit('reconnect_room', {
        roomId: session.roomId,
        playerName: session.playerName,
      });
      handleJoined(result);
      showToast('Reconnected!', 'success');
    } catch {
      // Room may have ended — stay on current screen
    }
  };

  socket.on('reconnected', () => {
    tryReconnect();
  });
}

/** Try to reconnect to a previous session (page refresh, no ?room in URL). */
async function attemptReconnect() {
  const session = getSession();
  if (!session.roomId || !session.playerName) return;

  // If URL has a room param, let lobby auto-join handle it
  const urlRoom = new URLSearchParams(window.location.search).get('room');
  if (urlRoom) return;

  try {
    await socket.whenReady();
    const result = await socket.emit('reconnect_room', {
      roomId: session.roomId,
      playerName: session.playerName,
    });
    handleJoined(result);
    if (result.reconnected) {
      showToast('Reconnected!', 'success');
    }
  } catch (err) {
    // Only clear session if the room truly doesn't exist
    if (err.message === 'Room not found.') {
      clearSession();
    }
  }
}

// Boot
init();
