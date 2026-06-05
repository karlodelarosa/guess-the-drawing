/**
 * Drawing canvas — local rendering and stroke sync.
 */

let canvas, ctx;
let isDrawing = false;
let currentStroke = null;
let brushColor = '#000000';
let brushSize = 5;
let canDraw = false;
let strokeCounter = 0;

/** Callbacks set by app. */
let onStrokeComplete = null;
let onUndoRequest = null;
let onClearRequest = null;

/**
 * Initialize the canvas module.
 * @param {object} callbacks
 */
export function init(callbacks) {
  canvas = document.getElementById('drawing-canvas');
  ctx = canvas.getContext('2d');
  onStrokeComplete = callbacks.onStroke;
  onUndoRequest = callbacks.onUndo;
  onClearRequest = callbacks.onClear;

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Pointer events for drawing
  canvas.addEventListener('pointerdown', startDraw);
  canvas.addEventListener('pointermove', draw);
  canvas.addEventListener('pointerup', endDraw);
  canvas.addEventListener('pointerleave', endDraw);

  // Toolbar
  document.getElementById('brush-color').addEventListener('input', (e) => {
    brushColor = e.target.value;
  });

  document.querySelectorAll('.brush-size-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.brush-size-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      brushSize = parseInt(btn.dataset.size, 10);
    });
  });

  document.getElementById('btn-undo').addEventListener('click', () => {
    if (canDraw && onUndoRequest) onUndoRequest();
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    if (canDraw && onClearRequest) onClearRequest();
  });
}

/** Resize canvas to fill as much space as possible. */
function resizeCanvas() {
  const wrapper = canvas.parentElement;
  const isMobile = window.innerWidth <= 768;
  const padding = isMobile ? 4 : 8;
  let w = wrapper.clientWidth - padding * 2;
  let h = wrapper.clientHeight - padding * 2;

  // On mobile, use full area; on desktop prefer wide canvas
  if (!isMobile) {
    const ratio = 4 / 3;
    if (w / h > ratio) w = h * ratio;
    else h = w / ratio;
  }

  // Preserve existing content if canvas already has size
  let imageData = null;
  if (canvas.width > 0 && canvas.height > 0) {
    imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  canvas.width = Math.floor(w);
  canvas.height = Math.floor(h);
  fillWhite();

  if (imageData) {
    // Redraw all strokes instead of scaling image data
    redrawAllStrokes();
  }
}

/** Fill canvas with white background. */
function fillWhite() {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/** Get pointer position relative to canvas. */
function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

function startDraw(e) {
  if (!canDraw) return;
  isDrawing = true;
  canvas.setPointerCapture(e.pointerId);
  const pos = getPos(e);
  strokeCounter++;
  currentStroke = {
    id: `stroke-${Date.now()}-${strokeCounter}`,
    color: brushColor,
    size: brushSize,
    points: [{ x: pos.x / canvas.width, y: pos.y / canvas.height }],
  };
}

function draw(e) {
  if (!isDrawing || !currentStroke) return;
  const pos = getPos(e);
  const normPoint = { x: pos.x / canvas.width, y: pos.y / canvas.height };
  const points = currentStroke.points;
  const prev = points[points.length - 1];

  // Draw locally
  ctx.strokeStyle = currentStroke.color;
  ctx.lineWidth = currentStroke.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(prev.x * canvas.width, prev.y * canvas.height);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();

  points.push(normPoint);
}

function endDraw() {
  if (!isDrawing || !currentStroke) return;
  isDrawing = false;

  if (currentStroke.points.length > 1 && onStrokeComplete) {
    onStrokeComplete(currentStroke);
  }
  currentStroke = null;
}

/** All strokes for redraw. */
let allStrokes = [];

/**
 * Render a stroke on the canvas.
 * @param {object} stroke - normalized coordinates (0-1)
 */
export function renderStroke(stroke) {
  if (!stroke.points || stroke.points.length < 2) return;

  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();

  const first = stroke.points[0];
  ctx.moveTo(first.x * canvas.width, first.y * canvas.height);

  for (let i = 1; i < stroke.points.length; i++) {
    const p = stroke.points[i];
    ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
  }
  ctx.stroke();
}

/** Store and render a stroke. */
export function addStroke(stroke) {
  allStrokes.push(stroke);
  renderStroke(stroke);
}

/** Remove a stroke by ID and redraw. */
export function removeStroke(strokeId) {
  allStrokes = allStrokes.filter((s) => s.id !== strokeId);
  redrawAllStrokes();
}

/** Redraw all strokes from scratch. */
export function redrawAllStrokes() {
  fillWhite();
  for (const stroke of allStrokes) {
    renderStroke(stroke);
  }
}

/** Load strokes from server state. */
export function loadStrokes(strokes) {
  allStrokes = strokes ? [...strokes] : [];
  redrawAllStrokes();
}

/** Clear canvas and strokes. */
export function clear() {
  allStrokes = [];
  fillWhite();
}

/** Enable or disable drawing. */
export function setCanDraw(enabled) {
  canDraw = enabled;
  const toolbar = document.getElementById('canvas-toolbar');
  toolbar.style.opacity = enabled ? '1' : '0.4';
  toolbar.style.pointerEvents = enabled ? 'auto' : 'none';
  canvas.style.cursor = enabled ? 'crosshair' : 'default';
}

/** Show/hide spectator overlay. */
export function setSpectatorMode(isSpectator) {
  const overlay = document.getElementById('spectator-overlay');
  overlay.classList.toggle('hidden', !isSpectator);
}

/** Show word reveal overlay. */
export function showReveal(word) {
  const overlay = document.getElementById('reveal-overlay');
  document.getElementById('reveal-word').textContent = word;
  overlay.classList.remove('hidden');
}

export function hideReveal() {
  document.getElementById('reveal-overlay').classList.add('hidden');
}

/** Show the word the drawer must draw (overlay on canvas). */
export function showDrawWord(word, category) {
  const overlay = document.getElementById('draw-word-overlay');
  document.getElementById('draw-word').textContent = word || '';
  const categoryEl = document.getElementById('draw-category');
  if (category) {
    categoryEl.textContent = category;
    categoryEl.classList.remove('hidden');
  } else {
    categoryEl.textContent = '';
    categoryEl.classList.add('hidden');
  }
  overlay.classList.remove('hidden');
}

export function hideDrawWord() {
  document.getElementById('draw-word-overlay').classList.add('hidden');
}
