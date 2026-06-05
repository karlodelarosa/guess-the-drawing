/** Represents a single player in a room. */

class Player {
  /**
   * @param {string} id - Socket ID
   * @param {string} name
   * @param {string} color - Hex color
   * @param {boolean} isSpectator
   */
  constructor(id, name, color, isSpectator = false) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.score = 0;
    this.isSpectator = isSpectator;
    this.isHost = false;
    this.hasGuessedCorrectly = false;
    this.isTyping = false;
    this.connected = true;
  }

  /** Serialize for client consumption. */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      score: this.score,
      isSpectator: this.isSpectator,
      isHost: this.isHost,
      hasGuessedCorrectly: this.hasGuessedCorrectly,
      isTyping: this.isTyping,
      connected: this.connected,
    };
  }
}

module.exports = Player;
