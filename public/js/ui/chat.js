/**
 * Chat panel — messages, typing indicators, guess input.
 */

const messagesEl = () => document.getElementById('chat-messages');
const typingEl = () => document.getElementById('typing-indicator');
const chatInput = () => document.getElementById('chat-input');
const chatForm = () => document.getElementById('chat-form');

/** Track who is currently typing. */
const typingPlayers = new Map();

/**
 * Render a single chat message.
 * @param {object} entry
 */
export function addMessage(entry) {
  const el = document.createElement('div');
  el.className = 'chat-message';

  if (entry.isSystem) {
    el.classList.add('system');
    if (entry.isCorrect) el.classList.add('correct');
    if (entry.isCorrect && entry.playerName) {
      el.innerHTML = `<span style="color:${entry.playerColor}">${escapeHTML(entry.playerName)}</span> ${escapeHTML(entry.message)}`;
    } else {
      el.textContent = entry.message;
    }
  } else {
    el.innerHTML = `<span class="chat-author" style="color:${entry.playerColor}">${escapeHTML(entry.playerName)}:</span> ${escapeHTML(entry.message)}`;
  }

  messagesEl().appendChild(el);
  messagesEl().scrollTop = messagesEl().scrollHeight;
}

/** Load chat history from room state. */
export function loadHistory(history) {
  messagesEl().innerHTML = '';
  if (history) history.forEach(addMessage);
}

/** Update typing indicator. */
export function setTyping(playerId, playerName, isTyping) {
  if (isTyping) {
    typingPlayers.set(playerId, playerName);
  } else {
    typingPlayers.delete(playerId);
  }

  const names = [...typingPlayers.values()];
  if (names.length === 0) {
    typingEl().textContent = '';
  } else if (names.length === 1) {
    typingEl().textContent = `${names[0]} is typing...`;
  } else {
    typingEl().textContent = `${names.join(', ')} are typing...`;
  }
}

/** Set chat input placeholder and disabled state. */
export function configureInput({ placeholder, disabled, hasGuessed }) {
  const input = chatInput();
  input.placeholder = placeholder || 'Type your guess...';
  input.disabled = disabled || false;
  if (hasGuessed) {
    input.placeholder = 'You guessed correctly!';
    input.disabled = true;
  }
}

/** Register chat form submit handler. */
export function onSubmit(callback) {
  chatForm().addEventListener('submit', (e) => {
    e.preventDefault();
    const input = chatInput();
    const msg = input.value.trim();
    if (!msg) return;
    callback(msg);
    input.value = '';
  });

  // Keep guess input visible above mobile keyboard
  chatInput().addEventListener('focus', () => {
    if (!window.matchMedia('(max-width: 768px)').matches) return;
    setTimeout(() => {
      chatForm().scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 300);
  });
}

/** Register typing events. */
export function onTyping(callback) {
  let typingTimeout = null;
  let isTyping = false;

  chatInput().addEventListener('input', () => {
    if (!isTyping) {
      isTyping = true;
      callback(true);
    }
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      isTyping = false;
      callback(false);
    }, 1500);
  });
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
