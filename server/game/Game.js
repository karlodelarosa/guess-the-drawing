const { getRandomWord } = require('../wordList');
const {
  ROUND_DURATION_MS,
  GUESSER_POINTS,
  DRAWER_POINTS_PER_GUESS,
} = require('../constants');

/**
 * Manages an active game session within a room.
 * Handles rounds, scoring, and turn progression.
 */
class Game {
  /**
   * @param {import('./Player')[]} activePlayers - Non-spectator players for this game
   */
  constructor(activePlayers) {
    this.activePlayers = activePlayers;
    this.drawOrder = this._shuffle([...activePlayers.map((p) => p.id)]);
    this.currentDrawerIndex = 0;
    this.currentRound = 0;
    this.totalRounds = this.drawOrder.length;
    this.phase = 'waiting'; // waiting | drawing | reveal | finished
    this.currentWord = null;
    this.currentCategory = null;
    this.roundStartTime = null;
    this.roundEndTime = null;
    this.roundTimer = null;
    this.correctGuessers = new Set();
    this.onRoundEnd = null;
    this.onGameEnd = null;
    this.onStateChange = null;
  }

  /** Fisher-Yates shuffle. */
  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Get the current drawer's player ID. */
  getCurrentDrawerId() {
    return this.drawOrder[this.currentDrawerIndex] ?? null;
  }

  /** Start the first round. */
  start() {
    this.phase = 'drawing';
    this.currentRound = 1;
    this._startRound();
  }

  /** Begin a new drawing round. */
  _startRound() {
    const { word, category } = getRandomWord();
    this.currentWord = word;
    this.currentCategory = category;
    this.roundStartTime = Date.now();
    this.roundEndTime = this.roundStartTime + ROUND_DURATION_MS;
    this.correctGuessers.clear();

    // Reset guess state for all active players
    for (const player of this.activePlayers) {
      player.hasGuessedCorrectly = false;
    }

    if (this.roundTimer) clearTimeout(this.roundTimer);
    this.roundTimer = setTimeout(() => this._endRound('timer'), ROUND_DURATION_MS);

    if (this.onStateChange) this.onStateChange('round_start');
  }

  /**
   * Normalize a guess for comparison.
   * @param {string} guess
   */
  normalizeGuess(guess) {
    return guess.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Check if a chat message matches the current word.
   * @param {string} playerId
   * @param {string} message
   * @returns {{ correct: boolean, points?: number, drawerPoints?: number }}
   */
  checkGuess(playerId, message) {
    if (this.phase !== 'drawing') return { correct: false };
    if (playerId === this.getCurrentDrawerId()) return { correct: false };

    const player = this.activePlayers.find((p) => p.id === playerId);
    if (!player || player.isSpectator || player.hasGuessedCorrectly) {
      return { correct: false };
    }

    const normalized = this.normalizeGuess(message);
    const answer = this.normalizeGuess(this.currentWord);

    if (normalized !== answer) return { correct: false };

    // Calculate points based on time remaining
    const elapsed = Date.now() - this.roundStartTime;
    const remaining = Math.max(0, ROUND_DURATION_MS - elapsed);
    const percentRemaining = remaining / ROUND_DURATION_MS;

    let guesserPoints = 25;
    for (const tier of GUESSER_POINTS) {
      if (percentRemaining >= tier.threshold) {
        guesserPoints = tier.points;
        break;
      }
    }

    player.score += guesserPoints;
    player.hasGuessedCorrectly = true;
    this.correctGuessers.add(playerId);

    // Award drawer
    const drawer = this.activePlayers.find((p) => p.id === this.getCurrentDrawerId());
    if (drawer) {
      drawer.score += DRAWER_POINTS_PER_GUESS;
    }

    // Check if everyone (except drawer) has guessed
    const guessers = this.activePlayers.filter((p) => p.id !== this.getCurrentDrawerId());
    const allGuessed = guessers.every((p) => p.hasGuessedCorrectly);

    if (allGuessed) {
      this._endRound('all_guessed');
    }

    return {
      correct: true,
      points: guesserPoints,
      drawerPoints: DRAWER_POINTS_PER_GUESS,
      playerName: player.name,
      playerColor: player.color,
    };
  }

  /**
   * Drawer ends the round early.
   * @param {string} drawerId
   * @returns {boolean}
   */
  finishDrawing(drawerId) {
    if (this.phase !== 'drawing') return false;
    if (drawerId !== this.getCurrentDrawerId()) return false;
    this._endRound('drawer_done');
    return true;
  }

  /**
   * End the current round.
   * @param {'timer' | 'all_guessed' | 'drawer_done'} reason
   */
  _endRound(reason) {
    if (this.phase !== 'drawing') return;
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }

    this.phase = 'reveal';
    if (this.onRoundEnd) {
      this.onRoundEnd({
        reason,
        word: this.currentWord,
        category: this.currentCategory,
        round: this.currentRound,
        totalRounds: this.totalRounds,
      });
    }

    // Auto-advance after reveal delay
    setTimeout(() => this._advanceToNextRound(), 4000);
  }

  /** Move to the next drawer or end the game. */
  _advanceToNextRound() {
    this.currentDrawerIndex++;

    if (this.currentDrawerIndex >= this.drawOrder.length) {
      this._endGame();
      return;
    }

    this.currentRound++;
    this.phase = 'drawing';
    this._startRound();
  }

  /** End the game and compute final rankings. */
  _endGame() {
    this.phase = 'finished';
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }

    const rankings = [...this.activePlayers]
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({
        rank: i + 1,
        id: p.id,
        name: p.name,
        color: p.color,
        score: p.score,
      }));

    if (this.onGameEnd) {
      this.onGameEnd({ rankings, winner: rankings[0] ?? null });
    }
  }

  /** Get time remaining in current round (ms). */
  getTimeRemaining() {
    if (!this.roundEndTime) return 0;
    return Math.max(0, this.roundEndTime - Date.now());
  }

  /** Serialize game state for clients. */
  toJSON(forPlayerId) {
    const isDrawer = forPlayerId === this.getCurrentDrawerId();
    return {
      phase: this.phase,
      currentRound: this.currentRound,
      totalRounds: this.totalRounds,
      drawerId: this.getCurrentDrawerId(),
      drawOrder: this.drawOrder,
      word: isDrawer && this.phase === 'drawing' ? this.currentWord : null,
      category: isDrawer && this.phase === 'drawing' ? this.currentCategory : null,
      timeRemaining: this.getTimeRemaining(),
      roundDuration: ROUND_DURATION_MS,
    };
  }

  /** Clean up timers. */
  destroy() {
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }
  }
}

module.exports = Game;
