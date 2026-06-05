/**
 * Lobby screen — name entry, create/join room.
 */

import * as socket from '../socket.js';
import { showToast } from '../ui/toast.js';
import { getRoomFromURL } from '../utils/storage.js';

const nameInput = () => document.getElementById('player-name');
const roomCodeInput = () => document.getElementById('room-code');

let joinCallback = null;
let autoJoinStarted = false;

export function init(onJoined) {
  joinCallback = onJoined;

  const roomFromURL = getRoomFromURL();
  if (roomFromURL) {
    roomCodeInput().value = roomFromURL;
  }

  const saved = sessionStorage.getItem('gtd_playerName');
  if (saved) nameInput().value = saved;

  // Always auto-join when invite link contains a room code
  if (roomFromURL && saved) {
    autoJoinFromUrl(roomFromURL, saved);
  }

  document.getElementById('btn-create-room').addEventListener('click', async () => {
    const name = getName();
    if (!name) return;

    try {
      await socket.whenReady();
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

  roomCodeInput().addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

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

async function autoJoinFromUrl(roomId, name) {
  if (autoJoinStarted) return;
  autoJoinStarted = true;

  try {
    await socket.whenReady();
    // Try reconnect first (returning player), fall back to fresh join
    try {
      const result = await socket.emit('reconnect_room', { roomId, playerName: name });
      joinCallback(result);
      return;
    } catch {
      // Not a returning player — join as new
    }
    await tryJoinRoom(roomId, name);
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

async function tryJoinRoom(roomId, name) {
  try {
    await socket.whenReady();
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
