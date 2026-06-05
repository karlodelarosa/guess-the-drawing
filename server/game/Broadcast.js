/**
 * Transport-agnostic broadcast interface.
 * Implemented by Socket.IO (local) and WebSockets (Cloudflare DO).
 */

/**
 * @typedef {object} BroadcastAPI
 * @property {(roomId: string, event: string, data?: any) => void} emitToRoom
 * @property {(socketId: string, event: string, data?: any) => void} emitToPlayer
 * @property {(roomId: string, exceptSocketId: string, event: string, data?: any) => void} emitToRoomExcept
 */

module.exports = {};
