/**
 * enemies.js — Enemy AI, procedural traits, spawning, and death drops.
 */

import { isWalkable, getGrid, TILE, TILE_SIZE, WORLD_W, WORLD_H } from "./world.js";

const SHIELD_REACTIONS = ["cautious", "aggressive", "flanker"];
const LOW_HP_BEHAVIORS = ["flee", "kamikaze", "stand"];

// Trait pools
const ADJ_POOL = ["Mossy", "Sunlit", "Dappled", "Warden's", "Hearthstone", "Thorn", "Ember", "Frost", "Oak", "Mist"];
const SWORD_NOUNS = ["Shortblade", "Bough", "Sword", "Blade", "Thorn", "Scythe"];
const SHIELD_NOUNS = ["Bulwark", "Ward", "Aegis", "Bastion", "Wall", "Hearth"];

// Default stat baselines for affix comparison
export const DEFAULT_SWORD_STATS = { damage: 1.0, range: 40, cooldown: 350, pushback: 100, critChance: 0, lifesteal: 0 };
export const DEFAULT_SHIELD_STATS = { blockArc: 90, maxStamina: 100, staminaRegen: 25, procChance: 100, postBreakCooldown: 2.5 };

const SHIELD_EFFECTS = [
  { name: "paralyze", value: 0.8, unit: "s" },
  { name: "slow", value: 50, unit: "%", detail: "for 2s" },
  { name: "reflect", value: 25, unit: "%" },
  { name: "knockback", value: 200, unit: "" },
  { name: "speed", value: 20, unit: "%", detail: "player speed for 1.5s" },
];

/**
 * Rolls random traits for a new enemy.
 */
export function rollTraits() {
  const speed = Math.round(40 + Math.random() * 100);
  const dmgOptions = [0.5, 1.0, 1.5];
  const contactDamage = dmgOptions[Math.floor(Math.random() * 3)];
  const hp = Math.floor(Math.random() * 4) + 1;
  const aggressionRadius = Math.round(80 + Math.random() * 200);
  const leapChance = Math.round(Math.random() * 80);
  const shieldReaction = SHIELD_REACTIONS[Math.floor(Math.random() * 3)];
  const lowHpBehavior = LOW_HP_BEHAVIORS[Math.floor(Math.random() * 3)];
  return { speed, contactDamage, hp, aggressionRadius, leapChance, shieldReaction, lowHpBehavior };
}

/**
 * Creates a fresh enemy state object.
 */
export function createEnemy(traits, x, y) {
  return {
    x, y, ...traits, maxHp: traits.hp, currentHp: traits.hp, radius: 10,
    state: "idle", stateTimer: 0,
    engaged: false, engagedTimer: 0,
    wanderAngle: Math.random() * Math.PI * 2, wanderTimer: 0,
    leapWindup: false, leapProgress: 0, leapStartX: 0, leapStartY: 0,
    attackCooldown: 0, attackTimer: 0,
    hitFlash: 0, hpBarShown: false, firstHit: false,
    frozen: false, slowed: false, slowTimer: 0, kamikazeGlow: false,
    isFast: traits.speed > 110,
    isHighDamage: traits.contactDamage > 1.0,
    isCautious: traits.shieldReaction === "cautious",
    dead: false, deathTimer: 0, breathOffset: 0,
  };
}

/**
 * Generates a pool of enemies for the world.
 */
export function spawnEnemies(count, enemySpawnArea) {
  const enemies = [];
  const shuffled = [...enemySpawnArea].sort(() => Math.random() - 0.5);
  for (let i = 0; i < count && i < shuffled.length; i++) {
    const pos = shuffled[i];
    const traits = rollTraits();
    const px = pos.x * 32 + 16;
    const py = pos.y * 32 + 16;
    enemies.push(createEnemy(traits, px, py));
  }
  return enemies;
}

/**
 * Updates enemy AI and state for one frame.
 */
export function updateEnemy(enemy, player, dt) {
  enemy.breathOffset = Math.sin(Date.now() / 750) * 1;
  enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
  enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
  enemy.stateTimer = Math.max(0, enemy.stateTimer - dt);
  enemy.slowTimer = Math.max(0, enemy.slowTimer - dt);
  if (enemy.slowTimer <= 0) enemy.slowed = false;

  const hpPercent = enemy.currentHp / enemy.maxHp;
  if (hpPercent < 0.3 && enemy.lowHpBehavior === "kamikaze" && !enemy.kamikazeGlow) {
    enemy.kamikazeGlow = true;
    enemy.state = "chase";
    enemy.speed *= 1.5;
  }

  // Paralysis
  if (enemy.frozen) {
    if (enemy.stateTimer <= 0) { enemy.frozen = false; enemy.state = "chase"; }
    return;
  }

  // Hitstun
  if (enemy.state === "hitstun") {
    if (enemy.stateTimer <= 0) enemy.state = "chase";
    return;
  }

  // Leap-attack
  if (enemy.state === "leap-attack") {
    enemy.leapProgress += dt / 200;
    if (enemy.leapProgress >= 1) {
      enemy.state = "recovery";
      enemy.stateTimer = 600;
    } else {
      const dx = player.x - enemy.x, dy = player.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      enemy.x += (dx / dist) * enemy.speed * 2 * (dt / 1000);
      enemy.y += (dy / dist) * enemy.speed * 2 * (dt / 1000);
    }
    return;
  }

  if (enemy.state === "recovery") {
    if (enemy.stateTimer <= 0) enemy.state = "chase";
    return;
  }

  // Engagement check
  const dx = player.x - enemy.x, dy = player.y - enemy.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < enemy.aggressionRadius) {
    enemy.engaged = true;
    enemy.engagedTimer = 0;
  } else if (enemy.engaged) {
    enemy.engagedTimer += dt;
    if (enemy.engagedTimer >= 4000) { enemy.engaged = false; enemy.state = "idle"; }
  }

  // Low HP flee
  if (hpPercent < 0.3 && enemy.lowHpBehavior === "flee" && !enemy.kamikazeGlow) {
    enemy.state = "flee";
  }

  // State machine
  switch (enemy.state) {
    case "idle": updateIdle(enemy, dt); break;
    case "chase": updateChase(enemy, player, dt); break;
    case "combat": updateCombat(enemy, player, dt); break;
    case "flee": updateFlee(enemy, player, dt); break;
  }
}

function updateIdle(enemy, dt) {
  enemy.wanderTimer -= dt;
  if (enemy.wanderTimer <= 0) {
    enemy.wanderAngle = Math.random() * Math.PI * 2;
    enemy.wanderTimer = 1000 + Math.random() * 2000;
  }
  const moveSpeed = enemy.speed * 0.3;
  let nx = enemy.x + Math.cos(enemy.wanderAngle) * moveSpeed * (dt / 1000);
  let ny = enemy.y + Math.sin(enemy.wanderAngle) * moveSpeed * (dt / 1000);
  const r = enemy.radius;
  nx = Math.max(r, Math.min(WORLD_W * TILE_SIZE - r, nx));
  ny = Math.max(r, Math.min(WORLD_H * TILE_SIZE - r, ny));
  if (isWalkable(nx, ny)) { enemy.x = nx; enemy.y = ny; }
  else { enemy.wanderAngle = Math.random() * Math.PI * 2; enemy.wanderTimer = 500; }
}

function updateChase(enemy, player, dt) {
  const dx = player.x - enemy.x, dy = player.y - enemy.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  if (dist < enemy.aggressionRadius * 0.5) {
    enemy.state = "combat";
    enemy.attackTimer = 500 + Math.random() * 1000;
    return;
  }
  const r = enemy.radius;
  let nx = enemy.x + (dx / dist) * enemy.speed * (dt / 1000);
  let ny = enemy.y + (dy / dist) * enemy.speed * (dt / 1000);
  nx = Math.max(r, Math.min(WORLD_W * TILE_SIZE - r, nx));
  ny = Math.max(r, Math.min(WORLD_H * TILE_SIZE - r, ny));
  if (isWalkable(nx, ny)) { enemy.x = nx; enemy.y = ny; }
}

function updateCombat(enemy, player, dt) {
  const dx = player.x - enemy.x, dy = player.y - enemy.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  enemy.attackTimer -= dt;
  if (enemy.attackTimer <= 0 && !enemy.frozen) {
    enemy.attackTimer = 800 + Math.random() * 1200;
    if (Math.random() * 100 < enemy.leapChance && dist > 40) {
      enemy.state = "leap-attack";
      enemy.leapProgress = 0;
      enemy.leapStartX = enemy.x;
      enemy.leapStartY = enemy.y;
      return;
    }
  }

  const r = enemy.radius;

  if (enemy.shieldReaction === "cautious") {
    if (dist < enemy.aggressionRadius * 0.7) {
      const bx = -dx / dist, by = -dy / dist;
      let nx = enemy.x + bx * enemy.speed * 0.5 * (dt / 1000);
      let ny = enemy.y + by * enemy.speed * 0.5 * (dt / 1000);
      nx = Math.max(r, Math.min(WORLD_W * TILE_SIZE - r, nx));
      ny = Math.max(r, Math.min(WORLD_H * TILE_SIZE - r, ny));
      if (isWalkable(nx, ny)) { enemy.x = nx; enemy.y = ny; }
    } else {
      const perpX = -dy / dist, perpY = dx / dist;
      const dir = Math.sin(Date.now() / 1500) > 0 ? 1 : -1;
      const angle = Math.atan2(perpY, perpX) + dir * 0.01;
      let nx = enemy.x + Math.cos(angle) * enemy.speed * 0.3 * (dt / 1000);
      let ny = enemy.y + Math.sin(angle) * enemy.speed * 0.3 * (dt / 1000);
      nx = Math.max(r, Math.min(WORLD_W * TILE_SIZE - r, nx));
      ny = Math.max(r, Math.min(WORLD_H * TILE_SIZE - r, ny));
      if (isWalkable(nx, ny)) { enemy.x = nx; enemy.y = ny; }
    }
  } else if (enemy.shieldReaction === "flanker") {
    const toPlayerAngle = Math.atan2(dy, dx);
    const playerAimAngle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    let arcDiff = Math.abs(toPlayerAngle - playerAimAngle);
    while (arcDiff > Math.PI) arcDiff = 2 * Math.PI - arcDiff;
    if (arcDiff < Math.PI / 4) {
      const angle = toPlayerAngle + Math.PI * 0.7;
      let nx = enemy.x + Math.cos(angle) * enemy.speed * (dt / 1000);
      let ny = enemy.y + Math.sin(angle) * enemy.speed * (dt / 1000);
      nx = Math.max(r, Math.min(WORLD_W * TILE_SIZE - r, nx));
      ny = Math.max(r, Math.min(WORLD_H * TILE_SIZE - r, ny));
      if (isWalkable(nx, ny)) { enemy.x = nx; enemy.y = ny; }
    } else {
      let nx = enemy.x + (dx / dist) * enemy.speed * (dt / 1000);
      let ny = enemy.y + (dy / dist) * enemy.speed * (dt / 1000);
      nx = Math.max(r, Math.min(WORLD_W * TILE_SIZE - r, nx));
      ny = Math.max(r, Math.min(WORLD_H * TILE_SIZE - r, ny));
      if (isWalkable(nx, ny)) { enemy.x = nx; enemy.y = ny; }
    }
  } else {
    if (dist > enemy.radius + player.radius + 4) {
      let nx = enemy.x + (dx / dist) * enemy.speed * (dt / 1000);
      let ny = enemy.y + (dy / dist) * enemy.speed * (dt / 1000);
      nx = Math.max(r, Math.min(WORLD_W * TILE_SIZE - r, nx));
      ny = Math.max(r, Math.min(WORLD_H * TILE_SIZE - r, ny));
      if (isWalkable(nx, ny)) { enemy.x = nx; enemy.y = ny; }
    }
  }
}

function updateFlee(enemy, player, dt) {
  const dx = player.x - enemy.x, dy = player.y - enemy.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const backX = -dx / dist, backY = -dy / dist;
  const moveSpeed = enemy.speed * 1.2;
  let nx = enemy.x + backX * moveSpeed * (dt / 1000);
  let ny = enemy.y + backY * moveSpeed * (dt / 1000);
  const r = enemy.radius;
  nx = Math.max(r, Math.min(WORLD_W * TILE_SIZE - r, nx));
  ny = Math.max(r, Math.min(WORLD_H * TILE_SIZE - r, ny));
  if (isWalkable(nx, ny)) { enemy.x = nx; enemy.y = ny; }
}

/**
 * Applies sword hit to an enemy.
 */
export function hitEnemy(enemy, damage, pushbackX, pushbackY) {
  enemy.currentHp -= damage;
  enemy.firstHit = true;
  enemy.hpBarShown = true;
  enemy.hitFlash = 120;
  enemy.state = "hitstun";
  enemy.stateTimer = 120;

  const r = enemy.radius;
  let nx = Math.max(r, Math.min(WORLD_W * TILE_SIZE - r, enemy.x + pushbackX));
  let ny = Math.max(r, Math.min(WORLD_H * TILE_SIZE - r, enemy.y + pushbackY));
  if (isWalkable(nx, ny)) { enemy.x = nx; enemy.y = ny; }
}

/**
 * Checks if enemy is dead.
 */
export function checkEnemyDeath(enemy) {
  if (enemy.currentHp <= 0 && !enemy.dead) {
    enemy.dead = true;
    enemy.deathTimer = 300;
    return true;
  }
  return false;
}

/**
 * Rolls a drop from the death table.
 */
export function rollDrop() {
  const roll = Math.random() * 100;
  if (roll < 12) return { type: "heart" };
  if (roll < 47) {
    return Math.random() < 0.5
      ? { type: "sword", data: rollSword() }
      : { type: "shield", data: rollShield() };
  }
  return { type: null };
}

/**
 * Rolls a random sword with affixes.
 */
export function rollSword() {
  const adj = ADJ_POOL[Math.floor(Math.random() * ADJ_POOL.length)];
  const noun = SWORD_NOUNS[Math.floor(Math.random() * SWORD_NOUNS.length)];
  const numAffixes = 2 + Math.floor(Math.random() * 2);
  const affixes = { ...DEFAULT_SWORD_STATS };
  const pool = [
    { key: "damage", min: 0.5, max: 2.5, step: 0.5 },
    { key: "range", min: 24, max: 72, step: 1 },
    { key: "cooldown", min: 200, max: 600, step: 10 },
    { key: "pushback", min: 0, max: 400, step: 1 },
    { key: "critChance", min: 0, max: 25, step: 1 },
    { key: "lifesteal", min: 0, max: 15, step: 1 },
  ];
  const indices = Array.from({ length: pool.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  for (let i = 0; i < numAffixes; i++) {
    const a = pool[indices[i]];
    const val = Math.round((a.min + Math.random() * (a.max - a.min)) / a.step) * a.step;
    affixes[a.key] = val;
  }
  return { ...affixes, name: `${adj} ${noun}`, type: "sword" };
}

/**
 * Rolls a random shield with affixes.
 */
export function rollShield() {
  const adj = ADJ_POOL[Math.floor(Math.random() * ADJ_POOL.length)];
  const noun = SHIELD_NOUNS[Math.floor(Math.random() * SHIELD_NOUNS.length)];
  const onBlockEffect = SHIELD_EFFECTS[Math.floor(Math.random() * SHIELD_EFFECTS.length)];
  const affixes = { ...DEFAULT_SHIELD_STATS, onBlockEffect: { ...onBlockEffect } };
  const numAffixes = 2 + Math.floor(Math.random() * 2);
  const pool = [
    { key: "blockArc", min: 60, max: 180, step: 5 },
    { key: "maxStamina", min: 60, max: 150, step: 5 },
    { key: "staminaRegen", min: 15, max: 45, step: 1 },
    { key: "procChance", min: 25, max: 100, step: 5 },
    { key: "postBreakCooldown", min: 1.5, max: 4, step: 0.5 },
  ];
  const indices = Array.from({ length: pool.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  for (let i = 0; i < numAffixes; i++) {
    const a = pool[indices[i]];
    const val = Math.round((a.min + Math.random() * (a.max - a.min)) / a.step) * a.step;
    affixes[a.key] = val;
  }
  return { ...affixes, name: `${adj} ${noun}`, type: "shield" };
}

/**
 * Applies a shield on-block effect to an enemy.
 */
export function applyShieldEffect(effect, enemy, fromX, fromY) {
  if (!effect || !enemy) return false;
  switch (effect.name) {
    case "paralyze":
      enemy.frozen = true;
      enemy.stateTimer = effect.value * 1000;
      return true;
    case "slow":
      enemy.slowed = true;
      enemy.slowTimer = 2000;
      enemy.speed = enemy.speed * 0.5;
      return true;
    case "knockback":
      const dx = enemy.x - fromX;
      const dy = enemy.y - fromY;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      enemy.x += (dx / dist) * effect.value;
      enemy.y += (dy / dist) * effect.value;
      return true;
    case "speed":
      // Applied to player in main game loop
      return true;
  }
  return false;
}
