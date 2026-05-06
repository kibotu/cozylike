/**
 * touch.js — Touch input handling for mobile devices.
 *
 * Provides virtual D-pad, tap-to-attack, hold-to-shield,
 * and touch-drag for aim direction. Falls back to keyboard
 * input on desktop.
 */

// ─── Mobile detection ───
const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;

// ─── Touch state ───
const state = {
  w: false,
  a: false,
  s: false,
  d: false,
  aimX: 0,
  aimY: 0,
  attack: false,
  shield: false,
  dash: false,
};

// ─── DOM refs ───
let canvasEl = null;
let dpadEl = null;
let attackBtn = null;
let shieldBtn = null;

function findElements() {
  canvasEl = document.getElementById("touch-canvas");
  dpadEl = document.getElementById("dpad");
  attackBtn = document.getElementById("touch-attack");
  shieldBtn = document.getElementById("touch-shield");
}

// ─── D-pad ───
function setupDpad() {
  if (!dpadEl) return;

  let active = false;
  let activeBtn = null;

  dpadEl.addEventListener("touchstart", (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleDpadTouch(e);
  }, { passive: false });

  dpadEl.addEventListener("touchmove", (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleDpadTouch(e);
  }, { passive: false });

  dpadEl.addEventListener("touchend", (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearDpad();
  }, { passive: false });

  dpadEl.addEventListener("touchcancel", (e) => {
    e.preventDefault();
    clearDpad();
  }, { passive: false });
}

function handleDpadTouch(e) {
  // Reset all directions
  state.w = false;
  state.a = false;
  state.s = false;
  state.d = false;

  const touches = e.touches;
  for (let i = 0; i < touches.length; i++) {
    const t = touches[i];
    const btn = document.elementFromPoint(t.clientX, t.clientY);
    if (!btn || !btn.closest("#dpad")) continue;

    const id = btn.id;
    if (id === "dpad-up") state.w = true;
    if (id === "dpad-down") state.s = true;
    if (id === "dpad-left") state.a = true;
    if (id === "dpad-right") state.d = true;
  }
}

function clearDpad() {
  state.w = false;
  state.a = false;
  state.s = false;
  state.d = false;
}

// ─── Attack button ───
function setupAttack() {
  if (!attackBtn) return;

  attackBtn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    e.stopPropagation();
    state.attack = true;
  }, { passive: false });

  attackBtn.addEventListener("touchend", (e) => {
    e.preventDefault();
    e.stopPropagation();
    state.attack = false;
  }, { passive: false });

  attackBtn.addEventListener("touchcancel", (e) => {
    e.preventDefault();
    state.attack = false;
  }, { passive: false });
}

// ─── Shield button ───
function setupShield() {
  if (!shieldBtn) return;

  shieldBtn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    e.stopPropagation();
    state.shield = true;
  }, { passive: false });

  shieldBtn.addEventListener("touchend", (e) => {
    e.preventDefault();
    e.stopPropagation();
    state.shield = false;
  }, { passive: false });

  shieldBtn.addEventListener("touchcancel", (e) => {
    e.preventDefault();
    state.shield = false;
  }, { passive: false });
}

// ─── Canvas touch for aim ───
function setupCanvas() {
  if (!canvasEl) return;

  canvasEl.addEventListener("touchstart", (e) => {
    e.preventDefault();
    updateAimFromTouch(e);
  }, { passive: false });

  canvasEl.addEventListener("touchmove", (e) => {
    e.preventDefault();
    updateAimFromTouch(e);
  }, { passive: false });
}

function updateAimFromTouch(e) {
  const touches = e.touches;
  // Use the first touch that is not on the D-pad or action buttons
  for (let i = 0; i < touches.length; i++) {
    const t = touches[i];
    const el = document.elementFromPoint(t.clientX, t.clientY);
    if (!el) continue;
    // If touch is on dpad or action buttons, skip it
    if (el.closest("#dpad") || el.closest("#touch-actions") || el.closest("#dpad-bg")) continue;
    state.aimX = t.clientX;
    state.aimY = t.clientY;
    return;
  }
}

// ─── Global touch handler to prevent browser gestures ───
function preventBrowserGestures() {
  document.addEventListener("touchmove", (e) => {
    if (e.target === canvasEl || e.target === document.body) {
      e.preventDefault();
    }
  }, { passive: false });

  document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gesturechange", (e) => e.preventDefault(), { passive: false });
}

// ─── Export ───
export function getInput() {
  return Object.freeze({
    w: state.w,
    a: state.a,
    s: state.s,
    d: state.d,
    aimX: state.aimX,
    aimY: state.aimY,
    attack: state.attack,
    shield: state.shield,
    dash: state.dash,
  });
}

/**
 * Initializes touch controls if on a touch device.
 * Call once on page load.
 */
export function setupTouchControls() {
  if (!isTouchDevice) return;

  findElements();
  setupDpad();
  setupAttack();
  setupShield();
  setupCanvas();
  preventBrowserGestures();
}

export { isTouchDevice };
