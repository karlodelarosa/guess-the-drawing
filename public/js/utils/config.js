/**
 * App configuration — production URL used when sharing invites from localhost.
 */
export const PRODUCTION_URL = 'https://guess-the-drawing.karlo-karlo59.workers.dev';

/** Build a shareable invite URL that works across devices. */
export function getInviteUrl(roomId) {
  const origin = window.location.origin;
  const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1');
  const base = isLocal ? PRODUCTION_URL : origin;
  return `${base}?room=${roomId}`;
}

/** Update the browser URL with the room code (for easy sharing). */
export function setRoomInUrl(roomId) {
  const url = new URL(window.location.href);
  url.searchParams.set('room', roomId);
  history.replaceState(null, '', url.toString());
}
