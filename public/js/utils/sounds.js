/**
 * Web Audio API sound effects.
 * Generates simple tones — no external audio files needed.
 */

let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

/**
 * Play a short tone.
 * @param {number} frequency - Hz
 * @param {number} duration - seconds
 * @param {string} type - oscillator type
 * @param {number} volume - 0-1
 */
function playTone(frequency, duration = 0.15, type = 'sine', volume = 0.3) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available — silently ignore
  }
}

/** Correct guess — ascending chime. */
export function playCorrectGuess() {
  playTone(523, 0.1, 'sine', 0.25);
  setTimeout(() => playTone(659, 0.1, 'sine', 0.25), 100);
  setTimeout(() => playTone(784, 0.2, 'sine', 0.25), 200);
}

/** Round start — short alert. */
export function playRoundStart() {
  playTone(440, 0.12, 'triangle', 0.2);
  setTimeout(() => playTone(550, 0.15, 'triangle', 0.2), 120);
}

/** Round end — descending tone. */
export function playRoundEnd() {
  playTone(440, 0.15, 'sine', 0.2);
  setTimeout(() => playTone(330, 0.25, 'sine', 0.2), 150);
}

/** Winner announcement — fanfare. */
export function playWinner() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.2, 'sine', 0.3), i * 150);
  });
}
