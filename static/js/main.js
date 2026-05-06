/**
 * main.js — Game loop, root state, and module integration.
 *
 * Single shared `game` state object owned by this module.
 * All other modules receive references to state, never access globals.
 */

import { createCamera } from "./render.js";
import { drawHUD, drawGameOver, drawTooltip } from "./ui.js";
import { drawReticle, drawTiles, drawPlayer, drawEnemy, drawGroundItem, drawHitEffects } from "./render.js";
import { generateWorld, setGrid } from "./world.js";
import { createPlayer, updatePlayer, swordAttack, takeDamage, isShieldBlocking } from "./player.js";
import { spawnEnemies, updateEnemy, hitEnemy, checkEnemyDeath, rollDrop } from "./enemies.js";
import { generateStartingItems, checkPickup, getHoveredItem, swapItem } from "./items.js";
import { getInput } from "./input.js";

// ─── Game State ─────────────────────────────────────────────────────
const game = {
  state: "playing", // playing | gameover
  world: null,
  player: null,
  enemies: [],
  groundItems: [],
  camera: null,
  kills: 0,
  mouseX: 0,
  mouseY: 0,
  hoveredItem: null,
  hitEffects: [],
  gameOverTime: 0,
};

// ─── World Generation ───────────────────────────────────────────────
function initWorld() {
  const { grid, spawnX, spawnY, enemySpawnArea } = generateWorld();
  setGrid(grid);

  game.player = createPlayer(spawnX, spawnY);
  game.enemies = spawnEnemies(Math.floor(8 + Math.random() * 8), enemySpawnArea); // 8-15
  game.groundItems = generateStartingItems(Math.floor(3 + Math.random() * 3), enemySpawnArea); // 3-5
  game.camera = createCamera();
  game.kills = 0;
  game.hitEffects = [];
  game.hoveredItem = null;
}

// ─── Input Handling ─────────────────────────────────────────────────
function setupInput() {
  const canvas = document.getElementById("game");
  canvas.style.cursor = "none"; // Hide native cursor

  document.addEventListener("mousemove", (e) => {
    game.mouseX = e.clientX;
    game.mouseY = e.clientY;
  });

  // Click handler for item swap
  canvas.addEventListener("click", () => {
    if (game.state !== "playing" || game.hoveredItem === null) return;

    const { item } = game.hoveredItem;
    if (item.type === "heart") return; // Hearts auto-collect

    const dropped = swapItem(game.player, item);
    game.groundItems.push(dropped);
  });

  // Game over restart
  document.addEventListener("keydown", restartOnGameOver);
  document.addEventListener("mousedown", restartOnGameOver);
}

function restartOnGameOver() {
  if (game.state !== "gameover") return;
  if (Date.now() - game.gameOverTime < 400) return; // 400ms minimum delay

  resetGame();
}

function resetGame() {
  game.state = "playing";
  initWorld();
}

// ─── Game Loop ──────────────────────────────────────────────────────
let lastTime = 0;
const FIXED_DT = 1000 / 60; // 60 FPS fixed timestep
const MAX_DT = 50; // Max delta time to prevent spiral of death

function gameLoop(timestamp) {
  requestAnimationFrame(gameLoop);

  if (game.state !== "playing") {
    // Still render but don't update
    render();
    return;
  }

  const dt = Math.min(timestamp - lastTime, MAX_DT);
  lastTime = timestamp;

  // Update
  update(dt);
  render();
}

/**
 * Fixed-timestep update at 60 FPS using accumulator pattern.
 */
let accumulator = 0;

function update(dt) {
  accumulator += dt;

  while (accumulator >= FIXED_DT) {
    accumulator -= FIXED_DT;
    step(FIXED_DT);
  }
}

/**
 * Single physics/AI step at fixed timestep.
 */
function step(dt) {
  const input = getInput();
  const player = game.player;

  // Update player
  updatePlayer(player, input, dt);

  // Sword attack
  if (input.attack) {
    const results = swordAttack(player, game.enemies);
    for (const hit of results) {
      hitEnemy(hit.enemy, hit.damage, hit.pushbackX, hit.pushbackY);

      // Check if enemy died from this hit
      if (checkEnemyDeath(hit.enemy)) {
        game.kills++;
        const drop = rollDrop();
        if (drop.type !== null) {
          if (drop.type === "heart") {
            game.groundItems.push({ type: "heart", x: hit.enemy.x, y: hit.enemy.y, collected: false, bobOffset: 0 });
          } else {
            game.groundItems.push({
              type: drop.type,
              data: drop.data,
              x: hit.enemy.x,
              y: hit.enemy.y,
              collected: false,
              bobOffset: 0,
            });
          }
        }
      }

      // Lifesteal visual
      if (hit.lifestealHeal > 0) {
        game.hitEffects.push({
          type: "lifesteal",
          x: player.x,
          y: player.y,
          life: 300,
          duration: 300,
          particles: [],
        });
      }
    }
  }

  // Contact damage from enemies
  for (const enemy of game.enemies) {
    if (enemy.dead || enemy.state === "hitstun") continue;

    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    if (dist < enemy.radius + player.radius) {
      // Check shield block
      if (isShieldBlocking(player, enemy.x, enemy.y)) {
        const shield = player.shield;
        // Check proc chance
        if (Math.random() * 100 < shield.procChance && shield.onBlockEffect) {
          const effect = shield.onBlockEffect;
          // Apply effect to enemy
          applyEffectToEnemy(enemy, effect);
        }
      } else {
        takeDamage(player, enemy.contactDamage, enemy.x, enemy.y);
      }
    }
  }

  // Check for death
  if (player.hp <= 0) {
    game.state = "gameover";
    game.gameOverTime = Date.now();
    return;
  }

  // Update enemies (dead enemies skip this)
  for (const enemy of game.enemies) {
    if (!enemy.dead) {
      updateEnemy(enemy, player, dt);
    }
  }

  // Clean up dead enemies after death animation
  game.enemies = game.enemies.filter(e => {
    if (e.dead) {
      e.deathTimer -= FIXED_DT;
      return e.deathTimer > 0;
    }
    return true;
  });

  // Auto-collect nearby hearts
  checkPickup(player, game.groundItems);

  // Update hover state
  game.hoveredItem = getHoveredItem(player, game.groundItems, game.camera, game.mouseX, game.mouseY);

  // Update camera
  game.camera.update(player, window.innerWidth, window.innerHeight);

  // Clean up hit effects
  for (const effect of game.hitEffects) {
    effect.life -= FIXED_DT;
  }
  game.hitEffects = game.hitEffects.filter(e => e.life > 0);
}

/**
 * Applies a shield on-block effect to an enemy.
 */
function applyEffectToEnemy(enemy, effect) {
  const { name, value } = effect;
  switch (name) {
    case "paralyze":
      enemy.frozen = true;
      enemy.stateTimer = value * 1000;
      enemy.state = "hitstun";
      break;
    case "slow":
      enemy.slowed = true;
      enemy.slowTimer = 2000;
      enemy.speed = enemy.speed * 0.5;
      break;
    case "knockback":
      const dx = enemy.x - game.player.x;
      const dy = enemy.y - game.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      enemy.x += (dx / dist) * value;
      enemy.y += (dy / dist) * value;
      break;
  }

  // Spawn leaf particles
  game.hitEffects.push({
    type: "leaf",
    x: enemy.x,
    y: enemy.y,
    life: 500,
    duration: 500,
    color: "#a0c080",
    particles: Array.from({ length: 6 }, () => ({
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3,
      size: 2 + Math.random() * 2,
    })),
  });
}

/**
 * Renders the current game state.
 */
function render() {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  // Set canvas resolution
  const dpr = devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.scale(dpr, dpr);

  // Clear
  ctx.fillStyle = "#2a2218";
  ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);

  if (game.state === "gameover") {
    drawGameOver(ctx, game.gameOverTime);
    return;
  }

  const camera = game.camera;

  // Draw tiles
  drawTiles(ctx, camera, canvas.width / dpr, canvas.height / dpr);

  // Draw ground items
  for (const item of game.groundItems) {
    if (!item.collected) {
      drawGroundItem(ctx, item, camera);
    }
  }

  // Draw enemies
  for (const enemy of game.enemies) {
    if (!enemy.dead) {
      drawEnemy(ctx, enemy, camera);
    }
  }

  // Draw player
  drawPlayer(ctx, game.player, camera);

  // Draw hit effects
  drawHitEffects(ctx, game.hitEffects, camera);

  // Draw reticle
  drawReticle(ctx, game.mouseX, game.mouseY);

  // Draw HUD
  drawHUD(ctx, game.player, game.kills);

  // Draw tooltip
  drawTooltip(ctx, game.player, game.hoveredItem, game.mouseX, game.mouseY);
}

// ─── Resize Handler ─────────────────────────────────────────────────
function onResize() {
  const canvas = document.getElementById("game");
  canvas.width = window.innerWidth * (devicePixelRatio || 1);
  canvas.height = window.innerHeight * (devicePixelRatio || 1);
}

// ─── Visibility Pause ───────────────────────────────────────────────
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") {
    // Game loop will naturally pause since requestAnimationFrame won't fire
  } else {
    // Reset lastTime to prevent huge dt jump
    lastTime = performance.now();
    accumulator = 0;
  }
});

// ─── Init ───────────────────────────────────────────────────────────
window.addEventListener("resize", onResize);
setupInput();
initWorld();

// Expose game state for debugging
window.game = game;

// Start the loop
requestAnimationFrame(gameLoop);
