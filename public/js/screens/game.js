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

  // Drawer name
  const drawer = roomState.players.find((p) => p.id === game.drawerId);
  const drawerEl = document.getElementById('drawer-name');
  if (drawer) {
    drawerEl.innerHTML = `<span style="color:${drawer.color}">${drawer.name}</span> is drawing`;
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
  const isDrawer = myId === game.drawerId && game.phase === 'drawing';
  const isSpectator = myPlayer.isSpectator;
  canvas.setCanDraw(isDrawer);
  canvas.setSpectatorMode(isSpectator && !isDrawer);

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
}
