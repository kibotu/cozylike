/**
 * render.js — Camera management and Canvas 2D drawing helpers.
 *
 * All visual rendering goes through this module. The camera follows the
 * player with smooth lerp and clamps to world bounds.
 */

import { getWorldPixelSize, getGrid, getTileSize, TILE, WORLD_W } from "./world.js";

/**
 * Creates a camera object that tracks the player.
 */
export function createCamera() {
  const cam = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    lerpFactor: 0.12,
  };

  cam.update = function (player, canvasW, canvasH) {
    // Target is player's world position centered on screen
    this.targetX = player.x - canvasW / 2;
    this.targetY = player.y - canvasH / 2;

    // Lerp toward target
    this.x += (this.targetX - this.x) * this.lerpFactor;
    this.y += (this.targetY - this.y) * this.lerpFactor;

    // Clamp to world bounds
    const world = getWorldPixelSize();
    this.x = Math.max(0, Math.min(world.w - canvasW, this.x));
    this.y = Math.max(0, Math.min(world.h - canvasH, this.y));
  };

  return cam;
}

/**
 * Draws the visible tile grid to the canvas.
 */
export function drawTiles(ctx, camera, canvasW, canvasH) {
  const tileSize = getTileSize();
  const grid = getGrid();
  const world = getWorldPixelSize();

  // Calculate visible tile range
  const startTileX = Math.floor(camera.x / tileSize);
  const startTileY = Math.floor(camera.y / tileSize);
  const endTileX = Math.ceil((camera.x + canvasW / devicePixelRatio) / tileSize);
  const endTileY = Math.ceil((camera.y + canvasH / devicePixelRatio) / tileSize);

  // Clamp to world bounds
  const sx = Math.max(0, startTileX);
  const sy = Math.max(0, startTileY);
  const ex = Math.min(world.w / tileSize, endTileX);
  const ey = Math.min(world.h / tileSize, endTileY);

  for (let y = sy; y < ey; y++) {
    for (let x = sx; x < ex; x++) {
      const tile = grid[y * WORLD_W + x];
      const px = x * tileSize - camera.x;
      const py = y * tileSize - camera.y;

      // Base tile color with subtle jitter
      const jitter = ((x * 31 + y * 17) % 7) - 3;
      drawTile(ctx, tile, px, py, jitter);
    }
  }
}

/**
 * Draws a single tile.
 */
function drawTile(ctx, type, x, y, jitter) {
  const tileSize = getTileSize();

  switch (type) {
    case TILE.GRASS:
      ctx.fillStyle = adjustColor("#5a7a4a", jitter);
      ctx.fillRect(x, y, tileSize, tileSize);
      // Tiny pebble
      if ((x + y) % 13 === 0) {
        ctx.fillStyle = "#6a8a5a";
        ctx.beginPath();
        ctx.arc(x + 16, y + 16, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;

    case TILE.PATH:
      ctx.fillStyle = "#8a9a6a";
      ctx.fillRect(x, y, tileSize, tileSize);
      break;

    case TILE.FLOWER:
      ctx.fillStyle = adjustColor("#5a7a4a", jitter);
      ctx.fillRect(x, y, tileSize, tileSize);
      // Flower petals
      const flowerColors = ["#c48a8a", "#d4a4a4", "#e4b4b4", "#f0d4d4"];
      ctx.fillStyle = flowerColors[(x * y) % flowerColors.length];
      ctx.beginPath();
      ctx.arc(x + 16, y + 16, 3, 0, Math.PI * 2);
      ctx.fill();
      break;

    case TILE.TREE:
      ctx.fillStyle = adjustColor("#5a7a4a", jitter);
      ctx.fillRect(x, y, tileSize, tileSize);
      // Tree trunk and canopy
      ctx.fillStyle = "#6a4a2a";
      ctx.beginPath();
      ctx.arc(x + 16, y + 20, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3a6a2a";
      ctx.beginPath();
      ctx.arc(x + 16, y + 14, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#4a7a3a";
      ctx.beginPath();
      ctx.arc(x + 14, y + 12, 8, 0, Math.PI * 2);
      ctx.fill();
      break;

    case TILE.ROCK:
      ctx.fillStyle = adjustColor("#5a7a4a", jitter);
      ctx.fillRect(x, y, tileSize, tileSize);
      // Rock
      ctx.fillStyle = "#6a6a6a";
      ctx.beginPath();
      ctx.ellipse(x + 16, y + 20, 10, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7a7a7a";
      ctx.beginPath();
      ctx.ellipse(x + 14, y + 18, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      break;

    case TILE.WATER:
      ctx.fillStyle = "#4a6a8a";
      ctx.fillRect(x, y, tileSize, tileSize);
      // Water shimmer
      const shimmer = Math.sin(Date.now() / 1000 + x + y) * 0.1;
      ctx.fillStyle = `rgba(100, 140, 180, ${0.3 + shimmer})`;
      ctx.fillRect(x + 8, y + 8, 16, 2);
      break;
  }
}

/**
 * Adjusts a hex color by a small jitter amount.
 */
function adjustColor(hex, jitter) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const jr = Math.max(0, Math.min(255, r + jitter));
  const jg = Math.max(0, Math.min(255, g + jitter * 0.7));
  const jb = Math.max(0, Math.min(255, b + jitter * 0.5));
  return `rgb(${jr | 0}, ${jg | 0}, ${jb | 0})`;
}

/**
 * Draws the player character.
 */
export function drawPlayer(ctx, player, camera) {
  const sx = player.x - camera.x;
  const sy = player.y - camera.y + player.breathOffset;

  ctx.save();

  // Drop shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
  ctx.beginPath();
  ctx.ellipse(sx, sy + 14, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  const bodyColor = player.iFrames > 0 ? "#aabbcc" : "#8ab48a";
  const flashColor = player.hitFlash > 0 ? "#cc8888" : null;
  ctx.fillStyle = flashColor || bodyColor;
  ctx.beginPath();
  ctx.arc(sx, sy, 12, 0, Math.PI * 2);
  ctx.fill();

  // Outline
  ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Eyes (face toward mouse)
  ctx.fillStyle = "#4a5a4a";
  const eyeOffsetX = Math.cos(player.aimAngle) * 3;
  const eyeOffsetY = Math.sin(player.aimAngle) * 3;
  ctx.beginPath();
  ctx.arc(sx + eyeOffsetX - 3, sy + eyeOffsetY - 2, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sx + eyeOffsetX + 3, sy + eyeOffsetY - 2, 2, 0, Math.PI * 2);
  ctx.fill();

// Sword visualization
  drawSword(ctx, player, sx, sy);

  // Attack animation
  drawAttackAnim(ctx, player, sx, sy);

  // Shield visualization
  drawShield(ctx, player, sx, sy);

  ctx.restore();
}

/**
 * Draws the sword held by the player.
 */
function drawSword(ctx, player, sx, sy) {
  const sword = player.sword;
  const angle = player.aimAngle;
  const len = sword.range * 0.5;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(angle);

  // Sword blade
  ctx.fillStyle = "#b8a898";
  ctx.beginPath();
  ctx.moveTo(12, -2);
  ctx.lineTo(12 + len, 0);
  ctx.lineTo(12, 2);
  ctx.closePath();
  ctx.fill();

  // Handle
  ctx.fillStyle = "#6a4a2a";
  ctx.fillRect(8, -3, 6, 6);

  ctx.restore();
}

/**
 * Draws the shield held by the player.
 */
function drawShield(ctx, player, sx, sy) {
  if (!player.shieldRaised) return;

  const angle = player.aimAngle;
  const halfArc = (player.shield.blockArc / 2) * (Math.PI / 180);

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(angle);

  // Shield arc indicator
  ctx.strokeStyle = player.stamina > 0 ? "rgba(140, 180, 220, 0.4)" : "rgba(140, 140, 140, 0.3)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 18, -halfArc, halfArc);
  ctx.stroke();

  // Shield body
  ctx.fillStyle = player.stamina > 0 ? "rgba(120, 160, 200, 0.5)" : "rgba(120, 120, 120, 0.3)";
  ctx.beginPath();
  ctx.arc(0, 0, 14, -halfArc, halfArc);
  ctx.fill();

  ctx.restore();
}

/**
 * Draws the sword swing arc animation.
 */
function drawAttackAnim(ctx, player, sx, sy) {
  if (player.attackAnimTimer <= 0) return;

  const progress = 1 - player.attackAnimTimer / 150; // 0 to 1
  const arcHalf = Math.PI / 4; // 45° half arc = 90° total
  const radius = player.sword.range;

  ctx.save();
  ctx.translate(sx, sy);

  const sweepAngle = player.attackAnimAngle - arcHalf + progress * arcHalf * 2;
  const startAngle = player.attackAnimAngle - arcHalf;

  // Glow
  ctx.shadowColor = "rgba(255, 255, 200, 0.8)";
  ctx.shadowBlur = 8;
  ctx.strokeStyle = "rgba(255, 255, 220, 0.8)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, radius, startAngle, sweepAngle);
  ctx.stroke();

  // Inner arc
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius, startAngle, sweepAngle);
  ctx.stroke();

  ctx.restore();
}

    /**
     * Draws an enemy.
     */
export function drawEnemy(ctx, enemy, camera) {
  if (enemy.dead) return;

  const sx = enemy.x - camera.x;
  const sy = enemy.y - camera.y + enemy.breathOffset;

  ctx.save();

  // Drop shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
  ctx.beginPath();
  ctx.ellipse(sx, sy + 12, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Color based on traits and state
  let baseColor, outlineColor;

  if (enemy.frozen) {
    baseColor = "#d4d4a0"; // pale yellow
    outlineColor = "#a0a060";
  } else if (enemy.slowed) {
    baseColor = "#8090c0"; // blue tint
    outlineColor = "#6070a0";
  } else if (enemy.kamikazeGlow) {
    baseColor = "#c06060"; // red glow
    outlineColor = "#a04040";
  } else if (enemy.hitFlash > 0) {
    baseColor = "#ffffff";
    outlineColor = "#dddddd";
  } else {
    // Trait-based colors
    if (enemy.isHighDamage) {
      baseColor = "#c08060"; // warm accent
      outlineColor = "#a06040";
    } else if (enemy.isFast) {
      baseColor = "#80a080";
      outlineColor = "#608060";
    } else {
      baseColor = "#90a080";
      outlineColor = "#708060";
    }
  }

  // Shape based on traits
  ctx.fillStyle = baseColor;
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 1.5;

  if (enemy.isFast) {
    // Elongated/streamlined
    ctx.beginPath();
    ctx.ellipse(sx, sy, 8, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (enemy.isHighDamage) {
    // Bulkier
    ctx.beginPath();
    ctx.arc(sx, sy, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (enemy.isCautious) {
    // Hunched posture (smaller, lower)
    ctx.beginPath();
    ctx.arc(sx, sy + 2, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    // Standard
    ctx.beginPath();
    ctx.arc(sx, sy, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // HP bar (shown only after first hit)
  if (enemy.hpBarShown && enemy.currentHp > 0) {
    const barWidth = 24;
    const barHeight = 3;
    const hpRatio = Math.max(0, enemy.currentHp / enemy.maxHp);
    const barX = sx - barWidth / 2;
    const barY = sy - 18;

    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(barX, barY, barWidth, barHeight);

    ctx.fillStyle = hpRatio > 0.5 ? "#6a9a5a" : hpRatio > 0.25 ? "#c0a040" : "#c06060";
    ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
  }

  ctx.restore();
}

/**
 * Draws a ground item.
 */
export function drawGroundItem(ctx, item, camera) {
  if (item.collected) return;

  const sx = item.x - camera.x;
  const sy = item.y - camera.y + Math.sin(Date.now() / 600) * 2; // 2px amplitude, 1.2s period

  ctx.save();

  // Drop shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
  ctx.beginPath();
  ctx.ellipse(sx, sy + 10, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  if (item.type === "heart") {
    // Heart pickup
    ctx.fillStyle = "#c48a8a";
    drawHeart(ctx, sx, sy, 8);
  } else if (item.type === "sword") {
    // Sword icon
    ctx.fillStyle = "#b8a898";
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(-Math.PI / 4);
    ctx.fillRect(-2, -10, 4, 20);
    ctx.fillStyle = "#6a4a2a";
    ctx.fillRect(-3, 4, 6, 4);
    ctx.restore();
  } else if (item.type === "shield") {
    // Shield icon
    ctx.fillStyle = "#8aa4c4";
    ctx.beginPath();
    ctx.arc(sx, sy - 4, 8, Math.PI, 0);
    ctx.lineTo(sx + 8, sy + 4);
    ctx.lineTo(sx - 8, sy + 4);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draws a heart shape.
 */
function drawHeart(ctx, x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.3);
  ctx.bezierCurveTo(x, y, x - size, y, x - size, y + size * 0.3);
  ctx.bezierCurveTo(x - size, y + size * 0.6, x, y + size * 0.8, x, y + size);
  ctx.bezierCurveTo(x, y + size * 0.8, x + size, y + size * 0.6, x + size, y + size * 0.3);
  ctx.bezierCurveTo(x + size, y, x, y, x, y + size * 0.3);
  ctx.fill();
}

/**
 * Draws the mouse reticle.
 */
export function drawReticle(ctx, mouseX, mouseY) {
  ctx.save();
  ctx.strokeStyle = "rgba(200, 200, 180, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(mouseX, mouseY, 10, 0, Math.PI * 2);
  ctx.stroke();

  // Crosshair
  ctx.beginPath();
  ctx.moveTo(mouseX - 4, mouseY);
  ctx.lineTo(mouseX - 2, mouseY);
  ctx.moveTo(mouseX + 2, mouseY);
  ctx.lineTo(mouseX + 4, mouseY);
  ctx.moveTo(mouseX, mouseY - 4);
  ctx.lineTo(mouseX, mouseY - 2);
  ctx.moveTo(mouseX, mouseY + 2);
  ctx.lineTo(mouseX, mouseY + 4);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draws hit effects (particles).
 */
export function drawHitEffects(ctx, effects, camera) {
  for (const effect of effects) {
    const sx = effect.x - camera.x;
    const sy = effect.y - camera.y;

    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - effect.life / effect.duration);

    if (effect.type === "leaf") {
      ctx.fillStyle = effect.color;
      for (const p of effect.particles) {
        const px = sx + p.vx * effect.life;
        const py = sy + p.vy * effect.life;
        ctx.beginPath();
        ctx.arc(px, py, p.size * (1 - effect.life / effect.duration * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (effect.type === "lifesteal") {
      ctx.fillStyle = "#80c060";
      const t = effect.life / effect.duration;
      ctx.beginPath();
      ctx.arc(sx, sy - 10 * t, 3 * (1 - t), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
