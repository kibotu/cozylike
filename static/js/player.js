/**
 * player.js — Player state, movement, combat, and shield mechanics.
 *
 * The player starts with 6 half-hearts of HP, a default sword, and a
 * default shield. Equipment slots are fixed: exactly one sword and one
 * shield. Items swap, never empty.
 */

import { getGrid, TILE, TILE_SIZE, WORLD_W, WORLD_H } from "./world.js";

// Default equipment
const DEFAULT_SWORD = {
  name: "Hearthstone Shortblade",
  damage: 1.0,
  range: 40,
  cooldown: 350,
  pushback: 100,
  critChance: 0,
  lifesteal: 0,
  type: "sword",
};

const DEFAULT_SHIELD = {
  name: "Mossy Ward",
  blockArc: 90,
  maxStamina: 100,
  staminaRegen: 25,
  onBlockEffect: null,
  procChance: 100,
  postBreakCooldown: 2.5,
  type: "shield",
};

/**
 * Creates a fresh player state object.
 */
export function createPlayer(worldSpawnX, worldSpawnY) {
  const TILE_SIZE = 32;
  const px = worldSpawnX * TILE_SIZE + TILE_SIZE / 2;
  const py = worldSpawnY * TILE_SIZE + TILE_SIZE / 2;

  return {
    x: px, y: py,
    hp: 3.0, // 3 full hearts = 6 half-hearts
    maxHp: 3.0,
    radius: 12,
    speed: 200, // px/s
    sword: { ...DEFAULT_SWORD },
    shield: { ...DEFAULT_SHIELD },
    swordCooldown: 0,
    attackHit: false,
    attackAnimTimer: 0,
    attackAnimAngle: 0,
    iFrames: 0,
    iFrameDuration: 800,
    dashing: false,
    dashProgress: 0,
    dashStartX: 0,
    dashStartY: 0,
    dashEndX: 0,
    dashEndY: 0,
    dashDuration: 180,
    dashDistance: 120,
    dashCooldown: 0,
    shieldRaised: false,
    stamina: 100,
    shieldBroken: false,
    shieldBreakTimer: 0,
    hitFlash: 0,
    aimAngle: 0,
    knockbackX: 0,
    knockbackY: 0,
    breathOffset: 0,
  };
}

/**
 * Returns the default sword for initial equipment.
 */
export function getDefaultSword() {
  return { ...DEFAULT_SWORD };
}

/**
 * Returns the default shield for initial equipment.
 */
export function getDefaultShield() {
  return { ...DEFAULT_SHIELD };
}

/**
 * Checks if a circle at (x, y) with given radius collides with any solid tile.
 */
function collidesAt(x, y, radius) {
  const minX = Math.max(0, Math.floor((x - radius) / TILE_SIZE));
  const maxX = Math.min(WORLD_W - 1, Math.floor((x + radius) / TILE_SIZE));
  const minY = Math.max(0, Math.floor((y - radius) / TILE_SIZE));
  const maxY = Math.min(WORLD_H - 1, Math.floor((y + radius) / TILE_SIZE));
  const grid = getGrid();

  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      const tile = grid[ty * 120 + tx];
      if (tile === TILE.TREE || tile === TILE.ROCK) {
        const tileCenterX = tx * TILE_SIZE + TILE_SIZE / 2;
        const tileCenterY = ty * TILE_SIZE + TILE_SIZE / 2;
        const dx = x - tileCenterX;
        const dy = y - tileCenterY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < radius + TILE_SIZE / 2) return true;
      }
    }
  }
  return false;
}

/**
 * Updates player movement, combat cooldowns, shield stamina, dash, i-frames, and knockback.
 * Does NOT resolve damage (that happens via takeDamage).
 */
export function updatePlayer(player, input, dt) {
  // Compute aim angle from canvas center to mouse position
  const canvas = document.getElementById("game");
  const rect = canvas.getBoundingClientRect();
  player.aimAngle = Math.atan2(
    input.aimY - rect.top - rect.height / 2,
    input.aimX - rect.left - rect.width / 2
  );

// Update cooldowns
  player.swordCooldown = Math.max(0, player.swordCooldown - dt);
  player.attackAnimTimer = Math.max(0, player.attackAnimTimer - dt);
  player.iFrames = Math.max(0, player.iFrames - dt);
  player.hitFlash = Math.max(0, player.hitFlash - dt);
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  player.shieldBreakTimer = Math.max(0, player.shieldBreakTimer - dt);

  // Breathing animation
  player.breathOffset = Math.sin(Date.now() / 750) * 1;

  // Handle dash
  if (input.dash && !player.dashing && player.dashCooldown <= 0) {
    player.dashing = true;
    player.dashProgress = 0;
    player.dashStartX = player.x;
    player.dashStartY = player.y;

    // Direction: WASD if moving, otherwise aim direction
    const wasdx = (input.d ? 1 : 0) - (input.a ? 1 : 0);
    const wasdy = (input.s ? 1 : 0) - (input.w ? 1 : 0);
    let dx, dy;
    if (wasdx !== 0 || wasdy !== 0) {
      const len = Math.sqrt(wasdx * wasdx + wasdy * wasdy);
      dx = wasdx / len;
      dy = wasdy / len;
    } else {
      dx = Math.cos(player.aimAngle);
      dy = Math.sin(player.aimAngle);
    }
    player.dashEndX = player.x + dx * player.dashDistance;
    player.dashEndY = player.y + dy * player.dashDistance;
    player.dashCooldown = 600;
  }

  if (player.dashing) {
    player.dashProgress += dt / player.dashDuration;
    if (player.dashProgress >= 1) {
      player.dashing = false;
      player.dashProgress = 0;
    } else {
      const t = player.dashProgress;
      player.x = player.dashStartX + (player.dashEndX - player.dashStartX) * t;
      player.y = player.dashStartY + (player.dashEndY - player.dashStartY) * t;
    }
  }

  // Handle shield stamina
  if (input.shield && !player.shieldBroken) {
    player.shieldRaised = true;
    player.stamina -= 30 * (dt / 1000);
    if (player.stamina <= 0) {
      player.stamina = 0;
      player.shieldRaised = false;
      player.shieldBroken = true;
      player.shieldBreakTimer = player.shield.postBreakCooldown * 1000;
    }
  } else {
    player.shieldRaised = false;
    if (!player.shieldBroken) {
      player.stamina = Math.min(player.shield.maxStamina, player.stamina + player.shield.staminaRegen * (dt / 1000));
    }
  }

  if (player.shieldBroken && player.shieldBreakTimer <= 0) {
    player.shieldBroken = false;
    player.stamina = 0;
  }

  // Normal movement (not dashing)
  if (!player.dashing) {
    const wasdx = (input.d ? 1 : 0) - (input.a ? 1 : 0);
    const wasdy = (input.s ? 1 : 0) - (input.w ? 1 : 0);

    // Decay knockback
    const kbMag = Math.sqrt(player.knockbackX ** 2 + player.knockbackY ** 2);
    player.knockbackX *= 0.9;
    player.knockbackY *= 0.9;
    if (kbMag < 0.5) { player.knockbackX = 0; player.knockbackY = 0; }

    // Try combined movement + knockback
    let newX = player.x + wasdx * player.speed * (dt / 1000) + player.knockbackX;
    let newY = player.y + wasdy * player.speed * (dt / 1000) + player.knockbackY;
    const TILE_SIZE = 32;
    const worldW = 120 * TILE_SIZE;
    const worldH = 90 * TILE_SIZE;
    const r = player.radius;
    newX = Math.max(r, Math.min(worldW - r, newX));
    newY = Math.max(r, Math.min(worldH - r, newY));

    if (!collidesAt(newX, newY, r)) {
      player.x = newX;
      player.y = newY;
    } else {
      // Slide along axes
      let testX = player.x + wasdx * player.speed * (dt / 1000) + player.knockbackX;
      testX = Math.max(r, Math.min(worldW - r, testX));
      if (!collidesAt(testX, player.y, r)) {
        player.x = testX;
        player.knockbackX = 0;
      }
      let testY = player.y + wasdy * player.speed * (dt / 1000) + player.knockbackY;
      testY = Math.max(r, Math.min(worldH - r, testY));
      if (!collidesAt(player.x, testY, r)) {
        player.y = testY;
        player.knockbackY = 0;
      }
    }
  }
}

/**
 * Attempts a sword attack. Returns hit results if successful.
 */
export function swordAttack(player, enemies) {
  if (player.swordCooldown > 0 || player.dashing) return [];

  const sword = player.sword;
  player.swordCooldown = sword.cooldown;
  player.attackHit = false;
  player.attackAnimTimer = 150;
  player.attackAnimAngle = player.aimAngle;

  const results = [];
  const arcHalf = Math.PI / 4; // 90° total arc
  const hitRadius = sword.range;

  for (const enemy of enemies) {
    if (enemy.dead) continue;

    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > hitRadius + enemy.radius) continue;

    // Check if enemy is within the sword arc
    const angle = Math.atan2(dy, dx);
    let angleDiff = angle - player.aimAngle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    if (Math.abs(angleDiff) > arcHalf) continue;

    // Check if tile between player and enemy blocks hitbox
    const TILE_SIZE = 32;
    const steps = Math.ceil(dist / TILE_SIZE);
    let blocked = false;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const cx = player.x + dx * t;
      const cy = player.y + dy * t;
      const tx = Math.floor(cx / TILE_SIZE);
      const ty = Math.floor(cy / TILE_SIZE);
      if (tx < 0 || tx >= 120 || ty < 0 || ty >= 90) continue;
      const grid = getGrid();
      const tile = grid[ty * 120 + tx];
      if (tile === TILE.TREE || tile === TILE.ROCK) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    // Hit!
    const isCrit = Math.random() * 100 < sword.critChance;
    const baseDamage = sword.damage * (isCrit ? 2 : 1);

    const pushX = (dx / dist) * sword.pushback;
    const pushY = (dy / dist) * sword.pushback;

    let lifestealHeal = 0;
    if (Math.random() * 100 < sword.lifesteal) {
      lifestealHeal = 0.5;
      player.hp = Math.min(player.maxHp, player.hp + lifestealHeal);
    }

    results.push({ enemy, damage: baseDamage, pushbackX: pushX, pushbackY: pushY, isCrit, lifestealHeal });
  }

  return results;
}

/**
 * Applies damage to the player with quantization and i-frame handling.
 */
export function takeDamage(player, damage, fromX, fromY) {
  if (player.iFrames > 0) return;

  const quantized = Math.round(damage * 2) / 2;
  player.hp -= quantized;
  player.iFrames = player.iFrameDuration;
  player.hitFlash = 150;

  const dx = player.x - fromX;
  const dy = player.y - fromY;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  player.knockbackX = (dx / dist) * 80;
  player.knockbackY = (dy / dist) * 80;
}

/**
 * Checks if the player's shield blocks damage from a given direction.
 */
export function isShieldBlocking(player, fromX, fromY) {
  if (!player.shieldRaised || player.shieldBroken) return false;

  const dx = fromX - player.x;
  const dy = fromY - player.y;
  const angle = Math.atan2(dy, dx);

  let angleDiff = angle - player.aimAngle;
  while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

  const halfArc = (player.shield.blockArc / 2) * (Math.PI / 180);
  return Math.abs(angleDiff) <= halfArc;
}

/**
 * Resets player to initial state for a new run.
 */
export function resetPlayer(player) {
  player.hp = 3.0;
  player.maxHp = 3.0;
  player.sword = { ...DEFAULT_SWORD };
  player.shield = { ...DEFAULT_SHIELD };
player.swordCooldown = 0;
  player.attackAnimTimer = 0;
  player.iFrames = 0;
  player.hitFlash = 0;
  player.dashing = false;
  player.dashCooldown = 0;
  player.dashProgress = 0;
  player.shieldRaised = false;
  player.stamina = 100;
  player.shieldBroken = false;
  player.shieldBreakTimer = 0;
  player.knockbackX = 0;
  player.knockbackY = 0;
}
