/**
 * Final results modal.
 */

import { playWinner } from '../utils/sounds.js';

export function show(data, isHost) {
  const modal = document.getElementById('results-modal');
  const winnerText = document.getElementById('winner-text');
  const rankingsList = document.getElementById('final-rankings');
  const playAgainBtn = document.getElementById('btn-play-again');

  if (data.winner) {
    winnerText.innerHTML = `<span style="color:${data.winner.color}">${data.winner.name}</span> wins with ${data.winner.score} points!`;
  } else {
    winnerText.textContent = 'No winner';
  }

  rankingsList.innerHTML = '';
  for (const entry of data.rankings) {
    const li = document.createElement('li');
    const rankClass = entry.rank === 1 ? 'rank-1' : '';
    li.innerHTML = `
      <span class="rank ${rankClass}">#${entry.rank}</span>
      <span class="player-dot" style="background:${entry.color}"></span>
      <span class="player-name" style="color:${entry.color}">${entry.name}</span>
      <span class="player-score">${entry.score}</span>
    `;
    rankingsList.appendChild(li);
  }

  if (isHost) {
    playAgainBtn.classList.remove('hidden');
  } else {
    playAgainBtn.classList.add('hidden');
  }

  modal.classList.remove('hidden');
  playWinner();
}

export function hide() {
  document.getElementById('results-modal').classList.add('hidden');
}

export function init({ onPlayAgain, onBackLobby }) {
  document.getElementById('btn-play-again').addEventListener('click', onPlayAgain);
  document.getElementById('btn-back-lobby').addEventListener('click', onBackLobby);
}
