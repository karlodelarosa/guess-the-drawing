/**
 * Player list rendering for lobby, waiting room, and scoreboard.
 */

/**
 * Render players into a list element.
 * @param {HTMLElement} listEl
 * @param {object[]} players
 * @param {object} options
 */
export function renderPlayerList(listEl, players, options = {}) {
  const { showScore = false, drawerId = null, gameActive = false } = options;
  listEl.innerHTML = '';

  const sorted = [...players].sort((a, b) => {
    if (showScore) return b.score - a.score;
    return 0;
  });

  for (const player of sorted) {
    const li = document.createElement('li');

    if (drawerId === player.id) li.classList.add('drawing');
    if (player.hasGuessedCorrectly) li.classList.add('guessed');
    if (!player.connected) li.style.opacity = '0.4';

    const dot = document.createElement('span');
    dot.className = 'player-dot';
    dot.style.background = player.color;
    li.appendChild(dot);

    const name = document.createElement('span');
    name.className = 'player-name';
    name.textContent = player.name;
    name.style.color = player.color;
    li.appendChild(name);

    if (player.isHost) {
      const badge = document.createElement('span');
      badge.className = 'player-badge';
      badge.textContent = 'Host';
      li.appendChild(badge);
    }

    if (player.isSpectator) {
      const badge = document.createElement('span');
      badge.className = 'player-badge';
      badge.textContent = 'Spectator';
      li.appendChild(badge);
    }

    if (showScore) {
      const score = document.createElement('span');
      score.className = 'player-score';
      score.textContent = player.score;
      li.appendChild(score);
    }

    listEl.appendChild(li);
  }
}
