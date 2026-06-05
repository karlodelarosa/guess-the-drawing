/**
 * Waiting room screen — player list, start game, share link.
 */

import { renderPlayerList } from '../ui/playerList.js';
import { showToast } from '../ui/toast.js';

let currentRoomId = '';

export function show(roomState, myPlayer) {
  currentRoomId = roomState.id;
  document.getElementById('display-room-id').textContent = roomState.id;
  update(roomState, myPlayer);
}

export function update(roomState, myPlayer) {
  const list = document.getElementById('waiting-player-list');
  renderPlayerList(list, roomState.players);
  document.getElementById('player-count').textContent = roomState.players.filter((p) => p.connected).length;

  const startBtn = document.getElementById('btn-start-game');
  const statusText = document.getElementById('waiting-status');

  if (roomState.status === 'lobby') {
    if (myPlayer.isHost) {
      startBtn.classList.remove('hidden');
      const active = roomState.players.filter((p) => !p.isSpectator && p.connected).length;
      startBtn.disabled = active < 2;
      statusText.textContent = active < 2
        ? 'Need at least 2 players to start'
        : 'You are the host — start when ready!';
    } else {
      startBtn.classList.add('hidden');
      statusText.textContent = 'Waiting for host to start...';
    }
  } else if (roomState.status === 'playing') {
    startBtn.classList.add('hidden');
    statusText.textContent = 'Game in progress — you are spectating';
  } else if (roomState.status === 'finished') {
    startBtn.classList.add('hidden');
    statusText.textContent = 'Game finished';
  }
}

export function init({ onStart, onLeave }) {
  document.getElementById('btn-start-game').addEventListener('click', onStart);
  document.getElementById('btn-leave-room').addEventListener('click', onLeave);

  document.getElementById('btn-copy-link').addEventListener('click', () => {
    const url = `${window.location.origin}?room=${currentRoomId}`;
    navigator.clipboard.writeText(url).then(() => {
      showToast('Invite link copied!', 'success');
    }).catch(() => {
      showToast(url, 'info', 5000);
    });
  });
}
