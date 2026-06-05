/**
 * Persist player name and room info in sessionStorage for reconnect.
 */

const KEYS = {
  PLAYER_NAME: 'gtd_playerName',
  ROOM_ID: 'gtd_roomId',
};

export function saveSession(playerName, roomId) {
  sessionStorage.setItem(KEYS.PLAYER_NAME, playerName);
  sessionStorage.setItem(KEYS.ROOM_ID, roomId);
}

export function getSession() {
  return {
    playerName: sessionStorage.getItem(KEYS.PLAYER_NAME) || '',
    roomId: sessionStorage.getItem(KEYS.ROOM_ID) || '',
  };
}

export function clearSession() {
  sessionStorage.removeItem(KEYS.PLAYER_NAME);
  sessionStorage.removeItem(KEYS.ROOM_ID);
}

/** Drop stale saved room when opening a different invite link. */
export function syncSessionWithInviteUrl() {
  const urlRoom = getRoomFromURL();
  if (!urlRoom) return;

  const savedRoom = sessionStorage.getItem(KEYS.ROOM_ID);
  if (savedRoom && savedRoom !== urlRoom) {
    sessionStorage.removeItem(KEYS.ROOM_ID);
  }
}

/** Parse room ID from URL query string or path. */
export function getRoomFromURL() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('room');
  if (fromQuery) return fromQuery.toUpperCase();

  const match = window.location.pathname.match(/\/room\/([A-Z0-9]+)/i);
  return match ? match[1].toUpperCase() : '';
}
