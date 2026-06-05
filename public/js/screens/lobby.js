/**
 * Lobby screen — name entry, create/join room.
 */

import * as socket from '../socket.js';
import { showToast } from '../ui/toast.js';
import { getRoomFromURL } from '../utils/storage.js';

const nameInput = () => document.getElementById('player-name');
const roomCodeInput = () => document.getElementById('room-code');

export function init(onJoined) {
  // Pre-fill room code from URL if present
  const roomFromURL = getRoomFromURL();
  if (roomFromURL) {
    roomCodeInput().value = roomFromURL;
  }

  // Restore saved name
  const saved = sessionStorage.getItem('gtd_playerName');
  if (saved) nameInput().value = saved;

  document.getElementById('btn-create-room').addEventListener('click', async () => {
    const name = getName();
    if (!name) return;

    try {
      const result = await socket.emit('create_room', { playerName: name });
      onJoined(result);
    } catch (err) {
      showToast(err.message, 'warning');
    }
  });

  document.getElementById('btn-join-room').addEventListener('click', async () => {
    const name = getName();
    const roomId = roomCodeInput().value.trim().toUpperCase();
    if (!name) return;
    if (!roomId) {
      showToast('Enter a room code', 'warning');
      return;
    }

    try {
      const result = await socket.emit('join_room', { roomId, playerName: name });
      onJoined(result);
    } catch (err) {
      showToast(err.message, 'warning');
    }
  });

  // Enter key support
  nameInput().addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (roomCodeInput().value.trim()) {
        document.getElementById('btn-join-room').click();
      } else {
        document.getElementById('btn-create-room').click();
      }
    }
  });
}

function getName() {
  const name = nameInput().value.trim();
  if (!name) {
    showToast('Please enter your name', 'warning');
    return null;
  }
  sessionStorage.setItem('gtd_playerName', name);
  return name;
}
