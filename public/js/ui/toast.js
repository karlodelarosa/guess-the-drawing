/**
 * Toast notification system.
 */

const container = () => document.getElementById('toast-container');

/**
 * Show a toast message.
 * @param {string} message
 * @param {'info'|'success'|'warning'} type
 * @param {number} duration - ms before removal
 */
export function showToast(message, type = 'info', duration = 3000) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container().appendChild(el);

  setTimeout(() => {
    el.remove();
  }, duration);
}
