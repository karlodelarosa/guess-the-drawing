/**
 * Waiting room screen — player list, start game, share link.
 */

import { renderPlayerList } from '../ui/playerList.js';
import { showToast } from '../ui/toast.js';
import { getInviteUrl, setRoomInUrl } from '../utils/config.js';

let currentRoomId = '';

export function show(roomState, myPlayer) {
  currentRoomId = roomState.id;
  document.getElementById('display-room-id').textContent = roomState.id;
  setRoomInUrl(roomState.id);
  updateInviteLink();
  update(roomState, myPlayer);
}

function updateInviteLink() {
  const url = getInviteUrl(currentRoomId);
  const linkEl = document.getElementById('invite-link');
  linkEl.href = url;
  linkEl.textContent = url;
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
    const url = getInviteUrl(currentRoomId);
    copyText(url, 'Invite link copied! Share with friends on their phones.');
  });

  document.getElementById('btn-copy-code').addEventListener('click', () => {
    copyText(currentRoomId, 'Room code copied!');
  });
}

function copyText(text, successMsg) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(successMsg, 'success');
  }).catch(() => {
    showToast(text, 'info', 6000);
  });
}
