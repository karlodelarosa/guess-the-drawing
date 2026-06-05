/**
 * Game screen — timer, round info, player scoreboard, drawer state.
 */

import { renderPlayerList } from '../ui/playerList.js';
import * as canvas from '../drawing/canvas.js';

let timerInterval = null;
let roundEndTime = 0;

/**
 * Update the full game UI from room state.
 * @param {object} roomState
 * @param {object} myPlayer
 * @param {string} myId - socket ID
 */
export function update(roomState, myPlayer, myId) {
  const game = roomState.game;
  if (!game) return;

  // Round info
  document.getElementById('round-info').textContent =
    `Round ${game.currentRound}/${game.totalRounds}`;

  // Drawer emphasis
  const drawer = roomState.players.find((p) => p.id === game.drawerId);
  const drawerBadge = document.getElementById('drawer-badge');
  const drawerBanner = document.getElementById('drawer-banner');
  const drawerBannerText = document.getElementById('drawer-banner-text');
  const doneBtn = document.getElementById('btn-done-drawing');

  const isDrawer = myId === game.drawerId && game.phase === 'drawing';
  const isSpectator = myPlayer.isSpectator;

  if (drawer && game.phase === 'drawing') {
    drawerBadge.classList.remove('hidden');
    drawerBadge.innerHTML = `<span class="drawer-pulse"></span> <span style="color:${drawer.color}">${drawer.name}</span> is drawing`;
  } else {
    drawerBadge.classList.add('hidden');
  }

  if (isDrawer && game.phase === 'drawing') {
    drawerBanner.classList.remove('hidden', 'guesser-mode');
    drawerBannerText.textContent = '✏️ Your turn to draw! Press "Done Drawing" when finished.';
    doneBtn.classList.remove('hidden');
  } else if (drawer && game.phase === 'drawing') {
    drawerBanner.classList.remove('hidden');
    drawerBanner.classList.add('guesser-mode');
    drawerBannerText.innerHTML = `Guess what <span style="color:${drawer.color}">${drawer.name}</span> is drawing — type your answer in the chat box below!`;
    doneBtn.classList.add('hidden');
  } else {
    drawerBanner.classList.add('hidden');
    drawerBanner.classList.remove('guesser-mode');
    doneBtn.classList.add('hidden');
  }

  // Word hint (only visible to drawer during drawing phase)
  const wordHint = document.getElementById('word-hint');
  if (game.word && game.phase === 'drawing') {
    wordHint.textContent = `Draw: ${game.word}`;
    wordHint.classList.remove('hidden');
  } else {
    wordHint.classList.add('hidden');
  }

  // Scoreboard
  const list = document.getElementById('game-player-list');
  renderPlayerList(list, roomState.players, {
    showScore: true,
    drawerId: game.drawerId,
    gameActive: game.phase === 'drawing',
  });

  // Drawing permissions
  canvas.setCanDraw(isDrawer);
  canvas.setSpectatorMode(isSpectator && !isDrawer);

  // Chat instructions
  const chatInstructions = document.getElementById('chat-instructions');
  if (isDrawer) {
    chatInstructions.classList.add('hidden');
  } else if (game.phase === 'drawing' && !myPlayer.hasGuessedCorrectly && !isSpectator) {
    chatInstructions.classList.remove('hidden');
    chatInstructions.innerHTML = 'Type the word you think is being drawn below, then press <strong>Send</strong>. Match the full word exactly!';
  } else if (myPlayer.hasGuessedCorrectly) {
    chatInstructions.classList.remove('hidden');
    chatInstructions.textContent = 'You guessed correctly! Wait for the next round.';
  } else if (isSpectator) {
    chatInstructions.classList.remove('hidden');
    chatInstructions.textContent = 'You joined mid-game — you can watch but guesses won\'t count until the next game.';
  } else {
    chatInstructions.classList.add('hidden');
  }

  // Timer
  if (game.phase === 'drawing') {
    startTimer(game.timeRemaining, game.roundDuration);
  } else {
    stopTimer();
  }

  return {
    isDrawer,
    isSpectator,
    hasGuessed: myPlayer.hasGuessedCorrectly,
    phase: game.phase,
  };
}

/** Start the round countdown timer. */
function startTimer(remaining, duration) {
  roundEndTime = Date.now() + remaining;
  const total = duration;

  if (timerInterval) clearInterval(timerInterval);

  const tick = () => {
    const left = Math.max(0, roundEndTime - Date.now());
    const pct = (left / total) * 100;

    document.getElementById('timer-bar').style.width = `${pct}%`;
    document.getElementById('timer-text').textContent = formatTime(left);

    if (left <= 0) stopTimer();
  };

  tick();
  timerInterval = setInterval(tick, 200);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function formatTime(ms) {
  const sec = Math.ceil(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Handle round end reveal. */
export function handleRoundEnd(data) {
  stopTimer();
  canvas.clear();
  canvas.showReveal(data.word);
  document.getElementById('btn-done-drawing').classList.add('hidden');
}

/** Handle new round start. */
export function handleRoundStart() {
  canvas.hideReveal();
  canvas.clear();
}

/** Handle game end. */
export function handleGameEnd() {
  stopTimer();
  canvas.setCanDraw(false);
  document.getElementById('btn-done-drawing').classList.add('hidden');
}
