/**
 * Lobby screen — name entry, create/join room.
 */

import * as socket from '../socket.js';
import { showToast } from '../ui/toast.js';
import { getRoomFromURL, getSession } from '../utils/storage.js';

const nameInput = () => document.getElementById('player-name');
const roomCodeInput = () => document.getElementById('room-code');

let joinCallback = null;

export function init(onJoined) {
  joinCallback = onJoined;

  // Pre-fill room code from URL if present
  const roomFromURL = getRoomFromURL();
  if (roomFromURL) {
    roomCodeInput().value = roomFromURL;
  }

  // Restore saved name
  const saved = sessionStorage.getItem('gtd_playerName');
  if (saved) nameInput().value = saved;

  // Auto-join from invite link when name is saved
  if (roomFromURL && saved) {
    const session = getSession();
    if (!session.roomId || session.roomId !== roomFromURL) {
      setTimeout(() => tryJoinRoom(roomFromURL, saved), 800);
    }
  }

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
    await tryJoinRoom(roomId, name);
  });

  // Auto-uppercase room code as user types
  roomCodeInput().addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
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

async function tryJoinRoom(roomId, name) {
  try {
    const result = await socket.emit('join_room', { roomId, playerName: name });
    joinCallback(result);
  } catch (err) {
    showToast(err.message, 'warning');
  }
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
