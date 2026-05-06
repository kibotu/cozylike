/**
 * ui.js — HUD rendering, item comparison tooltips, and game over overlay.
 */

import { getItemComparisonStats } from "./items.js";

const FONT = "system-ui, -apple-system, sans-serif";
const FONT_SIZE = 14;

/**
 * Draws the HUD (hearts, stamina bar, equipped items, kill counter).
 */
export function drawHUD(ctx, player, kills) {
  ctx.save();
  ctx.font = `${FONT_SIZE}px ${FONT}`;
  ctx.textBaseline = "top";

  // Hearts (top-left)
  drawHearts(ctx, player);

  // Stamina bar (below hearts)
  drawStaminaBar(ctx, player);

  // Equipped items (bottom-left)
  drawEquippedItems(ctx, player);

  // Kill counter (bottom-right)
  drawKillCounter(ctx, kills);

  ctx.restore();
}

/**
 * Draws the hearts row.
 */
function drawHearts(ctx, player) {
  const totalHearts = player.maxHp * 2; // half-hearts
  const heartSize = 14;
  const gap = 4;
  const startX = 12;
  const startY = 12;

  for (let i = 0; i < totalHearts; i++) {
    const x = startX + i * (heartSize + gap);
    const y = startY;
    const halfHeart = i < Math.floor(player.hp);
    const isHalfHeart = player.hp >= i + 0.5;

    ctx.fillStyle = halfHeart ? "#c48a8a" : "#4a4a4a";
    if (isHalfHeart) {
      // Half heart (left half filled)
      ctx.beginPath();
      ctx.moveTo(x + heartSize / 2, y + heartSize * 0.3);
      ctx.bezierCurveTo(x + heartSize / 2, y, x, y, x, y + heartSize * 0.3);
      ctx.bezierCurveTo(x, y + heartSize * 0.6, x + heartSize / 2, y + heartSize * 0.8, x + heartSize / 2, y + heartSize);
      ctx.bezierCurveTo(x + heartSize / 2, y + heartSize * 0.8, x + heartSize, y + heartSize * 0.6, x + heartSize, y + heartSize * 0.3);
      ctx.bezierCurveTo(x + heartSize, y, x + heartSize / 2, y, x + heartSize / 2, y + heartSize * 0.3);
      ctx.fill();

      // Fill the left half
      ctx.fillStyle = "#c48a8a";
      ctx.fillRect(x, y, heartSize / 2, heartSize);
    } else {
      // Empty heart
      ctx.fillStyle = "#4a4a4a";
      ctx.beginPath();
      ctx.moveTo(x + heartSize / 2, y + heartSize * 0.3);
      ctx.bezierCurveTo(x + heartSize / 2, y, x, y, x, y + heartSize * 0.3);
      ctx.bezierCurveTo(x, y + heartSize * 0.6, x + heartSize / 2, y + heartSize * 0.8, x + heartSize / 2, y + heartSize);
      ctx.bezierCurveTo(x + heartSize / 2, y + heartSize * 0.8, x + heartSize, y + heartSize * 0.6, x + heartSize, y + heartSize * 0.3);
      ctx.bezierCurveTo(x + heartSize, y, x + heartSize / 2, y, x + heartSize / 2, y + heartSize * 0.3);
      ctx.fill();
    }
  }
}

/**
 * Draws the stamina bar.
 */
function drawStaminaBar(ctx, player) {
  const barWidth = 120;
  const barHeight = 8;
  const x = 12;
  const y = 42;

  // Background
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.fillRect(x, y, barWidth, barHeight);

  // Fill
  const ratio = player.stamina / player.shield.maxStamina;
  const barColor = player.shieldBroken ? "#808080" : ratio > 0.3 ? "#8aa4c4" : "#c0a040";
  ctx.fillStyle = barColor;
  ctx.fillRect(x, y, barWidth * Math.max(0, ratio), barHeight);

  // Label
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.font = `${FONT_SIZE}px ${FONT}`;
  ctx.fillText("Shield", x + barWidth + 6, y - 1);
}

/**
 * Draws equipped item names (bottom-left).
 */
function drawEquippedItems(ctx, player) {
  const y = window.innerHeight - 40;

  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.font = `${FONT_SIZE}px ${FONT}`;
  ctx.fillText(`⚔ ${player.sword.name}`, 12, y);
  ctx.fillText(`🛡 ${player.shield.name}`, 12, y + 18);
}

/**
 * Draws the kill counter (bottom-right).
 */
function drawKillCounter(ctx, kills) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const x = w - 100;
  const y = h - 40;

  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.font = `${FONT_SIZE}px ${FONT}`;
  ctx.fillText(`Enemies: ${kills}`, x, y);
}

/**
 * Draws the item comparison tooltip.
 * Returns true if tooltip is active.
 */
export function drawTooltip(ctx, player, hoveredItem, mouseX, mouseY) {
  if (!hoveredItem) return false;

  const { item } = hoveredItem;
  const screenX = hoveredItem.screenX;
  const screenY = hoveredItem.screenY;

  const isEquipment = item.type === "sword" || item.type === "shield";

  ctx.save();

  // Prompt text for equipment items within 50px
  const dx = screenX - mouseX;
  const dy = screenY - mouseY;
  const hoverDist = Math.sqrt(dx * dx + dy * dy);

  if (isEquipment && hoverDist < 50) {
    ctx.fillStyle = "rgba(200, 180, 160, 0.7)";
    ctx.font = `${FONT_SIZE}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("hover to compare", screenX, screenY - 20);
    ctx.textAlign = "left";
  }

  // Tooltip box — only for equipment items (hearts auto-collect)
  if (!isEquipment) return true; // just show prompt, no comparison box

  const stats = getItemComparisonStats(item, player);
  const tooltipW = 200;
  const tooltipH = 50 + stats.length * 18 + 10; // header + 10px padding + 18px per stat
  const tooltipX = Math.min(screenX + 20, window.innerWidth - tooltipW - 10);
  const tooltipY = screenY - tooltipH / 2;

  // Background
  ctx.fillStyle = "rgba(30, 25, 20, 0.9)";
  ctx.strokeStyle = "rgba(200, 180, 160, 0.5)";
  ctx.lineWidth = 1;
  roundRect(ctx, tooltipX, tooltipY, tooltipW, tooltipH, 6);
  ctx.fill();
  ctx.stroke();

  // Header
  const icon = item.type === "sword" ? "⚔" : item.type === "shield" ? "🛡" : "♥";
  ctx.fillStyle = "#e0d0c0";
  ctx.font = `bold ${FONT_SIZE}px ${FONT}`;
  ctx.fillText(`${icon} ${item.name || "Half-heart"}`, tooltipX + 10, tooltipY + 16);

  // Stat comparison rows
  ctx.font = `${FONT_SIZE}px ${FONT}`;
  let y = tooltipY + 40;

  for (const stat of stats) {
    const label = stat.label;
    const groundVal = stat.ground;
    const equippedVal = stat.equipped;
    const diff = stat.diff;

    ctx.fillStyle = "#c0b0a0";
    ctx.fillText(label, tooltipX + 10, y);

    ctx.fillStyle = "#e0d0c0";
    ctx.fillText(`${groundVal}`, tooltipX + 10 + 80, y);

    ctx.fillStyle = "#807060";
    ctx.fillText("vs", tooltipX + 10 + 120, y);

    ctx.fillStyle = "#e0d0c0";
    ctx.fillText(`${equippedVal}`, tooltipX + 10 + 140, y);

    // Comparison indicator
    ctx.fillStyle = diff === 1 ? "#60a040" : diff === -1 ? "#c06060" : "#808080";
    ctx.fillText(diff === 1 ? "▲" : diff === -1 ? "▼" : "—", tooltipX + tooltipW - 20, y);

    y += 18;
  }

  ctx.restore();
  return true;
}

/**
 * Draws a rounded rectangle.
 */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Draws the game over overlay.
 */
export function drawGameOver(ctx, gameOverTime) {
  // Overlay fade
  ctx.fillStyle = "rgba(20, 15, 10, 0.7)";
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  // Text
  ctx.fillStyle = "rgba(200, 180, 160, 0.9)";
  ctx.font = "italic 28px Georgia, 'Times New Roman', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("you fell asleep…", window.innerWidth / 2, window.innerHeight / 2);

  // Restart prompt (after 400ms minimum delay)
  if (Date.now() - gameOverTime > 400) {
    ctx.font = `${FONT_SIZE}px ${FONT}`;
    ctx.fillStyle = "rgba(200, 180, 160, 0.5)";
    ctx.fillText("click or press any key to restart", window.innerWidth / 2, window.innerHeight / 2 + 40);
  }
}
