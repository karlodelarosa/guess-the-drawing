/** Shared server constants for game configuration. */

module.exports = {
  MAX_PLAYERS: 10,
  ROOM_ID_LENGTH: 6,
  ROUND_DURATION_MS: 80_000,
  MIN_PLAYERS_TO_START: 2,

  /** Points awarded to guesser based on time remaining (percentage). */
  GUESSER_POINTS: [
    { threshold: 0.75, points: 100 },
    { threshold: 0.50, points: 75 },
    { threshold: 0.25, points: 50 },
    { threshold: 0.00, points: 25 },
  ],

  /** Points awarded to drawer per correct guess. */
  DRAWER_POINTS_PER_GUESS: 50,

  /** Available player colors (hex). */
  PLAYER_COLORS: [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
    '#9b59b6', '#1abc9c', '#e67e22', '#34495e',
    '#ff6b6b', '#48dbfb', '#ff9ff3', '#54a0ff',
  ],

  WORD_CATEGORIES: [
    'Animals',
    'Objects',
    'Food',
    'Bible',
    'Church',
    'Music',
  ],
};
