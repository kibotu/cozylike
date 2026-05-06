/**
 * input.js — Keyboard + mouse handling.
 *
 * Tracks which movement keys are held, mouse position (screen-space),
 * and mouse button state. Exports a read-only snapshot object.
 */

const keys = new Map();
let mouseX = 0;
let mouseY = 0;
let mouseDown = false;
let rightMouseDown = false;

document.addEventListener("keydown", (e) => {
  // Prevent game keys from scrolling or doing anything else
  if (["KeyW", "KeyA", "KeyS", "KeyD", "Shift", "Space"].includes(e.code)) {
    e.preventDefault();
  }
  keys.set(e.code, true);
});

document.addEventListener("keyup", (e) => {
  if (["KeyW", "KeyA", "KeyS", "KeyD", "Shift", "Space"].includes(e.code)) {
    e.preventDefault();
  }
  keys.set(e.code, false);
});

document.addEventListener("mousemove", (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

document.addEventListener("mousedown", (e) => {
  e.preventDefault();
  if (e.button === 0) mouseDown = true;
  if (e.button === 2) rightMouseDown = true;
});

document.addEventListener("mouseup", (e) => {
  if (e.button === 0) mouseDown = false;
  if (e.button === 2) rightMouseDown = false;
});

// Prevent context menu on right-click
document.addEventListener("contextmenu", (e) => e.preventDefault());

/**
 * Returns a frozen snapshot of current input state.
 * @returns {{ wasd: { w: boolean, a: boolean, s: boolean, d: boolean }, aimX: number, aimY: number, attack: boolean, shield: boolean, dash: boolean }}
 */
export function getInput() {
  return Object.freeze({
    w: keys.get("KeyW") === true,
    a: keys.get("KeyA") === true,
    s: keys.get("KeyS") === true,
    d: keys.get("KeyD") === true,
    aimX: mouseX,
    aimY: mouseY,
    attack: mouseDown === true,
    shield: rightMouseDown === true,
    dash: keys.get("Shift") === true,
  });
}

/**
 * Returns WASD direction as a normalised vector.
 * @returns {{ x: number, y: number }}
 */
export function getWASDDirection(input) {
  let dx = 0, dy = 0;
  if (input.a) dx -= 1;
  if (input.d) dx += 1;
  if (input.w) dy -= 1;
  if (input.s) dy += 1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len > 0) {
    dx /= len;
    dy /= len;
  }
  return { x: dx, y: dy };
}
