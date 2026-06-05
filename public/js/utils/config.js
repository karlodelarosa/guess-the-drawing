/**
 * App configuration — production URL used when sharing invites from localhost.
 */
export const PRODUCTION_URL = 'https://guess-the-drawing.karlo-karlo59.workers.dev';

export function isLocalhost() {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

/**
 * Multiplayer runs on Cloudflare — redirect localhost visitors so phones can join the same room.
 * Add ?local=1 to skip (local Node/wrangler dev only).
 */
export function maybeRedirectToProduction() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('local') === '1' || !isLocalhost()) return false;

  const target = new URL(PRODUCTION_URL);
  const room = params.get('room');
  if (room) target.searchParams.set('room', room);
  window.location.replace(target.toString());
  return true;
}

/** Build a shareable invite URL that works across devices. */
export function getInviteUrl(roomId) {
  const origin = window.location.origin;
  const base = isLocalhost() ? PRODUCTION_URL : origin;
  return `${base}?room=${roomId}`;
}

/** Update the browser URL with the room code (for easy sharing). */
export function setRoomInUrl(roomId) {
  const url = new URL(window.location.href);
  url.searchParams.set('room', roomId);
  history.replaceState(null, '', url.toString());
}
