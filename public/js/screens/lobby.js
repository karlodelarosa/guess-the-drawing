/**
 * Lobby screen — name entry, create/join room.
 */

import * as socket from '../socket.js';
import { showToast } from '../ui/toast.js';
import { getRoomFromURL, getSession, syncSessionWithInviteUrl } from '../utils/storage.js';

const nameInput = () => document.getElementById('player-name');
const roomCodeInput = () => document.getElementById('room-code');

let joinCallback = null;
let autoJoinStarted = false;
let joinInProgress = false;

function setConnectionStatus(text, ok) {
  const el = document.getElementById('connection-status');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('connected', !!ok);
}

function showInviteMode(roomId) {
  document.getElementById('invite-banner')?.classList.remove('hidden');
  document.getElementById('invite-room-code').textContent = roomId;
  document.getElementById('btn-create-room')?.classList.add('hidden');
  document.getElementById('lobby-divider')?.classList.add('hidden');
  document.getElementById('btn-join-room')?.classList.add('hidden');
  document.getElementById('btn-join-invite')?.classList.remove('hidden');
  roomCodeInput().closest('.form-group')?.classList.add('hidden');
}

export function init(onJoined) {
  joinCallback = onJoined;

  syncSessionWithInviteUrl();

  const saved = sessionStorage.getItem('gtd_playerName');
  if (saved) nameInput().value = saved;

  const roomFromURL = getRoomFromURL();
  if (roomFromURL) {
    roomCodeInput().value = roomFromURL;
    showInviteMode(roomFromURL);
    if (!saved) {
      setTimeout(() => nameInput().focus(), 300);
    }
  }

  socket.on('connect', () => setConnectionStatus('Connected — ready to play', true));
  socket.on('disconnect', () => setConnectionStatus('Reconnecting…', false));

  socket.whenReady().then(() => setConnectionStatus('Connected — ready to play', true));

  const tryInviteJoin = () => {
    const roomId = getRoomFromURL();
    const name = nameInput().value.trim();
    if (!roomId || !name || autoJoinStarted) return;
    sessionStorage.setItem('gtd_playerName', name);
    autoJoinFromUrl(roomId, name);
  };

  // Auto-join from invite link when name is known
  if (roomFromURL && saved) {
    autoJoinFromUrl(roomFromURL, saved);
  }

  // Phone: join after user finishes typing their name
  nameInput().addEventListener('change', tryInviteJoin);

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

  const handleJoin = async () => {
    const name = getName();
    const roomId = (getRoomFromURL() || roomCodeInput().value.trim()).toUpperCase();
    if (!name) return;
    if (!roomId) {
      showToast('Enter a room code', 'warning');
      return;
    }
    await joinOrReconnect(roomId, name);
  };

  document.getElementById('btn-join-room').addEventListener('click', handleJoin);
  document.getElementById('btn-join-invite').addEventListener('click', handleJoin);

  roomCodeInput().addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  nameInput().addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (getRoomFromURL() || roomCodeInput().value.trim()) {
        handleJoin();
      } else {
        document.getElementById('btn-create-room').click();
      }
    }
  });
}

async function autoJoinFromUrl(roomId, name) {
  if (autoJoinStarted) return;
  autoJoinStarted = true;
  await joinOrReconnect(roomId, name);
}

/** Join a room — tries fresh join first, then reconnect for returning players. */
async function joinOrReconnect(roomId, name) {
  if (joinInProgress) return;
  joinInProgress = true;

  try {
    await socket.whenReady();

    const attempt = async () => {
      try {
        const result = await socket.emit('join_room', { roomId, playerName: name });
        joinCallback(result);
        return true;
      } catch (err) {
        if (err.message === 'That name is already taken.') {
          const result = await socket.emit('reconnect_room', { roomId, playerName: name });
          joinCallback(result);
          return true;
        }
        throw err;
      }
    };

    try {
      await attempt();
    } catch (err) {
      if (err.message === 'Room not found.') {
        showToast('Connecting to room…', 'info');
        await new Promise((r) => setTimeout(r, 1500));
        await socket.whenReady();
        await attempt();
      } else {
        throw err;
      }
    }
  } catch (err) {
    showToast(err.message, 'warning');
  } finally {
    joinInProgress = false;
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
